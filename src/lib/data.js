// Every sandbox reads its data from a base URL set by one flag.
//
//   live    - /api/data/<...>  (server route; only the studio twin actually
//             needs this, everything else is static from day one)
//   archive - /data/<...>      (plain static files under static/data)
//
// The non-negotiable rule from constraints.md: any sandbox that cannot render
// from the archive base does not ship. This is what makes the December freeze
// mechanical instead of a finals-week rewrite.
//
// The mode comes from a single build-time constant defined in vite.config.js,
// driven by the same SMT_MODE variable that picks the adapter in
// svelte.config.js. One switch, so the adapter and the data source cannot drift
// apart - and, importantly, no .env file is required to run the site.
export const MODE = __SMT_MODE__;

export function dataBase(slug) {
  return MODE === 'live' ? `/api/data/${slug}` : `/data/${slug}`;
}
