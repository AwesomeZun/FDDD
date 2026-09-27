# Full FlyWire API (implementation in progress)

`import { FlightExperiment, type FlightFrame, type FlightMode } from './lib/flight.ts'`

- `const engine = new FlightExperiment(seed)` creates actual 139255-cell worker; `await engine.init()` waits for gzip graph/identity loading. No 80-node fallback.
- `await engine.stepAsync(dt, candidateIndex, targetIndex, mode)` advances full LIF graph and returns frame. At most one outstanding step. UI should use awaited loop / ~20Hz, not queue promises every RAF.
- `engine.subscribe(frame => ...)` subscribes actual computed frames, returns unsubscribe.
- Compatibility `engine.step(...)` requests one async step if idle and returns most recent frame, initially action `LOADING FULL CONNECTOME`. Existing sync UI can keep using it. No fake full graph count before ready.
- `engine.reset(seed)` resets worker and body; pending old frames ignored. `engine.dispose()` terminates. Pause by not calling step; worker has NO autonomous timer.
- Modes: baseline, disconnected (no synaptic propagation), silenced (no sensor injection; residual activity decays). No direct input-to-motion bypass.
- Existing FlightFrame fields retained. Added `neuronCount`, `edgeCount`, `spikeCount`, `activeNeuronCount`, `traversedEdges`, `computeMs`, `tick`, `ready`, `error?`, `dynamicsLabel`, `activity` (full sorted 139255 float state), `fireState` (full Uint8), `displayedNeuronCount`.
- `output` is engineered signed 3-axis motor readout from downstream cells, never raw sensory. `activity` full-neuron array is unsuitable for old 80-node MaleCNS BrainScene. Use new scene below.

`import { FlyWireBrainScene } from './components/FlyWireBrainScene.tsx'`
`<FlyWireBrainScene frame={frame} />` renders same-source FAFB position samples (explicit count) and full-worker activity. Component can accept `className`. Do not claim anatomical MaleCNS atlas or 139255 displayed points if decimated.

UI required labels: simulated 139255 / edges2698236 only when ready; actual per-step spike count and computeMs; “Engineered sensory encoder + downstream motor decoder; calibrated demonstration gain, not drug physiology”; “FlyWire CC BY-NC4.0, noncommercial research demo; commercial clearance not granted.” Controls pause by stopping step requests. Existing layout/ CSS/LabScene remains UI agent-owned.

## Implementation complete / handoff

Files implemented: `src/lib/flight.ts`, `public/engine/flywire/{core,worker}.js`, `src/components/FlyWireBrainScene.tsx`, data/identity/display assets under `public/data/flywire`, actual worker harness and flight test.

`rootIds`, `originalToSorted`, `sortedToOriginal` are public fields after init. `rootIds[sortedToOriginal[sortedIndex]]` returns exact string root ID without unsafe JS integer conversion. Render sample includes sortedIndex and original index.

Control semantics (supersedes initial sketch): switching **into** disconnected or silenced clears electrical state and decoder history to give clean intervention onset; it does not reset simulation tick or position. Disconnected still injects sensory signals but disables all edges. Silenced disables injection and recurrence. Output always comes from measured worker spikes through the identical decoder, never an independent forced motor command. Passive velocity decays by drag. This is an electrical control, not a drug dose.

Important UI integration: replace legacy BrainScene with FlyWireBrainScene. Other legacy `Experiment`/MaleCNS assay exports are not rewritten by this engine-owned change and must NOT be presented as the live full-FAFB run. When exporting flight data, export actual subscribed frames plus full-graph provenance instead.

The timestep is one abstract LIF tick per requested step; dt controls passive body integration. There is no biological-time equivalence claim. Pause stops requests. One request can already be in flight when pause is pressed; ignore its body presentation or await it before declaring settled pause. The worker never starts a background tick loop.
