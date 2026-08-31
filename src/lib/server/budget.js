// The one control that turns "someone could run up my API bill" into a known,
// bounded number. Everything else in the assistant's defences is optimisation
// on top of this.
//
// Two ceilings, both daily, both enforced before the model is called:
//   - a global token ceiling for the whole site
//   - a message allowance per identity (generous for students, small for anyone else)
//
// When the global ceiling trips, the assistant says so plainly and the rest of
// the site keeps working. The assistant is strictly additive - no tutorial may
// depend on it - so its being off is an inconvenience, never a blocker.
import { update, read } from './store.js';
import { config } from './config.js';

const day = () => new Date().toISOString().slice(0, 10);

export async function status() {
  const s = await read('budget.json', {});
  const today = s[day()] ?? { tokens: 0, identities: {} };
  return {
    day: day(),
    tokens: today.tokens,
    ceiling: config.assistant.dailyTokenCeiling,
    exhausted: today.tokens >= config.assistant.dailyTokenCeiling
  };
}

// Reserve a turn. Returns { ok } or { ok:false, reason }.
export async function reserve(identityKey, kind) {
  const allowance =
    kind === 'student'
      ? config.assistant.studentDailyMessages
      : config.assistant.anonDailyMessages;

  return update('budget.json', {}, (state) => {
    const d = day();
    // Keep only the last 30 days.
    for (const k of Object.keys(state)) if (k < d) delete state[k];
    const today = (state[d] ??= { tokens: 0, identities: {} });

    if (today.tokens >= config.assistant.dailyTokenCeiling) {
      return { state, result: { ok: false, reason: 'site-daily-ceiling' } };
    }
    const used = today.identities[identityKey] ?? 0;
    if (used >= allowance) {
      return { state, result: { ok: false, reason: 'identity-daily-allowance', allowance } };
    }
    today.identities[identityKey] = used + 1;
    return { state, result: { ok: true } };
  });
}

// Record actual usage after the call returns.
export async function record(tokens) {
  return update('budget.json', {}, (state) => {
    const today = (state[day()] ??= { tokens: 0, identities: {} });
    today.tokens += tokens;
    return { state, result: today.tokens };
  });
}
