# Vesper sanctuary — architectural and lighting notes

This is an original game environment interpreted from the four supplied reference images. It is not a measured survey or a claim of historical reconstruction. The photographs establish the broad rectangular nave, two longitudinal galleries, round-headed high windows, flat decorated ceiling, transverse beams with curved support brackets, fluted Corinthian pilasters at the front wall, central wooden cross, and dark timber pews. The room therefore follows a classical chapel vocabulary rather than a Gothic cathedral.

## Research

- [Kensington United Reformed Church — official site](https://www.kensingtonurc.org.uk/): confirms the church is in Allen Street, Kensington.
- [Kensington United Reformed Church — venue hire](https://www.kensingtonurc.org.uk/room-hire/): describes a sanctuary and gallery, with a 260 m² ground floor and 65 m² gallery. These figures were contextual references, not a dimension source for the game.

The darker, neglected condition is fictional. The supernatural objects, adjustable mirror, journal, score and escape mechanism are invented game props. No claim is made about the real congregation or building's present condition.

## Art direction

- Weathered plaster is tinted toward the user's reference colors `#4E315A` and `#A89AB5` with charcoal violet shadows and restrained grey-violet daylight.
- Upper right-hand windows form the principal light source, with an angled highlight directed toward the wooden cross.
- Transparent fading light ribbons provide the visible shafts; drifting point sprites suggest airborne dust.
- Candles provide small warm contrast points rather than washing the room in orange.
- Pews have shaped end panels, a rolled top rail, raised inset back panels, hymn-book racks and kneelers.
- The organ console includes ranked pipes, two manuals, stop knobs, a score, carved case and bench.
- Window profiles, galleries, capital leaf clusters, cornice dentils, ceiling coffers, radiators, mouldings and floor grain provide close-range detail.

## Technical notes

The environment is real-time Three.js geometry. All texture canvases are generated deterministically in the browser; no external material downloads are required. Repeated ornaments and furniture components are GPU-instanced by material and geometry. One directional light renders shadows; secondary sources provide diffuse fill and small candle pools. The estimated coordinate envelope is 18 × 32 × 13 metres. Collision boxes keep the central and lateral aisles traversable.

Use `buildChurch(scene)` from `church.js`. Returned values include `colliders`, `bounds`, `world`, `update(dt, timeSeconds)`, `door`, `journal`, `organ`, `mirror`, `altar`, `key`, `setMirror(angleDegrees)`, `setBeamAligned(boolean)` and `setEscaped(boolean)`. Aligning the puzzle adds a separate narrow reflection from the mirror toward the cross and a small light over the revealed key. Architectural daylight remains visible throughout.
