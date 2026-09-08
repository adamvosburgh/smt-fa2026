// Where the sun is, what time it is where the model is, and which instants one
// accumulation runs over.
//
// No three.js in here on purpose. This is the arithmetic that decides where the
// light comes from, it is the part worth checking against an almanac, and it is
// checkable without a browser.
//
// suncalc is PINNED at 1.9.0, which returns RADIANS, with `azimuth` measured
// from south and positive towards west. 2.0.2 (September 2026) returns degrees,
// changed its module shape, and ships no license field in its npm metadata. Do
// not upgrade it without rewriting sunAltAz and re-running the checks in the
// dev notes.
import SunCalc from 'suncalc';

const DEG = 180 / Math.PI;

// 2026 is not a leap year. The sandbox's day_of_year runs 1-365 in this year and
// nothing in the model depends on the year beyond the sun's position, which
// moves by a few minutes of arc between one year and the next.
export const YEAR = 2026;
export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const STEP_MINUTES = 10;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// --- local civil time -----------------------------------------------------
//
// There is no API that turns a wall-clock reading in a named zone into a UTC
// instant, so we go the other way round: guess, format the guess in the zone,
// read how far off it is, and correct. Two iterations converge. Daylight-saving
// changes are handled because the second guess is at most an hour out and the
// zone's own data answers for the hour it lands in. No offset is hard-coded
// anywhere.
const formatters = new Map();

function formatterFor(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    formatters.set(timeZone, f);
  }
  return f;
}

// How far ahead of UTC the zone is at this instant, in milliseconds.
export function zoneOffsetMs(date, timeZone) {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  // en-US with hour12:false writes midnight as hour 24, which Date.UTC would
  // roll into the next day.
  const hour = Number(parts.hour) % 24;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

// The UTC instant whose wall-clock reading in `timeZone` is the one asked for.
export function zonedInstant({ year = YEAR, month, day, hour = 0, minute = 0, timeZone }) {
  const wall = Date.UTC(year, month, day, hour, minute);
  let t = wall;
  for (let i = 0; i < 2; i++) t = wall - zoneOffsetMs(new Date(t), timeZone);
  return new Date(t);
}

// day_of_year (1-365) to a calendar month and day.
export function dateOfYear(dayOfYear, year = YEAR) {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(d.getUTCDate() + Math.round(dayOfYear) - 1);
  return { month: d.getUTCMonth(), day: d.getUTCDate() };
}

export function dayOfYearOf(month, day, year = YEAR) {
  const jan1 = Date.UTC(year, 0, 1);
  return Math.round((Date.UTC(year, month, day) - jan1) / 86400000) + 1;
}

// "21 June" - what the day_of_year slider prints.
export function formatDayOfYear(dayOfYear, year = YEAR) {
  const { month, day } = dateOfYear(dayOfYear, year);
  return `${day} ${MONTH_NAMES[month]}`;
}

// The clock's hour and day, in the model's zone, as one UTC instant.
export function instantFor({ hour, dayOfYear, timeZone, year = YEAR }) {
  const { month, day } = dateOfYear(dayOfYear, year);
  const whole = Math.floor(hour);
  return zonedInstant({
    year,
    month,
    day,
    hour: whole,
    minute: Math.round((hour - whole) * 60),
    timeZone
  });
}

// --- where the sun is -----------------------------------------------------

// Altitude and azimuth in degrees, azimuth measured clockwise from north. This
// is the pair the metrics strip prints, so it is the pair a reader can check
// against an almanac without knowing anything about the model's axes.
export function sunAltAz(date, latitude, longitude) {
  const p = SunCalc.getPosition(date, latitude, longitude);
  return {
    altitude: p.altitude * DEG,
    azimuth: (((p.azimuth * DEG + 180) % 360) + 360) % 360
  };
}

// The direction TOWARDS the sun, in the file's axes: +X east, +Y up, -Z north.
// Returns null when the sun is below the horizon, which is the signal to draw
// no direct light and to skip the accumulation step.
//
//   azimuth from north = suncalc's azimuth + PI
//   east  = sin(azN) * cos(alt)
//   north = cos(azN) * cos(alt)
//   up    = sin(alt)
//
// northDeg rotates the vector about +Y for a model that was not built with north
// up, using the right-hand rule about +Y - the same sense as three.js's
// Matrix4.makeRotationY, so a positive north_deg turns the sun the same way
// rotating the model by that angle in three.js would.
export function sunVector(date, latitude, longitude, northDeg = 0) {
  const p = SunCalc.getPosition(date, latitude, longitude);
  if (!(p.altitude > 0)) return null;
  const azN = p.azimuth + Math.PI;
  const east = Math.sin(azN) * Math.cos(p.altitude);
  const north = Math.cos(azN) * Math.cos(p.altitude);
  const up = Math.sin(p.altitude);
  let x = east;
  const y = up;
  let z = -north;
  if (northDeg) {
    const t = (northDeg * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const nx = x * c + z * s;
    z = -x * s + z * c;
    x = nx;
  }
  return { x, y, z, altitudeDeg: p.altitude * DEG, azimuthDeg: (((azN * DEG) % 360) + 360) % 360 };
}

// --- the schedule ---------------------------------------------------------

// Every instant one day contributes to an accumulation: ten-minute steps, from
// the first step after sunrise to the last before sunset.
//
// Steps are aligned to ten-minute marks of the UTC epoch rather than to sunrise
// itself, so two days of the same month land on the same clock times and the
// year's twelve days are comparable. Every zone in the schema is a whole, half
// or quarter hour from UTC, so those marks are also clean local times.
//
// Above the Arctic and Antarctic circles getTimes returns Invalid Date for a day
// with no sunrise or no sunset. A student can put their model there, so the
// fallback walks the whole day and keeps the steps where the sun is up.
export function daySteps({ dayOfYear, latitude, longitude, timeZone, year = YEAR, stepMinutes = STEP_MINUTES }) {
  const { month, day } = dateOfYear(dayOfYear, year);
  const noon = zonedInstant({ year, month, day, hour: 12, timeZone });
  const step = stepMinutes * 60000;
  const times = SunCalc.getTimes(noon, latitude, longitude);
  const rise = times.sunrise?.getTime();
  const set = times.sunset?.getTime();
  const out = [];

  if (Number.isFinite(rise) && Number.isFinite(set) && set > rise) {
    for (let t = Math.ceil(rise / step) * step; t < set; t += step) out.push(new Date(t));
    return out;
  }

  const start = zonedInstant({ year, month, day, hour: 0, timeZone }).getTime();
  for (let t = Math.ceil(start / step) * step; t < start + 86400000; t += step) {
    const d = new Date(t);
    if (SunCalc.getPosition(d, latitude, longitude).altitude > 0) out.push(d);
  }
  return out;
}

// What one accumulation covers.
//
//   year   twelve representative days, the 15th of each month, each WEIGHTED by
//          its month's length. The counter adds the weight rather than 1, which
//          keeps it an exact integer (365 x 91 steps is well under the 65,535 a
//          two-channel byte counter holds) and makes the reported figure hours
//          on an average day of the year rather than hours on an average of
//          twelve days.
//   month  the 15th of the month the clock's day falls in, weight 1.
//   day    the day on the clock, weight 1.
//
// `maxDayHours` is the longest day in the period and is what the `hours` color
// scale runs to, so December's nine hours and June's fifteen are not squeezed
// into the same color. `daylightHours` is the period's daylight, weighted the
// same way as the counter, and is what `share` divides by - taken from the step
// count rather than from sunrise-to-sunset so a share can never exceed 100%.
export function periodSchedule({ period, dayOfYear, latitude, longitude, timeZone, year = YEAR, stepMinutes = STEP_MINUTES }) {
  const stepHours = stepMinutes / 60;
  let days;

  if (period === 'year') {
    days = MONTH_LENGTHS.map((len, m) => ({
      dayOfYear: dayOfYearOf(m, 15, year),
      weight: len
    }));
  } else if (period === 'month') {
    const { month } = dateOfYear(dayOfYear, year);
    days = [{ dayOfYear: dayOfYearOf(month, 15, year), weight: 1 }];
  } else {
    days = [{ dayOfYear: Math.round(dayOfYear), weight: 1 }];
  }

  let passes = 0;
  let maxDayHours = 0;
  let weightedSteps = 0;
  let totalWeight = 0;
  for (const d of days) {
    d.steps = daySteps({ dayOfYear: d.dayOfYear, latitude, longitude, timeZone, year, stepMinutes });
    passes += d.steps.length;
    maxDayHours = Math.max(maxDayHours, d.steps.length * stepHours);
    weightedSteps += d.weight * d.steps.length;
    totalWeight += d.weight;
  }

  return {
    period,
    days,
    passes,
    stepHours,
    totalWeight,
    maxDayHours,
    daylightHours: totalWeight ? (weightedSteps * stepHours) / totalWeight : 0
  };
}
