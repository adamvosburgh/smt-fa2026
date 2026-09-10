// Issue one submission token per student, from the registrar's roster export.
//
//   npm run tokens                       # every .csv in var/roster/
//   npm run tokens -- path/to/a.csv ...  # named files instead
//   npm run tokens -- --dry-run          # parse and report, write nothing
//   npm run tokens -- --reissue ab1234   # a new token for one person, or a
//                                        #   comma-separated list
//   npm run tokens -- --revoke ab1234    # turn one off and issue nothing
//
// The roster files are the SSOL / CourseWorks CSV export, unmodified: a
// two-line preamble, a blank line, then a header row with First Name, Last
// Name, UNI and Student Email. Roster and waitlist exports are read the same
// way and a UNI seen in both is one student. Put them in var/roster/ - var/ is
// gitignored, and those files carry student records.
//
// The PID column is deliberately never read. A university ID number cannot be
// rotated and is reused across university systems, so nothing here should hold
// one, hashed or otherwise: the number space is small enough that a hash of it
// is reversible in seconds.
//
// A token is `<uni>-<32 random base64url characters>`. The UNI prefix is not a
// credential. The server hashes the whole string and never parses it; the
// prefix is there so a token quoted in a support email, or turned up in a log,
// can be traced to a person without a lookup.
//
// Only the SHA-256 of each token is stored, in var/tokens.json, which is why a
// leak of that file hands nobody a working token. The plaintext exists in
// exactly one place - var/roster-tokens.csv, written here for the mail merge.
// Send the emails, then delete that file. After that a lost token is not
// recoverable and has to be reissued.
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const VAR = 'var';
const TOKENS = path.join(VAR, 'tokens.json');
const MERGE = path.join(VAR, 'roster-tokens.csv');
const ROSTER_DIR = path.join(VAR, 'roster');

// --- arguments ------------------------------------------------------------

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const next = argv[i + 1];
  const takesValue = next !== undefined && !next.startsWith('--');
  argv.splice(i, takesValue ? 2 : 1);
  return takesValue ? next : true;
}
const dryRun = flag('--dry-run') === true;
const list = (v) => String(v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const reissue = new Set(list(flag('--reissue')));
const revoking = new Set(list(flag('--revoke')));
const origin = String(flag('--origin') || process.env.ORIGIN || 'https://simmodeltwin.net').replace(/\/+$/, '');
const files = argv.filter((a) => !a.startsWith('--'));

// --- CSV ------------------------------------------------------------------

// Enough CSV for a registrar export: quoted fields, doubled quotes inside them,
// CRLF. Not a general parser and does not need to be.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const norm = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// The export opens with a count and a blank line, so the header is not row one.
// Find it by looking for the column we cannot do without.
function findHeader(rows) {
  return rows.findIndex((r) => r.some((c) => norm(c) === 'uni'));
}

function column(header, ...names) {
  for (const want of names) {
    const i = header.findIndex((h) => norm(h) === want);
    if (i >= 0) return i;
  }
  return -1;
}

async function readRoster(file) {
  const rows = parseCsv((await readFile(file, 'utf8')).replace(/^﻿/, ''));
  const h = findHeader(rows);
  if (h < 0) throw new Error(`${file}: no header row with a UNI column. Is this the CSV export?`);
  const header = rows[h];
  const iFirst = column(header, 'first name', 'first');
  const iLast = column(header, 'last name', 'last');
  const iUni = column(header, 'uni');
  const iEmail = column(header, 'student email', 'email');
  if (iFirst < 0 || iLast < 0) {
    throw new Error(`${file}: need First Name and Last Name columns. Found: ${header.join(', ')}`);
  }
  const out = [];
  for (const r of rows.slice(h + 1)) {
    const uni = (r[iUni] ?? '').trim().toLowerCase();
    const first = (r[iFirst] ?? '').trim();
    const last = (r[iLast] ?? '').trim();
    if (!uni || !first || !last) continue;
    out.push({
      uni,
      first,
      last,
      name: `${first} ${last}`,
      email: (iEmail >= 0 ? (r[iEmail] ?? '').trim() : '') || `${uni}@columbia.edu`,
      source: path.basename(file)
    });
  }
  return out;
}

// --- students -------------------------------------------------------------

const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
   .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let sources = files;
if (!sources.length) {
  try {
    sources = (await readdir(ROSTER_DIR)).filter((f) => f.toLowerCase().endsWith('.csv'))
      .sort().map((f) => path.join(ROSTER_DIR, f));
  } catch { sources = []; }
}
if (!sources.length) {
  console.error(`No roster files. Put the CSV exports in ${ROSTER_DIR}/ or name them on the command line.`);
  process.exit(1);
}

const byUni = new Map();
for (const file of sources) {
  for (const s of await readRoster(file)) {
    if (byUni.has(s.uni)) byUni.get(s.uni).source += `, ${s.source}`;
    else byUni.set(s.uni, s);
  }
}
const students = [...byUni.values()].sort((a, b) => a.last.localeCompare(b.last));

// The submission path is <lastname-firstname>/<sandbox>, and it is the gallery
// URL, so it stays readable. Two students who slug the same get their UNI
// appended - both of them, so nobody's folder depends on roster order.
const seen = new Map();
for (const s of students) {
  s.slug = `${slugify(s.last)}-${slugify(s.first)}`;
  seen.set(s.slug, (seen.get(s.slug) ?? 0) + 1);
}
for (const s of students) {
  if (seen.get(s.slug) > 1) {
    console.warn(`! slug collision on ${s.slug} - using ${s.slug}-${s.uni}`);
    s.slug = `${s.slug}-${s.uni}`;
  }
}

// --- token table ----------------------------------------------------------

let table = { tokens: {} };
try { table = JSON.parse(await readFile(TOKENS, 'utf8')); } catch {}
table.tokens ??= {};

const active = new Map(); // uni -> hash
for (const [hash, rec] of Object.entries(table.tokens)) {
  if (!rec.revoked && rec.uni) active.set(rec.uni, hash);
}

const issued = [];
const kept = [];

for (const s of students) {
  if (revoking.has(s.uni)) continue;
  if (active.has(s.uni) && !reissue.has(s.uni)) { kept.push(s); continue; }
  const was = active.has(s.uni);
  for (const [hash, rec] of Object.entries(table.tokens)) {
    if (rec.uni === s.uni || rec.student === s.slug) table.tokens[hash].revoked = true;
  }
  const token = `${s.uni}-${randomBytes(24).toString('base64url')}`;
  table.tokens[createHash('sha256').update(token, 'utf8').digest('hex')] = {
    student: s.slug,
    name: s.name,
    uni: s.uni,
    email: s.email,
    issued: new Date().toISOString(),
    revoked: false
  };
  issued.push({ ...s, token, status: was ? 'reissued' : 'new' });
}

for (const uni of revoking) {
  let n = 0;
  for (const [hash, rec] of Object.entries(table.tokens)) {
    if (rec.uni === uni && !rec.revoked) { table.tokens[hash].revoked = true; n++; }
  }
  console.log(`revoked ${n} token(s) for ${uni}`);
}

// A token whose UNI is no longer in any roster file. Not revoked automatically:
// a stale export would quietly cut off a student mid-semester. Decide by hand.
const rosterUnis = new Set(students.map((s) => s.uni));
const orphans = [...active.keys()].filter((u) => !rosterUnis.has(u) && !revoking.has(u));

// --- output ---------------------------------------------------------------

const csvField = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const enrollUrl = (token) => `${origin}/enroll/?t=${encodeURIComponent(token)}`;

console.log(`\nroster: ${sources.length} file(s), ${students.length} students`);
console.log(`  issued  ${issued.length}`);
console.log(`  kept    ${kept.length} (already have a live token; not in the mail merge)`);
if (orphans.length) console.log(`  orphan  ${orphans.length}: ${orphans.join(', ')} - has a token, not on the roster`);

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
  for (const s of issued) console.log(`  ${s.uni.padEnd(8)} ${s.slug.padEnd(28)} ${s.name}`);
  process.exit(0);
}

await mkdir(VAR, { recursive: true });
await writeFile(TOKENS, JSON.stringify(table, null, 2));

if (issued.length) {
  const header = ['first', 'last', 'name', 'uni', 'email', 'slug', 'token', 'enroll_url', 'status'];
  const lines = [header.join(',')];
  for (const s of issued) {
    lines.push([s.first, s.last, s.name, s.uni, s.email, s.slug, s.token, enrollUrl(s.token), s.status]
      .map(csvField).join(','));
  }
  await writeFile(MERGE, lines.join('\n') + '\n');
}

console.log(`\nwrote ${TOKENS} (hashes only)`);
if (issued.length) {
  console.log(`wrote ${MERGE} - ${issued.length} row(s), PLAINTEXT TOKENS.`);
  console.log('Run the mail merge, then delete that file. The tokens are not recoverable afterwards.');
} else {
  console.log('no new tokens, so no mail merge file was written.');
}
