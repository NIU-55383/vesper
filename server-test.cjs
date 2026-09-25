'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./server.js');

let root;
let server;
let port;
const html = '<!doctype html><title>Vesper test</title>';
const model = Buffer.from('glTF-0123456789-model-payload');

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vesper-http-test-'));
  const fixtureFiles = {
    'vesper.html': html,
    'avatar-data.js': 'globalThis.AvatarData = {};',
    'game-ui.css': 'body{color:white}',
    'vesper/review.html': '<!doctype html><title>Model review</title>',
    'vesper/main.js': 'export const title = "Vesper";',
    'vesper/puzzle.mjs': 'export const puzzle = true;',
    'vesper/vendor/three.module.js': 'export const REVISION = "test";',
    'vesper/assets/nailong.glb': model,
    'vesper/assets/preview.jpg': Buffer.from([255, 216, 255, 217]),
    'vesper/assets/walk.mp4': Buffer.from('test video data'),
    'vesper/puzzle.test.mjs': 'not public',
    'vesper/assets/private.json': '{"not":"public"}',
    '.git/config': 'not public',
    'server.js': 'not public',
    'package.json': 'not public',
    'render.yaml': 'not public',
    'README.md': 'not public',
  };
  for (const [name, contents] of Object.entries(fixtureFiles)) {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  }
  server = createServer({ root });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
});

after(async () => {
  if (server) {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
  if (root) await fs.rm(root, { recursive: true, force: true });
});

function request(target, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method, headers }, res => {
      const chunks = [];
      res.on('data', data => chunks.push(data));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('root and direct game URLs serve the standalone Vesper page', async () => {
  for (const url of ['/', '/index.html', '/vesper.html', '/vesper.html?model=1&revision=6.1']) {
    const response = await request(url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers['content-type'], /^text\/html/);
    assert.equal(response.body.toString(), html);
  }
});

test('health check works for GET and HEAD; unsupported methods are rejected', async () => {
  assert.equal((await request('/healthz')).body.toString(), 'ok\n');
  const head = await request('/healthz', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  const post = await request('/vesper.html', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('browser modules, shared UI and media use useful content types', async () => {
  for (const [url, expected] of [
    ['/avatar-data.js', 'text/javascript'],
    ['/game-ui.css', 'text/css'],
    ['/vesper/main.js', 'text/javascript'],
    ['/vesper/review.html', 'text/html'],
    ['/vesper/puzzle.mjs', 'text/javascript'],
    ['/vesper/vendor/three.module.js', 'text/javascript'],
    ['/vesper/assets/nailong.glb', 'model/gltf-binary'],
    ['/vesper/assets/preview.jpg', 'image/jpeg'],
    ['/vesper/assets/walk.mp4', 'video/mp4'],
  ]) {
    const response = await request(url);
    assert.equal(response.status, 200, url);
    assert.ok(response.headers['content-type'].startsWith(expected), url);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  }
});

test('HEAD, byte ranges and cache revalidation preserve asset metadata', async () => {
  const full = await request('/vesper/assets/nailong.glb');
  const head = await request('/vesper/assets/nailong.glb', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers['content-length']), model.length);
  assert.equal(head.body.length, 0);
  for (const [value, start, end] of [
    ['bytes=0-3', 0, 3], ['bytes=5-', 5, model.length - 1],
    ['bytes=-4', model.length - 4, model.length - 1],
  ]) {
    const response = await request('/vesper/assets/nailong.glb', { headers: { Range: value } });
    assert.equal(response.status, 206);
    assert.deepEqual(response.body, model.subarray(start, end + 1));
    assert.equal(response.headers['content-range'], 'bytes ' + start + '-' + end + '/' + model.length);
  }
  const unchanged = await request('/vesper/assets/nailong.glb', { headers: { 'If-None-Match': full.headers.etag } });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body.length, 0);
  const changed = await request('/vesper/assets/nailong.glb', { headers: { Range: 'bytes=0-3', 'If-Range': '"old"' } });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.body, model);
  const invalid = await request('/vesper/assets/nailong.glb', { headers: { Range: 'bytes=999999-' } });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers['content-range'], 'bytes */' + model.length);
});

test('server never serves repository internals, tests or path traversal', async () => {
  const paths = [
    '/.git/config', '/server.js', '/server-test.cjs', '/package.json', '/render.yaml', '/README.md',
    '/vesper/puzzle.test.mjs', '/vesper/browser-test.cjs', '/vesper/assets/private.json',
    '/vesper/assets/../main.js', '/vesper/assets/%2e%2e/main.js',
    '/vesper/assets/%252e%252e/main.js', '/vesper/assets/..%5cmain.js',
    '/vesper/assets/%00nailong.glb', '/vesper/assets/%zz.glb',
    '/vesper/assets/', '/missing.html', '/catan.html', '//server.js',
  ];
  for (const target of paths) {
    const response = await request(target);
    assert.equal(response.status, 404, target);
    assert.equal(response.body.toString(), 'Not found\n', target);
  }
});
