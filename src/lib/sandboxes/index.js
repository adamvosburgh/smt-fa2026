// The sandbox registry.
//
// Components are lazy so that a tutorial page which embeds one sandbox does not
// ship deck.gl, three.js and micropolisJS to every reader. `meta` and `schema`
// are eager - they are small, and the index page, the param panels and the
// server-side submission validator all need them synchronously.

import { SHOW_UNPUBLISHED } from '../visibility.js';
import bathtub from './bathtub/meta.js';
import bathtubSchema from './bathtub/schema.json';
import coefficientsSchema from './coefficients/schema.json';
import pencilSchema from './pencil/schema.json';
import afterFiveSchema from './after-five/schema.json';
import anthromesSchema from './anthromes/schema.json';
import sunlightSchema from './sunlight/schema.json';

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
  bathtub: bathtubSchema,
  coefficients: coefficientsSchema,
  pencil: pencilSchema,
  'after-five': afterFiveSchema,
  anthromes: anthromesSchema,
  sunlight: sunlightSchema
  // ...one per sandbox as it is built.
};

// The full list, in registry order, including sandboxes hidden from the site.
// The submission validator and the cover script use this so a hidden sandbox
// keeps working at its URL rather than 404ing.
// Sunlight sits at the END, after bathtub, so that unhiding it makes it 6 and
// nothing already published renumbers.
export const allSandboxes = [
  studioTwin,
  pencil,
  afterFive,
  coefficients,
  anthromes,
  bathtub,
  sunlight
].map((m) => ({ ...m, schema: schemas[m.slug] ?? null }));

// What the site shows. `number` is assigned from position here, not read from
// meta.js - unhiding a sandbox later renumbers the rest automatically.
export const sandboxes = allSandboxes
  .filter((s) => SHOW_UNPUBLISHED || s.published !== false)
  .map((s, i) => ({ ...s, number: i + 1 }));

// Published entries come second so their numbered copies win.
export const bySlug = Object.fromEntries(
  [...allSandboxes, ...sandboxes].map((s) => [s.slug, s])
);

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
