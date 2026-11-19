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

// final project write-ups: relative image paths -> the submission's assets/ (flat)
const writeupMd = new MarkdownIt({ html: false, breaks: true, linkify: true }).use(openInNewTab);
const defaultImage = writeupMd.renderer.rules.image;
writeupMd.renderer.rules.image = (tokens, idx, options, env, self) => {
  const src = tokens[idx].attrGet('src') ?? '';
  if (env?.base && src && !/^([a-z]+:|\/|#)/i.test(src)) {
    const name = decodeURIComponent(src.split(/[?#]/)[0]).split('/').pop().replace(/[^A-Za-z0-9._-]/g, '_');
    tokens[idx].attrSet('src', `${env.base}assets/${name}`);
  }
  tokens[idx].attrSet('loading', 'lazy');
  return defaultImage(tokens, idx, options, env, self);
};

export function studentMarkdown(text) {
  return md.render(String(text ?? ''));
}

export function writeupMarkdown(text, base) {
  return writeupMd.render(String(text ?? ''), { base });
}
