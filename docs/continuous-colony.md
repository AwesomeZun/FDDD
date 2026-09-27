# Continuous colony

`useContinuousColony(pairs: HabitatPair[])` automatically initializes four independent
`FlightExperiment` workers once pairs are nonempty. It returns:

```ts
{ flies: ColonyFly[], ready: boolean, paused: boolean,
  pause(): void, resume(): void, error: string, steps: number, bytes: number,
  exportRecords(): Promise<void>, training: boolean,
  setTraining(v: boolean): void, elapsed: number }
```

`HabitatPair` and `ColonyFly` are exported by `colonyPolicy.ts` and re-exported by
the hook. `destination` indexes the supplied pairs; `learned` and `dwell` use the
same indexing. `feeding` is the current learned preference when near a complex,
not a predicted affinity. `dwell` is proximity time in seconds. `elapsed` is active
animation time (background-tab gaps are capped), while frame times use the
engine's 0.05-second inspection clock. `steps` counts individual persisted brain
frames across all four flies; `bytes` counts their uncompressed spike bitsets.

Equal-value rerenders do not restart the workers. Changing any pair value starts
a new colony session and resets its policy/counters. Keep pair positions stable;
do not send continuously animated position props. Old recordings remain in
IndexedDB. An empty dataset waits for data. `ready` means graph and recording
initialization succeeded, not that the latest computation has completed.

## Neural computation and movement

All four workers use the 139,255-neuron / 2,698,236-edge engine. Every iteration
calls `inspectAsync(..., 'baseline', true)` for each worker. There is no 16-step,
100-step, or other finite-run cutoff. The batch loop waits for recording before
starting another batch. Pause blocks the next batch, allowing an in-flight batch
to finish and commit. Resume retries a failed storage write before new compute.
Engine initialization/graph errors are fatal for that session, not silently
replaced with synthetic activity.

RequestAnimationFrame animates the last actual motor output independently of
worker latency, publishing display state at approximately 20 Hz. Positions span
all three world axes; passive bounds are x ±7.5, y [-2.8,4], z ±5.5. Typical
active speed is around 0.65–1.2 world units/s depending on motor output. Zero motor
output removes propulsion and velocity decays. Display trails cap at 240 points.

**The steering adapter is authored**, not an emergent neural navigation claim.
Attraction and near-complex tangential steering establish the desired direction;
neural turn, lift and thrust outputs alter direction, height and speed. This is
not a scripted time trajectory and is not a learned flight controller. Workers
are electrically independent. Distinct behavioral PRNG seeds are 2026, 9945,
17864, 25783; the existing engine does not expose a neuronal RNG-seed input, so
these must not be advertised as differently randomized connectomes.

## Inputs and honest reward learning

`scoreFreePair` removes scores, computed flags, labels and file URLs before the
sensory adapter. Its inputs are SMILES tokens, an explicitly authored categorical
target-ID cue, and relative position. A target-ID hash is **not protein structure**
and the chemical encoding is not a validated fly chemoreceptor model.

The separate `externalReward` lookup admits only finite, computed Vina scores.
It maps score to a fixed bounded reward `sigmoid(-(score+7)/2)`. During training,
about one second of contact triggers an exponential update (rate 0.12) of that
fly's visited candidate preference. Uncomputed candidates receive no reward.
A softmax preference policy plus 15% uniform exploration chooses destinations;
movement never directly sorts or takes argmax of docking scores. Near visits last 3 + learnedPreference × 9 seconds, counted only during proximity. A 35-second travel timeout permits reselection. Initial exploration covers unobserved combinations before softmax revisits. The authored proximity radius is 2 world units; a 1.6-unit orbital steering radius keeps flies around, rather than buried inside, receptor structures.
An exploratory draw may select the same complex again.

`setTraining(false)` freezes learned values exactly. Motion, neural inspection,
recording and stochastic choices from the frozen policy continue. Re-enabling
training permits further online updates. No pretrained PARP1 model is loaded.
**This is learned candidate preference from supplied external reward, not blind
affinity discovery, cross-target generalization, or evidence of fly cognition.**
Cross-target Vina scores are uncalibrated; the fixed reward transform does not
correct differences in receptor preparation, scoring offsets or docking setup.
Any cross-target preference ordering therefore inherits those limitations.

## Full spike recording, rotation and export

The existing `NeuralRecord` stores a 17,407-byte full-neuron bitset for every
computed inspection frame. Each committed chunk contains at most four frames.
Segments rotate after 1,024 frames (17,824,768 raw spike bytes, about 17 MiB).
In-memory retention is bounded: four latest display frames, at most one pending
four-frame batch, finite trails and per-candidate policy arrays. No complete
neural history or growing segment list is retained in JavaScript.

Successful peer results are retained and committed even if another worker
rejects. A missing full bitset is an explicit fatal error. An IndexedDB quota or
transaction failure pauses the colony, retains the pending batch, and reports
an error instead of dropping samples or continuing unrecorded. Resume or export
retries it. **Do not reload/unmount after a storage error until that pending batch
has committed**: browser memory cannot survive a crash or page teardown. An
ordinary unmount waits for in-flight writes before disposing workers.

`exportRecords()` pauses and drains pending writes, then walks the IndexedDB
run catalogue one matching session segment at a time. It uses the existing
`NeuralRecord.export` ZIP path, including full root IDs and sorted-to-original
mapping in each segment. Each segment is bounded before the existing in-memory
ZIP exporter sees it. Frame `compoundId` contains the globally unique pair ID;
segment metadata provides the compound ID, target ID, score and input provenance.
Frame mode indicates whether its sensory computation began in training/frozen
mode. The exporter reopens prior `NeuralRecord` identifiers through `init`, which
refreshes their run creation timestamp but retains original metadata/chunks.

Export sends to the existing `/api/records` endpoint when available, otherwise
requests browser ZIP downloads. Multiple segments produce multiple ZIPs;
browser multiple-download permissions may apply. Download initiation is not
proof the user saved a file. The hook remains paused after export. Files and
IndexedDB chunks are never automatically deleted: persistent disk usage grows
until explicitly managed by the user. This intentional non-destructive policy
avoids claiming a download succeeded and deleting its only durable source.
The export control covers the current session; older sessions remain in the
`fddd-neural-assays` database for recovery, not a session-wide JS cache.

Recordings contain all per-inspection spike flags, not membrane potentials,
sub-tick trajectories or every engine state variable. FlyWire's noncommercial
CC BY-NC 4.0 restrictions remain applicable.

## Verification

`node --experimental-strip-types --test tests/continuous*.test.ts` covers reward
isolation, exact training freeze, stochastic learned revisit bias, distinct
behavioral seeds, motor-dependent 3D motion, finite trails, and 105 real full-graph
inspection rounds in each of four independent worker harnesses. All 420 bitsets
are checked against the engine's spike count. `npm run typecheck` verifies the
shared contract. These are policy/engine tests, not an automated browser quota,
React lifecycle or multi-download permission test.
