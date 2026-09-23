// Markdown content pipeline.
//
// We render markdown with markdown-it rather than mdsvex on purpose. It keeps
// Adam's Methods conventions working unchanged (markdown-it-attrs for
// `#img-full`, raw HTML allowed, linkify on) and it means `{` and `<` in a code
// sample are never mistaken for Svelte syntax. The cost is that you cannot write
// a Svelte component tag in prose - instead you write a mount div:
//
//   <div data-sandbox="bathtub" data-mode="view" data-params='{"slr_m":1.5}'></div>
//
// ...and <SandboxMounts> in the page layout finds it and mounts the real
// component into it. See src/lib/components/SandboxMounts.svelte.

import { load as parseYaml } from 'js-yaml';
import { SHOW_UNPUBLISHED, isPublished } from './visibility.js';
import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import anchor from 'markdown-it-anchor';

const md = new MarkdownIt({ html: true, breaks: false, linkify: true })
  .use(attrs)
  // Stable section anchors are load-bearing: the build doctor points students at
  // `/tutorials/05-bathtub/#what-came-out`, and the hand-written failure map
  // keys off these slugs. Do not change the slugify rule without migrating it.
  .use(anchor, {
    level: [2, 3],
    slugify: (s) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-'),
    permalink: anchor.permalink.headerLink({ safariReaderFix: true })
  });

const raw = import.meta.glob('/src/content/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

// Frontmatter split. We do this by hand with js-yaml rather than using
// gray-matter, because this module is imported by universal `load` functions and
// therefore runs in the BROWSER as well as on the server - and gray-matter is a
// Node library that reaches for Buffer, which does not exist there. It fails at
// hydration, so the page still returns a clean 200 and then dies silently.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function split(source) {
  const m = FRONTMATTER.exec(source);
  if (!m) return { data: {}, content: source };
  return { data: parseYaml(m[1]) ?? {}, content: source.slice(m[0].length) };
}

// Section headings, read back out of the RENDERED html rather than out of the
// markdown, so the ids are the ones markdown-it-anchor actually put on the page
// and a heading listed here always matches a working anchor. The permalink
// plugin wraps the heading text in an <a>, so the inner tags come off.
//
// The assistant's prompt carries this index for every live tutorial - see
// src/lib/assistant-prompt.js - which is how it can name a section rather than
// paraphrase one it has not read.
const HEADING = /<h([23])\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g;

function headingsOf(html) {
  const out = [];
  for (const [, level, id, inner] of html.matchAll(HEADING)) {
    const text = inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) out.push({ level: Number(level), id, text });
  }
  return out;
}

function parse(filepath, source) {
  const { data, content } = split(source);
  const rel = filepath.replace(/^\/src\/content\//, '').replace(/\.md$/, '');
  const [section, ...rest] = rel.split('/');
  const slug = rest.join('/') || section;
  // Rendered lazily-ish; cheap enough at this corpus size to do eagerly.
  const html = md.render(content);
  return {
    ...data,
    section,
    slug,
    url: section === 'syllabus' ? '/' : `/${section}/${slug}/`,
    filepath,
    html,
    headings: headingsOf(html),
    excerpt: content.replace(/[#*`>\-\[\]]/g, '').trim().slice(0, 240)
  };
}

// NOT filtered here. `published: false` used to drop a document before anything
// could see it, which meant SMT_SHOW_UNPUBLISHED could not show it either. The
// filter is in isLive() now, so one switch reveals everything held back.
const all = Object.entries(raw).map(([filepath, source]) => parse(filepath, source));

const bySequence = (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0);

// ------------------------------------------------------------------ //
// Publishing.                                                         //
// ------------------------------------------------------------------ //
//
// Every tutorial and assignment carries `publish: "YYYY-MM-DD"` and is on the
// site from 00:00 America/New_York on that date. Dev notes (`devnotes: true`)
// carry no date and are always live.
//
// This module runs in the browser as well as on the server, so the test is a
// pure function of Date.now() with no library behind it. 2026's daylight saving
// change is 1 November, so a course date before it is EDT (UTC-4) and one from
// it on is EST (UTC-5). The course ends 19 November; the two-line rule covers
// the whole term.
const DST_ENDS_2026 = '2026-11-01';

export function startOfDayNY(ymd) {
  const offset = String(ymd) < DST_ENDS_2026 ? '04' : '05';
  return Date.parse(`${ymd}T${offset}:00:00Z`);
}

// 9:00 New York on the due date. The year is the year of `publish:`, so a due
// date is never ambiguous, and the DST rule above applies. Null when either
// field is missing.
export function dueAt(d) {
  const due = /^(\d{1,2})\/(\d{1,2})$/.exec(String(d?.due ?? '').trim());
  const year = /^(\d{4})-\d{2}-\d{2}$/.exec(String(d?.publish ?? ''));
  if (!due || !year) return null;
  const ymd = `${year[1]}-${due[1].padStart(2, '0')}-${due[2].padStart(2, '0')}`;
  const start = startOfDayNY(ymd);
  return Number.isNaN(start) ? null : start + 9 * 3600 * 1000;
}

// Midnight New York at the end of the due date: fifteen hours after dueAt. The
// clocks change at 2am, so midnight is always on the due date's side of it.
// Student Work folds an assignment's section from this moment on.
export function closesAt(d) {
  const due = dueAt(d);
  return due === null ? null : due + 15 * 3600 * 1000;
}

// The due date as the pages show it: "9/17", unchanged from the frontmatter.
export function dueLabel(d) {
  return d?.due ? String(d.due) : null;
}

// SMT_SHOW_UNPUBLISHED=1 makes everything live, so Adam can read what students
// cannot. See src/lib/visibility.js; one switch covers documents, sandboxes and
// submissions alike.
export { SHOW_UNPUBLISHED };

export function isLive(d, now = Date.now()) {
  if (!d) return false;
  if (SHOW_UNPUBLISHED) return true;
  if (d.published === false) return false;
  if (!d.publish) return true;
  return now >= startOfDayNY(d.publish);
}

// True only under the dev flag: the item is showing but is not on the site.
export function isPending(d, now = Date.now()) {
  if (!d) return false;
  if (d.published === false) return true;
  return Boolean(d.publish) && now < startOfDayNY(d.publish);
}

// What the tag beside a pending item says. Two reasons an item can be held
// back, and they are different facts: a date it is waiting for, or a decision.
export function pendingLabel(d, now = Date.now()) {
  if (!isPending(d, now)) return null;
  if (d.published === false) return 'unpublished';
  return `publishes ${publishDate(d)}`;
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long'
});

// "9/17" from "2026-09-17", with no timezone in the arithmetic.
export function publishDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d?.publish ?? ''));
  return m ? `${Number(m[2])}/${Number(m[3])}` : null;
}

export function publishWeekday(d) {
  return d?.publish ? WEEKDAY.format(new Date(startOfDayNY(d.publish))) : null;
}

// The list of live documents in a section. Pass { all: true } where the caller
// needs the unpublished ones too - prerender entries, for instance.
export function collection(section, opts = {}) {
  const items = all.filter((d) => d.section === section);
  return (opts.all ? items : items.filter((d) => isLive(d))).sort(bySequence);
}

// Returns the document whether or not it is live. Callers that must not leak
// unpublished prose - every page load - check isLive() themselves and render
// the "publishes on" stub instead.
export function doc(section, slug) {
  return all.find((d) => d.section === section && d.slug === slug) ?? null;
}

export const tutorials = () => collection('tutorials');
export const assignments = () => collection('assignments');
export const resources = () => collection('resources');
export const syllabus = () => collection('syllabus')[0] ?? null;

export { md };
