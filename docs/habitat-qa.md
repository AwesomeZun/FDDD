# Continuous habitat QA

## Changes
One shared3D world with8 computed complexes and4 refined insect avatars. Two continuously updating neural views on each side, modeled membrane activity/spike flashes, camera controls and full-cell recording. Original video permanently retained at references/motion/continuous-brain-reference.mp4.

## Real molecular evidence
3 protein targets /6 chemical identities /8 executed combinations. New factorXa: apixaban-10.248, niraparib-7.967; mouseCOX-2: celecoxib-11.880, niraparib-6.605 kcal/mol. ExistingPARP1 results unchanged. Different targets/protocols do not imply calibrated affinities.

COX-2 prepared inputs interleave4chains with strippedchainIDs. Initial simple backbone rendering therefore failed to connect mostCAs despite successful loading. Fixed by restoring exact coordinate-matched chain labels from sourcePDB and grouping by chain. All2208CAs and all prepared atom coordinates verified unchanged. Reproduction helper runs after multi-target manifest generation. Ribbons are stylized C-alpha paths, not fabricated secondary-structure assignments.

## Neural/policy integrity
25 tests pass. The real full-graph integration run checks4800 complete139255-bit states, all4 workers' movement in3axes, distinct electrical histories, score-only input invariance and isolated silencing. Long-horizon policy convergence uses an explicitly separate replay of real motor outputs, not fabricated additional neural steps.

Preferences learn only from external reward after contact; no score enters sensory encoding or direct trajectory forces. Freeze changes no learned values. Initial exploration covers all combinations. Continuous surface-orbit policy has no finite assay cutoff. Measured residence uses the nearest complex within2world units and does not copy reward percentages.

## Browser
All8 molecular objects rendered; COX-2 whole4chain structures visually verified after correction. Camera drag rotates entire world and scroll zoom changes size. Pause settled at476 totalframes; export contained476 full bitsets and every decoded popcount matched the recorded spikeCount. Resume increased counts, frozen reward mode kept neural computation/movement active; reward was re-enabled. Final post-orbit recording additionally includes sampled position, velocity and candidate preference.

Full recording is segmented on disk, not reduced to display points. Raw storage grows over time. No silent sample deletion; errors pause. Current runtime remains brain-onlyFlyWire, notMaleCNS/VNC.

## Final complete export
Final continuous session exported13 segments totaling12,572 complete brain frames. Every frame's full139255-bit population count matched its logged spikeCount. All rows include position, velocity and8 candidate preference values. No frame was dropped at the1024-frame segment boundaries. Verification result saved with release docs. Mol* displayed the actual4-chain COX-2 structure while all workers continued; a later screenshot showed over7000 continued frames. Motion proof uses captured wall-clock intervals, not a fabricated animation or accelerated trajectory.
