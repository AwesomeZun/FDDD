# Full FAFB engine integration results

Implemented 2026-09-14. Main/CSS/LabScene left to UI owner. Audit-only scope has been superseded by implementation.

## What now computes

Full 139,255-cell, 2,698,236-edge supplied graph, hash `fbf8d440ca1207c7573e1acdd2366f9d0beb9b533c1710f21681264f81b1cc49`. Every cell is decayed and thresholded each step. Every outgoing edge of every previously fired cell is traversed in baseline mode. No graph truncation, group gating, tiny fallback or visual-only cell count. Neurons with no outgoing spike do not require edge multiplication.

Worker is a modified MIT upstream parser/CSR/group reorder plus new dense-state tick and message-only stepping. Overflow fixed with Uint32 group counts. Mapping retained both ways with all indexed string root IDs. Reset clears voltage/spikes/refractory/decoder/tick. No start timer exists, so repeated-start timer bug is eliminated.

## Explicit model adaptations

Original normalization retained then multiplied by **80 gain** (this is weight gain, NOT 80 nodes). Threshold changed 1→0.35 and leak 0.95→0.90. Fixed 3-tick refractory. This demonstrative gain makes propagation visible but is NOT fitted biological dynamics. These changes appear in every frame's dynamicsLabel.

16,574 cells in photoreceptor/olfactory/touch/wind heuristic groups receive authored eight-channel world/candidate input. Channels are assigned by original neuron index modulo8, not validated receptive fields. 3,581 cells in upstream GNG_DESC provide the only motor signal. That upstream category also includes ascending cells, so this is a **descending-group proxy**, not a verified motor population. Six bins use original index modulo6; x/y use rate differences; z uses the mean positive downstream spike rate. Smoothed rates are transformed with tanh. No food heading, direct target force, target-seek term or neural-independent thrust. Passive physics adds drag and reflecting chamber walls only.

Output drives visible movement, not purposeful validated navigation. No efficacy, docking, learning, receptor selectivity or pharmacology is inferred. Mode control clears electrical state on intervention onset; disconnected blocks edges; silenced blocks injection and recurrence. Same decoder runs in every mode.

## Same-source view

19,894 representative positions from FAFB coordinates.csv, every seventh canonical indexed cell; each point carries original and sorted indices. It is an anatomical-coordinate point cloud, not soma-certified positions or neuron morphology. Full139255 activity is computed; only19894 points displayed, labeled explicitly. No MaleCNS atlas borrowed.

## Actual verification

`npm test`: 6/6 tests passed, including actual Node worker_threads adapter running the same `public/engine/flywire/worker.js` and real gzip binary. The other five tests cover historical fixture modules and do not prove this engine; the new test independently verifies full count, all identity inverses, Uint32 spike-sum consistency, deterministic reset, meaningful downstream output, electrical controls, and no autonomous ticking.

M4 Max / Node26.5.0, 120 real worker step roundtrips with 20 warmup ticks:
- Initial gzip graph and identity initialization: 176.09ms.
- Worker compute: mean1.96ms, p95 2.14ms, max2.38ms in recorded pre-final-control-cleanup run. Structured message delivery and body rendering excluded from computeMs.
- Max traversed edges during this sensory case358203 (full adjacency retained; applicable edges only).
- Final spikes10884; maximum3-axis output norm0.5134.
- Passive unconstrained test integration displacement4.68 scene units over6 seconds; production adds chamber reflection.
- Dense all-edge traversal feasibility already measured in audit; normal sensory run need not fire every cell.

`npm run build` passed; only Vite >500kB bundle advisory. Full actual browser final layout integration belongs to UI owner; this component was typechecked but no browser visual claim is made here.

## License

Code MIT attribution retained at public/engine/flywire/LICENSE-MIT.txt. Data CC BY-NC4.0; `public/data/flywire/NOTICE.md` contains source, publication, derivative details and noncommercial limitation. Local research demo only. Commercial clearance NOT granted. Existing Cobanov attribution conditions continue to apply. Canonical release checksum provenance remains the audit's limitation, despite exhaustive verification of bundled CSV-to-binary pairs.

Final post-control-cleanup rerun: all6 tests still passed; init175.92ms; mean2.13ms, p95 2.59ms, max7.36ms. Spike/readout/edge/displacement values unchanged. Tail variation is expected in a shared desktop process; no single run is a device guarantee.
