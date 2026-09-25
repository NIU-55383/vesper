'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pipeline } = require('node:stream');

const ROOT_FILES = new Set([
  'vesper.html', 'avatar-data.js', 'social-data.js', 'game-audio.js',
  'game-ui.js', 'game-ui.css', 'ui-symbols.svg',
]);
const GAME_FILES = new Set([
  'main.js', 'church.js', 'character.js', 'character-extremities.js',
  'sculpt-union.js', 'puzzle.mjs', 'style.css', 'review.html',
]);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/vnd.microsoft.icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};
const ASSET_EXTENSIONS = new Set([
  '.glb', '.gltf', '.bin', '.jpg', '.jpeg', '.png', '.webp', '.avif',
  '.svg', '.ico', '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.woff2',
]);

function publicFile(requestTarget) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestTarget.split('?')[0]);
  } catch {
    return null;
  }
  if (!pathname.startsWith('/') || /[\\:%\u0000-\u001f\u007f]/.test(pathname)) return null;
  const parts = pathname.slice(1).split('/');
  if (parts.some(part => part === '.' || part === '..' || part.startsWith('.'))) return null;
  if (pathname === '/' || pathname === '/index.html') return 'vesper.html';
  const relative = pathname.slice(1);
  if (ROOT_FILES.has(relative)) return relative;
  if (parts.length === 2 && parts[0] === 'vesper' && GAME_FILES.has(parts[1])) return relative;
  if (parts[0] !== 'vesper' || parts.length < 3 || parts.some(part => !part)) return null;
  const extension = path.extname(relative).toLowerCase();
  if (parts[1] === 'vendor' && extension === '.js') return relative;
  if (parts[1] === 'assets' && ASSET_EXTENSIONS.has(extension)) return relative;
  return null;
}

function byteRange(value, length) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || length === 0) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, length - suffix);
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : length - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= length || end < start) return null;
    end = Math.min(end, length - 1);
  }
  return { start, end };
}

function sendText(req, res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function createServer({ root = __dirname } = {}) {
  const rootPath = fs.realpathSync(root);
  const rootPrefix = rootPath + path.sep;
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(req, res, 405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
      return;
    }
    if ((req.url || '').split('?')[0] === '/healthz') {
      sendText(req, res, 200, 'ok\n');
      return;
    }
    const relative = publicFile(req.url || '');
    if (!relative) {
      sendText(req, res, 404, 'Not found\n');
      return;
    }
    try {
      const filePath = await fsp.realpath(path.join(rootPath, relative));
      if (!filePath.startsWith(rootPrefix)) {
        sendText(req, res, 404, 'Not found\n');
        return;
      }
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        sendText(req, res, 404, 'Not found\n');
        return;
      }
      const etag = '"' + stat.size.toString(16) + '-' + Math.trunc(stat.mtimeMs).toString(16) + '"';
      const modified = stat.mtime.toUTCString();
      const headers = {
        'Content-Type': TYPES[path.extname(relative).toLowerCase()],
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Accept-Ranges': 'bytes',
        'Last-Modified': modified,
        ETag: etag,
      };
      if ((req.headers['if-none-match'] || '').split(/\s*,\s*/).includes(etag)
          || req.headers['if-none-match'] === '*') {
        delete headers['Content-Length'];
        res.writeHead(304, headers);
        res.end();
        return;
      }
      const rangeHeader = req.headers.range;
      const ifRange = req.headers['if-range'];
      const shouldRange = rangeHeader && (!ifRange || ifRange === etag || ifRange === modified);
      const range = shouldRange ? byteRange(rangeHeader, stat.size) : undefined;
      if (shouldRange && !range) {
        sendText(req, res, 416, 'Requested range not satisfiable\n', { 'Content-Range': 'bytes */' + stat.size });
        return;
      }
      if (range) {
        headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + stat.size;
        headers['Content-Length'] = range.end - range.start + 1;
      }
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      pipeline(fs.createReadStream(filePath, range || {}), res, error => {
        if (error && !res.destroyed) res.destroy(error);
      });
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error);
      } else {
        sendText(req, res, error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500,
          error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Not found\n' : 'Unable to serve file\n');
      }
    }
  });
}

if (require.main === module) {
  const rawPort = process.env.PORT || '18760';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer between 1 and 65535.');
    process.exitCode = 1;
  } else {
    const host = process.env.LOCAL_ONLY === '1' ? '127.0.0.1' : '0.0.0.0';
    const server = createServer();
    server.on('error', error => {
      console.error('Unable to start Vesper:', error.message);
      process.exitCode = 1;
    });
    server.listen(port, host, () => {
      console.log('Vesper listening at http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port);
    });
    const shutdown = () => {
      server.close(() => { process.exitCode = 0; });
      server.closeIdleConnections();
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }
}

module.exports = { createServer };
