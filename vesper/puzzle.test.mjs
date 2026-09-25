import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, restoreState, interact, playNotes, alignMirror,
  getObjective, getHint, getInventory, getJournal,
} from './puzzle.mjs';

function readJournal() { return interact(createState(), 'journal').state; }
function solveOrgan() { return playNotes(readJournal(), ['E', 'G', 'C']).state; }
function installLens() { return interact(solveOrgan(), 'mirror').state; }
function solveMirror() { return alignMirror(installLens(), 60).state; }
function getKey() { return interact(solveMirror(), 'altar').state; }

test('a full playthrough reads clues, plays music, redirects light and unlocks the exit', () => {
  const start = createState();
  assert.match(getObjective(start), /手记/);
  const journal = interact(start, 'journal');
  assert.equal(journal.kind, 'journal');
  assert.match(journal.text, /E、G、C/);
  assert.match(journal.text, /60°/);
  const organ = playNotes(journal.state, ['E', 'G', 'C']);
  assert.equal(organ.solved, true);
  assert.deepEqual(getInventory(organ.state).map(item => item.id), ['journal', 'lens']);
  const mirror = interact(organ.state, 'mirror');
  assert.equal(mirror.kind, 'mirror');
  assert.equal(mirror.state.lensInstalled, true);
  assert.equal(getInventory(mirror.state).some(item => item.id === 'lens'), false);
  const beam = alignMirror(mirror.state, 60);
  assert.equal(beam.state.beamAligned, true);
  const altar = interact(beam.state, 'altar');
  assert.equal(altar.item, 'key');
  const exit = interact(altar.state, 'exit');
  assert.equal(exit.kind, 'win');
  assert.equal(exit.state.escaped, true);
  assert.match(exit.title, /奶龙胜利/);
  assert.match(exit.title, /Nailong wins/);
});

test('wrong or malformed notes preserve progress and remain retryable', () => {
  const state = readJournal();
  for (const notes of [['C', 'G', 'E'], ['E'], ['E', 'G', 'C', 'C'], ['e', 'g', 'c'], null, 'EGC', ['E', {}, 'C']]) {
    const response = playNotes(state, notes);
    assert.equal(response.kind, 'organ');
    assert.equal(response.solved, false);
    assert.deepEqual(response.state, state);
    assert.equal(response.choices.length, 7);
  }
  assert.equal(playNotes(state, ['E', 'G', 'C']).state.organSolved, true);
});

test('items and chapter gates cannot be skipped', () => {
  const start = createState();
  assert.deepEqual(playNotes(start, ['E', 'G', 'C']).state, start);
  assert.deepEqual(interact(start, 'mirror').state, start);
  assert.deepEqual(alignMirror(start, 60).state, start);
  assert.deepEqual(interact(start, 'altar').state, start);
  assert.deepEqual(interact(start, 'exit').state, start);
  const organ = solveOrgan();
  assert.equal(alignMirror(organ, 60).state.lensInstalled, false);
  assert.equal(interact(organ, 'altar').state.keyTaken, false);
  assert.equal(interact(solveMirror(), 'exit').state.escaped, false);
});

test('wrong mirror choices can be retried and do not consume the mounted lens', () => {
  const initial = installLens();
  const wrong = alignMirror(initial, 30);
  assert.equal(wrong.kind, 'mirror');
  assert.equal(wrong.state.mirrorAngle, 30);
  assert.equal(wrong.state.lensInstalled, true);
  assert.equal(wrong.state.beamAligned, false);
  assert.equal(interact(wrong.state, 'altar').state.keyTaken, false);
  for (const value of ['60', 61, undefined, NaN, Infinity]) {
    assert.deepEqual(alignMirror(wrong.state, value).state, wrong.state);
  }
  assert.equal(alignMirror(wrong.state, 60).state.beamAligned, true);
});

test('solved actions are idempotent and cannot break a later puzzle', () => {
  const solved = solveMirror();
  assert.deepEqual(alignMirror(solved, 90).state, solved);
  assert.deepEqual(playNotes(solved, ['C', 'C', 'C']).state, solved);
  assert.deepEqual(interact(solved, 'mirror').state, solved);
  const keyed = getKey();
  assert.equal(interact(keyed, 'altar').changed, false);
  assert.deepEqual(interact(keyed, 'altar').state, keyed);
  const escaped = interact(keyed, 'exit').state;
  assert.deepEqual(interact(escaped, 'exit').state, escaped);
  assert.equal(interact(escaped, 'exit').changed, false);
  assert.deepEqual(interact(escaped, 'journal').state, escaped);
});

test('every valid stage round-trips through a JSON save', () => {
  const stages = [createState(), readJournal(), solveOrgan(), installLens(), solveMirror(), getKey(), interact(getKey(), 'exit').state];
  for (const state of stages) assert.deepEqual(restoreState(JSON.stringify(state)), state);
});

test('invalid saves cannot inject types, unrelated data or inconsistent progress', () => {
  for (const value of [null, undefined, '', '{', 'null', 'true', '[]', [], 1, {}, { version: 2 }, ' '.repeat(8193)]) {
    assert.deepEqual(restoreState(value), createState());
  }
  assert.deepEqual(restoreState({ version: 1, journalRead: 'true', organSolved: true, keyTaken: true, escaped: true, extra: '<script>' }), createState());
  const inconsistent = restoreState({ ...createState(), journalRead: true, beamAligned: true, keyTaken: true, escaped: true, mirrorAngle: 60 });
  assert.deepEqual(inconsistent, readJournal());
  const missingAngle = restoreState({ ...solveMirror(), mirrorAngle: 90, keyTaken: true, escaped: true });
  assert.equal(missingAngle.lensInstalled, true);
  assert.equal(missingAngle.beamAligned, false);
  assert.equal(missingAngle.keyTaken, false);
  assert.equal(alignMirror(missingAngle, 60).state.beamAligned, true);
  const parsed = restoreState('{"version":1,"journalRead":true,"__proto__":{"polluted":true}}');
  assert.deepEqual(parsed, readJournal());
  assert.equal({}.polluted, undefined);
});

test('actions do not mutate frozen caller state or note arrays', () => {
  const state = Object.freeze(readJournal());
  const notes = Object.freeze(['E', 'G', 'C']);
  playNotes(state, notes);
  interact(state, 'journal');
  interact(state, 'exit');
  assert.deepEqual(state, readJournal());
  const installed = Object.freeze(installLens());
  alignMirror(installed, 90);
  assert.deepEqual(installed, installLens());
});

test('hints, objectives and journals are available at every stage without revealing unearned items', () => {
  const stages = [createState(), readJournal(), solveOrgan(), installLens(), solveMirror(), getKey(), interact(getKey(), 'exit').state];
  for (const state of stages) {
    assert.ok(getObjective(state).length > 0);
    assert.ok(getHint(state).length > 0);
    assert.ok(getJournal(state).every(entry => entry.title && entry.text));
  }
  assert.deepEqual(getInventory(createState()), []);
  assert.equal(getJournal(createState()).length, 1);
  assert.equal(getInventory(getKey()).filter(item => item.id === 'key').length, 1);
  assert.match(getHint(installLens()), /60°/);
});
