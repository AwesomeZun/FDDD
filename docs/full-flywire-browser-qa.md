# Full FlyWire final browser QA

2026-09-14, Aside browser, localhost5173. Replaces the rejected80-cell dashboard. Independently verified139255 simulated cells /2698236 weighted graph edges, with19894 anatomical display points separately labeled. Original full-screen molecular scene has no borrowed trading-panel grid or reference ring/platform composition.

Verified live continuous flying body with wing animation and varying speed (~2.3 world units/s), computed spike telemetry (~8k–12k observed per step), candidate selection, Pause freezing time, Resume, and JSON browser download (artifacts/fddd-full-flywire-run.json). Silence produced0 spikes and velocity decayed from1.736 to0.002 in4.5 model seconds; Baseline restored firing and movement. Actual motor force uses downstream firing only; authored decoder maps differential rates to turning/lift/forward thrust and passive reflecting walls. These are explicit demonstration mechanics, not real flight physiology or drug predictions.

Fixed a browser structured-clone memory error by transferring graph buffers and per-cell typed arrays, loading root IDs inside worker rather than cloning a large string array into worker, and avoiding Array.from copies of all139255 states every frame. Fresh reload then controls and continuous frames worked. Tests include late trajectory not sticking at boundary, silence damping, full identity/index mapping, graph counts, actual worker stepping and reset. 7/7 tests and production build passed. Five are legacy fixture regressions; two specifically execute full worker/body. No reduced graph fallback.

Observed worker benchmark during final test: mean1.89ms, p952.07ms, max2.12ms (100 measured postwarmup ticks). Browser observed~2ms after warmup; end-to-end20Hz is scheduler target, not validated realtime physiology. UI display UPDATED CELLS refers states updated, not biological activity count.

Proof8 live frames recorded to session tmp/final-flywire-00.jpg through07.jpg, converted to tmp/flywire-live-proof.gif. Leave app LIVE, not paused, for delivery. Full data CC BY-NC4.0: noncommercial demo only. No commercial deployment.

## Production delivery refinement

Further isolated development/HMR memory instability by serving production dist at http://localhost:5174/ (npm run preview -- --port5174, PID56045). All139255 cell states remain in the worker, but normal UI requests only19,894 display-sample activities/fire flags with compactDisplay=true. Full-state output remains available to worker tests. This is transport/display sampling, NOT reduced neural computation. Production initial observed JS heap55MB. Do not deliver old dev5173 link as final. Active control labels use UPDATED CELLS, not biological active-cell count.
