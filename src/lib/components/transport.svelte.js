// The shared clock behind every sandbox's transport control.
//
// One instance per SandboxFrame. The frame runs the single requestAnimationFrame
// loop and calls tick(); ParamPanel renders the transport rows and calls the
// verbs. Position always lives in `params` - the transport keeps only a
// fractional accumulator so slow rates advance smoothly - and it reads and
// writes params through the two closures the frame hands it, so it never holds
// a stale reference.
//
// Two rules from the build doc, enforced here and nowhere else:
//
//   - tick() discards elapsed time while the sandbox has reported
//     onready(false). Skip, never buffer: Pencil recomputes 246,921 lots on a
//     year change, and queueing ticks faster than it can answer locks the page.
//   - Only one timeline plays at a time. Playing one holds every other at its
//     current value; the panel renders the held rows as `held at <value>` so
//     the interaction is stated on screen, not just in code.
//
// A sandbox whose clock is an engine rather than a schema property
// (the city simulator) registers an external adapter via the frame's
// `ontransport` callback and gets the same row in the panel.

// Schema keys:
//   x-timeline    "primary" | "secondary"
//   x-play-rate   steps (or enum stops) per second at 1x
//   x-play-loop   reaching the end restarts (true) or stops (false)
//   x-play-auto   start playing on mount (full layout, edit mode only)

export function timelinesOf(schema) {
  return Object.entries(schema?.properties ?? {})
    .filter(([, p]) => p['x-timeline'])
    .map(([key, p]) => ({
      key,
      kind: p['x-timeline'],
      rate: p['x-play-rate'] ?? 1,
      loop: p['x-play-loop'] ?? false,
      auto: p['x-play-auto'] ?? false,
      prop: p
    }));
}

// Same rule ParamPanel uses to gray a control: a timeline whose value another
// control has taken over must not play either.
function overridden(prop, read) {
  const when = prop['x-disabled-when'];
  if (!when) return false;
  return Object.entries(when).every(([k, v]) =>
    Array.isArray(v) ? v.includes(read(k)) : read(k) === v
  );
}

export function createTransport(schema, read, write) {
  const timelines = timelinesOf(schema);
  const byKey = Object.fromEntries(timelines.map((t) => [t.key, t]));

  let playingKey = $state(null); // a timeline key, 'external', or null
  let speed = $state(1); // 0.5 | 1 | 2 | 4
  let external = $state(null); // adapter registered by the sandbox
  let externalReadout = $state(''); // polled by the frame, ~6Hz

  // key -> fractional position (value units for ranges, stop index for enums).
  // Not reactive: only tick() and the verbs touch it.
  const acc = {};
  const lastWritten = {};

  const isEnum = (t) => Array.isArray(t.prop.enum);
  const stepOf = (t) => t.prop['x-step'] ?? t.prop.multipleOf ?? 1;

  // If someone else wrote the param (slider drag, arrow keys, a loaded
  // submission), the accumulator resyncs from it. The transport ignores its
  // own writes; that asymmetry is what prevents a write loop.
  function sync(t) {
    const v = read(t.key);
    if (v === lastWritten[t.key] && acc[t.key] !== undefined) return;
    acc[t.key] = isEnum(t) ? Math.max(0, t.prop.enum.indexOf(v)) : Number(v ?? t.prop.minimum ?? 0);
    lastWritten[t.key] = v;
  }

  function emit(t, value) {
    if (value === read(t.key)) return;
    lastWritten[t.key] = value;
    write(t.key, value);
  }

  function advance(t, dt) {
    sync(t);
    if (isEnum(t)) {
      const n = t.prop.enum.length;
      let idx = acc[t.key] + t.rate * speed * dt;
      if (idx >= n) {
        if (t.loop) idx -= n;
        else {
          idx = n - 1;
          playingKey = null;
        }
      }
      acc[t.key] = idx;
      emit(t, t.prop.enum[Math.floor(idx)]);
    } else {
      const step = stepOf(t);
      const min = t.prop.minimum ?? 0;
      const max = t.prop.maximum ?? min;
      let pos = acc[t.key] + t.rate * step * speed * dt;
      if (pos > max) {
        if (t.loop) pos = min + (pos - max);
        else {
          pos = max;
          playingKey = null;
        }
      }
      acc[t.key] = pos;
      const snapped = Math.min(max, Math.max(min, Math.round(pos / step) * step));
      emit(t, snapped);
    }
  }

  function nudge(key, dir) {
    const t = byKey[key];
    if (!t) return;
    if (playingKey === key) playingKey = null; // stepping the playing timeline pauses it
    sync(t);
    if (isEnum(t)) {
      const n = t.prop.enum.length;
      const idx = Math.min(n - 1, Math.max(0, Math.floor(acc[t.key]) + dir));
      acc[t.key] = idx;
      emit(t, t.prop.enum[idx]);
    } else {
      const step = stepOf(t);
      // For fine-grained continuous timelines a single x-step nudge is
      // useless; x-step-jump names a coarser stride for the step buttons.
      const jump = t.prop['x-step-jump'] ?? step;
      const min = t.prop.minimum ?? 0;
      const max = t.prop.maximum ?? min;
      const pos = Math.min(max, Math.max(min, acc[t.key] + dir * jump));
      acc[t.key] = pos;
      emit(t, Math.round(pos / step) * step);
    }
  }

  return {
    timelines,
    get playingKey() {
      return playingKey;
    },
    get speed() {
      return speed;
    },
    get external() {
      return external;
    },
    get externalReadout() {
      return externalReadout;
    },
    // What the cover pipeline waits on: nothing moving anywhere.
    get paused() {
      return playingKey === null;
    },

    play(key) {
      const t = byKey[key];
      if (!t || overridden(t.prop, read)) return;
      sync(t);
      if (external && playingKey === 'external') external.pause();
      playingKey = key;
    },
    pause(key) {
      // pause() stops everything; pause(key) only if that one is playing -
      // grabbing a held timeline's slider must not stop the playing one.
      if (key !== undefined && playingKey !== key) return;
      if (playingKey === 'external') external?.pause();
      playingKey = null;
    },
    toggle(key) {
      if (playingKey === key) this.pause();
      else this.play(key);
    },
    stepFwd(key) {
      nudge(key, +1);
    },
    stepBack(key) {
      nudge(key, -1);
    },
    setSpeed(m) {
      speed = m;
      external?.setSpeed?.(m);
    },

    // The frame's rAF calls this. Skip - never buffer - while the sandbox is
    // busy, and pause outright if the playing timeline gets overridden.
    tick(dt, ready) {
      if (playingKey === null || playingKey === 'external') return;
      const t = byKey[playingKey];
      if (!t) {
        playingKey = null;
        return;
      }
      if (overridden(t.prop, read)) {
        playingKey = null;
        return;
      }
      if (!ready) return;
      advance(t, Math.min(dt, 0.25)); // a background tab's first dt back is huge
    },

    // The city-simulator path: same row, engine underneath.
    setExternal(adapter) {
      external = adapter ?? null;
      if (adapter?.playing) playingKey = 'external';
      else if (playingKey === 'external') playingKey = null;
    },
    playExternal() {
      if (!external) return;
      external.play();
      playingKey = 'external';
    },
    pauseExternal() {
      if (!external) return;
      external.pause();
      if (playingKey === 'external') playingKey = null;
    },
    toggleExternal() {
      if (playingKey === 'external') this.pauseExternal();
      else this.playExternal();
    },
    stepExternal() {
      this.pauseExternal();
      external?.step();
    },
    pollExternal() {
      if (external?.readout) externalReadout = external.readout();
    },

    // Cover determinism: every timeline to its schema default, nothing playing.
    reset() {
      if (playingKey === 'external') external?.pause();
      playingKey = null;
      for (const t of timelines) {
        if (t.prop.default !== undefined) {
          acc[t.key] = isEnum(t) ? t.prop.enum.indexOf(t.prop.default) : t.prop.default;
          lastWritten[t.key] = t.prop.default;
          write(t.key, t.prop.default);
        }
      }
      external?.pause?.();
    }
  };
}
