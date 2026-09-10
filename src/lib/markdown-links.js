// A link in a sandbox's prose goes to a source on somebody else's site, and it
// is read beside a running simulation - navigating the tab away from it throws
// the reader's state out. So every link the card and the control panel render
// opens in a new tab.
//
// Written as a markdown-it plugin rather than a string replacement on the
// rendered html, because markdown-it already knows which tokens are links.
export function openInNewTab(md) {
  const base = md.renderer.rules.link_open
    ?? ((tokens, i, options, env, self) => self.renderToken(tokens, i, options, env, self));
  md.renderer.rules.link_open = (tokens, i, options, env, self) => {
    tokens[i].attrSet('target', '_blank');
    tokens[i].attrSet('rel', 'noopener');
    return base(tokens, i, options, env, self);
  };
}
