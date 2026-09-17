// See an assignment board build itself, locally, before the real due date.
//
//   node scripts/try-assignment-board.js                     # assignment-01, 12 test submissions
//   node scripts/try-assignment-board.js assignment-02 --students 30
//   node scripts/try-assignment-board.js --from path/to/submissions
//                                                            # real submissions copied off the box
//   node scripts/try-assignment-board.js --port 5181
//
// It starts a second dev server (5180 by default, so `npm run dev` on 5173 can
// keep running) with everything pointed into var/try-board/, which is
// gitignored and wiped at the start of each run:
//
//   var/try-board/tokens.json     a copy of var/tokens.json, so your token works
//   var/try-board/submissions/    test submissions, or the ones from --from
//   var/try-board/boards/         where the board lands
//
// The server's clock (Date.now) is moved to one minute past the assignment's
// due moment, so the ticker in src/hooks.server.js builds the board on start,
// exactly as it will at 9:00 on the due date. Nothing under src/submissions or
// var/boards is touched.
//
// The test submissions say they are test submissions, in the title and the
// gallery text. Their covers are flat colored PNGs.
//
// Once it is up, submitting through the assignment page on this server (as
// yourself) lands in var/try-board/submissions and shows the late-tile path:
// a new tile appears on the open board without a restart.
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';
import { load as parseYaml } from 'js-yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- arguments ------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
}
const students = Number(flag('--students', 12));
const from = flag('--from', null);
const port = Number(flag('--port', 5180));
const slug = argv.find((a) => !a.startsWith('--')) ?? 'assignment-01';

// --- the assignment and its due moment -------------------------------------
const mdPath = path.join(root, 'src/content/assignments', `${slug}.md`);
if (!existsSync(mdPath)) fail(`no such assignment: ${slug}`);
const fm = parseYaml(/^---\r?\n([\s\S]*?)\r?\n---/.exec(await readFile(mdPath, 'utf8'))?.[1] ?? '') ?? {};
if (fm.submit !== true) fail(`${slug} does not take uploads (submit: true), so it never gets a board`);

// The same rule as dueAt() in src/lib/content.js.
const due = /^(\d{1,2})\/(\d{1,2})$/.exec(String(fm.due ?? '').trim());
const year = /^(\d{4})-\d{2}-\d{2}$/.exec(String(fm.publish ?? ''));
if (!due || !year) fail(`${slug} needs both due: and publish: in its frontmatter to get a board`);
const ymd = `${year[1]}-${due[1].padStart(2, '0')}-${due[2].padStart(2, '0')}`;
const dueAt = Date.parse(`${ymd}T${ymd < '2026-11-01' ? '04' : '05'}:00:00Z`) + 9 * 3600 * 1000;
const offset = Math.max(0, dueAt + 60_000 - Date.now());

// --- a clean scratch tree --------------------------------------------------
const dir = path.join(root, 'var', 'try-board');
await rm(dir, { recursive: true, force: true });
await mkdir(path.join(dir, 'submissions'), { recursive: true });

const tokens = path.join(root, 'var', 'tokens.json');
if (existsSync(tokens)) await cp(tokens, path.join(dir, 'tokens.json'));
else console.log('try-board: no var/tokens.json, so no token will work on this server');

if (from) {
  let n = 0;
  for (const student of await readdir(from)) {
    const src = path.join(from, student, slug);
    if (!existsSync(path.join(src, 'manifest.json'))) continue;
    await cp(src, path.join(dir, 'submissions', student, slug), { recursive: true });
    n++;
  }
  console.log(`try-board: copied ${n} submissions for ${slug} from ${from}`);
} else {
  for (let i = 1; i <= students; i++) {
    const student = `test-student-${String(i).padStart(2, '0')}`;
    const sub = path.join(dir, 'submissions', student, slug);
    await mkdir(path.join(sub, 'assets'), { recursive: true });
    await writeFile(path.join(sub, 'cover.png'), flatPng(800, 600, (i * 137) % 360));
    await writeFile(
      path.join(sub, 'manifest.json'),
      JSON.stringify(
        {
          sandbox: slug,
          kind: 'assignment',
          student,
          title: `Test submission ${i}`,
          gallery_text: 'A test submission made by scripts/try-assignment-board.js. Not real work.',
          description: '',
          params: {},
          primary: 'assets/none',
          assets: [],
          cover_file: 'cover.png',
          submitted: new Date().toISOString(),
          app_version: '0.1.0'
        },
        null,
        2
      )
    );
  }
  console.log(`try-board: wrote ${students} test submissions for ${slug}`);
}

// --- the moved clock -------------------------------------------------------
const clock = path.join(dir, 'clock.mjs');
await writeFile(clock, `const real = Date.now;\nDate.now = () => real() + ${offset};\n`);

// --- the server ------------------------------------------------------------
const base = `http://localhost:${port}`;
console.log(`try-board: clock moved ${(offset / 3600000).toFixed(1)}h forward, to just past ${slug}'s due moment (${ymd} 9:00 New York)`);
const server = spawn('npx', ['vite', 'dev', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    ORIGIN: base,
    SMT_STATE_DIR: dir,
    SMT_SUBMISSIONS_DIR: path.join(dir, 'submissions'),
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${pathToFileURL(clock).href}`.trim()
  }
});
const stop = () => server.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));

// The ticker starts on the server's first request.
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    if ((await fetch(base + '/')).ok) break;
  } catch {
    // Not up yet.
  }
}
console.log(`\ntry-board: ${base}/whiteboard/${slug}/`);
console.log(`try-board: ${base}/assignments/${slug}/   (submit here to see a late tile arrive)`);
console.log('try-board: Ctrl+C to stop. The board is in var/try-board/boards/.\n');

// --- helpers ---------------------------------------------------------------
function fail(message) {
  console.error(`try-board: ${message}`);
  process.exit(1);
}

// A PNG of one flat color, hue in degrees. No image library needed.
function flatPng(w, h, hue) {
  const f = (n) => {
    const k = (n + hue / 60) % 6;
    return Math.round(255 * (0.75 - 0.5 * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([f(5), f(3), f(1)], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
