# Twenty flies, twenty full brains (2026-09-14)

User request: 5× the flies (4 → 20), each still running its own full MaleCNS v1.0 brain + VNC worker (167,122 neurons, 6,241,236 connections). No shared, pooled, or reduced brains. Clustering at higher real Vina reward is achieved by strengthening the existing reward-learning policy, not by scripting destinations.

## Changed
- `src/lib/colonyPolicy.ts`: `FLY_COUNT=20`; `FLY_SEED(i)=2026+i*7919`; `createFly` starts flies on a 5×4 lattice inside the arena (x −6..6, z −3..3, small deterministic stagger) instead of the old diagonal line that ran off-arena beyond fly 4; initial destinations spread by `id*count/FLY_COUNT`.
- Learning policy (authored parameters, labelled as such in code): learning rate `.12 → .30` (`LEARNING_RATE`), exploration floor `.15 → .05` (`EXPLORATION_FLOOR`), softmax gain `4 → 7` (`PREFERENCE_GAIN`). Unseen-first exploration and the reward transform (`externalReward`, sigmoid of the real Vina score) are unchanged. Reward OFF still freezes preference.
- `src/lib/flight.ts`: one module-level cached download of `connectome.bin.gz` (27 MB) + `root-ids.json`; each worker gets its own copy via `buffer.slice(0)` (postMessage transfers the buffer). Previously each `FlightExperiment.init` fetched the graph itself, which would be 20 downloads.
- `src/lib/useContinuousColony.ts`: all 4-length arrays derived from `FLY_COUNT`; `brainCount`, `seeds` and a `recordingNote` in segment metadata; sensory phase uses `FLY_COUNT`.
- `src/lib/neuralRecord.ts`: export writes `brain-1..brain-N.spikes.bin` for whatever fly indices were recorded (was fixed at 4); manifest gains `brainFiles`.
- `src/main.tsx`: `LIVE · 20 BRAINS`, `20 × 167,122 neurons`, methods copy dynamic; 20 fly names; four full point-cloud BrainPanels show the selected fly + next three (all 20 canvases at 28,195 points each would swamp the page); new `FlyGrid` shows every fly's live STEP, spikes/step, current destination and learned preference bar, click to select.
- `src/lib/flyAccents.ts` + `src/habitat.css` `.i0–.i19`: twenty distinct per-fly accents (first four unchanged). The 3D avatar component can import `FLY_ACCENTS` to stay index-aligned with the panels.
- Tests: `tests/twenty-flies.test.ts` (seeds distinct, starts in-arena and distinct, 20 accents, learning concentrates on the best-rewarded complex while keeping every complex reachable, reward-off freezes). `tests/continuous-policy.test.ts` exploration threshold now derived from `EXPLORATION_FLOOR`. Existing 4-unit worker tests construct their own 4-fly populations and remain as unit tests. 41 tests pass; typecheck and build pass.

## Cost, measured in Node (16 cores, 128 GB, same engine + harness the tests use)
| workers | init | step median (all in parallel) | p90 | max | RSS delta |
|---|---|---|---|---|---|
| 4 | 0.37 s | 5.2 ms | 7.1 ms | 37 ms | 1.58 GB (~394 MB/worker incl. gz buffers) |
| 20 | 1.42 s | 12.0 ms | 16.7 ms | 39 ms | 5.40 GB (~270 MB/worker) |

At 20 workers a full parallel step is ~12 ms median, well inside the 50 ms tick on this machine. Chrome per-worker overhead was not measured; expect roughly 5–6 GB of browser memory for the colony. On machines with fewer cores than flies, the tick will stretch (20 steps serialize over available cores) and the UI will show it as slower STEP advancement; nothing is skipped or approximated.

## Recording rate
Every fly records its full 20,891-byte spike bitset every 50 ms tick: 20 × 20,891 × 20/s ≈ 8.0 MB/s (≈ 29 GB/hour) into IndexedDB, versus ≈ 1.6 MB/s with 4 flies. This is unchanged in kind (lossless, all cells); only the population multiplied it. If IndexedDB quota is exhausted the colony pauses with the existing "retained in memory" error rather than dropping data. Consider exporting or clearing segments during long sessions.

## Browser verification (2026-09-14, parent session)
- Header reads `LIVE · 20 BRAINS`, `20 × 167,122 neurons`; all 20 grid cells advance STEP together (591 after ~3 min).
- Measured tick in Chrome (16 logical cores): all-worker compute wait 95–160 ms + IndexedDB persist 15–25 ms + 50 ms schedule gap → **~240 ms per brain step (~4 steps/s)**, versus ~90 ms with 4 brains and 12 ms/step in the Node harness. Nothing is approximated; the brains simply decide 4×/s while flight physics use real elapsed dt. Diagnostic `globalThis.__fdddTiming` exposes last-tick compute/persist ms.
- Recording: 8.4 MB after 420 steps, i.e. ~8 MB/s sustained into IndexedDB. Long sessions will hit browser quota; the colony then pauses with the retained-in-memory error.
- Avatars: PRISM LOW-3 at scale .084 (~.14 world units, 1/5 of previous), 20 accents from `FLY_ACCENTS` shared with panels, 2-digit labels, trails per fly.
- Clustering after ~2.5 min: destinations Celecoxib 6, Apixaban 6, Pamiparib 4, PARP1-15R 2, Niraparib 2, Rucaparib 0. Trend toward higher Vina-reward complexes is visible but the unseen-first exploration pass (up to 35 s per unvisited target × 8) is not yet complete, so this is not yet the converged preference. Cross-target Vina scores remain uncalibrated; the reward is a sigmoid of raw score by design and is labelled as such.
