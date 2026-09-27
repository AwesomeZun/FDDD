# Continuous colony integration review

Read-only review of policy, hook and current eight-combination dataset. Only this report and tests/continuous-integration-review.test.ts were created. No runtime-owned files changed.

## Verdict

PASS for the tested trajectory: no stationary-motor or identical-saturated-reward blocker. Not a guarantee that the highest-reward complex always wins. Full-loop neural testing and extended motor replay are deliberately distinguished below.

## Reproduce

`node --experimental-strip-types --test tests/continuous-integration-review.test.ts`

One integration test passed; `npm run typecheck` also passed. Uses the existing Node worker harness and actual 139,255-neuron, 2,698,236-edge graph in four separate workers. Does not mount React or exercise IndexedDB/browser rendering.

## Actual full-graph closed loop

1,200 fresh neural inspections per fly (4,800 frames), each full spike bitset checked against spikeCount. 83,553,600 bytes checked, not persisted by this test. Each new actual motor output drives five 0.05-second motion substeps: 300 virtual motion seconds and 60 engine-clock seconds per fly. This explicitly models 250ms inspection cadence with last-output hold, not 300 seconds of neural clock and not browser wall-time scheduling. Control uses hook's residence threshold 3 + learned*9 and age >35, with contact-based updates and actual UI coordinates.

| Fly | Path length | X range | Y range | Z range | Contact episodes | Destination draws |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 166.846311 | 13.378443 | 2.452542 | 8.872268 | 15 | 15 |
| 2 | 165.067414 | 9.305765 | 2.792846 | 8.811251 | 16 | 15 |
| 3 | 165.679529 | 13.187581 | 2.709945 | 9.020215 | 16 | 15 |
| 4 | 164.579844 | 13.175799 | 1.696925 | 8.606071 | 18 | 17 |

Contact episodes count first contact after a destination draw, including redrawing the same complex. Destination draws are not necessarily changes. All flies updated some preferences, but 300 seconds does NOT train every candidate for every fly. Total contact-update counts per fly: 154, 159, 144, 165. All four full spike bitsets were pairwise distinct in 1196/1200 rounds, and each fly produced 1200 distinct bitsets. Initial zero thrust/spike steps occur, but actual thrust maxima are 0.488581, 0.486096, 0.484263, 0.488319 and all flies sustained motion.

## Independence and score isolation

After different histories, identical current sensory vectors AND identical phase produced four distinct full spike bitsets and four distinct compact activity arrays in all 16 follow-up rounds. This is evidence of retained independent electrical histories, not proof of different neuronal seeds. Resetting all workers and perturbing only score/computed flag produced byte-identical spike bitsets and identical outputs in all 16 rounds. Silencing worker 0 alone gave exactly zero spikes/output for 8 rounds while the three peers remained mutually identical and nonzero.

Source inspection: scoreFreePair exposes only id, targetId, smiles, position. colonySensory uses chemical descriptors, target-ID hash and relative position; FlightExperiment sends sensory/mode to the worker, not score or learned preferences. Reward directly updates candidate preference, not synaptic weights. Learned policy later changes destination and therefore future sensory input: that mediated influence is intentional, not direct score leakage. Four worker objects have private engine modules/states; the constructor seed is not a neuronal RNG seed. Identical reset histories match exactly, so do not advertise inherently different randomized brains.

## Extended policy training: actual motor REPLAY, not more neural simulation

Following the actual 300-second run, cycle its 1,200 actual motor samples for another 30,000 motion seconds of training, then 10,000 seconds of frozen evaluation. The motion/reward/policy loop remains active; motors no longer respond to the new replay trajectory's sensory input. This checks policy convergence and residence bias given recorded functioning motors, not long-horizon closed-loop neural stability.

Reward values in dataset order: 0.954631181, 0.885187589, 0.830475364, 0.799712748, 0.919827088, 0.450784871, 0.835346040, 0.618574007. Eight distinct values, range 0.450784871 to 0.954631181; not an identical-value saturation failure. Maximum trained preference error versus its external reward: 4.440892098500626e-16. Frozen preferences stayed exactly byte-for-byte JSON equal throughout 10,000 seconds while flies continued to move.

Frozen aggregate contact seconds in dataset order: 4509.15, 2850.65, 2491.20, 2151.85, 3927.90, 454.40, 2734.70, 1095.05. Reward/residence Spearman correlation: 1; per fly: 1.000000000, 0.976190476, 0.904761905, 0.880952381. Fly 3 spent slightly longer at COX2/celecoxib than at globally highest reward PARP1/15R despite convergence. Thus even this run directly contradicts an always-highest-wins guarantee. Geometry, motor differences, travel times, residence rule and sampling affect residence.

## Caveats / follow-ups (not observed motion blockers)

- docs/continuous-colony.md still says 12-second timeout and minimum four-second visits; runtime now uses 35 seconds and 3 + learned*9 seconds. Update documentation in the owning session.
- The neural connectome's weights never learn here. Training/freeze concerns per-candidate scalar preferences only; the underlying engineered connectome remains fixed.
- The test mirrors the hook's scheduling/control logic rather than importing a shared tick reducer. Recheck if the hook changes; React scheduling, recording failures, pause/unmount are outside this test.
- residence accumulates near time across brief excursions within one destination tenure; unlike contact, it is not reset when far away. Contact updates require a continuous >=1 second interval before the next inspection; finite inspection cadence can lose a partial interval. Feeding is refreshed on inspection, not each motion frame.
- Multi-target scores remain uncalibrated across receptors. Main UI rejects uncomputed candidates; the policy null-reward branch exists but this dataset does not use it.
- Brain panel activity derives from actual worker activity/fireState. Camera rotation and glow smoothing are visualization effects, not additional neural observations. 19,894 display samples are not all 139,255 neurons, although full bitsets cover them all.

## Source hashes reviewed

- colonyPolicy.ts: 5cb6a6704323c3be1a7b0c7523d02d36fd56181a00fd7b8431e2efedaea5f03f
- useContinuousColony.ts: 7320d9489b92835d2e87e0a41dcb6a99cf6dc98d89748a3a330fa4def83cc748
- multi-target.json: f1841569e7e4cfa4ba96fde075c0ec303aca3c09335ba3286c980b8224a33524

## Exact metrics

### Actual loop
```json
{
  "virtualMotionSeconds": 300,
  "neuralSecondsPerFly": 60,
  "frames": 4800,
  "fullSpikeBytes": 83553600,
  "arrivals": [
    15,
    16,
    16,
    18
  ],
  "destinationDraws": [
    15,
    15,
    15,
    17
  ],
  "pathLengths": [
    166.84631133218187,
    165.06741416547746,
    165.67952863450478,
    164.5798439156012
  ],
  "axisRanges": [
    [
      13.378442537195856,
      2.452541534556518,
      8.872268447297929
    ],
    [
      9.305765165019908,
      2.7928462571184025,
      8.811251191637535
    ],
    [
      13.18758119436437,
      2.709944623041226,
      9.020214682340058
    ],
    [
      13.17579886647426,
      1.6969252919381261,
      8.606070550918593
    ]
  ],
  "dwell": [
    [
      92.69999999999688,
      0,
      9.55,
      29.600000000000286,
      21.45000000000017,
      0,
      0,
      8.299999999999983
    ],
    [
      56.9999999999989,
      31.700000000000315,
      20.10000000000015,
      0,
      42.04999999999975,
      7.349999999999982,
      9.650000000000002,
      0
    ],
    [
      0,
      75.94999999999783,
      30.750000000000302,
      9.349999999999998,
      10.450000000000014,
      15.350000000000083,
      0,
      8.299999999999983
    ],
    [
      45.449999999999555,
      0,
      9.55,
      20.350000000000154,
      0,
      7.249999999999982,
      84.04999999999737,
      8.199999999999982
    ]
  ],
  "learned": [
    [
      0.9546244564093636,
      0.5,
      0.7258870552625116,
      0.7923557146092439,
      0.891171681463549,
      0.5,
      0.5,
      0.5759307006552844
    ],
    [
      0.9541743834952646,
      0.8768670310728383,
      0.8013474176160578,
      0.5,
      0.9173014135426406,
      0.4708978931345766,
      0.7292162680383689,
      0.5
    ],
    [
      0.5,
      0.8851575704567314,
      0.8223632021815435,
      0.704860142272251,
      0.8029048341121309,
      0.4590045722557285,
      0.5,
      0.5759307006552844
    ],
    [
      0.952767317206891,
      0.5,
      0.7258870552625116,
      0.7732962044879356,
      0.5,
      0.4708978931345766,
      0.8353322482848068,
      0.5759307006552844
    ]
  ],
  "updates": [
    [
      87,
      0,
      9,
      29,
      21,
      0,
      0,
      8
    ],
    [
      54,
      30,
      19,
      0,
      40,
      7,
      9,
      0
    ],
    [
      0,
      74,
      29,
      9,
      10,
      14,
      0,
      8
    ],
    [
      43,
      0,
      9,
      19,
      0,
      7,
      79,
      8
    ]
  ],
  "spikeRanges": [
    [
      4854,
      18090
    ],
    [
      0,
      21810
    ],
    [
      0,
      22109
    ],
    [
      0,
      21708
    ]
  ],
  "thrustRanges": [
    [
      0,
      0.48858104722069345
    ],
    [
      0,
      0.48609565337918204
    ],
    [
      0,
      0.4842628712954929
    ],
    [
      0,
      0.4883189151052193
    ]
  ],
  "uniqueSpikeBitsets": [
    1200,
    1200,
    1200,
    1200
  ],
  "allFourDifferentRounds": 1196
}
```

### State controls
```json
{
  "identicalCurrentInputHistory": [
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    },
    {
      "distinctBits": 4,
      "distinctActivity": 4
    }
  ],
  "resetScorePerturbationIdenticalRounds": 16,
  "singleWorkerSilencingIsolatedRounds": 8
}
```

### Motor replay
```json
{
  "trainingMotionSeconds": 30300,
  "frozenEvaluationSeconds": 10000,
  "rewards": [
    0.9546311807808119,
    0.8851875890284409,
    0.8304753635545674,
    0.7997127476675654,
    0.9198270878271877,
    0.45078487089866653,
    0.8353460401906115,
    0.6185740074950563
  ],
  "learned": [
    [
      0.9546311807808114,
      0.8851875890284404,
      0.830475363554567,
      0.799712747667565,
      0.9198270878271873,
      0.45078487089866676,
      0.8353460401906111,
      0.6185740074950559
    ],
    [
      0.9546311807808114,
      0.8851875890284404,
      0.830475363554567,
      0.799712747667565,
      0.9198270878271873,
      0.45078487089866676,
      0.8353460401906111,
      0.6185740074950559
    ],
    [
      0.9546311807808114,
      0.8851875890284404,
      0.830475363554567,
      0.799712747667565,
      0.9198270878271873,
      0.45078487089866676,
      0.8353460401906111,
      0.6185740074950559
    ],
    [
      0.9546311807808114,
      0.8851875890284404,
      0.830475363554567,
      0.799712747667565,
      0.9198270878271873,
      0.45078487089866676,
      0.8353460401906111,
      0.6185740074950559
    ]
  ],
  "maxPreferenceError": 4.440892098500626e-16,
  "frozenResidence": [
    [
      1228.0999999994308,
      876.4499999997506,
      550.3500000000472,
      493.800000000078,
      1010.6499999996286,
      108.34999999999599,
      703.5499999999079,
      243.70000000002116
    ],
    [
      1136.7999999995138,
      732.9499999998811,
      730.3499999998835,
      504.55000000008044,
      948.0999999996855,
      86.54999999999723,
      699.3499999999117,
      286.80000000003093
    ],
    [
      1031.4999999996096,
      631.2999999999736,
      635.6499999999696,
      535.2500000000609,
      1039.0999999996027,
      122.2499999999952,
      575.850000000024,
      347.7000000000448
    ],
    [
      1112.7499999995357,
      609.949999999993,
      574.8500000000249,
      618.2499999999854,
      930.0499999997019,
      137.24999999999696,
      755.9499999998602,
      216.85000000001506
    ]
  ],
  "aggregateResidence": [
    4509.14999999809,
    2850.649999999598,
    2491.1999999999252,
    2151.850000000205,
    3927.8999999986186,
    454.3999999999853,
    2734.699999999704,
    1095.050000000112
  ],
  "rewardResidenceSpearman": 1,
  "perFlySpearman": [
    1,
    0.9761904761904762,
    0.9047619047619048,
    0.8809523809523809
  ],
  "frozenPathLengths": [
    5602.319053310217,
    5544.166494387533,
    5555.04651239287,
    5580.7128990416895
  ],
  "frozenExact": true
}
```
