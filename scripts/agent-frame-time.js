// How long one frame of the mouse agents costs.
//
// The overlay is a nod to the course, not a feature, so it only earns its place
// if it is free. This drives the pointer around the syllabus at the cap of
// sixty agents and reads the mean frame time the component records.
//
//   node scripts/agent-frame-time.js --base http://localhost:5173
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, arr) =>
      a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') === false ? arr[i + 1] : true] : []
    )
    .filter((x) => x.length)
);
const BASE = args.base || 'http://localhost:5173';
const PATHS = ['/', '/tutorials/', '/sandboxes/'];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined
});

for (const p of PATHS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + p, { waitUntil: 'networkidle' });

  // Sixty agents is the cap, which the presence count will not reach on a test
  // box, so ask the page for them directly by faking twenty people.
  await page.route('**/api/presence', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"count":20}' })
  );
  await page.reload({ waitUntil: 'networkidle' });

  // Drive the pointer for five seconds so the loop stays awake.
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    const a = ((Date.now() - t0) / 700) % (Math.PI * 2);
    await page.mouse.move(720 + Math.cos(a) * 420, 450 + Math.sin(a) * 320);
    await page.waitForTimeout(16);
  }

  const r = await page.evaluate(() => window.__agentFrameMs?.() ?? null);
  console.log(
    r
      ? `${p.padEnd(14)} agents ${String(r.agents).padStart(2)}  obstacles ${String(r.obstacles).padStart(3)}  frames ${String(r.frames).padStart(4)}  mean ${r.mean.toFixed(3)} ms`
      : `${p.padEnd(14)} agents not running (pointer, width or reduced-motion gate)`
  );
  await ctx.close();
}

await browser.close();
