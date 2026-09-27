# FDDD · Continuous molecular habitat

A local, continuously running 3D research demo: four fly avatars explore eight real executed protein–ligand combinations while four MaleCNS v1.0 selected brain+VNC models keep computing. It does not stop after inspecting a batch.

## Run

Node22+ recommended (verified Node26).

```sh
npm install
npm run build
npm run serve
```

Open http://localhost:5177/. The page starts the colony automatically after data/engine initialization. No public deployment.

## Current screen

- One shared rotatable/zoomable/pannable3D world; actual protein C-alpha ribbons and actual Vina pose coordinates. These are experimental structures, not AlphaFold predictions. A selected complex can be opened in Mol* for detailed inspection.
-3 distinct proteins: human PARP1/4R6E, human factorXa/2P16, mouse COX-2/3LN1.6 distinct molecules,8 executed combinations. Same ligand across targets is not a new chemical identity.
-4 simple refined insect silhouettes with cyan/orange/violet/lime accents, smooth3-axis flight, real position trails and an illustrative proboscis response. Surface-orbit steering keeps flies around structures rather than buried inside them.
-Two large neural panels on each side. Each independent CNS model computes167122 included neurons and6241236 graph edges (>=5 synapses).28195 measured anatomical samples are drawn per CNS, with actual computed activity/spike flashes. Spatial color is a visualization palette, not a cell-type classifier.
-Reward ON learns a per-fly candidate preference after contact using executed Vina scores as an external reward. Initial exploration covers unseen combinations before softmax revisits. Reward OFF freezes preferences; flight and neural computation continue.
-The controller receives score-free molecular/target-ID/position cues. Neural motor outputs affect motion. Preference learning, steering and food response are engineered adapters, NOT native synaptic plasticity, validated feeding physiology, blind binding discovery, or a drug-efficacy test.
-Raw cross-target Vina scores are not calibrated affinities. Stronger learned reward increases expected preference, not a guarantee that each short trajectory ranks every combination correctly. Residence is measured geometrically at the nearest complex within2 world units, not copied from scores.

## Full-cell records

Every computed CNS step stores167122 spike flags losslessly (20891bytes), along with pair identity, sensory inputs, mode, time and sampled flight position/velocity/preference. Membrane voltages are not retained. IndexedDB segments rotate at1024 frames to bound JavaScript memory; disk history is not silently deleted. Export pauses and saves each current-session segment with full neuron-ID mappings ONLY through the local server into PROJECT/public/data/records/. No browser Downloads, anchors or download fallback. A failed server save is reported explicitly and retains all IndexedDB chunks for retry. Resume afterward.

Continuous recording consumes tens ofMB per minute of raw spike storage. Pause stops computation/motion. Storage failure visibly pauses and retains pending records rather than dropping them; do not reload after such an error before export/retry succeeds.

## Verification and reproduction

```sh
npm test
node scripts/docking/run-all.mjs
# Additional docking job commands: docs/multi-target-docking.md
node scripts/docking/build-multi-target.mjs
```

25 tests passed. Actual full-graph review checked4800 complete spike frames, distinct electrical states,3-axis movement, score-only perturbation invariance and selected-worker silencing. A separately labeled motor-replay test checks long-horizon policy learning/freeze; it is NOT additional neural simulation. See docs/continuous-review.md, docs/continuous-colony.md, docs/habitat-qa.md and docs/multi-target-docking.md.

The earlier DOCKSTRING PARP1 surrogate, its training data/weights and6144-frame training spike archive remain bundled as separate reproducible work. It is not the current multi-target candidate-policy model; no transfer-performance claim is made.

## Brain plus ventral nerve cord

MaleCNS v1.0 publicly includes a connected brain and ventral nerve cord from one male specimen. Current runtime uses the selected MaleCNS brain+VNC graph. Different specimens must not be appended and presented as a measured single CNS. See docs/cns-data-scope.md.

## Licenses

Preserve LICENSE, THIRD_PARTY_NOTICES.md and bundled dataset/tool notices. Current bundled FlyWire provenance is retained conservatively for noncommercial use; original EM and connectivity releases must not have their licenses conflated. The MaleCNS selected brain+VNC backend is bundled under CC BY4.0 data terms; archived FlyWire files keep their original notices. Mol*MIT; Vina/Webina notices preserved. User-provided images/video are references, not reusable stock art.

Built with [fly-connectome-template](https://github.com/cobanov/fly-connectome-template) by [Mert Cobanov](https://github.com/cobanov).

## Current runtime: MaleCNS v1.0
The latest default is now MaleCNS brain+VNC, superseding older FlyWire runtime descriptions above. Actual built population167122 neurons;6241236 edges with>=5 synapses, from official v1.0 tables. Full source-selection counts and license: public/data/malecns/manifest.json and NOTICE.md. Computation/recording cover all included neurons, display samples28195 measured soma positions. See docs/malecns-migration.md for backup restore and modeling limits. Existing FlyWire-trained surrogate remains archived and is NOT a validated MaleCNS predictor.

## Project-only output and selection limits
All generated outputs remain in this project. Backup tar and checksum: `backups/flywire-before-malecns/`; prior browser-generated files were moved into its `browser-downloads/` subfolder. New release packages go in `releases/`. Never use browser Downloads or session artifact folders.

167122 is an expanded model population:165122 Traced plus2000 selected null-status rows,1991 explicitly Out of scope (1982R1-R6 and9ol_intrinsic),9 unlabeled. It is not the official traced count or a full unfiltered graph. See `docs/malecns-selection-audit.json`. MaleCNS >=5synapse threshold is not strictly identical to prior FlyWire retained weights (28462 prior edges have magnitude<5).

## Public build
Static deployment notes (Vercel, drug.flybrain.kr, device-adaptive colony size, 500 MB recording cap, pruned data): see docs/public-deploy.md.
