/** Chapter I: deterministic story state. No renderer, DOM, audio or wall-clock dependency. */
export const SAVE_VERSION = 2;
export const ORGAN_BPM = 72;
export const ORGAN_BEAT_SECONDS = 60 / ORGAN_BPM;
export const ORGAN_SEQUENCE = Object.freeze(['○', '△', null, '◇']);
export const ARCHIVE_DIALS = Object.freeze([Object.freeze(['○', '△', '□']), Object.freeze(['│', '×', '◇']), Object.freeze(['↑', '↓', '•'])]);
export const ARCHIVE_SOLUTION = Object.freeze([0, 1, 1]);
// Twelve seconds of room pre-roll reconcile the 35-second duration with the
// specified 19:30:47–19:31:10 recording. The church clock never follows this code.
export const TAPE_DURATION = 35;
export const TAPE_EVENTS = Object.freeze([
  { at: 12, id: 'room' }, { at: 17, id: 'cloth' }, { at: 21, id: 'cup' }, { at: 24, id: 'breath' }, { at: 25, id: 'silence' },
  { at: 29, id: 'terminalChime' }, { at: 31, id: 'colourLeak' },
  { at: 33, id: 'realityChair' }, { at: 35, id: 'complete' },
].map(Object.freeze));
// The real chronology has not been supplied. Do not invent a printed date.
export const PERFORMANCE_DATE = '06 · 02';
export const B18_PRINTED_DATE = null;
const SYMBOLS = ['○', '△', '◇'];
const finite = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, finite(v)));
const count = v => Math.floor(clamp(v, 0, 100000));
const yes = v => v === true;

export function createState() {
  return {
    version: SAVE_VERSION,
    curtainInspected: false, curtainReleased: false, curtainRaised: false, curtainOpened: false, curtainStage: 'latched',
    programmeCollected: false, patternRevealed: false,
    seatB17Inspected: false, seatB18Inspected: false, clockInspected: false,
    organSolved: false, sideRoomUnlocked: false, organFailures: 0,
    organPlaying: false, organElapsed: 0, organBeat: -1,
    organInputs: [null, null, null, null], organSilenceRemaining: 0,
    b17TicketCollected: false, b18TicketCollected: false, b18Altered: false,
    inspectedB18Date: false, inspectedSeatLedger: false,
    archiveInserted: null, archiveLampOn: false, archiveDials: [0, 0, 0], archiveDrawerSolved: false,
    tapeCollected: false, brassKeyCollected: false, upperDoorUnlocked: false,
    tapeInserted: false, tapePlaying: false, tapePosition: 0, tapeCompleted: false,
    tapePlayCount: 0, tapeReplayCount: 0, tapeEarlyStops: 0,
    tapeRunStarted: false, tapeRunInterrupted: false, firstTapeRunUnbroken: true,
    postExitReplayCount: 0, replaySearchRecorded: false, replayRestoreRecorded: false,
    playerWaitedThroughSilence: false, heardTerminalChime: false, heardRealityChairSound: false, tapeColourLeaked: false,
    exitUnlocked: false, exitOpened: false, corridorEntered: false, escaped: false, chapterComplete: false,
    floorStoneHeard: false, floorStoneInspected: false,
    routeBias: { restore: 0, search: 0, release: 0 },
  };
}

function normalize(raw, resume) {
  let d = raw;
  if (typeof d === 'string') {
    if (d.length > 20000) return createState();
    try { d = JSON.parse(d); } catch { return createState(); }
  }
  // Version 1 was a different three-note/mirror prototype; migrate to a clean
  // chapter, never reinterpret its keys or escaped flag as chapter progress.
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.version !== SAVE_VERSION) return createState();
  const s = createState();
  s.curtainInspected = yes(d.curtainInspected);
  s.curtainReleased = s.curtainInspected && yes(d.curtainReleased);
  s.curtainRaised = s.curtainReleased && (yes(d.curtainRaised) || yes(d.curtainOpened));
  s.curtainOpened = s.curtainRaised && yes(d.curtainOpened);
  s.curtainStage = s.curtainOpened ? 'secured' : s.curtainRaised ? 'raised' : s.curtainReleased ? 'released' : 'latched';
  s.programmeCollected = yes(d.programmeCollected);
  s.patternRevealed = s.programmeCollected && s.curtainOpened && yes(d.patternRevealed);
  for (const key of ['seatB17Inspected', 'seatB18Inspected', 'clockInspected']) s[key] = yes(d[key]);
  s.organSolved = s.patternRevealed && yes(d.organSolved);
  s.sideRoomUnlocked = s.organSolved && yes(d.sideRoomUnlocked);
  s.organFailures = s.patternRevealed ? count(d.organFailures) : 0;
  s.organPlaying = resume && s.patternRevealed && !s.organSolved && yes(d.organPlaying);
  s.organElapsed = s.organPlaying ? clamp(d.organElapsed, -.6, ORGAN_BEAT_SECONDS * 4) : 0;
  s.organBeat = s.organPlaying && s.organElapsed >= 0 ? Math.min(3, Math.floor((s.organElapsed + 1e-8) / ORGAN_BEAT_SECONDS)) : -1;
  if (s.organPlaying && Array.isArray(d.organInputs)) s.organInputs = Array.from({ length: 4 }, (_, i) => SYMBOLS.includes(d.organInputs[i]) ? d.organInputs[i] : null);
  s.organSilenceRemaining = s.organSolved && !s.sideRoomUnlocked ? Math.max(.001, clamp(d.organSilenceRemaining, 0, 2)) : 0;
  s.b17TicketCollected = s.sideRoomUnlocked && yes(d.b17TicketCollected);
  s.b18TicketCollected = s.sideRoomUnlocked && yes(d.b18TicketCollected);
  s.b18Altered = s.b18TicketCollected && yes(d.b18Altered);
  s.inspectedB18Date = B18_PRINTED_DATE !== null && s.b18TicketCollected && yes(d.inspectedB18Date);
  s.archiveDrawerSolved = (s.b17TicketCollected || s.b18Altered) && yes(d.archiveDrawerSolved);
  s.inspectedSeatLedger = s.archiveDrawerSolved && yes(d.inspectedSeatLedger);
  s.archiveInserted = resume && ((d.archiveInserted === 'B17' && s.b17TicketCollected) || (d.archiveInserted === 'B18' && s.b18TicketCollected)) ? d.archiveInserted : null;
  s.archiveLampOn = s.sideRoomUnlocked && yes(d.archiveLampOn);
  if (s.sideRoomUnlocked && Array.isArray(d.archiveDials)) s.archiveDials = Array.from({ length: 3 }, (_, i) => Number.isInteger(d.archiveDials[i]) && d.archiveDials[i] >= 0 && d.archiveDials[i] < 3 ? d.archiveDials[i] : 0);
  // Drawer contents are permanent. Reloading cannot lose either key item.
  s.tapeCollected = s.archiveDrawerSolved;
  s.brassKeyCollected = s.archiveDrawerSolved;
  s.upperDoorUnlocked = s.brassKeyCollected && yes(d.upperDoorUnlocked);
  s.tapeInserted = s.upperDoorUnlocked && yes(d.tapeInserted);
  s.tapeCompleted = s.upperDoorUnlocked && yes(d.tapeCompleted);
  s.tapePosition = s.upperDoorUnlocked ? clamp(d.tapePosition, 0, TAPE_DURATION) : 0;
  s.tapePlaying = resume && s.tapeInserted && s.tapePosition < TAPE_DURATION && yes(d.tapePlaying);
  s.tapePlayCount = s.upperDoorUnlocked ? count(d.tapePlayCount) : 0;
  s.tapeReplayCount = Math.max(0, s.tapePlayCount - 1);
  s.tapeEarlyStops = s.upperDoorUnlocked ? count(d.tapeEarlyStops) : 0;
  s.tapeRunStarted = s.tapePlayCount > 0 && yes(d.tapeRunStarted);
  s.tapeRunInterrupted = s.tapeRunStarted && yes(d.tapeRunInterrupted);
  s.firstTapeRunUnbroken = s.tapePlayCount <= 1 && s.tapeEarlyStops === 0 && d.firstTapeRunUnbroken !== false;
  s.postExitReplayCount = s.tapeCompleted ? Math.min(count(d.postExitReplayCount), s.tapeReplayCount) : 0;
  s.replaySearchRecorded = s.tapeReplayCount >= 3;
  s.replayRestoreRecorded = s.tapeCompleted && s.postExitReplayCount >= 3;
  s.playerWaitedThroughSilence = s.tapeCompleted && yes(d.playerWaitedThroughSilence);
  s.heardTerminalChime = s.upperDoorUnlocked && (s.tapeCompleted || yes(d.heardTerminalChime));
  s.heardRealityChairSound = s.upperDoorUnlocked && (s.tapeCompleted || yes(d.heardRealityChairSound));
  s.tapeColourLeaked = s.upperDoorUnlocked && (s.tapeCompleted || yes(d.tapeColourLeaked));
  s.exitUnlocked = s.tapeCompleted;
  s.exitOpened = s.exitUnlocked && yes(d.exitOpened);
  s.corridorEntered = s.exitOpened && yes(d.corridorEntered);
  s.escaped = s.corridorEntered && (yes(d.escaped) || yes(d.chapterComplete));
  s.chapterComplete = s.escaped;
  s.floorStoneHeard = s.tapeCompleted && yes(d.floorStoneHeard);
  s.floorStoneInspected = s.tapeCompleted && yes(d.floorStoneInspected);
  s.routeBias = {
    restore: Number(s.b18Altered) + Number(s.replayRestoreRecorded),
    search: Number(s.inspectedB18Date) + Number(s.inspectedSeatLedger) + Number(s.replaySearchRecorded),
    release: Number(s.playerWaitedThroughSilence),
  };
  return s;
}

/** Restore pauses transport and returns tickets; long silence can safely resume. */
export function restoreState(raw) { return normalize(raw, false); }
function stateOf(raw) { return normalize(raw, true); }
function view(s, kind = 'notice', title = '', text = '', extra = {}) {
  return { state: s, kind, title, text, changed: false, effects: [], ...extra };
}
function done(before, s, kind = 'notice', title = '', text = '', effects = [], extra = {}) {
  const state = stateOf(s);
  return view(state, kind, title, text, { changed: JSON.stringify(before) !== JSON.stringify(state), effects, ...extra });
}
function organView(s, extra = {}) { return view(s, 'organ', '', '', { choices: SYMBOLS.map(value => ({ value, label: value })), ...extra }); }
function archiveView(s, extra = {}) {
  const projection = s.archiveLampOn && (s.archiveInserted === 'B17' || (s.archiveInserted === 'B18' && s.b18Altered)) ? ['○', '×', '↓'] : null;
  return view(s, 'archive', '', '', { dials: ARCHIVE_DIALS, projection, ...extra });
}
function tapeView(s, extra = {}) { return view(s, 'tape', '19:31', s.tapeEarlyStops >= 3 && !s.tapeCompleted ? '卷盘还没停。' : '', extra); }
function interruptTape(s) {
  if (s.tapePlaying && s.tapePosition < TAPE_DURATION && !s.tapeRunInterrupted) {
    s.tapeEarlyStops += 1;
    s.tapeRunInterrupted = true;
    if (s.tapePlayCount === 1) s.firstTapeRunUnbroken = false;
  }
  s.tapePlaying = false;
}
function failOrgan(before, s) {
  s.organFailures += 1;
  s.organPlaying = true; s.organElapsed = -.6; s.organBeat = -1;
  s.organInputs = [null, null, null, null];
  const effects = [{ type: 'organFail' }];
  if (s.organFailures >= 2) effects.push({ type: 'organHint', level: Math.min(3, s.organFailures), beat: 2 });
  return done(before, s, 'organ', '', '', effects, { solved: false });
}

/** User actions and proximity triggers. Every gate is checked here, not in UI. */
export function act(raw, id, payload = {}) {
  const before = stateOf(raw), s = stateOf(raw);
  const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  if (s.escaped) return view(s, 'end', 'I. THE SILENT SANCTUARY', '无声之地');
  switch (id) {
    case 'curtain':
      s.curtainInspected = true;
      return done(before, s, 'curtain', '', s.curtainOpened ? '' : s.curtainReleased ? '绳子松开了。' : '绳子被固定扣压着。');
    case 'curtainRelease':
      if (!s.curtainInspected || s.curtainReleased) return act(s, 'curtain');
      s.curtainReleased = true;
      return done(before, s, 'curtain', '', '绳子松开了。', [{ type: 'curtainRelease' }]);
    case 'curtainPull':
      if (!s.curtainReleased) return view(s, 'curtain', '', '拉不动。');
      if (s.curtainOpened) return view(s, 'notice');
      s.curtainRaised = true;
      return done(before, s, 'curtain', '', '墙边有一个挂钩。', [{ type: 'curtainRaise' }]);
    case 'curtainSecure':
      if (!s.curtainRaised) return view(s, 'curtain', '', '绳子还够不到挂钩。');
      if (s.curtainOpened) return view(s, 'notice');
      s.curtainOpened = true;
      return done(before, s, 'notice', '', '', [{ type: 'curtainOpen' }]);
    case 'seatB17':
      s.seatB17Inspected = true;
      return done(before, s, 'notice', 'B17', '边缘有些磨损。');
    case 'seatB18':
      s.seatB18Inspected = true;
      return done(before, s, 'notice', 'B18', '坐垫很平整。');
    case 'clock':
      s.clockInspected = true;
      return done(before, s, 'notice', '19:31', '指针停着。');
    case 'programme':
      s.programmeCollected = true;
      return done(before, s, 'programme', 'PROGRAMME', '折过很多次。', before.programmeCollected ? [] : [{ type: 'paper' }]);
    case 'window':
      if (!s.curtainOpened) return act(s, 'curtain');
      if (!s.programmeCollected) return view(s, 'notice', '', '微光穿过玻璃。');
      s.patternRevealed = true;
      return done(before, s, 'pattern', '', '', [], { pattern: [...ORGAN_SEQUENCE] });
    case 'organ':
      if (s.organSolved) return view(s, 'notice');
      if (!s.patternRevealed) return view(s, 'notice', '', '琴盖上有四个位置。');
      return organView(s);
    case 'organStart':
      if (!s.patternRevealed || s.organSolved) return act(s, 'organ');
      s.organPlaying = true; s.organElapsed = 0; s.organBeat = 0; s.organInputs = [null, null, null, null];
      return done(before, s, 'organ', '', '', [{ type: 'organBeat', beat: 0 }]);
    case 'organInput': {
      if (!s.organPlaying || s.organElapsed < 0 || !SYMBOLS.includes(p.symbol)) return organView(s);
      const beat = s.organBeat;
      if (ORGAN_SEQUENCE[beat] !== p.symbol || s.organInputs[beat] !== null) return failOrgan(before, s);
      s.organInputs[beat] = p.symbol;
      return done(before, s, 'organ', '', '', [{ type: 'organNote', symbol: p.symbol, beat }]);
    }
    case 'organStop':
      s.organPlaying = false; s.organElapsed = 0; s.organBeat = -1; s.organInputs = [null, null, null, null];
      return done(before, s, 'notice');
    case 'sideRoom':
      return view(s, 'notice', '', s.sideRoomUnlocked ? '' : '门把手没有转动。');
    case 'b17Ticket':
    case 'b18Ticket': {
      if (!s.sideRoomUnlocked) return act(s, 'sideRoom');
      const b17 = id === 'b17Ticket';
      s[b17 ? 'b17TicketCollected' : 'b18TicketCollected'] = true;
      return done(before, s, 'ticket', b17 ? 'B17' : 'B18', b17 ? '纸已经有些软了。' : '很平整。', [], { ticket: b17 ? 'B17' : 'B18' });
    }
    case 'flipB18':
      if (!s.b18TicketCollected) return view(s);
      s.inspectedB18Date = B18_PRINTED_DATE !== null;
      return done(before, s, 'ticketBack', 'B18', '', [], { printedDate: B18_PRINTED_DATE });
    case 'archive':
      if (!s.sideRoomUnlocked) return act(s, 'sideRoom');
      return archiveView(s);
    case 'ticketInsert':
      if (!s.sideRoomUnlocked || !['B17', 'B18'].includes(p.ticket) || !s[p.ticket === 'B17' ? 'b17TicketCollected' : 'b18TicketCollected']) return act(s, 'archive');
      s.archiveInserted = p.ticket;
      return { ...done(before, s, 'archive', '', '', [{ type: 'ticketInsert' }]), projection: archiveView(s).projection, dials: ARCHIVE_DIALS };
    case 'ticketEject':
      s.archiveInserted = null;
      return done(before, s, 'archive');
    case 'archiveLamp':
      if (!s.sideRoomUnlocked) return act(s, 'sideRoom');
      s.archiveLampOn = !s.archiveLampOn;
      return { ...done(before, s, 'archive', '', '', [{ type: 'archiveLamp' }]), projection: archiveView(s).projection, dials: ARCHIVE_DIALS };
    case 'archiveTurn':
      if (!s.sideRoomUnlocked || !Number.isInteger(p.index) || p.index < 0 || p.index > 2 || !Number.isInteger(p.value) || p.value < 0 || p.value > 2) return act(s, 'archive');
      s.archiveDials[p.index] = p.value;
      return done(before, s, 'archive', '', '', [{ type: 'archiveTurn' }]);
    case 'punchB18':
      if (s.archiveInserted !== 'B18' || s.b18Altered) return act(s, 'archive');
      s.b18Altered = true;
      return { ...done(before, s, 'archive', '', '', [{ type: 'punch' }]), projection: archiveView(s).projection, dials: ARCHIVE_DIALS };
    case 'archiveCheck':
      if (s.archiveDrawerSolved) return archiveView(s);
      if (!s.archiveLampOn || !(s.archiveInserted === 'B17' || (s.archiveInserted === 'B18' && s.b18Altered)) || !ARCHIVE_SOLUTION.every((v, i) => s.archiveDials[i] === v)) return view(s, 'archive', '', '', { solved: false, effects: [{ type: 'archiveClick' }] });
      s.archiveDrawerSolved = true; s.tapeCollected = true; s.brassKeyCollected = true;
      return done(before, s, 'drawer', '', '', [{ type: 'archiveSolved' }], { solved: true });
    case 'seatLedger':
      if (!s.archiveDrawerSolved) return act(s, 'archive');
      s.inspectedSeatLedger = true;
      return done(before, s, 'ledger', 'SEATING / STORAGE RECORD', '');
    case 'upperDoor':
      if (!s.brassKeyCollected) return view(s, 'notice', '', '钥匙孔很小。');
      s.upperDoorUnlocked = true;
      return done(before, s, 'notice', '', '', before.upperDoorUnlocked ? [] : [{ type: 'upperDoorUnlock' }]);
    case 'tapePlayer':
      if (!s.upperDoorUnlocked) return act(s, 'upperDoor');
      return tapeView(s);
    case 'tapeInsert':
      if (!s.upperDoorUnlocked || !s.tapeCollected) return act(s, 'tapePlayer');
      s.tapeInserted = true;
      return done(before, s, 'tape', '19:31', '', [{ type: 'tapeInsert' }]);
    case 'tapePlay':
      if (!s.tapeInserted) return tapeView(s);
      if (s.tapePlaying) return tapeView(s);
      if (s.tapePosition >= TAPE_DURATION) { s.tapePosition = 0; s.tapeRunStarted = false; }
      if (!s.tapeRunStarted) {
        s.tapePlayCount += 1; s.tapeRunStarted = true; s.tapeRunInterrupted = false;
        if (s.exitUnlocked) s.postExitReplayCount += 1;
      }
      s.tapePlaying = true;
      return done(before, s, 'tape', '19:31', '', [{ type: 'tapePlay', position: s.tapePosition }]);
    case 'tapeStop': {
      const wasPlaying = s.tapePlaying;
      interruptTape(s);
      return done(before, s, 'tape', '19:31', '', wasPlaying ? [{ type: 'tapeStop', inertia: s.tapeEarlyStops >= 2 }] : []);
    }
    case 'tapeRewind':
      if (!s.tapeInserted) return tapeView(s);
      interruptTape(s); s.tapePosition = 0; s.tapeRunStarted = false; s.tapeRunInterrupted = false;
      return done(before, s, 'tape', '19:31', '', [{ type: 'tapeRewind' }]);
    case 'tapeEject':
      if (!s.tapeInserted) return tapeView(s);
      interruptTape(s); s.tapeInserted = false;
      return done(before, s, 'tape', '19:31', '', [{ type: 'tapeEject' }]);
    case 'stoneNear':
      if (!s.tapeCompleted || s.floorStoneHeard) return view(s);
      s.floorStoneHeard = true;
      return done(before, s, 'notice', '', '', [{ type: 'floorStoneKnock' }]);
    case 'stone':
      if (!s.tapeCompleted) return view(s);
      s.floorStoneInspected = true;
      return done(before, s, 'stone', '', '很冷。', [], { marking: s.inspectedSeatLedger ? 'B18' : null });
    case 'exit':
      if (!s.exitUnlocked) return view(s, 'notice', '', '门轻轻震了一下。', { effects: [{ type: 'exitRattle' }] });
      s.exitOpened = true;
      return done(before, s, 'notice', '', '', before.exitOpened ? [] : [{ type: 'exitOpen' }, { type: 'terminalChime', distant: true }]);
    case 'corridorEnter':
      if (!s.exitOpened || s.corridorEntered) return view(s);
      s.corridorEntered = true;
      return done(before, s, 'notice', '', '', [{ type: 'corridorEnter' }]);
    case 'corridorEnd':
      if (!s.corridorEntered) return view(s);
      s.escaped = true;
      return done(before, s, 'end', 'I. THE SILENT SANCTUARY', '无声之地', [{ type: 'chapterEnd' }]);
    default: return view(s);
  }
}

/** Advance visible beats. A rest is proven by the elapsed beat, not a rest button. */
export function tickOrgan(raw, dt) {
  const before = stateOf(raw), s = stateOf(raw);
  if (!(finite(dt) > 0)) return view(s);
  const seconds = clamp(dt, 0, 1);
  if (s.organSolved && !s.sideRoomUnlocked) {
    s.organSilenceRemaining = Math.max(0, s.organSilenceRemaining - seconds);
    if (s.organSilenceRemaining <= 1e-8) {
      s.sideRoomUnlocked = true; s.organSilenceRemaining = 0;
      return done(before, s, 'notice', '', '', [{ type: 'sideRoomUnlock' }, { type: 'colourLeak', where: 'window', duration: .7 }, { type: 'b18Cloth' }]);
    }
    return done(before, s);
  }
  if (!s.organPlaying || s.organSolved) return view(s);
  const oldElapsed = s.organElapsed;
  const end = oldElapsed + seconds;
  const effects = [];
  if (oldElapsed < 0 && end >= 0) effects.push({ type: 'organBeat', beat: 0 });
  for (let beat = 0; beat < 4; beat += 1) {
    const boundary = ORGAN_BEAT_SECONDS * (beat + 1);
    if (oldElapsed < boundary && end + 1e-8 >= boundary) {
      if (s.organInputs[beat] !== ORGAN_SEQUENCE[beat]) return failOrgan(before, s);
      if (beat === 3) {
        s.organSolved = true; s.organPlaying = false; s.organBeat = -1; s.organElapsed = 0;
        s.organSilenceRemaining = 2;
        return done(before, s, 'notice', '', '', [...effects, { type: 'organSolved' }], { solved: true });
      }
      effects.push({ type: 'organBeat', beat: beat + 1 });
    }
  }
  s.organElapsed = end; s.organBeat = end < 0 ? -1 : Math.min(3, Math.floor((end + 1e-8) / ORGAN_BEAT_SECONDS));
  return done(before, s, 'organ', '', '', effects);
}

/** Each event crosses its time threshold once per pass, even with dropped frames. */
export function tickTape(raw, dt) {
  const before = stateOf(raw), s = stateOf(raw);
  if (!s.tapePlaying || !(finite(dt) > 0)) return view(s);
  const previous = s.tapePosition;
  s.tapePosition = Math.min(TAPE_DURATION, previous + clamp(dt, 0, 1));
  const effects = [];
  for (const event of TAPE_EVENTS) {
    if (previous < event.at && s.tapePosition + 1e-8 >= event.at) {
      if (event.id === 'terminalChime') s.heardTerminalChime = true;
      if (event.id === 'realityChair') s.heardRealityChairSound = true;
      if (event.id === 'complete') {
        const firstCompletion = !s.tapeCompleted;
        s.tapePlaying = false; s.tapeCompleted = true; s.exitUnlocked = true;
        if (firstCompletion && s.tapePlayCount === 1 && s.firstTapeRunUnbroken) s.playerWaitedThroughSilence = true;
        effects.push({ type: 'tapeComplete' });
        if (firstCompletion) effects.push({ type: 'exitUnlock' });
      } else if (event.id === 'colourLeak') {
        // This is the chapter's second and final colour leak, never repeat it.
        if (!s.tapeColourLeaked) { s.tapeColourLeaked = true; effects.push({ type: 'colourLeak', where: 'smallWindow', duration: 1 }); }
      } else effects.push({ type: event.id, source: 'tape' });
    }
  }
  return done(before, s, 'tape', '19:31', '', effects);
}

export function getTapeTimecode(raw) {
  const position = typeof raw === 'number' ? raw : stateOf(raw).tapePosition;
  const seconds = 19 * 3600 + 30 * 60 + 35 + Math.floor(clamp(position, 0, TAPE_DURATION));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, '0')).join(':');
}
export function getObjective(raw) {
  const s = stateOf(raw);
  if (s.escaped) return '无声之地';
  if (s.exitOpened) return '门外还有一段路。';
  return '找到离开教堂的方法。';
}
export function getHint(raw) {
  const s = stateOf(raw);
  if (s.escaped || s.exitUnlocked) return '';
  if (!s.curtainOpened) return '窗帘的绳子没有垂下来。';
  if (!s.programmeCollected) return '座位下面有一角纸。';
  if (!s.patternRevealed) return '夹层的纸很薄。';
  if (!s.organSolved) return '有一个位置始终没有颜色。';
  if (!s.archiveDrawerSolved) return '光能穿过已有的孔。';
  if (!s.upperDoorUnlocked) return '黄铜钥匙很窄。';
  return '卷盘还在转。';
}
export function getInventory(raw) {
  const s = stateOf(raw), items = [];
  if (s.programmeCollected) items.push({ id: 'programme', name: '节目单', description: '折过很多次。' });
  if (s.b17TicketCollected) items.push({ id: 'b17Ticket', name: 'B17', description: '纸已经有些软了。' });
  if (s.b18TicketCollected) items.push({ id: 'b18Ticket', name: 'B18', description: '很平整。' });
  if (s.tapeCollected) items.push({ id: 'tape', name: '19:31', description: '19:31。' });
  if (s.brassKeyCollected) items.push({ id: 'brassKey', name: '黄铜钥匙', description: '一把很窄的钥匙。' });
  return items;
}
export function getJournal(raw) {
  const s = stateOf(raw), entries = [];
  if (s.programmeCollected) entries.push({ title: 'PROGRAMME', text: 'LUDOVICO EINAUDI\n[Track]\n[Track]\nExperience\n[Track]\n[Track]' });
  if (s.patternRevealed) entries.push({ title: '描图纸', text: '○　△　_　◇' });
  if (s.clockInspected) entries.push({ title: '19:31', text: '指针停着。' });
  if (s.b17TicketCollected) entries.push({ title: 'B17', text: '纸已经有些软了。' });
  if (s.b18TicketCollected) entries.push({ title: 'B18', text: '很平整。' });
  if (s.inspectedSeatLedger) entries.push({ title: 'SEATING / STORAGE RECORD', text: Array.from({ length: 30 }, (_, i) => `B${String(i + 1).padStart(2, '0')}${({ 2: '   MOVED', 8: '   STORAGE', 20: '   REPLACED' })[i] || ''}`).join('\n') });
  if (s.floorStoneInspected) entries.push({ title: '石板', text: '很冷。' });
  return entries;
}
