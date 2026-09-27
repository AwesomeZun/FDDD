# Original FlyBrain behavior map (code verified)

Source: snedea/flybrain commit9191824d17871b7851645782d53d23f213ddb938.

## Implemented source states

js/fly-logic.js:18–27 defines thresholds; :51–95 evaluateBehaviorEntry lists startle, fly, feed, groom, brace, rest, phototaxis, explore, walk, idle. Feed also has authored hunger+foodNearby bypass; brace/light/rest use external stimuli and internal drive rules. This is neural-plus-authored policy, not all behavior proven emergent from anatomy.

js/main.js:960–1007 implements state durations/cooldowns, startle freeze200ms then phases, grooming trigger location snapshot. :1030 onward computeMovementForBehavior has explicit food-direction steering and exploration wander. js/brain-worker-bridge.js:273–355 synthesizeMotorOutputs derives behavior intents and constructs virtual motor drive, with direct directional behavior policies remaining separate.

readme.md Usage documents Feed, Touch(head/thorax/abdomen/legs), Air/wind, Light, Temp(neutral/warm/cool). These are inputs, not each independent high-level neural behavior.

| Original | Proposed research-demo observation, not validated drug effect |
|---|---|
| walk/explore/fly | speed, movement range, direction changes, motor suppression |
| food approach/feed | approach preference, intake-duration proxy |
| startle after touch | stimulus sensitivity, response latency and recovery |
| phototaxis | sensory response and orientation |
| brace under wind | perturbation resistance/recovery |
| rest/groom/idle | time allocation among behavioral states |

Protein binding must remain a SEPARATE docking/affinity/evidence layer. A conceptual workflow: ligand-target calculation or synthetic fixture → explicitly authored circuit perturbation → observed model behavior → multi-condition comparison. No simulation behavior proves binding, target occupancy, toxicity, clinical efficacy, or conserved pharmacology. Current FDDD imports full LIF engine/data, NOT all10 source behavior policies; active bodies use our explicitly engineered downstream flight decoder. Four avatars are four independent state copies of the same full139255-cell graph, not four different anatomical connectomes.

Source links:
- https://github.com/snedea/flybrain/blob/9191824d17871b7851645782d53d23f213ddb938/js/fly-logic.js#L51-L95
- https://github.com/snedea/flybrain/blob/9191824d17871b7851645782d53d23f213ddb938/js/main.js#L960-L1060
- https://github.com/snedea/flybrain/blob/9191824d17871b7851645782d53d23f213ddb938/js/brain-worker-bridge.js#L273-L355
