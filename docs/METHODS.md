# FDDD methods — v1.0.0

## Measured data and adaptation

Upstream https://github.com/cobanov/flyjump @ c08c86bc18efd8125964b1d2ca4fc1df59700f30 was inspected locally. src/data/connectome.json is copied byte-for-byte, SHA256 2424c9dd2e44534e600aeda1a9058039b1f22a4bd983284a27adc10b22130719. It contains 80 MaleCNS v1.0 cells, 1,296 directed edges, 26,029 synaptic contacts, 32 injected input cells and 16 output cells. Graph selection and original table hashes are retained in public/data/connectome/manifest.json. Measured positions, IDs and contacts are retained. Transmitter signs and activity equations are modeling assumptions, not measured physiology.

## Equations

For contact count c_ij and inferred presynaptic sign s_i, w_ij = c_ij s_i / sum_k(c_kj |s_k|), or zero if the denominator is zero. For each input pair (cell,channel), d_cell = 2(o_channel − 0.5); other drives are zero. Three iterations per step:

    h_j ← 0.3 h_j + 0.7 tanh(d_j + 1.4 Σ_i w_ij h_i)
    y_k = 4 h_output[k]

Each iteration accumulates using the preceding activity vector, then updates all cells. State persists across candidates/targets within each run; all three condition models start at zero. Activity is dimensionless signed rate-like state, not voltage or spikes/s.

Baseline retains all edges; disconnected skips recurrent accumulation while keeping input injection; silenced clears all cell activities and outputs. All three receive exactly the same observations on every step. This is an engineered computational intervention, not biological ablation.

## Synthetic encoder

LCG: s ← (1664525 s + 1013904223) modulo 2^32; r = s/2^32. Eight feature components per candidate are 0.08 + 0.84r. Interpret channels as synthetic size, lipophilicity, polarity, donor, acceptor, flexibility, compactness and assay-context descriptors, all dimensionless. No actual molecular structures or measured descriptors are implied. Two further random draws generate synthetic fit 55+40r and safety 50+45r. These fixture scores do not measure circuit quality.

For target index t ∈ {0,1,2}, step n, channel i:

    o_i = clamp(feature_i + (t−1)0.08 (i odd ? 1 : −1)
                + 0.06 sin(0.22 n + i), 0, 1)

This demo injection deliberately replaces upstream game observations. No Dino trained readout or gameplay code is used.

## Engineered readout

    z = Σ_k y_k cos(1.7 k) / 4
    priority = 50 + 45 tanh(z)

Action is ADVANCE if priority >70, SCAN if >52, HOLD if >35, otherwise REVIEW. This authored rule maps real circuit output to visible operator state and ranking. It is not learned and has no biological validation. Automatic queue advance occurs every 24 simulation steps independently of the action label; the circuit controls priority and the displayed action/foreleg pose. Each run is bounded to 192 samples. Speed changes wall-clock interval only. Pausing does not change circuit state. Target/mode/candidate changes affect the next step, preserving historical samples for faithful export.

## Visualization and boundaries

The exact 80 simulated cell positions/states are overlaid on the measured anatomical atlas; the much larger gray atlas is unmodeled context. The 80-cell matrix remains usable without WebGL. Flybody anatomical meshes have 93,879 triangles according to the preserved source manifest. Foreleg angles derive from mean absolute actual activity; chamber rotation is explicitly illustrative and stops on pause/reduced motion. Protein helices and ligand pose are procedural illustrations, not sourced protein coordinates or computed docking. No Kd, IC50, kcal/mol or therapeutic efficacy claim is made.

Exports preserve graph provenance and per-step conditions/inputs/outputs. Timing varies by hardware and is intentionally excluded from determinism assertions. Readout differences between controls show dependency, not superiority. These 80 cells are a selected circuit, not a complete fly brain or an in vivo experiment.
