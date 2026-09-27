# Fly design studio

Standalone page: http://localhost:5177/fly-designs.html

The existing MaleCNS experiment is untouched. Vite builds both index.html and fly-designs.html; the existing server serves both without restarting. This design preview does not create CNS workers, run docking, or write neural records. Candidate selection uses localStorage only (fddd.fly-design), never modifies the experiment.

Six original procedural Three.js candidates: ONYX balanced biomorphic graphite; AERO slender aerodynamic carbon; PRISM faceted titanium; VEIL translucent shell and spine; VECTOR open structural wireframe; IVORY broad ceramic shell. All have two wings, six jointed legs, restrained eyes and paired antennae. Same geometry-world scale in overview; variants intentionally differ in anatomy dimensions. Materials alone do not define the variants. Wing animation and hovering are authored preview motion, not biological or neural activity. Prefers-reduced-motion starts paused.

Controls: 6-design overview, enlarged selected design, candidate buttons, click meshes to select, pause/resume, reset view, orbit/pan/zoom. Environments: three-dimensional vector-grid floor/walls/axes; depth portal frames; quiet empty space. Same scene renderer/lighting for fair comparison. Background particles are fixed, not neural signals.

Geometry modules: src/design-studio/models.ts; background module environment.ts. No imported fly assets and no external image/font dependency. WebGL failures are explicit. Geometry verification in src/design-studio/geometry-verification.json. Typecheck/build pass; existing31tests pass. Browser visual QA remains parent responsibility.

## Drosophila correction
User rejected the first silhouettes as mosquito-like. All six now share a compact Drosophila-inspired anatomy: stout .67-wide thorax, short .76-long broad rounded abdomen with wide transverse geometry bands, short jointed legs (maximum lateral reach .538), very short antennae with branched aristae, flush matte reddish-brown compound eyes, short mouth lobes and paired halteres. Wings are broad/rounded (length1.0–1.1, width.82–.88) and swept rearward. Membrane and veins share negative-Z coordinates; the parent's vein-direction fix remains intact.

AERO was renamed MICA (stable id retained to avoid invalidating local selection) and no longer uses an elongated thin body. Variants now differ primarily by render language: natural satin, minimal matte, faceted, translucent, wireframe, warm ceramic. They are not six different insect body plans. Geometry checks explicitly enforce six legs, two eyes, two antennae, two halteres, short mouthparts, at least four abdominal bands and the compact proportion limits. These remain authored illustrative designs, not taxonomically exact reconstructions. Stage, environment and main UI were not edited in this correction.

## User correction and final QA
User twice rejected mosquito/bee silhouettes. All six rebuilt on one compact Drosophila body plan; AERO renamed MICA (stable storage ID retained). Reference photograph (André Karwath, CC BY-SA2.5) stored in references/drosophila with attribution. Parent reduced regular bee-like bands to subtle anterior cuticle boundaries plus darker male posterior, corrected wing veins to membrane coordinates, and added folded-wing/flight-pose toggle. Folded wings are raised over the dorsal abdomen in this authored display pose. These remain stylized procedural studies, not measured anatomical reconstructions.

Browser verified all six selection buttons, enlarged/overview, wing spread/fold, motion pause/resume, Vector/Cyber/Quiet environment switching. All31existingtests pass;6anatomy/finitegeometry checks pass; build/typecheck pass. Seven recorded simulation-source/data hashes unchanged, proving mainMaleCNS app unaffected. No CNS workers, file downloads or neural recordings are started by this preview.
