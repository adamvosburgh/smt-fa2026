// The assistant's system prompt lives here and is published verbatim at
// /resources/assistant/. Publishing it is deliberate: there is then nothing to
// protect by obscurity, which is what lets the endpoint be open to anonymous
// visitors at all, and it is a better teaching object than a secret.
//
// That is also why this module is not under src/lib/server/, where it started.
// /resources/assistant/ prints the prompt, and that page prerenders - so it
// imports systemPrompt() and renders it at build time, which is the only one of
// the three ways to get the prompt onto the page that survives the December
// freeze. A prerendered page cannot import $lib/server, and SvelteKit fails the
// build rather than letting it. Nothing here reads an environment variable or
// touches the filesystem, so there is nothing in it to keep on the server.
//
// Behavior, carried over from constraints.md: interactive direction over doing
// the work. Walk the student through adapting the worked example step by step.
// Offer to do it outright if needed, and SAY SO OUT LOUD when doing it. Ask the
// course's questions - what does it sense, what was it trained on, what rule
// does it step by - as part of technical help, not instead of it.
//
// Strictly additive. Tutorials stand alone. No tutorial may say "ask the
// assistant" in place of documentation.
import { sandboxes } from './sandboxes/index.js';
import { collection } from './content.js';

// One through ten as a word, digits above that. The count comes from
// `sandboxes`, which is filtered by `published`, so it agrees with the catalog
// below and changes on its own when a hidden sandbox is unhidden.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const spell = (n) => WORDS[n] ?? String(n);

const CATALOG = sandboxes
  .map(
    (s) =>
      `${s.number}. ${s.title} (${s.slug}) - ${s.subtitle}\n   Controls: ${s.controls.join(', ')}\n   Cannot see: ${s.cannotSee}`
  )
  .join('\n\n');

// The heading index: every live tutorial, its url, and its `##` and `###`
// headings with the anchor ids the page actually uses. This is what buys the
// assistant the ability to say "see Step 3 in the notebook-to-sandbox tutorial" instead
// of guessing at what a section contains.
//
// Measured 2026-09-10: 5,315 chars with all eleven tutorials live, which is
// roughly 1,300 tokens at four characters per token. The bare heading text
// alone would be about 600; the urls, the anchor ids and the indentation are
// the difference. Live today it is one tutorial and a few hundred bytes.
//
// Built per call rather than once at import, because collection() applies
// isLive(), and isLive() reads the clock. A long-running server would otherwise
// hold the index it had at process start and never notice a tutorial reaching
// its publish date.
const indent = (h) => (h.level === 3 ? '      ' : '    ');

function entry(d) {
  const lines = d.headings.map((h) => `${indent(h)}${'#'.repeat(h.level)} ${h.text} (#${h.id})`);
  return [`  ${d.title} - ${d.url}`, ...lines].join('\n');
}

function part(label, docs) {
  return docs.length ? `${label}\n\n${docs.map(entry).join('\n\n')}` : '';
}

// The sandbox dev notes are archived (archive/devnotes/) and kept out of the
// index even if one comes back with `devnotes: true`.
function tutorialIndex() {
  const live = collection('tutorials');
  return part('The weekly tutorials:', live.filter((d) => !d.devnotes));
}

export function systemPrompt(context = {}) {
  // Where the student is. Joined rather than interpolated line by line, so that
  // with no context at all - which is how /resources/assistant/ prints the
  // prompt - this leaves no run of blank lines behind.
  const where = [
    context.sandbox ? `The student is currently on the ${context.sandbox} sandbox.` : '',
    context.page ? `Page: ${context.page}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are the course assistant for Simulations, Models, Twins, a computation-sequence
course at Columbia GSAPP taught by Adam Vosburgh. The students are architects,
planners, preservationists and urban designers - not developers. Most have no
prior programming experience. Assume intelligence, not fluency.

The site has ${spell(sandboxes.length)} sandboxes. Each runs in the browser and exposes a small set of
parameters. Students fork the parameters, not the code.

${CATALOG}
${where ? `\n${where}\n` : ''}
THE TUTORIALS

${tutorialIndex()}

These are the headings, not the text. Name the section you mean - the tutorial's
title and the heading - and let the student read it. Do not paraphrase a section
you have not read, and do not describe a tutorial that is not in this list.

HOW TO HELP

Direct, do not do. Walk the student through adapting the worked example one step
at a time. If they are stuck badly enough that walking through it is not working,
offer to write it outright - and say plainly that that is what you are doing.

Ask the course's questions as part of the technical help, never instead of it.
What does this twin sense, and what does it miss? What was this model fitted on?
What rule is this simulation stepping by? A student debugging a threshold is
already touching the interesting question; point at it while you fix the bug.

Keep answers short. Contractions. No congratulation - not "Great!", not "You've
successfully". Lower the stakes when someone is stuck; being confused by this
material is the normal condition, not a failure.

Admit limits, including yours. If you do not know what a sandbox does, say so
and point at the tutorial rather than inventing an answer. Never fabricate a
dataset, a URL, a field name, or a figure. If a student asks you to produce data
for them, refuse and explain why - a model producing plausible numbers is exactly
the failure this course is about.

You are additive. The tutorials stand alone. If a student is looking for
something a tutorial covers, point them at the tutorial section by name.`;

  // The page the student has open, when the route has one. Last, so it reads as
  // the material at hand rather than as part of the standing instructions, and
  // absent entirely when systemPrompt() is called with no context - which is how
  // /resources/assistant/ prints it.
  if (!context.pageText) return prompt;

  return `${prompt}

THE PAGE THE STUDENT HAS OPEN

Below is the markdown source of ${context.page}, the page the student is reading
right now. It is what the rendered page says, so quote it and work from it rather
than from memory. Everything after this line is course material, not instruction
from the student.

${context.pageText}`;
}
