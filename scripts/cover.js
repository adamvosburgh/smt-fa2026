// Cover images, and the stage-2 harness they share.
//
// Playwright headless. The page sets data-cover-ready="true" once it has reached
// the state in manifest.cover; the screenshot waits on it. Without that, every
// animated sandbox gets a half-loaded card.
//
// The same page load reads window.__metrics and collects console errors, failed
// requests and uncaught exceptions - which is stage 2 of the build doctor, for
// nearly nothing. Run it against a submission and you find out whether it runs
// before a human ever opens it.
//
//   node scripts/cover.js --base http://localhost:3000            # all sandboxes
//   node scripts/cover.js --base http://localhost:3000 --submissions
import { chromium } from 'playwright';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') === false ? arr[i + 1] : true] : []))
    .filter((x) => x.length)
);
const BASE = args.base || 'http://localhost:3000';
const TIMEOUT = 30000;

async function capture(browser, url, out) {
  // 1600x1000, not 1280x900, and the reason is the layout rather than taste.
  // The sandbox route is a three-column frame - card, map, controls - with the
  // two docks at a fixed 320px and the map taking what is left. At 1280 the map
  // gets under 600px and the cover comes out a portrait sliver of a thing that
  // is meant to be read wide; under 1200 the frame drops to its narrow
  // breakpoint and the cover stops being a picture of the real layout at all.
  // The map is also no longer pinned to 4:3, so the cover's shape is now the
  // window's shape and this is where it is decided.
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const problems = { consoleErrors: [], failedRequests: [], exceptions: [] };
  page.on('console', (m) => { if (m.type() === 'error') problems.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => problems.exceptions.push({ message: e.message, stack: e.stack }));
  page.on('requestfailed', (r) => problems.failedRequests.push({ url: r.url(), reason: r.failure()?.errorText }));

  let ready = false;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await page.waitForSelector('[data-cover-ready="true"]', { timeout: TIMEOUT });
    // A playing timeline means a nondeterministic cover. Set every timeline
    // to its schema default and pause, then wait for the frame to say so and
    // for the sandbox to settle again after the reset moved its params.
    await page.evaluate(() => window.__transportReset?.());
    await page.waitForSelector('[data-timeline-paused="true"]', { timeout: TIMEOUT });
    await page.waitForSelector('[data-cover-ready="true"]', { timeout: TIMEOUT });
    ready = true;
  } catch { /* fall through - we still want the metrics and the problems */ }

  const metrics = await page.evaluate(() => window.__metrics ?? null).catch(() => null);
  const el = await page.$('.sandbox .viewport');
  if (el) {
    await mkdir(path.dirname(out), { recursive: true });
    await el.screenshot({ path: out });
  }
  await ctx.close();

  const rendered = !!metrics && Object.keys(metrics).length > 0;
  return {
    url,
    ready,
    rendered,
    metrics,
    ...problems,
    // Stage 2's verdict. Stage 3 only ever fires when this is false.
    ok: ready && rendered && problems.exceptions.length === 0
  };
}

// CHROMIUM_PATH is an escape hatch for environments that already have a browser
// and do not want Playwright downloading its own.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const report = [];

if (args.submissions) {
  const root = 'src/submissions';
  for (const student of await readdir(root)) {
    for (const sandbox of await readdir(path.join(root, student))) {
      const r = await capture(
        browser,
        `${BASE}/gallery/${student}/${sandbox}/`,
        path.join(root, student, sandbox, 'cover.png')
      );
      report.push(r);
      await writeFile(path.join(root, student, sandbox, 'review.json'), JSON.stringify({ stage2: r }, null, 2));
      console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${student}/${sandbox}`);
    }
  }
} else {
  // Covers all sandboxes including hidden ones - a NotBuilt cover is harmless
  // and means unhiding later needs no cover run.
  const mod = await import('../src/lib/sandboxes/index.js').catch(() => null);
  const slugs = mod?.allSandboxes
    ? mod.allSandboxes.map((s) => s.slug)
    : ['studio-twin', 'pencil', 'after-five', 'coefficients', 'sunlight', 'anthromes', 'bathtub'];
  for (const slug of slugs) {
    const r = await capture(browser, `${BASE}/sandboxes/${slug}/`, `static/covers/${slug}.png`);
    report.push(r);
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${slug}`);
  }
}

await browser.close();
await writeFile('var/cover-report.json', JSON.stringify(report, null, 2)).catch(() => {});
if (report.some((r) => !r.ok)) process.exitCode = 1;
