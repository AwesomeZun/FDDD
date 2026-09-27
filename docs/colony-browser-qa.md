# Four-fly colony QA

Production preview: http://localhost:5174/ (same preview server, rebuilt dist).

- Four independent full139255-cell/2698236-edge workers created; four distinct candidate-index inputs; four distinct live spike readouts displayed.
- Four original smooth pastel avatars replace all live anatomical Flybody loading. Small wings/feet and highlighted eyes, individual IDs and colored trails. Four colored independent brain portraits (19894 sampled points EACH; full graph computation EACH).
- Browser: Amber baseline→Silence: Amber0 spikes and velocity eventually0.000, Azure/Lilac/Sage continue positive spikes. Restore Amber:12492 spikes and resumed velocity. Select Azure: candidate changes to Morrow; Silence yields Azure0 while Amber14692/Lilac17132/Sage15004 observed in that snapshot. This verifies selected-only intervention, not visual duplication of one output.
- At77wallseconds/~67.7simulationseconds: responsive; observed main-page JS heap73MB (not total process/worker memory). Browser worker-step values vary with load (~10–21ms observed baseline). Simulation scheduling targets20Hz and may run slower than wall time; no realtime guarantee.
- npm test:8/8 pass, including actual four-worker independence test. npm run build:pass; bundle-size advisory remains.
- Methods explains shared anatomical graph vs independent state, current engineered flight decoder vs unported upstream behavior policies, separate proposed binding calculation, synthetic molecular fixtures, licenses and archived unused Flybody assets.
- Export schema updated fddd-full-flywire-colony-v4; each record includes4 per-fly entries and selected-fly identity. No browser export-download test was added in this update.
- Stale attached development tab016638CFC1D6B351D7A27332A29D3EF3 closed. Other old dev tabEED327B3CCF4FB113B0780A0A00B693A failed CDP attach; do not use it as delivery URL.
