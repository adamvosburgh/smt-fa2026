// Markdown for text a student typed: the description on a submission page.
//
// This is the only place student text goes through {@html}, and it is written
// by anyone holding a token, so it is untrusted. `html: false` is what makes it
// safe: markdown-it escapes any raw tag in the source rather than passing it
// through, and its link check refuses javascript:, vbscript:, file: and most
// data: URLs. Every other field on the page (title, gallery text, answers) is
// plain text and Svelte escapes it.
//
// Not content.js's renderer, which has `html: true` for course pages Adam writes.
import MarkdownIt from 'markdown-it';
import { openInNewTab } from '$lib/markdown-links.js';

const md = new MarkdownIt({ html: false, breaks: true, linkify: true }).use(openInNewTab);

export function studentMarkdown(text) {
  return md.render(String(text ?? ''));
}
