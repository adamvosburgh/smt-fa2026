// How a board talks to the server. The canvas knows only connect(), and the
// object it returns: send(ops), cursor(x, y), close().
//
// Down: a Server-Sent Events stream read with fetch, because EventSource cannot
// send the authorization header and the token never goes in a URL. A fetch
// stream does not reconnect on its own, so this does, with backoff.
//
// Up: ordinary POSTs.
//
// If the stream turns out not to survive the Cloudflare tunnel, the fallback is
// polling GET /api/boards/<slug>?since=<version> every two seconds. That swap
// belongs entirely in this file.

const BACKOFF = [1000, 2000, 4000, 8000, 10000];

export function clientId() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (const b of crypto.getRandomValues(new Uint8Array(12))) s += abc[b % abc.length];
  return s;
}

export async function fetchBoard(slug, token) {
  const res = await fetch(`/api/boards/${slug}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw Object.assign(new Error('board'), { status: res.status });
  return res.json();
}

/**
 * @param {{ slug: string, token: string, cid: string,
 *   onevent: (event: string, data: any) => void,
 *   onstatus: (status: 'live' | 'reconnecting' | 'denied') => void }} opts
 */
export function connect({ slug, token, cid, onevent, onstatus }) {
  const auth = { authorization: `Bearer ${token}` };
  let closed = false;
  let attempt = 0;
  let controller = null;
  let timer = 0;

  async function open() {
    if (closed) return;
    controller = new AbortController();
    try {
      const res = await fetch(`/api/boards/${slug}/events?cid=${cid}`, {
        headers: { ...auth, accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store'
      });
      if (res.status === 401 || res.status === 404) {
        onstatus('denied');
        return;
      }
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let cut;
        while ((cut = buffer.search(/\r?\n\r?\n/)) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, '');
          const parsed = parse(block);
          if (!parsed) continue;
          if (parsed.event === 'hello') {
            attempt = 0;
            onstatus('live');
          }
          onevent(parsed.event, parsed.data);
        }
      }
      throw new Error('stream ended');
    } catch {
      if (closed) return;
      onstatus('reconnecting');
      timer = setTimeout(open, BACKOFF[Math.min(attempt++, BACKOFF.length - 1)]);
    }
  }

  function parse(block) {
    let event = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue;
      const i = line.indexOf(':');
      const field = i < 0 ? line : line.slice(0, i);
      const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (!data.length) return null;
    try {
      return { event, data: JSON.parse(data.join('\n')) };
    } catch {
      return null;
    }
  }

  // Resolves to { status, body }. Never throws: a network failure is status 0.
  async function send(ops) {
    try {
      const res = await fetch(`/api/boards/${slug}/ops`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ ops, cid })
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    } catch {
      return { status: 0, body: null };
    }
  }

  function cursor(x, y) {
    fetch(`/api/boards/${slug}/cursor`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ x, y, cid }),
      keepalive: x === null
    }).catch(() => {});
  }

  function close() {
    closed = true;
    clearTimeout(timer);
    controller?.abort();
  }

  open();
  return { send, cursor, close };
}
