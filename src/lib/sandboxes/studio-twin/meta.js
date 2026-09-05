export default {
  published: false,
  slug: 'studio-twin',
  title: 'Studio Twin',
  subtitle: 'The studio in 3D with a volumetric CO₂ field animating over time.',
  status: 'gated',
  statusNote: 'Gated on the sensor pilot. If CO₂ sits flat at 500-650 ppm all day, room-scale inference is dead and this falls back to desk-level presence.',
  kind: 'twin',
  blurb:
    "Dense and saturated inside the instrumented zone, dissolving toward nothing across the rest of the room - the twin's edge is visible, not hidden. Beside it: inferred occupancy for the CDP zone with a confidence band, and a room-total extrapolation with a much wider one.",
  liveCapability:
    'The sandbox refits nightly from student count submissions and reads a live sensor stream. The tutorial version reads a frozen two-week window.',
  controls: ['sensor subset', 'interpolation method', 'fit window', 'extrapolation on/off', 'event track', 'time window'],
  metrics: ['inferred occupancy (CDP zone)', 'confidence band', 'room-total extrapolation'],
  data: ['ESP32 + Sensirion SCD41 nodes via MQTT to the Pi', 'QR occupancy ground truth', 'studio geometry (glTF, Y-up, meters)'],
  cannotSee: 'It reports bodies; it measured gas. Outside the sensor hull it is guessing, and the render says so.',
  tutorial: null,
  live: true
};
