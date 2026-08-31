// Markdown content pipeline.
//
// We render markdown with markdown-it rather than mdsvex on purpose. It keeps
// Adam's Methods conventions working unchanged (markdown-it-attrs for
// `#img-full`, raw HTML allowed, linkify on) and it means `{` and `<` in a code
// sample are never mistaken for Svelte syntax. The cost is that you cannot write
// a Svelte component tag in prose - instead you write a mount div:
//
//   <div data-sandbox="bathtub" data-mode="view" data-params='{"slr_m":1.5}'></div>
//
// ...and <SandboxMounts> in the page layout finds it and mounts the real
// component into it. See src/lib/components/SandboxMounts.svelte.

import { load as parseYaml } from 'js-yaml';
import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import anchor from 'markdown-it-anchor';

const md = new MarkdownIt({ html: true, breaks: false, linkify: true })
  .use(attrs)
  // Stable section anchors are load-bearing: the build doctor points students at
  // `/tutorials/07-bathtub/#the-parameters`, and the hand-written failure map
  // keys off these slugs. Do not change the slugify rule without migrating it.
  .use(anchor, {
    level: [2, 3],
    slugify: (s) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-'),
    permalink: anchor.permalink.headerLink({ safariReaderFix: true })
  });

const raw = import.meta.glob('/src/content/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

// Frontmatter split. We do this by hand with js-yaml rather than using
// gray-matter, because this module is imported by universal `load` functions and
// therefore runs in the BROWSER as well as on the server - and gray-matter is a
// Node library that reaches for Buffer, which does not exist there. It fails at
// hydration, so the page still returns a clean 200 and then dies silently.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function split(source) {
  const m = FRONTMATTER.exec(source);
  if (!m) return { data: {}, content: source };
  return { data: parseYaml(m[1]) ?? {}, content: source.slice(m[0].length) };
}

function parse(filepath, source) {
  const { data, content } = split(source);
  const rel = filepath.replace(/^\/src\/content\//, '').replace(/\.md$/, '');
  const [section, ...rest] = rel.split('/');
  const slug = rest.join('/') || section;
  return {
    ...data,
    section,
    slug,
    url: section === 'syllabus' ? '/' : `/${section}/${slug}/`,
    filepath,
    // Rendered lazily-ish; cheap enough at this corpus size to do eagerly.
    html: md.render(content),
    excerpt: content.replace(/[#*`>\-\[\]]/g, '').trim().slice(0, 240)
  };
}

const all = Object.entries(raw)
  .map(([filepath, source]) => parse(filepath, source))
  .filter((doc) => doc.published !== false);

const bySequence = (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0);

export function collection(section) {
  return all.filter((d) => d.section === section).sort(bySequence);
}

export function doc(section, slug) {
  return all.find((d) => d.section === section && d.slug === slug) ?? null;
}

export const tutorials = () => collection('tutorials');
export const assignments = () => collection('assignments');
export const resources = () => collection('resources');
export const syllabus = () => collection('syllabus')[0] ?? null;

export { md };
