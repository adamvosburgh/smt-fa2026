// The text of the page a student has open, for the assistant's prompt.
//
// The assistant is most useful when the student is partway through a tutorial
// and stuck on the code in front of them, so the prompt carries the whole page
// they are reading (about 3,000-7,000 tokens for a weekly tutorial) on top of
// the heading index in assistant-prompt.js. Not the whole corpus - that would be
// around 45,000 tokens a turn, which the daily ceiling does not cover for a
// class of thirty.
//
// Server-only, and deliberately so. It has to hold every markdown source in the
// site, and only /api/assistant ever needs one; putting it in $lib/server keeps
// SvelteKit from letting it reach a page bundle by accident. assistant-prompt.js
// stays universal because /resources/assistant/ prints it.
//
// The RAW markdown goes to the model rather than the rendered html. It is
// shorter, and it is what the student sees in the tutorial's code blocks.
import { doc, isLive } from '$lib/content.js';
import { sandboxes } from '$lib/sandboxes/index.js';

// Two globs, each with an inline literal for its options - import.meta.glob
// cannot take a variable there. content.js and cards.js glob the same files, but
// they keep the rendered html and drop the source, and this needs the source.
const contentRaw = import.meta.glob('/src/content/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const cardRaw = import.meta.glob('/src/lib/sandboxes/*/card.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

// Nothing on the site is close to this. It is here so that one long file added
// later cannot quietly double the cost of every message.
const MAX_CHARS = 40000;

const SECTIONS = new Set(['tutorials', 'assignments', 'resources']);
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

// Markdown reference definitions, which every tutorial keeps in a block at the
// end: `[CANOPY]: /tutorials/images/w2/01-canopy.png`. They are paths, not
// prose, and the model has no use for them.
const REFS = /^\[[^\]]+\]:[ \t]*\S+[ \t]*$/gm;

// Same treatment cards.js gives a draft card's leading HTML comment.
const stripLeadingComment = (source) => String(source).replace(/^\s*<!--[\s\S]*?-->\s*/, '');

function tidy(text) {
  return text.replace(REFS, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
}

/**
 * The markdown of the page at `pathname`, or null where there is no single
 * document behind it - the gallery, the syllabus, and every index page.
 * Unpublished pages return null too: the assistant must not know what a student
 * cannot read.
 */
export function pageText(pathname) {
  const parts = String(pathname ?? '').split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [section, slug] = parts;

  if (section === 'sandboxes') {
    // `sandboxes` is the published list, so a hidden sandbox gets nothing even
    // though its page still answers at its url.
    if (!sandboxes.some((s) => s.slug === slug)) return null;
    const source = cardRaw[`/src/lib/sandboxes/${slug}/card.md`];
    return source ? tidy(stripLeadingComment(source)) : null;
  }

  if (!SECTIONS.has(section)) return null;

  const d = doc(section, slug);
  if (!d || !isLive(d)) return null;
  const source = contentRaw[d.filepath];
  return source ? tidy(String(source).replace(FRONTMATTER, '')) : null;
}
