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
