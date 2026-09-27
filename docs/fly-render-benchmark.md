# Drosophila renderer microbenchmark

## Parent UI API

```ts
import {benchmarkCandidates,type BenchmarkReport} from './benchmark';
const report:BenchmarkReport = await benchmarkCandidates({
  onProgress: (completed,total) => { /* optional UI state update */ },
  signal: abortController.signal, // optional
});
```

No parameters are required. Invoke once from the studio's benchmark button, disable the button while pending, catch errors, and show `report.results`. `report.fastestId` is only the lowest measured median. If `report.confidence === 'close'`, report `practicalTieIds` instead of an unqualified winner.

Result rows contain `id`, `name`, `drawCalls`, `triangles`, `lines`, `points`, `vertices`, `geometries`, `medianMs`, `p25Ms`, `p75Ms`, `minMs`, `maxMs`, `roundMediansMs`.

## Fairness / meaning

- Existing unmodified six procedural models.
- One model at a time, shared renderer, fixed camera/light setup and identical flight-wing/rotation phases.
- 512×512 render target, pixel ratio1; up to4MSAA samples (actual requested supported limit in report).
- No environment, text labels, UI, CNS computation or full flight controller in the measurement scene.
- All shaders compiled and24frames warmed per candidate before measurement.
-12counterbalanced rounds ×8measured frames per candidate (96samples each). Every model occupies each timing-order slot twice.
- Each measured frame times `renderer.render(scene,camera)` plus `gl.finish()`. This includes CPU submission and blocking GPU completion. It is **not isolated GPU time**, not production FPS, and not a measurement of neural computation.
- Uses median of round medians; quartiles and individual extrema retained.
- `renderer.info.render` provides actual drawcall and primitive counts, including material passes.
- Vertex count is the sum of unique allocated geometry position entries, not an estimate of shader invocations.
- Offscreen target means presentation/compositing and visible-canvas tone mapping are excluded.
- Other tabs, backgroundCNSworkers, thermal state and browser scheduling can affect values. For a cleaner rerun, pause unrelated workloads.
- Practical ties: within10% or0.05ms of the lowest median, or overlapping interquartile ranges. This is a heuristic, not a significance test.
- No files, downloads, network requests or persistent state are written by the benchmark. Temporary renderer, target and canvas are disposed in `finally`.

## Static baseline (not browser timings)

`design-model-static-costs.json` records geometry-only counts. Current PRISM has4,832vertices and54renderable objects; VECTOR has4,502vertices but62renderable objects. Therefore lowest vertex count alone does not establish lowest renderer cost. Actual timings and `renderer.info` require running the browser API above.

## Validation

Typecheck passed. `tests/design-benchmark.test.ts` verifies deterministic quantiles and that Node cannot fabricate browser timings. Browser execution is the parent UI's verification step; no browser timing has been invented in this document.

## Browser execution,2026-09-14
Two actual512×512 WebGL runs completed;192measured frames/candidate total. Files fly-render-benchmark-run1.json,run2.json,summary.json. Lowest observed median VECTOR(.450/.775ms); run2 MICA(.775ms) effectively tied; broad interquartile overlap prevents a universal fastest claim. PRISM:56drawcalls/5740triangles; MICA:56/11280. VECTOR:62/5088triangles+3130lines; VEIL:71drawcalls and highest observed medians1.575/2.475ms. Timings include blockinggl.finish and CPUsubmission, notFPS orisolatedGPU; otherworkloadnoteliminated. Practicaltie isheuristic.

Preview now uses flightPose.ts, same3Dpath/heading/bank/wingphase acrossall6. Trail andlabel overhead common and excluded frombenchmark. Timerpose uses samehelper andwingangle. Defaultmode isflight; stationary/folded pose stillavailable.34tests pass andbuild/typecheck pass. Actualbrowserrecording12frames over6.162seconds preservedcaptureintervals; no fabricatedtrajectory or neuralactivity claimed.
