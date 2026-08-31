<script>
  // Renders controls straight off the sandbox's JSON Schema. One schema does two
  // jobs: it draws this panel, and the server validates submitted params against
  // the same file. If a control is missing here, add it to the schema, not here.
  let { schema, params = $bindable(), disabled = false } = $props();

  const entries = $derived(Object.entries(schema?.properties ?? {}));

  function labelFor(prop, value) {
    const i = (prop.enum ?? []).indexOf(value);
    return prop['x-enum-labels']?.[i] ?? String(value);
  }
  // Slider granularity comes from x-step, not from multipleOf. multipleOf is a
  // validation keyword and Ajv checks it by dividing: 1.4 / 0.1 is
  // 13.999999999999998, so a schema that declares multipleOf 0.1 rejects a
  // sixth of the positions its own slider can reach. x-step draws the control,
  // minimum and maximum validate. Kept reading multipleOf as a fallback so an
  // integer-stepped schema written the obvious way still works.
  const stepOf = (prop) => prop['x-step'] ?? prop.multipleOf ?? 1;

  function fmt(prop, value) {
    const step = stepOf(prop);
    const dp = step < 1 ? String(step).split('.')[1].length : 0;
    return `${Number(value).toFixed(dp)}${prop['x-unit'] ? ' ' + prop['x-unit'] : ''}`;
  }

  // A control whose value is being decided by another control has no business
  // being draggable. x-disabled-when names the other controls and the values
  // that take it over; x-disabled-note says so in place of the readout, because
  // a greyed slider on its own reads as broken rather than as overridden.
  //
  // The value is NOT written back while a control is disabled. The sandbox
  // derives the real number itself, and having the panel race it to the same
  // state is how you get a reactive loop.
  function overridden(prop) {
    const when = prop['x-disabled-when'];
    if (!when) return false;
    return Object.entries(when).every(([k, v]) => params[k] === v);
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

<div class="params">
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
        {:else if prop.type === 'number' || (prop.type === 'integer' && !prop.enum)}
          <span class="param-value">{fmt(prop, params[key])}</span>
        {/if}
      </div>

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
      {:else if prop.enum}
        <div class="segmented" id="p-{key}">
          {#each prop.enum as opt}
            <button
              type="button"
              class:on={params[key] === opt}
              disabled={off}
              onclick={() => (params[key] = opt)}>{labelFor(prop, opt)}</button
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
          bind:value={params[key]}
        />
      {/if}

      {#if prop.description}
        <p class="param-note">{prop.description}</p>
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
  input[type='range'] { width: 100%; accent-color: #000; }
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
