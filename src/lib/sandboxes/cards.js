// Sandbox cards.
//
// One markdown file per sandbox, at src/lib/sandboxes/<slug>/card.md, holding
// the plain-language account of what the thing is, what it is trying to show,
// how it works, what it assumes, and what it cannot see. Sources are footnotes
// on the sentences that use them. Every sandbox gets one; SandboxCard.svelte
// puts it behind the info button.
//
// It lives beside the component rather than in src/content/ on purpose: the
// card is part of the sandbox, and moving one sandbox moves its card with it.
// It still has to be under src/ - import.meta.glob only works there, and the
// options argument has to be an inline object literal.
//
// Rendered with its own markdown-it rather than the one in content.js, because
// that one carries markdown-it-anchor and would turn every heading in a 300px
// panel into a permalink.
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';

// Footnotes carry the citations. markdown-it-footnote emits them at the end of
// whatever it was asked to render, so in the per-section render below a note
// lands under the section that used it - which means a card.md has to define
// each footnote inside the section that references it, not at the end of the
// file. Numbering restarts per section for the same reason.
const md = new MarkdownIt({ html: false, breaks: false, linkify: true }).use(footnote);

const raw = import.meta.glob('/src/lib/sandboxes/*/card.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const cards = Object.fromEntries(
  Object.entries(raw).map(([path, source]) => {
    const slug = path.split('/').at(-2);
    // docId prefixes the footnote ids, so two cards on one page cannot collide.
    return [slug, md.render(source, { docId: slug })];
  })
);

export function card(slug) {
  return cards[slug] ?? null;
}

// The same card, split at its `##` headings.
//
// The left dock of the full-width sandbox layout shows the card open on the
// page rather than behind a button, one <details> per section. That needs the
// sections separately, and splitting the RENDERED html on `<h2>` is the wrong
// place to do it - it means parsing html with a regex to undo a decision
// markdown-it already made correctly. So split the source and render each body
// on its own.
//
// Anything before the first `##` is dropped.
const sections = Object.fromEntries(
  Object.entries(raw).map(([path, source]) => {
    // A capturing split alternates [before, title, body, title, body, ...].
    const slug = path.split('/').at(-2);
    const parts = String(source).split(/^##[ \t]+(.+?)[ \t]*$/m);
    const out = [];
    for (let i = 1; i < parts.length; i += 2) {
      // One docId per section: each section's footnotes get their own ids.
      const docId = `${slug}-${(i - 1) / 2}`;
      out.push({ title: parts[i], html: md.render(parts[i + 1] ?? '', { docId }) });
    }
    return [slug, out];
  })
);

export function cardSections(slug) {
  return sections[slug] ?? [];
}
