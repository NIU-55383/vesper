# Vesper project

- The only active source for Vesper is this repository: C:/Users/牛特/Documents/GitHub/vesper.
- Make all future Vesper character, church, puzzle, UI, asset, test and deployment updates here.
- Never add Vesper entries, files or dependencies to holdem-table-online. This game is deployed independently.
- Preserve the existing GitHub remote NIU-55383/vesper. Do not commit, push, publish or change Render services unless the user asks; the user uploads/deploys.
- Keep runtime resources self-contained. The UI helper files here are local copies; do not read them from a sibling checkout or depend on its server.
- Serve the game at / and /vesper.html. Honor Render PORT and bind to 0.0.0.0 unless LOCAL_ONLY=1.
- Keep all models, images, audio/video and local Three.js files included in this repository. Do not replace real geometry with flat images.
- Preserve the approved church while changing the character unless requested otherwise.
- Run npm test for server/puzzle changes and the relevant browser or model checks for affected behavior. Update exported character assets when modifying the sculpt or animation.
