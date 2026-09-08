// Cover images, and the stage-2 harness they share.
//
// Playwright headless. The page sets data-cover-ready="true" once it has reached
// the state in manifest.cover; the screenshot waits on it. Without that, every
// animated sandbox gets a half-loaded card.
//
// window.__hidePanels() takes the four floating panels off the map first, so
// the shot is the map rather than the map with its controls over it.
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
// 60s, not 30s, and the reason is the sunlight sandbox: a year is 880 shadow
// renders, which is under a second on a GPU and about thirty on a machine
// falling back to software rasterisation - right on the old limit. Overridable
// with --timeout for a slow box.
const TIMEOUT = Number(args.timeout) || 60000;

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
    // The four panels float OVER the map, and the shot is of the map. One call
    // takes them off; nothing puts them back, because the page is thrown away
    // right afterwards.
    await page.evaluate(() => window.__hidePanels?.());
    await page.waitForSelector('[data-timeline-paused="true"]', { timeout: TIMEOUT });
    await page.waitForSelector('[data-cover-ready="true"]', { timeout: TIMEOUT });
    ready = true;
  } catch { /* fall through - we still want the metrics and the problems */ }

  const metrics = await page.evaluate(() => window.__metrics ?? null).catch(() => null);
  // A sandbox page has a viewport; an assignment upload marks what to shoot.
  const el = (await page.$('.sandbox .viewport')) ?? (await page.$('[data-cover-target]'));
  // The frame always renders a .viewport once it is mounted, whether or not the
  // map inside it loaded. Nothing to shoot therefore means the frame was never
  // mounted, which on a sandbox route means the page is the unpublished stub.
  const nothingToShoot = !el;
  let shot = false;
  if (el) {
    await mkdir(path.dirname(out), { recursive: true });
    // Playwright waits for the element to hold still before it shoots, and on a
    // slow machine a heavy sandbox can miss that window. Caught, because one
    // sandbox that will not settle must not abandon the other six - the run
    // reports it as a failure instead.
    try {
      await el.screenshot({ path: out, timeout: TIMEOUT });
      shot = true;
    } catch (err) {
      problems.consoleErrors.push(`screenshot failed: ${err?.message ?? err}`);
    }
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
    shot,
    nothingToShoot,
    ok: ready && rendered && shot && problems.exceptions.length === 0
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
  // EVERY slug, including the ones held back. The list is hardcoded because
  // importing the registry from plain node does not work - its meta.js files
  // pull in schema.json, and a JSON import needs an import attribute node will
  // not infer. The dynamic import is tried first anyway, so the list repairs
  // itself the day that changes; keep the fallback in step with index.js.
  //
  // A sandbox with `published: false` renders a "not published yet" page with
  // no viewport on it, so there is nothing to shoot. That is reported as SKIP
  // rather than FAIL - the page is doing what it should - and its existing
  // cover is left where it is.
  const mod = await import('../src/lib/sandboxes/index.js').catch(() => null);
  const slugs = mod?.allSandboxes
    ? mod.allSandboxes.map((s) => s.slug)
    : ['studio-twin', 'pencil', 'after-five', 'coefficients', 'sunlight', 'anthromes', 'bathtub'];
  for (const slug of slugs) {
    const r = await capture(browser, `${BASE}/sandboxes/${slug}/`, `static/covers/${slug}.png`);
    if (r.nothingToShoot) {
      console.log(`skip ${slug} - not published, no map on the page`);
      continue;
    }
    report.push(r);
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${slug}`);
  }
}

await browser.close();
await writeFile('var/cover-report.json', JSON.stringify(report, null, 2)).catch(() => {});
if (report.some((r) => !r.ok)) process.exitCode = 1;
