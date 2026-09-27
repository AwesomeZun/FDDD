# Brain and ventral nerve cord: checked2026-09-14

The user is correct: MaleCNSv1.0 is a public connected male brain+VNC dataset with intact neck connective, released2026-06-08. Insects have a ventral nerve cord, functionally analogous to, but not literally, a vertebrate spinal cord.

Primary source: https://www.janelia.org/project-team/flyem/male-cns-connectome
Download: https://male-cns.janelia.org/download
Official publication: https://www.cell.com/cell/fulltext/S0092-8674%2826%2900942-6
The official source describes a fully proofread/annotated connected CNS and CC BY4.0 data. Full connection graph and annotations are available, not merely visualization meshes. The current FDDD runtime now uses the selected MaleCNS v1.0 brain+VNC model:165122 Traced plus2000 added null-status segments, including1991 explicitly Out of scope. Not the official traced count or full unfiltered graph. See malecns-migration.md.

BANC is another same-specimen female brain+VNC resource, with specimen exclusions including lamina/ocelli: https://www.nature.com/articles/s41586-026-10735-w ; https://doi.org/10.7910/DVN/7WTH1N . Do not call these exclusions a completely missing cord, or claim every visual structure is included.

MANC and FANC are standalone VNC datasets. Appending them to the different-specimen FlyWire brain would be a synthetic reconstruction, not measured whole-CNS connectivity. The MaleCNS backend now has its own pinned neuronIDs, edges, filters, neurotransmitter assumptions, measured anatomy and motor/sensory mapping. Current counts and recording are dataset-specific. BANC would require a separate implementation.

Licensing note: primary connectivity releases and source EM imagery may have different licenses. Preserve the current inherited bundle notice until its exact source lineage is audited; do not generalize EM noncommercial terms to every public connectivity dataset.
