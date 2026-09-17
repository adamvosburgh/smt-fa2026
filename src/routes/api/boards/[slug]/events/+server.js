// The board's live stream, as Server-Sent Events.
//
// Not a WebSocket: that would need the `ws` package and a custom server around
// adapter-node's handler. This is one GET returning a ReadableStream, which
// adapter-node serves as it is, and the single PM2 fork makes the module-memory
// hub in src/lib/server/boards.js the whole of the realtime layer.
//
// The client reads it with fetch rather than EventSource, because EventSource
// cannot send the authorization header and the token must never go in a URL.
import { identify } from '$lib/server/auth.js';
import { get, subscribe, canSubscribe, people, frame, unauthorized, notFound } from '$lib/server/boards.js';

const CID = /^[a-z0-9]{6,20}$/;
// Cloudflare's tunnel closes a response that has gone quiet. 20s is under any
// of its timeouts.
const PING_MS = 20_000;
const PING = new TextEncoder().encode(': ping\n\n');

export async function GET({ params, request, url }) {
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  const board = await get(params.slug);
  if (!board) return notFound();
  if (!canSubscribe(params.slug)) return new Response(null, { status: 503 });

  const cid = url.searchParams.get('cid');
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const leave = subscribe(params.slug, { controller, who, cid: CID.test(cid ?? '') ? cid : null });
      controller.enqueue(frame('hello', { version: board.version, people: people(params.slug) }));
      const ping = setInterval(() => {
        try {
          controller.enqueue(PING);
        } catch {
          cleanup();
        }
      }, PING_MS);
      let done = false;
      cleanup = () => {
        if (done) return;
        done = true;
        clearInterval(ping);
        leave();
      };
      request.signal?.addEventListener('abort', () => cleanup());
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
      connection: 'keep-alive'
    }
  });
}
