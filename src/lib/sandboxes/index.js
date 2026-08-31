// The sandbox registry.
//
// Components are lazy so that a tutorial page which embeds one sandbox does not
// ship deck.gl, three.js and micropolisJS to every reader. `meta` and `schema`
// are eager - they are small, and the index page, the param panels and the
// server-side submission validator all need them synchronously.

import bathtub from './bathtub/meta.js';
import bathtubSchema from './bathtub/schema.json';

// --- stubs. Each gets a meta.js + schema.json + component as it is built. ---
import studioTwin from './studio-twin/meta.js';
import pencil from './pencil/meta.js';
import afterFive from './after-five/meta.js';
import coefficients from './coefficients/meta.js';
import sunlight from './sunlight/meta.js';
import anthromes from './anthromes/meta.js';

const loaders = {
  'studio-twin': () => import('./studio-twin/StudioTwin.svelte'),
  pencil: () => import('./pencil/Pencil.svelte'),
  'after-five': () => import('./after-five/AfterFive.svelte'),
  coefficients: () => import('./coefficients/Coefficients.svelte'),
  sunlight: () => import('./sunlight/Sunlight.svelte'),
  anthromes: () => import('./anthromes/Anthromes.svelte'),
  bathtub: () => import('./bathtub/Bathtub.svelte')
};

const schemas = {
  bathtub: bathtubSchema
  // ...one per sandbox as it is built.
};

export const sandboxes = [
  studioTwin,
  pencil,
  afterFive,
  coefficients,
  sunlight,
  anthromes,
  bathtub
].map((m) => ({ ...m, schema: schemas[m.slug] ?? null }));

export const bySlug = Object.fromEntries(sandboxes.map((s) => [s.slug, s]));

export function load(slug) {
  const l = loaders[slug];
  if (!l) throw new Error(`no such sandbox: ${slug}`);
  return l();
}

export function defaults(slug) {
  const schema = bySlug[slug]?.schema;
  if (!schema) return {};
  return Object.fromEntries(
    Object.entries(schema.properties ?? {})
      .filter(([, p]) => p.default !== undefined)
      .map(([k, p]) => [k, p.default])
  );
}
