<script>
  // Renders controls straight off the sandbox's JSON Schema. One schema does two
  // jobs: it draws this panel, and the server validates submitted params against
  // the same file. If a control is missing here, add it to the schema, not here.
  //
  // TWO PANELS, ONE SCHEMA. Every property carries `x-panel`, either
  // "assumptions" (it changes the underlying data or the model's numbers) or
  // "representation" (it changes how that data is drawn). The frame renders this
  // component once per panel and each draws only its own properties; the split
  // is a fact about the control, so it lives in the schema rather than in a list
  // here.
  import { dev } from '$app/environment';

  let {
    schema,
    params = $bindable(),
    disabled = false,
    transport = null,
    assets = {},
    panel = null
  } = $props();

  // A control whose value is being decided elsewhere is grayed by
  // x-disabled-when and REMOVED by x-shown-when. The difference is whether it
  // still means anything in the current state: an overridden slider is still a
  // number the reader chose, and a control for a view that isn't showing is not
  // a control at all.
  function matches(when) {
    return Object.entries(when).every(([k, v]) =>
      Array.isArray(v) ? v.includes(params[k]) : params[k] === v
    );
  }

  // x-hidden-when-asset names an asset whose presence removes the control
  // outright, rather than greying it. The sunlight sandbox's "which floor of the
  // example" control means nothing once a student has uploaded their own model,
  // and a disabled slider would read as something they had failed to unlock.
  const entries = $derived(
    Object.entries(schema?.properties ?? {})
      .filter(([, p]) => !(p['x-hidden-when-asset'] && assets?.[p['x-hidden-when-asset']]))
      .filter(([key, p]) => {
        if (!panel) return true;
        const declared = p['x-panel'];
        if (!declared && dev) {
          console.error(
            `[ParamPanel] ${key} has no "x-panel". Every property needs one; it is being drawn under assumptions.`
          );
        }
        return (declared ?? 'assumptions') === panel;
      })
      .filter(([, p]) => !p['x-shown-when'] || matches(p['x-shown-when']))
  );

  // x-scenario-of names the enum control that sets this slider. Moving the
  // slider by hand means the reader has left the published scenario, so the
  // enum goes to "custom"; the enum's x-scenario-values writes every slider in
  // one go when a stop is chosen. Nothing is written for "custom" - it is the
  // sliders as they stand.
  function writeScenario(prop, key, stop) {
    params[key] = stop;
    const values = prop['x-scenario-values']?.[stop];
    if (!values) return;
    for (const [k, v] of Object.entries(values)) params[k] = v;
  }

  function leaveScenario(prop) {
    const key = prop['x-scenario-of'];
    if (key && params[key] !== 'custom') params[key] = 'custom';
  }

  function labelFor(prop, value) {
    const i = (prop.enum ?? []).indexOf(value);
    return prop['x-enum-labels']?.[i] ?? String(value);
  }
  // x-enum-notes is x-enum-labels' longer sibling: one note per stop, rendered
  // under the control for the selected stop only. Where a stop carries its own
  // justification (the office rent scenarios in the conversion sandbox), this is where it goes.
  function noteFor(prop, value) {
    const i = (prop.enum ?? []).indexOf(value);
    return prop['x-enum-notes']?.[i] ?? null;
  }
  // Slider granularity comes from x-step, not from multipleOf. multipleOf is a
  // validation keyword and Ajv checks it by dividing: 1.4 / 0.1 is
  // 13.999999999999998, so a schema that declares multipleOf 0.1 rejects a
  // sixth of the positions its own slider can reach. x-step draws the control,
  // minimum and maximum validate. Kept reading multipleOf as a fallback so an
  // integer-stepped schema written the obvious way still works.
  const stepOf = (prop) => prop['x-step'] ?? prop.multipleOf ?? 1;

  // x-format "date" renders a day-of-year as a date. 2026 is not a leap year;
  // any schema using this has to say which year its axis is in.
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function fmt(prop, value) {
    // x-format "clock" renders a fractional hour as HH:MM - the transport
    // readout for a time-of-day axis should read as a clock, not a decimal.
    if (prop['x-format'] === 'clock') {
      const h = Math.floor(value) % 24;
      const m = Math.round((value - Math.floor(value)) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (prop['x-format'] === 'date') {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + Math.round(value) - 1);
      return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    }
    if (prop.enum) return labelFor(prop, value);
    const step = stepOf(prop);
    const dp = step < 1 ? String(step).split('.')[1].length : 0;
    return `${Number(value).toFixed(dp)}${prop['x-unit'] ? ' ' + prop['x-unit'] : ''}`;
  }

  // A control whose value is being decided by another control has no business
  // being draggable. x-disabled-when names the other controls and the values
  // that take it over; x-disabled-note says so in place of the readout, because
  // a grayed slider on its own reads as broken rather than as overridden.
  //
  // A value may be an array, meaning any one of these takes the control over -
  // bathtub's `aep` has four storm levels and one "no storm", and it is the
  // four that override the manual surge and the tide.
  //
  // The value is NOT written back while a control is disabled. The sandbox
  // derives the real number itself, and having the panel race it to the same
  // state is how you get a reactive loop.
  function overridden(prop) {
    const when = prop['x-disabled-when'];
    return when ? matches(when) : false;
  }

  // x-group starts a labelled section. The heading is drawn when the group
  // changes, so the schema's property order is the panel's reading order.
  const grouped = $derived(
    entries.map(([key, prop], i) => ({
      key,
      prop,
      heading: prop['x-group'] && prop['x-group'] !== entries[i - 1]?.[1]['x-group']
        ? prop['x-group']
        : null
    }))
  );
</script>

{#snippet speedRow()}
  <span class="speeds">
    {#each [0.5, 1, 2, 4] as m (m)}
      <button
        type="button"
        class="speed"
        class:on={transport.speed === m}
        onclick={() => transport.setSpeed(m)}>{m}×</button
      >
    {/each}
  </span>
{/snippet}

<div class="params">
  {#if transport?.external && panel !== 'assumptions'}
    <!-- A sandbox whose clock is an engine, not a schema property. Same row,
         run/pause/step of the simulation underneath. It is a representation
         control like any other timeline, so it draws at the top of that panel. -->
    <div class="param">
      <div class="param-head">
        <label for="p-transport-external">{transport.external.label ?? 'the clock'}</label>
        <span class="param-value">{transport.externalReadout}</span>
      </div>
      <div class="transport" id="p-transport-external">
        <button
          type="button"
          class="tbtn"
          onclick={() => transport.toggleExternal()}
          aria-label={transport.playingKey === 'external' ? 'pause' : 'play'}
        >
          {transport.playingKey === 'external' ? '⏸' : '⏵'}
        </button>
        <button type="button" class="tbtn" onclick={() => transport.stepExternal()} aria-label="step">⏭</button>
        {@render speedRow()}
      </div>
    </div>
  {/if}
  {#each grouped as { key, prop, heading } (key)}
    {#if heading}
      <h3 class="group">{heading}</h3>
    {/if}
    {@const off = disabled || overridden(prop)}
    <div class="param" class:emphasis={prop['x-emphasis']} class:off>
      <div class="param-head">
        <label for="p-{key}">{prop.title ?? key}</label>
        {#if off && prop['x-disabled-note']}
          <span class="param-value note">{prop['x-disabled-note']}</span>
        {:else if prop.type === 'number' || (prop.type === 'integer' && !prop.enum) || (prop.enum && prop['x-control'] === 'slider')}
          <span class="param-value">{fmt(prop, params[key])}</span>
        {/if}
      </div>

      {#if transport && prop['x-timeline'] && !off}
        {@const held = transport.playingKey !== null && transport.playingKey !== key}
        <div class="transport">
          <button type="button" class="tbtn" onclick={() => transport.stepBack(key)} aria-label="back">⏮</button>
          {#if held}
            <!-- Another timeline is playing and holds this one. Said on
                 screen, not just in code. -->
            <span class="held">held at {fmt(prop, params[key])}</span>
          {:else}
            <button
              type="button"
              class="tbtn"
              onclick={() => transport.toggle(key)}
              aria-label={transport.playingKey === key ? 'pause' : 'play'}
            >
              {transport.playingKey === key ? '⏸' : '⏵'}
            </button>
            <span class="readout">{fmt(prop, params[key])}</span>
          {/if}
          <button type="button" class="tbtn" onclick={() => transport.stepFwd(key)} aria-label="forward">⏭</button>
          {#if !held}{@render speedRow()}{/if}
        </div>
      {/if}

      {#if prop.type === 'boolean'}
        <button
          id="p-{key}"
          type="button"
          class="toggle"
          class:on={params[key]}
          disabled={off}
          onclick={() => (params[key] = !params[key])}
        >
          <span class="dot"></span>{params[key] ? 'on' : 'off'}
        </button>
      {:else if prop.enum && prop['x-control'] === 'slider'}
        <!-- An enum with too many stops for buttons (Anthromes has 75 years)
             is drawn as a slider over the stop INDEX. The value written back
             is still the enum member, so the schema validates it unchanged
             and the transport, which already steps enums by index, needs
             nothing new. The readout in the head shows the stop's label. -->
        <input
          id="p-{key}"
          type="range"
          min="0"
          max={prop.enum.length - 1}
          step="1"
          disabled={off}
          value={Math.max(0, prop.enum.indexOf(params[key]))}
          onpointerdown={() => prop['x-timeline'] && transport?.pause(key)}
          onkeydown={() => prop['x-timeline'] && transport?.pause(key)}
          oninput={(e) => (params[key] = prop.enum[Number(e.currentTarget.value)])}
        />
      {:else if prop['x-scenario-values']}
        <!-- A scenario enum: one button per line rather than a segmented row,
             because the labels are sentences. Choosing a stop writes every
             slider it names. -->
        <div class="stack" id="p-{key}">
          {#each prop.enum as opt}
            <button
              type="button"
              class:on={params[key] === opt}
              disabled={off}
              onclick={() => writeScenario(prop, key, opt)}>{labelFor(prop, opt)}</button
            >
          {/each}
        </div>
      {:else if prop.enum}
        <div class="segmented" id="p-{key}">
          {#each prop.enum as opt}
            <button
              type="button"
              class:on={params[key] === opt}
              disabled={off}
              onclick={() => {
                if (prop['x-timeline']) transport?.pause(key);
                params[key] = opt;
              }}>{labelFor(prop, opt)}</button
            >
          {/each}
        </div>
      {:else}
        <input
          id="p-{key}"
          type="range"
          min={prop.minimum}
          max={prop.maximum}
          step={stepOf(prop)}
          disabled={off}
          onpointerdown={() => prop['x-timeline'] && transport?.pause(key)}
          onkeydown={() => prop['x-timeline'] && transport?.pause(key)}
          oninput={() => leaveScenario(prop)}
          bind:value={params[key]}
        />
      {/if}

      <!-- The prose folds away so the panel is the controls, not an essay
           with sliders in it. Collapsed by default; the justifications are one
           click away, and a selected enum stop's own note travels with the
           description under the same fold. -->
      {#if prop.description || (prop.enum && noteFor(prop, params[key]))}
        <details class="why">
          <summary>why these numbers</summary>
          {#if prop.enum && noteFor(prop, params[key])}
            <p class="param-note stop-note">{noteFor(prop, params[key])}</p>
          {/if}
          {#if prop.description}
            <p class="param-note">{prop.description}</p>
          {/if}
        </details>
      {/if}
    </div>
  {/each}
</div>

<style>
  .params { display: flex; flex-direction: column; gap: 1.25rem; }
  .group {
    font-size: 0.65rem; text-transform: lowercase; letter-spacing: 0.06em;
    color: #999; font-weight: 400; margin: 0.5rem 0 -0.5rem;
    border-bottom: 1px solid #eee; padding-bottom: 0.4rem;
  }
  .group:first-child { margin-top: 0; }
  .param { display: flex; flex-direction: column; gap: 0.35rem; }
  .param.off label, .param.off .param-note { color: #bbb; }
  .param.off input[type='range'] { accent-color: #ccc; }
  .param-value.note { font-style: italic; color: #aaa; font-variant-numeric: normal; }
  .param.emphasis {
    border-left: 2px solid #000;
    padding-left: 0.75rem;
    margin-left: -0.75rem;
  }
  .param-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  label { font-size: 0.75rem; font-weight: 700; }
  .param-value { font-size: 0.75rem; color: #666; font-variant-numeric: tabular-nums; }
  .param-note { font-size: 0.68rem; line-height: 1.5; color: #666; margin: 0.15rem 0 0; }
  .why summary {
    cursor: pointer; list-style: none;
    font-size: 0.6rem; color: #aaa; letter-spacing: 0.03em;
    display: inline-flex; align-items: baseline; gap: 0.3rem;
  }
  .why summary::-webkit-details-marker { display: none; }
  .why summary::before { content: '+'; font-weight: 400; }
  .why[open] > summary::before { content: '–'; }
  .why summary:hover { color: #000; }
  .why[open] > summary { color: #666; margin-bottom: 0.2rem; }
  input[type='range'] { width: 100%; accent-color: #000; }
  .transport {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.15rem 0;
  }
  .tbtn {
    font: inherit; font-size: 0.7rem; line-height: 1;
    padding: 0.25rem 0.4rem;
    background: #fff; border: 1px solid #ccc; cursor: pointer; color: #000;
  }
  .tbtn:hover { border-color: #000; }
  .readout {
    flex: 1; text-align: center;
    font-size: 0.95rem; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .held {
    flex: 1; text-align: center;
    font-size: 0.72rem; font-style: italic; color: #999;
    font-variant-numeric: tabular-nums;
  }
  .speeds { display: flex; }
  .speed {
    font: inherit; font-size: 0.6rem; line-height: 1;
    padding: 0.25rem 0.28rem;
    background: #fff; border: 1px solid #eee; border-right: 0; cursor: pointer; color: #999;
  }
  .speed:last-child { border-right: 1px solid #eee; }
  .speed.on { background: #000; border-color: #000; color: #fff; }
  .stop-note { font-style: italic; }
  .stack { display: flex; flex-direction: column; border: 1px solid #ccc; }
  .stack button {
    padding: 0.35rem 0.5rem; font: inherit; font-size: 0.7rem; text-align: left;
    background: #fff; border: 0; border-bottom: 1px solid #eee; cursor: pointer; color: #666;
  }
  .stack button:last-child { border-bottom: 0; }
  .stack button.on { background: #000; color: #fff; }
  .segmented { display: flex; border: 1px solid #ccc; }
  .segmented button {
    flex: 1; padding: 0.3rem 0.4rem; font: inherit; font-size: 0.7rem;
    background: #fff; border: 0; border-right: 1px solid #eee; cursor: pointer; color: #666;
  }
  .segmented button:last-child { border-right: 0; }
  .segmented button.on { background: #000; color: #fff; }
  .toggle {
    display: inline-flex; align-items: center; gap: 0.5rem; align-self: flex-start;
    padding: 0.3rem 0.6rem; font: inherit; font-size: 0.7rem;
    background: #fff; border: 1px solid #ccc; cursor: pointer; color: #666;
  }
  .toggle.on { border-color: #000; color: #000; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #ccc; }
  .toggle.on .dot { background: #000; }
</style>
