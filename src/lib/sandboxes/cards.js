// Sandbox cards.
//
// One markdown file per sandbox, at src/lib/sandboxes/<slug>/card.md, holding
// the plain-language account of what the thing is, why we're looking at it,
// where the data came from, what the model assumes, and what it cannot see.
// Every sandbox gets one; SandboxCard.svelte puts it behind the info button.
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

const md = new MarkdownIt({ html: false, breaks: false, linkify: true });

const raw = import.meta.glob('/src/lib/sandboxes/*/card.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const cards = Object.fromEntries(
  Object.entries(raw).map(([path, source]) => [path.split('/').at(-2), md.render(source)])
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
// Anything before the first `##` is dropped. In practice that is the
// "PROSE DRAFT" comment three of the four cards still carry.
const sections = Object.fromEntries(
  Object.entries(raw).map(([path, source]) => {
    // A capturing split alternates [before, title, body, title, body, ...].
    const parts = String(source).split(/^##[ \t]+(.+?)[ \t]*$/m);
    const out = [];
    for (let i = 1; i < parts.length; i += 2) {
      out.push({ title: parts[i], html: md.render(parts[i + 1] ?? '') });
    }
    return [path.split('/').at(-2), out];
  })
);

export function cardSections(slug) {
  return sections[slug] ?? [];
}
