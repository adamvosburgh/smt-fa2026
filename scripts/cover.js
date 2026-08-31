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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const problems = { consoleErrors: [], failedRequests: [], exceptions: [] };
  page.on('console', (m) => { if (m.type() === 'error') problems.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => problems.exceptions.push({ message: e.message, stack: e.stack }));
  page.on('requestfailed', (r) => problems.failedRequests.push({ url: r.url(), reason: r.failure()?.errorText }));

  let ready = false;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
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
  const { sandboxes } = await import('../src/lib/sandboxes/index.js').catch(() => ({ sandboxes: null }));
  const slugs = sandboxes
    ? sandboxes.map((s) => s.slug)
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
