# Reward into the brain, brain-driven residence, input-driven dynamics (2026-09-14)

Everything below is either (a) a real full-population MaleCNS computation or (b) an explicitly authored parameter. No docking score is invented; all rewards derive from the executed Vina scores in `public/data/docking/multi-target.json`.

## A. Reward channel into annotated gustatory neurons
- `upstream/malecns-v1.0/annotations.feather` has `class == "gustatory"` for **1,428** neurons, all inside the 167,122-neuron selection. Composition (subclass): pharyngeal sensillum 48, labellar bristle 163, taste peg 60, leg bristle 768, wing bristle 385, unlabeled 4. Superclass: cb_sensory 275, sensory_ascending 80, vnc_sensory 1,073.
- `public/data/malecns/gustatory.json` lists their original indices (`gustatoryIndices`, 1,428) plus the proboscis/pharyngeal subset (`feedingIndices`, 271) for reference.
- Engine (`public/engine/malecns/core.js`): a 9th input (`sensory[8]`, "reward") drives **only** the 1,428 gustatory cells, which are removed from the generic 8-channel sensory drive. The 271-cell subset alone produced only +1.3 % population spikes, so the full annotated class is used; this is stated in `dynamicsLabel` and `manifest.rewardChannel`.
- Value (`colonyPolicy.rewardInput`): `externalReward(pair) × learned[destination]` while the fly is inside the destination's contact radius, else 0. Recorded per frame as `sensory[8]` (spike bitset format unchanged).

Measured (Node harness `scripts/brain-dynamics-harness.mjs`, one brain, seed 2026, 300 steps, chemical input fixed):

| condition | mean spikes/step | sd | lag-4 autocorr | vnc_sensory | cb_intrinsic | cb_sensory |
|---|---:|---:|---:|---:|---:|---:|
| reward 0 | 11,258 | 2,199 | .25 | 1,288 | 3,752 | 1,231 |
| reward 1 | 12,090 | 2,164 | .28 | 1,655 | 4,000 | 1,312 |

Two-brain worker test (`tests/brain-reward-loop.test.ts`, 400 steps): high-reward input .842 → 12,019 spikes/step; reward 0 → 11,369 (+5.7 %); cb_sensory 1,315 vs 1,233, sensory_ascending 132 vs 108, vnc_sensory 1,655 vs 1,297; 0 identical bitsets. The effect is real but modest (~+6–7 % population, up to +28 % in vnc_sensory): the LIF at this calibration is refractory-limited, so no single channel can double activity.

## B. Brain-driven leave rule (replaces the 35 s / `3 + learned × 9` timers)
`colonyPolicy.ts`: `leaveDrive = EMA(.15) of |turn| + |lift|` from the computed descending motor output. The fly leaves its destination when `leaveDrive > LEAVE_BASE (.24) + LEAVE_REWARD_GAIN (.60) × rewardInput`, after ≥ 2 s in contact, or at a 120 s cap; while travelling, a 60 s cap re-draws the destination. Unseen-first exploration is kept.

Honest note: measured `leaveDrive` under real computation sits at .13–.30 and is **not monotonic in the reward input** (reward changes turn/lift magnitude only slightly and inconsistently). So the moment of leaving comes from the computed output, but the *gradient* (high reward = longer stay) comes from the authored threshold shift. In the two-brain test the reward-0 fly left at 2 s (the minimum) and the reward-.84 fly had not left after 20 s (threshold .74 is above any observed drive, so it stays to the 120 s cap). Celecoxib-level reward (.49 × learned ≈ .24 → threshold .38) leaves intermittently.

## C. Input-driven dynamics and de-synchronised starts
Sensory drive per step changed from `.10 + .40·input` to `.02 + .55·input`. Before/after (same harness):

| condition | before: spikes/step | before: lag-4 autocorr | after: spikes/step | after: lag-4 autocorr |
|---|---:|---:|---:|---:|
| silent (all inputs 0) | 7,309 (cv .44) | -.37 | **0** | – |
| chemical input | 11,634 (cv .33) | **.81** | 11,795 (cv .20) | **.23** |

The ~4-step population rhythm (lag-4 autocorrelation .81) is largely gone (.23); activity without input is now zero (in the colony there is always chemical input, so brains stay at ~11–12 k spikes/step). Each worker also starts from a seeded uniform membrane spread (0–.3 × threshold; `initEngine(..., {seed})`, `resetEngine(seed)`), so 20 brains launched together are not phase-locked. `FlightExperiment.reset(seed)` reseeds. Labels updated in `dynamicsLabel` and `manifest.dynamics`.

## Reward transform (authored, sharpened)
`externalReward = sigmoid((score − (−11.9)) / 0.5)` (was `sigmoid(−(score + 7)/2)`). Authored reward transform of real Vina scores; not calibrated affinity; cross-target scores remain uncalibrated.

| pair | Vina kcal/mol | reward before | reward after |
|---|---:|---:|---:|
| PARP1 inhibitor 15R @ parp1-4r6e-chain-a | -13.093 | 0.955 | **0.916** |
| Celecoxib @ cox2-3ln1 | -11.88 | 0.92 | 0.49 |
| Pamiparib @ parp1-4r6e-chain-a | -11.085 | 0.885 | 0.164 |
| Apixaban @ factor-xa-2p16 | -10.248 | 0.835 | 0.035 |
| Niraparib @ parp1-4r6e-chain-a | -10.178 | 0.83 | 0.031 |
| Rucaparib @ parp1-4r6e-chain-a | -9.769 | 0.8 | 0.014 |
| Niraparib @ factor-xa-2p16 | -7.967 | 0.619 | 0.000 |
| Niraparib @ cox2-3ln1 | -6.605 | 0.451 | 0.000 |

## Files
`public/engine/malecns/core.js`, `public/engine/malecns/worker.js`, `public/data/malecns/gustatory.json` (new), `public/data/malecns/manifest.json` (dynamics + rewardChannel fields), `src/lib/flight.ts` (9-channel input, init/reset seed), `src/lib/colonyPolicy.ts`, `src/lib/useContinuousColony.ts`, `scripts/brain-dynamics-harness.mjs` (new), `tests/brain-reward-loop.test.ts` (new), `tests/continuous-integration-review.test.ts` (reset with common seed). 44 tests pass; typecheck and build pass. Recording metadata `policy` string updated. Frame `sensory` arrays are now length 9 in new recordings; old archives (length 8) remain valid.

## Proportional mode (2026-09-15, user: "하나만 몰빵이야, 비례해서")
Replaced the sharp sigmoid reward with a linear rescale between the worst and best executed Vina score in the loaded set (`rewardScale`, `REWARD_FLOOR=.05`): 15R 1.00, Celecoxib .82, Pamiparib .71, Apixaban .58, Niraparib@PARP1 .57, Rucaparib .51, Niraparib@Xa .25, Niraparib@COX-2 .05. `chooseDestination` now weights options linearly by learned value (`PREFERENCE_POWER=1`, exploration floor .05) instead of exp(7·v), so destination shares follow the learned ratio (best ≈ 22% of choices when fully learned, not a monopoly). Gustatory reward channel and brain-driven leave rule unchanged. 46 tests pass. Deployed to drug.flybrain.kr. Live check after ~4 min with 8 flies: residence 15R 10.7 / Pamiparib 24.5 / Niraparib@PARP1 17.9 / Rucaparib 13.0 / Celecoxib 19.9 / Nira@COX-2 6.3 / Apixaban 1.5 / Nira@Xa 6.3 % — spread, but not yet converged to the reward ratio (small colony, short run).

## Why the proportional policy looked flat at first, and the fixes (2026-09-15)
Root causes found by instrumentation (`globalThis.__fdddTiming`, PerformanceObserver longtask):
1. Simulation time ran at ~1/10 wall time: the motion loop capped dt at .1 s per animation frame, and frames arrived late because the main thread was ~90% busy. Fix: dt cap 1 s with <=50 ms sub-step integration in `advanceFly`.
2. BrainGrid repainted 20 × 28,195 points at 10 Hz. Fix: 4 Hz, repaint only cells with a new computed step or a decaying flash, per-cell scissor clear with `preserveDrawingBuffer`.
3. Fast flies hovered just outside the contact radius (e.g. 1.82 vs 1.78), so residence/learning never started. Fix: contact radius +.75 → +1.25 world units, plus .9 hysteresis once resident.
4. Residence was credited to the nearest complex, so the huge COX-2 structure absorbed passing flies (worst-reward pair showed 26 %). Fix: residence counts only contact with the fly's own destination.
5. Travel cap 60 → 30 s, FLIGHT_SPEED 2.2 → 4.5, exploration-pass stay cap 8 s, reward-proportional stay cap 5–30 s; displayed residence is now a rolling 3-minute window.
Also: several localhost/deployed tabs were running colonies at once (68 workers) which slowed every tab; one tab at a time is recommended.
Result on the local 20-fly run (~9 min): learned preference for fly 01 = 15R 99 / Celecoxib 71 / Pamiparib 64 / Apixaban 55 / Niraparib@PARP1 55 / Rucaparib 51 / Niraparib@Xa 28 / Niraparib@COX-2 10 %; residence last 3 min = 15R 18.2, Apixaban 18.0, Celecoxib 12.8, Pamiparib 12.7, Niraparib@PARP1 10.6, Niraparib@Xa 10.0, Niraparib@COX-2 9.0, Rucaparib 8.6 %; destinations 15R 5/20. Spread, gradient present, still converging. Deployed.
