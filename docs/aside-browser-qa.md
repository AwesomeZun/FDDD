# Aside browser QA, 2026-09-14

Opened live app at http://127.0.0.1:5173/ with Aside browser. Actual anatomical fly, illustrative molecular chamber and brain atlas rendered. Found and fixed high-DPI canvas CSS overflow with explicit width/height 100% for both 3D canvases. Rebuilt successfully and reran all 5 tests (pass).

Verified via fresh accessibility snapshots: single-step (80-cell activity 0.285, priority35.87), candidate change, silenced mode (all activity0, priority50), reset, baseline restart, automatic screening through all 8 candidates, pause at176/192 steps, target selector, Methods open. Actual JSON browser download succeeded as artifacts/fddd-example-run.json. JSON/CSV serialization covered by automated tests; CSV browser download and mobile layout not independently exercised. No efficacy/docking validation claimed.

Proof: session tmp/fddd-dashboard-proof.jpg. Local Vite process PID41977. Source bundle rebuilt after CSS correction. Actual model: CLI gpt-6-astra low verified; Aside session model setting updated per user request. Chat6Pro final strategy remains blocked by exhausted workspace quota, not misrepresented as completed.
