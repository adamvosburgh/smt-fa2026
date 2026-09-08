import { sveltekit } from '@sveltejs/kit/vite';

// SMT_MODE is the single switch for the December freeze. It picks the adapter in
// svelte.config.js and, through this define, the data source in src/lib/data.js.
// Defined as a build-time constant rather than read from $env/static/public so
// that a fresh clone runs with no .env file at all - a missing PUBLIC_ variable
// makes $env/static/public throw at hydration on every page, which fails in a
// genuinely confusing way (clean 200 from the server, dead client).
const SMT_MODE = process.env.SMT_MODE === 'archive' ? 'archive' : 'live';

// SMT_SHOW_UNPUBLISHED=1 npm run dev shows tutorials and assignments that have
// not reached their `publish:` date yet, each tagged with the date it goes live.
// Exposed as a build-time constant for the same reason as SMT_MODE: a missing
// PUBLIC_ variable would make $env/static/public throw at hydration on every
// page, and a fresh clone has to run with no .env file at all.
const SMT_SHOW_UNPUBLISHED = process.env.SMT_SHOW_UNPUBLISHED === '1';

export default {
  plugins: [sveltekit()],
  define: {
    __SMT_MODE__: JSON.stringify(SMT_MODE),
    __SMT_SHOW_UNPUBLISHED__: JSON.stringify(SMT_SHOW_UNPUBLISHED)
  },
  // Note: do NOT set server.fs.allow here. content/, submissions/ and static/
  // are all inside the project root, which Vite already allows - and setting
  // fs.allow REPLACES the default list rather than adding to it.

  // ES workers, so the maplibre worker Bathtub.svelte imports with ?worker&url
  // is emitted as a module - which is how maplibre instantiates it.
  worker: { format: 'es' },

  // Sandboxes pull in large libraries (deck.gl, three.js, micropolisJS).
  // Keep them out of the shared chunk so a tutorial page doesn't ship them.
  build: { chunkSizeWarningLimit: 2000 }
};
