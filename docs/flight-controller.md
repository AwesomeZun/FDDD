# V2: visible causal circuit-to-flight path

The original dashboard was not sufficient: it emphasized tables and a stationary operator pose. V2 adds a continuously running closed-loop scene controller.

src/lib/flight.ts consumes measured MaleCNS 80-cell topology and the adapted upstream signed leaky-tanh recurrence. Eight engineered observations combine relative waypoint position/distance, candidate fixture channels, and current speed. Sixteen descending readouts generate three motor signals through fixed cosine-weighted projections. Mean absolute output gates ALL thrust; damping acts independently. A mild authored waypoint term and centering term are gated by circuit thrust. The output changes actual world position and velocity, not just a label.

This is an engineered embodied adapter, NOT trained fly flight physiology, a demonstrated emergent behavior claim, or a drug affinity predictor. Candidate shape/assay descriptors remain synthetic. Motor learning is not implemented. Graph provenance and existing licenses remain unchanged.

Controls: disconnected graph from rest produces zero output and zero movement; silencing mid-flight removes thrust and velocity decays. Tests verify deterministic repeatability, changed trajectory for changed input, baseline displacement, and disabled motion under controls. Nine total tests passed at initial implementation.

User asked whether a full FlyWire engine could be used. Parallel code/runtime audit of snedea/flybrain is in progress; do not imply the 80-cell version is a hardware limit or a full-brain implementation. Later integration must distinguish actual full-graph computation from anatomical context and preserve runtime/data licenses.
