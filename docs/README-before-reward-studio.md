# FDDD / Molecular Field

Original interactive molecular-exploration scene with a live, full FlyWire LIF circuit. This is a noncommercial research platform prototype, not a drug discovery or docking result.

## Run

Node22+: npm ci, npm run dev (http://127.0.0.1:5173/). npm test and npm run build. Native build dependencies use WASM overrides for this environment.

## What actually runs

139,255 neuron states updated every step; 2,698,236 bundled weighted directed pairs available for spike-driven propagation. Actual outgoing edges of fired neurons are traversed, not all edges redundantly every step. Source snedea/flybrain commit9191824d17871b7851645782d53d23f213ddb938. Browser worker owns the graph and transfers typed state arrays without serializing JS arrays. Display samples19,894 same-source representative positions, explicitly not139,255 rendered points. No80-cell fallback. Legacy80-cell utilities/tests remain but are not the active engine.

Engineered sensory channels enter sensory cells; only downstream neuronal firing supplies motor commands. Authored turn/lift/thrust decoder and passive reflecting boundaries produce visible continuous flight. Silence removes sensory/recurrent drive and motor drive; remaining body velocity decays. Demo LIF calibration weight×80, threshold.35, leak.90 is NOT fitted physiology. Protein/ligand shapes and candidate descriptors are synthetic illustrations. No direct hardcoded food steering from upstream.

## Interaction

Starts live after loading. Choose candidate/target, compare Baseline/Disconnect/Silence, pause/reset and export actual compact JSON flight records. No192-step stop.

## Verification

7 automated tests pass including full worker IDs/counts, spike accounting, reset, controls and sustained body movement after boundaries. Aside browser verified live139255 graph, moving fly, candidate change, Silence reducing spikes to0/speed~0 then baseline restoring flight. See docs/full-engine-integration-results.md and docs/full-flywire-browser-qa.md.

## Licenses / attribution

FlyWire data CC BY-NC4.0: noncommercial research/demo only, commercial clearance not granted. MIT engine changes retain upstream notice in public/engine/flywire. Flybody anatomy Apache2.0. Original visual scene designed for this project; reference images are not redistributable application assets.

Built with [fly-connectome-template](https://github.com/cobanov/fly-connectome-template) by [Mert Cobanov](https://github.com/cobanov). Preserve LICENSE (Cobanov Template Attribution License1.0), THIRD_PARTY_NOTICES.md and public notices. Substantial modifications made for this platform.

Chat6Pro final planning remained blocked by workspace quota; do not attribute this implementation to a completed6Pro strategy. Implementation and revisions used Astra/Aside workflow.

## Four-fly colony update

Live scene now uses four original stylized, smooth pastel avatars (Amber/Azure/Lilac/Sage), not anatomical Flybody meshes. Each has an independent full139255-neuron/2698236-edge worker state, using the same measured anatomical graph. Each of four brain portraits displays19894 representative points driven by that worker's own activity. Candidate fixtures are assigned successively from the selected fixture index. Click a brain portrait to select a fly; Silence/Disconnect affects only that fly while the other three continue. Pause and Reset apply to the colony. Export records include each fly's inputs assignment, mode, outputs, position, spike count and timing.

Original source behavior map and proposed drug-research framing are in docs/original-behavior-map.md. The10 upstream behavior policies have NOT all been ported; the current colony uses our engineered flight decoder. Protein/ligand visuals are illustrative, not a binding assay. Added actual4-worker independence and selected-only silencing test; total8 tests pass.
