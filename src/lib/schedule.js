// The eleven class dates, Fall 2026. Every Thursday from 10 September to 19
// November. They agree with the Course Overview table at the top of the
// syllabus - if one of them moves, both have to move.
//
// Kept here rather than parsed out of the syllabus markdown because the home
// page's navigation aids need them before the markdown is in the DOM, and
// because a typo in a table cell should not silently move the arrow.
export const CLASS_DATES = [
  '2026-09-10',
  '2026-09-17',
  '2026-09-24',
  '2026-10-01',
  '2026-10-08',
  '2026-10-15',
  '2026-10-22',
  '2026-10-29',
  '2026-11-05',
  '2026-11-12',
  '2026-11-19'
];

// "9/10" - how the syllabus table writes the same date.
export function short(iso) {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

// Today in New York as YYYY-MM-DD. en-CA formats as ISO, which is the one
// locale trick this file leans on; everything else is string comparison.
export function todayNY(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

// The class the arrow points at: the first class date strictly after today, so
// that on a class day it already points at the following week. After the last
// class it stays on the last one. Returns { iso, week } with week 1-based.
export function nextClass(now = new Date()) {
  const today = todayNY(now);
  const i = CLASS_DATES.findIndex((d) => d > today);
  const index = i === -1 ? CLASS_DATES.length - 1 : i;
  return { iso: CLASS_DATES[index], week: index + 1 };
}
