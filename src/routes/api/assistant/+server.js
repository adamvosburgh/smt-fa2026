// The course assistant.
//
// ---------------------------------------------------------------------------
// THE THREAT MODEL, since it drives every decision below.
//
// What is actually at risk is the API bill. Not the course content - this is a
// public course site and the system prompt is published on /resources/. So the
// goal is not authentication. The goal is to make abuse uneconomical and, above
// all, BOUNDED. Layered, cheapest first:
//
//   0. A hard daily token ceiling for the whole site (see server/budget.js).
//      This is the control that matters. It converts an unbounded financial
//      risk into a known number. Everything else is optimisation on top of it.
//
//   1. A VALID STUDENT TOKEN IS REQUIRED. No anonymous tier. The token is the
//      one students already paste once to submit, so this is a thing they did
//      in week 1 doing double duty rather than a second credential.
//
//      There was an anonymous free tier here until 2026-09-10, on the argument
//      that it kept the site public. Adam's call was that it does not: the site
//      is public, and every sandbox, tutorial and assignment on it stays open to
//      anyone with no token at all. It is the API spend that is not public. An
//      anonymous allowance keyed on a session cookie is also reset by clearing
//      cookies, so it was friction rather than a limit.
//
//   3. THE TRANSCRIPT LIVES ON THE SERVER. The client sends a session id and
//      one new message - never a message array. This is the easiest hole to
//      leave open and the most expensive one: if the client can post arbitrary
//      history, someone pastes 100k tokens of their own text into `messages`
//      and you pay to process it. Here they cannot.
//
//   4. The model, the system prompt, and max_tokens are all fixed server-side.
//      The client picks none of them.
//
// What is deliberately NOT here: accounts, passwords or OAuth (far too much
// machinery for a seminar - the token IS the identity, see server/auth.js), and
// IP allowlisting Columbia (students work from home).
//
// Every exchange is logged to var/assistant-log.jsonl. That is a course
// improvement byproduct, the same way review.json is: it shows which tutorial
// sections keep getting asked about. Say so in the syllabus.
// ---------------------------------------------------------------------------
import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { identify, sameOrigin } from '$lib/server/auth.js';
import { reserve, record, status } from '$lib/server/budget.js';
import { config } from '$lib/server/config.js';
import { read, update } from '$lib/server/store.js';
import { systemPrompt } from '$lib/assistant-prompt.js';
import { pageText } from '$lib/server/page-text.js';

const SESSION_COOKIE = 'smt_sid';

export async function GET() {
  const b = await status();
  return json({ enabled: config.assistant.enabled, budget: { exhausted: b.exhausted } });
}

export async function POST({ request, cookies, getClientAddress }) {
  const a = config.assistant;
  if (!a.enabled || !a.apiKey) {
    return json({ ok: false, error: 'The assistant is off right now.' }, { status: 503 });
  }
  if (!sameOrigin(request, config.origin)) {
    return json({ ok: false, error: 'bad origin' }, { status: 403 });
  }

  // The gate. identify() returns 'anonymous' for a missing, unknown or revoked
  // token alike, and all three get the same answer - saying which it was would
  // tell someone probing whether a token they hold is real.
  const who = await identify(request);
  if (who.kind !== 'student') {
    return json(
      {
        ok: false,
        error:
          'The assistant needs your submission token - the one from the enrollment link you were emailed. Paste it below and this browser will remember it.',
        needsToken: true
      },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const message = String(body.message ?? '').slice(0, a.maxCharsPerMessage);
  if (!message.trim()) return json({ ok: false, error: 'empty message' }, { status: 400 });

  // Context the page supplies about where the student is. It is a hint for the
  // prompt, not a capability - nothing here can widen what the assistant can do.
  //
  // The client sends `sandbox` from page.params.slug, which is the slug of
  // whatever [slug] route it is on - a tutorial on /tutorials/01-setting-up/,
  // not a sandbox. Trust it only under /sandboxes/, and take the slug from the
  // path rather than from the body while we are here.
  const page = String(body.page ?? '').slice(0, 200);
  const onSandbox = /^\/sandboxes\/([^/]+)\/?$/.exec(page);
  const context = {
    sandbox: onSandbox ? onSandbox[1] : '',
    page
  };

  // The text of the page itself. Server-side, from the site's own markdown -
  // the client sends a pathname and nothing more, so this cannot be used to
  // push text of someone's choosing into the prompt.
  context.pageText = pageText(context.page);

  // The session cookie is the transcript's key, not an identity. Only set once
  // the token has checked out, so a caller with no token cannot make the server
  // open a session for them.
  let sid = cookies.get(SESSION_COOKIE);
  if (!sid) {
    sid = randomUUID();
    cookies.set(SESSION_COOKIE, sid, {
      path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 30
    });
  }
  const identityKey = `student:${who.student}`;

  const gate = await reserve(identityKey);
  if (!gate.ok) {
    return json(
      {
        ok: false,
        error:
          gate.reason === 'site-daily-ceiling'
            ? 'The assistant has hit its daily limit for the whole site. It resets tomorrow - everything else on the site still works, and no tutorial needs it.'
            : `You have used your ${gate.allowance} messages for today.`
      },
      { status: 429 }
    );
  }

  // Server-held transcript. The client sends one message; we own the history.
  const key = `sessions/${sid}.json`;
  const prior = await read(key, { turns: [] });
  if (prior.turns.length >= a.maxTurnsPerSession) {
    return json({ ok: false, error: 'This conversation is long enough. Start a new one.' }, { status: 429 });
  }

  const messages = [...prior.turns, { role: 'user', content: message }];

  let reply, usage;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': a.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: a.model,
        max_tokens: a.maxTokensPerReply,
        system: systemPrompt(context),
        messages
      })
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    reply = data.content?.map((c) => c.text).filter(Boolean).join('\n') ?? '';
    usage = data.usage ?? {};
  } catch (err) {
    return json({ ok: false, error: 'The assistant could not be reached. Try again in a minute.' }, { status: 502 });
  }

  await record((usage.input_tokens ?? 0) + (usage.output_tokens ?? 0));
  await update(key, { turns: [] }, () => ({
    state: { turns: [...messages, { role: 'assistant', content: reply }] }
  }));

  await mkdir(path.join(config.stateDir), { recursive: true });
  // The page text is NOT logged, only its length. The log is read to see which
  // sections keep getting asked about; a copy of the tutorial on every line
  // would bury that under megabytes of text the repository already holds.
  const { pageText: text, ...logged } = context;
  await appendFile(
    path.join(config.stateDir, 'assistant-log.jsonl'),
    JSON.stringify({
      t: new Date().toISOString(),
      identityKey,
      context: { ...logged, pageTextChars: text?.length ?? 0 },
      message,
      reply,
      usage
    }) + '\n'
  );

  return json({ ok: true, reply });
}
