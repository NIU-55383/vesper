# Chapter I original sound assets

All WAVs are original deterministic procedural synthesis, mono 22,050 Hz / 16-bit PCM. They contain no borrowed recordings, spoken dialogue, or quoted musical composition. `pianoLast.wav` is one isolated synthesized note; it is not an excerpt from Experience.

`terminalChime.wav` and `realityChair.wav` are stable reusable narrative resources. Future scenes should reference these exact files. `realityChair.wav` is a synthetic wood-chair scrape prototype, not a field recording; it can later be replaced by a commissioned or authorized recording under the same resource ID.

Regenerate with `python generate.py` (NumPy required). `manifest.json` records duration, peak, RMS, file size and SHA-256 of every file.

## Runtime contract

`createChapterAudio(controller)` uses the existing audio controller's `muted`, `volume` and `unlock()` without changing stored preferences. It creates its Web Audio context only on `unlock()`, then loads at most one file at a time. Missing sound files are silent and do not stop story progression.

Methods: `unlock()`, `sync({hidden, paused})`, `play(id, {volume, rate, pan})`, `tickTape(position, playing)`, `stopAll()`, `dispose()`.

Call `sync` when mute, volume, app visibility or story pause changes. Browser `visibilitychange` also stops sound immediately. No missed story cues are queued or replayed after loading, muting, resuming or returning from the background.

IDs: `terminalChime`, `realityChair`, `paper`, `cloth`, `latch`, `cup`, `stone`, `breath`, `tapeStart`, `tapeStop`, `curtain`, `door`, `footstep`, `organFail`, `organCircle`, `organTriangle`, `organDiamond`, `pianoLast`.

Aliases: `organ○` / `○`, `organ△` / `△`, `organ◇` / `◇`; `chair`, `lock`, `step`, `piano`, `floorStone` (a quiet low knock). `tapeMotor` is managed only by `tickTape`. Up to eight short sources can overlap, footsteps have a 120 ms minimum interval, and inputs are bounded.

## Tape timeline integration

Story code dispatches events, not the sound module: room foley in the opening 12 seconds; breath at 24; piano's final tone at 25; terminal chime at 29; color-only flash at 31; exact reusable chair file at 33; tape end and latch at 35. `tickTape` only maintains a very quiet mechanical motor loop before 25 seconds. From 25 seconds onward the motor is silent, while the story's visible reels/timecode continue. This preserves the intended silence without imposing any hearing requirement.

The final piano has a naturally decaying tail. For the music-puzzle success sequence, begin the two seconds of quiet after the last note's tail, then play `latch`; do not use a celebratory success sound.

