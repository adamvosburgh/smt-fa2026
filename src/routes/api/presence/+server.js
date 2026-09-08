// How many people are on the site right now.
//
// The only thing that reads this is the mouse agents overlay, which draws three
// arrows per person. It is a count, nothing else: the ids are random strings
// the browser makes up in sessionStorage, nothing identifies anyone, and
// nothing is written to disk. Held in module memory on purpose - it is worth
// exactly as much as the process it lives in, and var/ is for things that have
// to survive a restart.
//
// In the archive build there is no server at all, so the client falls back to
// three agents. See src/lib/components/MouseAgents.svelte.
import { json } from '@sveltejs/kit';

const TTL_MS = 75_000; // the client beacons every 30s, so this forgives two misses
const MAX_IDS = 5000; // a ceiling, so a flood of made-up ids cannot grow the map

/** @type {Map<string, number>} id -> last seen (ms) */
const seen = new Map();

function sweep(now) {
  for (const [id, at] of seen) if (now - at > TTL_MS) seen.delete(id);
}

export function GET() {
  const now = Date.now();
  sweep(now);
  return json({ count: seen.size }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST({ request }) {
  const now = Date.now();
  sweep(now);
  let id = null;
  try {
    ({ id } = await request.json());
  } catch {
    // A beacon with no body still counts as nothing; fall through to the count.
  }
  if (typeof id === 'string' && /^[a-z0-9]{6,40}$/.test(id)) {
    if (seen.has(id) || seen.size < MAX_IDS) seen.set(id, now);
  }
  return json({ count: seen.size }, { headers: { 'cache-control': 'no-store' } });
}
