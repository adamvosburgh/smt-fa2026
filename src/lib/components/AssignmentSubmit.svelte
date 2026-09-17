<script>
  // The upload modal on an assignment page.
  //
  // Same write path as a sandbox submission (/api/submit, the student's token,
  // manifest + assets), with manifest.kind = 'assignment' and the assignment
  // slug where a sandbox slug would go. The gallery then shows the uploaded file
  // instead of running a sandbox at the submitted parameters.
  //
  // The cover is drawn here, in the browser, as a JPEG from the uploaded image - the
  // server has no image library and the Playwright cover pipeline would only
  // give us a screenshot of the same picture. PDFs and HTML files get no cover
  // from here; `npm run covers -- --submissions` screenshots those.
  //
  // A `model` assignment is the exception to "the gallery shows the file": the
  // gallery RUNS it, in the sandbox named by the assignment's `sandbox_ref`. The
  // sandbox can work out everything about the model except where on earth it is,
  // so four site fields travel with it as manifest.params. Their defaults come
  // from that sandbox's own schema, so there is one place they are written down.
  import { token } from '$lib/token.js';
  import { bySlug, defaults } from '$lib/sandboxes/index.js';
  import { drawCopy } from '$lib/draw-copy.js';
  let { doc, onclose } = $props();

  const accepts = Array.isArray(doc.accepts) && doc.accepts.length ? doc.accepts : ['image', 'pdf'];

  // Which boxes the form shows, and in what order, from the assignment's `form:`
  // frontmatter. Title, gallery text and the work are always asked for, because
  // the server requires them; an assignment can leave out description and extras.
  const FORM_DEFAULT = ['title', 'gallery_text', 'description', 'work', 'extras'];
  const form = [...(Array.isArray(doc.form) && doc.form.length ? doc.form : FORM_DEFAULT)];
  for (const f of ['title', 'gallery_text', 'work']) if (!form.includes(f)) form.push(f);

  // Short-answer questions from the assignment's `questions:` frontmatter, a
  // list of { key, label }, with `options` for a dropdown. They come after the boxes. The answers go in the
  // manifest and the gallery page shows them under the same labels.
  const questions = Array.isArray(doc.questions) ? doc.questions.filter((q) => q?.key && q?.label) : [];
  let answers = $state(Object.fromEntries(questions.map((q) => [q.key, ''])));
  const answered = $derived(questions.every((q) => answers[q.key]?.trim()));
  const EXT = { image: '.png,.jpg,.jpeg,.webp', pdf: '.pdf', html: '.html', model: '.glb' };
  const accept = accepts.map((k) => EXT[k]).filter(Boolean).join(',');

  const isModel = accepts.includes('model');
  const modelSlug = doc.sandbox_ref ?? 'sunlight';
  const modelSchema = bySlug[modelSlug]?.schema ?? null;
  const zones = modelSchema?.properties?.timezone?.enum ?? ['America/New_York'];
  const zoneLabels = modelSchema?.properties?.timezone?.['x-enum-labels'] ?? zones;
  const modelDefaults = defaults(modelSlug);
  let site = $state({
    latitude: modelDefaults.latitude ?? 0,
    longitude: modelDefaults.longitude ?? 0,
    timezone: modelDefaults.timezone ?? 'America/New_York',
    north_deg: modelDefaults.north_deg ?? 0
  });

  let title = $state('');
  let galleryText = $state('');
  let description = $state('');
  let primary = $state(null);
  let extras = $state([]);
  let result = $state(null);
  let busy = $state(false);

  const isImage = (f) => /\.(png|jpe?g|webp)$/i.test(f?.name ?? '');

  // The upload cap, checked here as soon as a file is chosen so nobody finds out
  // after pressing submit. Keep in step with maxSubmissionBytes in
  // src/lib/server/config.js, which is what the server enforces. It covers the
  // work and the extras together; the cover drawn below is not counted.
  const MAX_BYTES = 15 * 1024 * 1024;
  const LIMIT = '15MB';
  const mb = (bytes) => `${(bytes / 1048576).toFixed(1)}MB`;
  const total = $derived((primary?.size ?? 0) + extras.reduce((n, f) => n + f.size, 0));
  const tooBig = $derived(total > MAX_BYTES);

  async function submit() {
    busy = true;
    result = null;
    const fd = new FormData();
    fd.set(
      'manifest',
      JSON.stringify({
        sandbox: doc.slug,
        kind: 'assignment',
        student: 'ignored-server-derives-this',
        title,
        gallery_text: galleryText,
        description,
        params: isModel
          ? {
              latitude: Number(site.latitude),
              longitude: Number(site.longitude),
              timezone: site.timezone,
              north_deg: Number(site.north_deg)
            }
          : {},
        primary: `assets/${primary.name}`,
        answers: questions.length ? $state.snapshot(answers) : undefined,
        app_version: '0.1.0'
      })
    );
    fd.append('asset', primary, primary.name);
    for (const f of extras) fd.append('asset', f, f.name);
    // A 1200px-wide JPEG of the uploaded image, for the Student Work card.
    const cover = isImage(primary) ? await drawCopy(primary, { width: 1200 }) : null;
    if (cover) fd.append('cover', cover, 'cover.jpg');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: $token ? { authorization: `Bearer ${$token}` } : {},
        body: fd
      });
      // /api/submit answers in JSON, including when an upload is too large. The
      // Node server's own body-size limit does not, so a 413 without JSON still
      // gets a sentence.
      const body = await res.json().catch(() => null);
      result =
        body ??
        (res.status === 413
          ? { ok: false, error: `The upload is too large. The limit is ${LIMIT} for everything together.` }
          : { ok: false, error: 'Upload failed. Your work is not lost - try again.' });
    } catch {
      result = { ok: false, error: 'Upload failed. Your work is not lost - try again.' };
    } finally {
      busy = false;
    }
  }
</script>

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="dialog" role="dialog" aria-label="Submit">
  <h2>Submit — {doc.title}</h2>

  {#if !$token}
    <label>
      Submission token
      <input type="password" bind:value={$token} placeholder="paste it once" />
    </label>
    <p class="hint">You were given this at the start of the semester. The browser keeps it.</p>
  {/if}

  {#each form as f (f)}
    {#if f === 'title'}
      <label>Title<input bind:value={title} maxlength="140" /></label>
    {:else if f === 'gallery_text'}
      <label>
        Gallery text
        <textarea bind:value={galleryText} rows="3" maxlength="600"
          placeholder="Two sentences. Text that might accompany a work of art."></textarea>
      </label>
    {:else if f === 'description'}
      <label>
        Description
        <textarea bind:value={description} rows="5"
          placeholder="Longer text. Sources, what you did, what it can't see."></textarea>
      </label>
    {:else if f === 'work'}
      <label>
        The work ({accepts.join(', ')})
        <input type="file" {accept} onchange={(e) => (primary = e.currentTarget.files[0] ?? null)} />
      </label>
      {#if primary && primary.size > MAX_BYTES}
        <p class="err size">This file is {mb(primary.size)}. The limit is {LIMIT}. Export a smaller
          version and choose it again.</p>
      {/if}
      <p class="hint">
        {#if isModel}This is the model the gallery runs. One <code>.glb</code>, in meters, under 15MB,
        with the objects named the way the tutorial describes.{:else}This is the file the gallery
        shows. It has to be under 15MB.{/if}
        {#if accepts.includes('html')}An HTML file must be one self-contained file - styles, scripts
        and data inline - because the gallery runs it in a sandboxed frame that can't fetch anything
        else.{/if}
      </p>

      {#if isModel}
        <fieldset class="site">
          <legend>Where the model is</legend>
          <p class="hint">
            The sandbox reads everything else out of the file. It can't work out where on earth your
            model sits, so these four travel with it.
          </p>
          <div class="grid">
            <label>Latitude<input type="number" step="0.0001" bind:value={site.latitude} /></label>
            <label>Longitude<input type="number" step="0.0001" bind:value={site.longitude} /></label>
            <label>
              Time zone
              <select bind:value={site.timezone}>
                {#each zones as z, i (z)}<option value={z}>{zoneLabels[i] ?? z}</option>{/each}
              </select>
            </label>
            <label>North offset<input type="number" step="1" bind:value={site.north_deg} /></label>
          </div>
        </fieldset>
      {/if}
    {:else if f === 'extras'}
      <label>
        Anything else (optional, 15MB total)
        <input type="file" multiple onchange={(e) => (extras = [...e.currentTarget.files])} />
      </label>
      {#if tooBig && !(primary && primary.size > MAX_BYTES)}
        <p class="err size">These files come to {mb(total)} with the work. The limit is {LIMIT}
          for everything together. Leave some out or export smaller versions.</p>
      {/if}
    {/if}
  {/each}

  {#each questions as q (q.key)}
    <label>
      {q.label}
      {#if Array.isArray(q.options) && q.options.length}
        <select bind:value={answers[q.key]}>
          <option value="" disabled>Choose one</option>
          {#each q.options as o}<option value={o}>{o}</option>{/each}
        </select>
      {:else}
        <textarea bind:value={answers[q.key]} rows="3" maxlength="2000"></textarea>
      {/if}
    </label>
  {/each}

  {#if result}
    {#if result.ok}
      <p class="ok">Submitted. <a href={result.next}>See it</a>.</p>
    {:else if result.errors}
      <ul class="errs">
        {#each result.errors as e}
          <li>{e.message}{#if e.see} <a href={e.see}>Fix</a>{/if}</li>
        {/each}
      </ul>
    {:else}
      <p class="err">{result.error}</p>
    {/if}
  {/if}

  <div class="actions">
    <button type="button" onclick={onclose}>close</button>
    <button type="button" class="go" disabled={busy || !title || !galleryText || !primary || !answered || tooBig} onclick={submit}>
      {busy ? 'sending…' : 'submit'}
    </button>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
  .dialog {
    position: fixed; z-index: 1101; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(520px, calc(100vw - 2rem)); max-height: 86vh; overflow-y: auto;
    background: var(--bg); color: var(--fg); border: 1px solid var(--rule); padding: 1.5rem; font-size: 0.78rem;
  }
  h2 { font-size: 0.95rem; margin: 0 0 1.25rem; }
  label { display: block; margin-bottom: 0.9rem; font-size: 0.72rem; font-weight: 700; }
  input, textarea, select { display: block; width: 100%; font: inherit; font-size: 0.78rem; font-weight: 400;
    margin-top: 0.3rem; padding: 0.4rem; border: 1px solid var(--rule);
    background: var(--code-bg); color: var(--fg); }
  .hint { font-size: 0.66rem; color: var(--fg-dim); margin: -0.5rem 0 1rem; }
  .site { border: 1px solid var(--rule); padding: 0.6rem 0.8rem 0.2rem; margin: 0 0 0.9rem; }
  .site legend { font-size: 0.7rem; font-weight: 700; padding: 0 0.3rem; }
  .site .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 0.6rem; }
  .actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
  .actions button { font: inherit; font-size: 0.72rem; padding: 0.45rem 0.9rem;
    border: 1px solid var(--fg); background: transparent; color: var(--fg); cursor: pointer; }
  .actions button:hover { background: var(--hi); color: var(--hi-fg); border-color: var(--hi); }
  .actions .go { background: var(--fg); color: var(--bg); }
  .actions .go:disabled { opacity: 0.4; cursor: default; }
  .actions .go:disabled:hover { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .ok { color: var(--hi); }
  .err, .errs { color: var(--fg); font-weight: 700; }
  .size { font-size: 0.72rem; margin: -0.5rem 0 1rem; }
  .errs { padding-left: 1.1rem; font-size: 0.72rem; }
</style>
