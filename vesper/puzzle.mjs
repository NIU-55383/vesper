/** Deterministic, DOM-free story state for Vesper / 薄暮礼拜堂. */
export const SAVE_VERSION = 1;
export const NOTE_SEQUENCE = Object.freeze(['E', 'G', 'C']);
export const MIRROR_ANGLE = 60;
const NOTES = Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const SOLFEGE = Object.freeze(['do', 're', 'mi', 'fa', 'sol', 'la', 'si']);
const ANGLES = Object.freeze([30, 60, 90]);

export function createState() {
  return {
    version: SAVE_VERSION,
    journalRead: false,
    organSolved: false,
    lensInstalled: false,
    mirrorAngle: null,
    beamAligned: false,
    keyTaken: false,
    escaped: false,
  };
}

/** Accept only this chapter's known fields; discard malformed or impossible progress. */
export function restoreState(raw) {
  let data = raw;
  if (typeof data === 'string') {
    if (data.length > 8192) return createState();
    try { data = JSON.parse(data); } catch { return createState(); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== SAVE_VERSION) {
    return createState();
  }
  const state = createState();
  state.journalRead = data.journalRead === true;
  state.organSolved = state.journalRead && data.organSolved === true;
  state.lensInstalled = state.organSolved && data.lensInstalled === true;
  state.mirrorAngle = state.lensInstalled && ANGLES.includes(data.mirrorAngle) ? data.mirrorAngle : null;
  state.beamAligned = state.lensInstalled && state.mirrorAngle === MIRROR_ANGLE && data.beamAligned === true;
  state.keyTaken = state.beamAligned && data.keyTaken === true;
  state.escaped = state.keyTaken && data.escaped === true;
  return state;
}

function result(state, kind, title, text, extra = {}) {
  return { state, kind, title, text, changed: false, ...extra };
}
function noteChoices() {
  return NOTES.map((value, index) => ({ value, label: `${value} · ${SOLFEGE[index]}` }));
}
function mirrorChoices() {
  return ANGLES.map(value => ({ value, label: `${value}°` }));
}
function organView(state, text, extra = {}) {
  return result(state, 'organ', '沉默的管风琴', text, { choices: noteChoices(), ...extra });
}
function mirrorView(state, text, extra = {}) {
  return result(state, 'mirror', '窗下的黄铜反光器', text, { choices: mirrorChoices(), ...extra });
}
function finished(state) {
  return result(state, 'win', '奶龙胜利 / Nailong wins', '门缝里终于吹进了风。奶龙带着礼拜堂的最后一束光，走回薄暮。');
}

/** IDs: journal, organ, mirror (also reflector), altar, exit. */
export function interact(raw, id) {
  const state = restoreState(raw);
  if (state.escaped && id !== 'journal') return finished(state);
  switch (id) {
    case 'journal':
      return result({ ...state, journalRead: true }, 'journal', '守堂人的手记',
        '“先让沉默唱出三声：mi、sol、do。琴键旁的字母是 E、G、C，依此顺序弹奏。”\n\n“把琴中藏着的黄铜透镜带到右侧窗下。反光器的刻度要停在六十度（60°），让侧窗的微光落在十字架上。”\n\n“光会唤醒祭坛。拿到旧钥匙，再回到身后的正门。”',
        { changed: !state.journalRead });
    case 'organ':
      if (state.organSolved) return result(state, 'notice', '旋律已被记起', '机关已经打开。带着黄铜透镜去右侧窗下的反光器。');
      if (!state.journalRead) return result(state, 'notice', '琴谱被撕走了', '琴盖里留下一行小字：“入口左侧的守堂人手记，记得这段旋律。”先去找到它。');
      return organView(state, '依次弹奏手记里的三个音。音符会显示在下方；随时可以清空重试。');
    case 'mirror':
    case 'reflector':
      if (!state.organSolved) return result(state, 'notice', '缺失的透镜', '黄铜支架上有一道圆形空槽。守堂人的手记提到：那枚透镜藏在管风琴里。');
      if (state.beamAligned) return result(state, 'notice', '光已落在十字架上', '反光器锁定在 60°。尘埃沿着光路缓缓浮动，祭坛内传来了轻响。');
      return mirrorView({ ...state, lensInstalled: true },
        state.lensInstalled ? '转动反光器的黄铜刻度。手记里写着正确的角度。' : '你把黄铜透镜嵌进空槽。侧窗的微光聚成了一束。转动刻度，让它落向十字架。',
        { changed: !state.lensInstalled });
    case 'altar':
      if (state.keyTaken) return result(state, 'notice', '空下来的暗格', '旧钥匙已经在你手中。沿着中间的过道回到入口，打开正门。');
      if (!state.beamAligned) return result(state, 'notice', '没有影子的十字架', '石台上刻着：“当窗的光触到十字，沉睡的锁舌便会退让。”去右侧窗下调整反光器。');
      return result({ ...state, keyTaken: true }, 'success', '获得 · 旧钥匙', '十字架的影子落在石台细缝上。暗格松开了，里面躺着一把旧钥匙。现在可以回到入口。', { changed: true, item: 'key' });
    case 'exit':
      if (!state.keyTaken) return result(state, 'notice', '紧锁的正门', '奶龙推了推沉重的木门。锁还扣着，需要一把旧钥匙。入口左侧似乎留着一本手记。');
      return { ...finished({ ...state, escaped: true }), changed: true };
    default:
      return result(state, 'notice', '一切都很安静', '走近有标记的物件，按 E 查看。');
  }
}

/** Submit a complete three-note sequence; bad input never consumes an item. */
export function playNotes(raw, notes) {
  const state = restoreState(raw);
  if (state.escaped) return finished(state);
  if (state.organSolved || !state.journalRead) return interact(state, 'organ');
  if (!Array.isArray(notes) || notes.length !== 3 || !notes.every(note => NOTES.includes(note))) {
    return organView(state, '需要依次弹奏三个音。请使用琴键上的 C、D、E、F、G、A、B。', { solved: false });
  }
  if (!NOTE_SEQUENCE.every((note, index) => notes[index] === note)) {
    return organView(state, '音符在高处散去了，机关没有回应。手记里的顺序是 mi → sol → do；可以清空后再试。', { solved: false });
  }
  return result({ ...state, organSolved: true }, 'success', '获得 · 黄铜透镜',
    '最后一个音沉入木地板，琴侧的抽屉缓缓弹开。里面的黄铜透镜仍有一点温度。把它带到右侧窗下的反光器。',
    { changed: true, solved: true, item: 'lens' });
}

/** Lens installation happens at interact('mirror'); alignment is latched after solving. */
export function alignMirror(raw, value) {
  const state = restoreState(raw);
  if (state.escaped) return finished(state);
  if (!state.organSolved || state.beamAligned) return interact(state, 'mirror');
  if (!state.lensInstalled) return result(state, 'notice', '先安装透镜', '走近右侧窗下的反光器，按 E 将黄铜透镜嵌入空槽。');
  if (!ANGLES.includes(value)) return mirrorView(state, '请选择反光器上实际刻出的角度：30°、60° 或 90°。', { solved: false });
  if (value !== MIRROR_ANGLE) {
    return mirrorView({ ...state, mirrorAngle: value },
      value === 30 ? '光束停在十字架下方。手记里记下的是六十度，继续调整。' : '光束越过十字架，消失在檐线上。手记里记下的是六十度，继续调整。',
      { changed: state.mirrorAngle !== value, solved: false });
  }
  return result({ ...state, mirrorAngle: MIRROR_ANGLE, beamAligned: true }, 'success', '第二道机关 · 光的归处',
    '苍白的日光斜穿窗格，照亮了十字架。空气中的尘埃像悬停的雪。祭坛里传来一声轻响——去看看那道石缝。',
    { changed: true, solved: true });
}

export function getObjective(raw) {
  const state = restoreState(raw);
  if (state.escaped) return '奶龙已逃出礼拜堂';
  if (state.keyTaken) return '03 / 用旧钥匙打开入口正门';
  if (state.beamAligned) return '03 / 查看十字架下的祭坛';
  if (state.lensInstalled) return '02 / 调整反光器，让光照向十字架';
  if (state.organSolved) return '02 / 将黄铜透镜放入右侧窗下的反光器';
  if (state.journalRead) return '01 / 在管风琴上重现三音旋律';
  return '01 / 寻找入口左侧的守堂人手记';
}

export function getHint(raw) {
  const state = restoreState(raw);
  if (state.escaped) return '门已经打开。这一章完成了。';
  if (state.keyTaken) return '转身沿中央过道回到来时的双扇木门，靠近后按 E。';
  if (state.beamAligned) return '走到礼拜堂最前方，十字架正下方的石台就是祭坛。按 E 取出钥匙。';
  if (state.lensInstalled) return '守堂人写得很清楚：反光器停在 60°。靠近反光器按 E，然后选择 60°。';
  if (state.organSolved) return '面向十字架时，反光器在右侧的高窗下。靠近后按 E 安装透镜。';
  if (state.journalRead) return '管风琴在十字架左侧。靠近按 E，依次弹奏 E（mi）→ G（sol）→ C（do）。';
  return '从起点向左侧走。守堂人的手记放在入口左侧的小桌上，靠近按 E。';
}

export function getInventory(raw) {
  const state = restoreState(raw);
  const items = [];
  if (state.journalRead) items.push({ id: 'journal', name: '守堂人手记', description: 'E → G → C；反光器 60°；光照十字，祭坛藏钥。' });
  if (state.organSolved && !state.lensInstalled) items.push({ id: 'lens', name: '黄铜透镜', description: '从管风琴里找到。适配右侧窗下反光器的圆形空槽。' });
  if (state.keyTaken) items.push({ id: 'key', name: '旧钥匙', description: '祭坛暗格里的钥匙，可以开启入口正门。' });
  return items;
}

export function getJournal(raw) {
  const state = restoreState(raw);
  const entries = [{ title: '薄暮礼拜堂', text: '门在身后关上了。找回旋律，让侧窗的光照向十字架，寻找离开的钥匙。' }];
  if (state.journalRead) entries.push({ title: '守堂人的笔记', text: '管风琴的旋律：mi → sol → do，即 E → G → C。窗下反光器的角度：60°。光落在十字架上后，查看祭坛。' });
  if (state.organSolved) entries.push({ title: '琴里的黄铜透镜', text: state.lensInstalled ? '透镜已安装在右侧窗下的反光器里。' : '从管风琴暗格里取出了透镜，把它装到右侧窗下。' });
  if (state.beamAligned) entries.push({ title: '光的归处', text: '反光器已锁定在 60°。日光照亮十字架，祭坛传来了响动。' });
  if (state.keyTaken) entries.push({ title: '门的另一边', text: '旧钥匙已经找到，回入口开门。' });
  if (state.escaped) entries.push({ title: '奶龙胜利 / Nailong wins', text: '奶龙推开了沉重的木门，走回薄暮。' });
  return entries;
}
