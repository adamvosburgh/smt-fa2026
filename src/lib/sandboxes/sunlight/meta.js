export default {
  slug: 'sunlight',
  number: 5,
  title: 'Where the Sunlight Goes',
  subtitle: 'A single floor plate in real context, units false-colored by annual direct sun hours.',
  status: 'planned',
  kind: 'simulation',
  blurb:
    'Shadows animate across a day and across the year. Per-unit table beside it; the daylit band drawn against the deep core. This is the sandbox where the uploaded asset is the point - any adequately prepped glTF works, including your own.',
  controls: ['date', 'time of day', 'floor number', 'unit depth', 'context on/off', 'analysis period'],
  metrics: ['% of floor area within the daylit band', 'units meeting the hours threshold', 'min / median hours per unit', 'deepest lit point', 'units that are legal but dark'],
  data: ['uploaded glTF (unit_*, window_*, core, slab) + lat/lon', 'DCP 3D Building Model for context', 'suncalc solar positions'],
  cannotSee:
    'Radiometrically honest, socially blind. Nothing about who gets the north-facing unit. And it reports direct sun hours, not true sDA, which needs radiance-based interreflection.',
  tutorial: null,
  live: false
};
