// Inline markdown for the control panel.
//
// The schema's `description` strings and `x-enum-notes` carry the sources for
// the numbers they justify, and a source without a link is a citation the
// reader has to retype into a search box. So the panel's fold renders markdown,
// inline only: a note is one paragraph and should not be able to open a heading
// or a list inside a 300px panel.
//
// `html: false` is what makes this safe to hand to {@html}. markdown-it escapes
// any raw tag in the source rather than passing it through, so the only markup
// that comes out is markup markdown-it wrote - which for renderInline is
// emphasis, code and links.
import MarkdownIt from 'markdown-it';
import { openInNewTab } from '$lib/markdown-links.js';

const md = new MarkdownIt({ html: false, breaks: false, linkify: true }).use(openInNewTab);

export function inlineMarkdown(text) {
  return md.renderInline(String(text ?? ''));
}
