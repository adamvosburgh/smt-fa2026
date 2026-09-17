// Server start. The only thing here is the whiteboard ticker, which builds an
// assignment's board at 9:00 New York on the morning it is due. See
// src/lib/server/board-ticker.js.
import { building } from '$app/environment';
import { MODE } from '$lib/data.js';

export async function init() {
  if (building) return; // prerender and the archive build
  if (MODE === 'archive') return;
  // Imported here, after the checks, so the build never loads server config.
  const { tick } = await import('$lib/server/board-ticker.js');
  const run = () => tick().catch((err) => console.error(`boards: tick failed: ${err?.message ?? err}`));
  run();
  setInterval(run, 60_000).unref();
}
