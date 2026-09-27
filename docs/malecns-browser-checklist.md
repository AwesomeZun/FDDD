# MaleCNS integration QA checklist
- Current FlyWire backup is project-local at backups/flywire-before-malecns; restore build/tests passed (existing dependencies reused).
- Original final FlyWire export:72696 unique full-neuron frames,71 segments; all spike bit counts and finite positions verified.84 generated browser-download files moved into project backup.
- First MaleCNS browser session ran31612 frames (all4workers tick7903) and was paused before final UI update. Records remain in IndexedDB; no deletion performed.
- Final checks pending: common Angstrom scale, radius-aware movement, save-to-project button, zero browser downloads, fresh MaleCNS record frame and identity verification.

## Final results
-31 tests pass; production build/typecheck pass.
- Current selected167122neurons/6241236edges and4independent liveworkers confirmed inbrowser.
- Shared0.03world/Å orthographic scene, all8complexes loaded; measuredCOX/PARPlinear ratio2.27007. Zoom and rotation exercised. Resetviewadded afterorbitQA torestorefit.
- Radius-aware approach/arena now derives fromactualreceptorbounds. Proximityisbounding-sphereheuristic; bodyavatarisnotphysicalmolecularscale.
- Saved5184actualCNSframes in6projectlocalZIPsegments. Each20891-byte frame has167122validbits and6zeropaddingbits. Allpopcounts, neuronidentitylength andfinitepositions verified; no duplicatedfly/tick. NewbrowserDownloads=[] (verified filesystem before/after).
- Resumedliveafterexport. AdditionalongoingframescontinueIndexedDBcapture. Noautomaticdownloadfallback exists.
