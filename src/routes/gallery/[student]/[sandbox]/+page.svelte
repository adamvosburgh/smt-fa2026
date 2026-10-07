<script>
  // The archived page. Same component as the sandbox, mode="view" - which is the
  // whole reason for the one-component-two-modes rule. Nothing here re-renders a
  // frozen screenshot; it runs the real thing at the student's parameters.
  import { load as loadSandbox, defaults } from '$lib/sandboxes/index.js';
  import SandboxFrame from '$lib/components/SandboxFrame.svelte';
  import { studentMarkdown } from '$lib/student-markdown.js';
  import { FRAME_CSP } from '$lib/frame-policy.js';
  import { MODE } from '$lib/data.js';
  //
  // Assignment uploads are the other case: no sandbox, just the file the
  // student handed in - an image, a PDF, or one self-contained HTML page run in
  // a sandboxed iframe (no same-origin, so it can't read the token; that also
  // means it can't fetch anything, which is why the file has to be
  // self-contained).
  //
  // A .glb is the third case, and it is neither: the file is not something to
  // show, it is something to RUN. The sunlight sandbox is mounted on it in edit
  // mode, so the visitor can move the clock through the student's own model.
  // The Submit button comes off, because the file already is the submission.
  //
  // A link submission (manifest.link, a GitHub Pages address) shows the
  // screenshot, the link, and in live mode the live page framed below it. The
  // archive drops the frame, since the page it points at may not outlast it.
  let { data } = $props();

  const isAssignment = $derived(data.sub.kind === 'assignment');
  const primary = $derived(data.sub.primary ? `${data.sub.assetBase}${data.sub.primary}` : null);
  const primaryKind = $derived(
    /\.(png|jpe?g|webp)$/i.test(primary ?? '') ? 'image'
      : /\.pdf$/i.test(primary ?? '') ? 'pdf'
      : /\.html?$/i.test(primary ?? '') ? 'html'
      : /\.glb$/i.test(primary ?? '') ? 'model'
      : 'file'
  );

  const MODEL_SANDBOX = 'sunlight';
  const isModel = $derived(isAssignment && primaryKind === 'model');
  const link = $derived(isAssignment ? (data.sub.link ?? null) : null);
  // With a link, the screenshot is what is shown: the primary when no file came
  // with it, the cover otherwise. Any file that did come is listed below.
  const shot = $derived(link ? (primaryKind === 'image' ? primary : data.sub.coverUrl) : null);
  // Real state rather than a derived object, because the frame's transport
  // writes into it while the clock plays.
  let modelParams = $state({});

  let Component = $state(null);
  $effect(() => {
    if (isModel) {
      modelParams = { ...defaults(MODEL_SANDBOX), ...(data.sub.params ?? {}) };
      // The frame publishes __metrics and data-cover-ready for this one, the
      // same as on the sandbox route, so the cover script needs nothing special.
      loadSandbox(MODEL_SANDBOX).then((m) => (Component = m.default));
      return;
    }
    if (isAssignment) {
      // Let the cover script treat this page like a settled sandbox.
      window.__metrics = { kind: 'assignment' };
      return;
    }
    loadSandbox(data.sub.sandbox).then((m) => (Component = m.default));
  });

  const modelMeta = $derived(isModel ? data.modelSandbox : null);
</script>

<header class="sub-header">
  <h1>{data.sub.title}</h1>
  {#if isAssignment}
    <p class="who">{data.sub.student} · <a href="/assignments/{data.sub.sandbox}/">{data.assignment?.title ?? data.sub.sandbox}</a></p>
  {:else}
    <p class="who">{data.sub.student} · <a href="/sandboxes/{data.sub.sandbox}/">{data.meta?.title}</a></p>
  {/if}
  <p class="gallery-text">{data.sub.gallery_text}</p>
</header>

{#if isModel}
  {#if Component && modelMeta}
    <SandboxFrame
      meta={modelMeta}
      schema={modelMeta.schema}
      {Component}
      mode="edit"
      layout="contained"
      bind:params={modelParams}
      assets={{ model: primary }}
      submittable={false}
    />
  {/if}
  <p class="download"><a href={primary}>Download the model ({data.sub.primary?.replace(/^assets\//, '')})</a></p>
{:else if link}
  <div class="work" data-cover-target data-cover-ready="true" data-timeline-paused="true">
    <img src={shot} alt={data.sub.title} />
    <p class="open"><a href={link} target="_blank" rel="noopener">{link}</a></p>
  </div>
  {#if MODE !== 'archive'}
    <div class="work live">
      <iframe src={link} title={data.sub.title} sandbox="allow-scripts" loading="lazy"></iframe>
    </div>
  {/if}
{:else if isAssignment}
  <div class="work" data-cover-target data-cover-ready="true" data-timeline-paused="true">
    {#if primaryKind === 'image'}
      <img src={primary} alt={data.sub.title} />
    {:else if primaryKind === 'pdf' && data.sub.pages?.length}
      <!-- Every page as an image, drawn at upload, because a phone's browser
           shows only the first page of an embedded PDF, or nothing. -->
      {#each data.sub.pages as p, i (p)}
        <img class="page" src="{data.sub.assetBase}{p}" alt="{data.sub.title}, page {i + 1}" loading="lazy" />
      {/each}
      <p class="open">
        {#if data.sub.page_count > data.sub.pages.length}First {data.sub.pages.length} of {data.sub.page_count} pages. {/if}<a href={primary} target="_blank" rel="noopener">Open the PDF</a>
      </p>
    {:else if primaryKind === 'pdf'}
      <object data={primary} type="application/pdf" title={data.sub.title}>
        <p><a href={primary}>Open the PDF</a>.</p>
      </object>
    {:else if primaryKind === 'html'}
      <iframe src={primary} title={data.sub.title} sandbox="allow-scripts" csp={MODE === 'archive' ? undefined : FRAME_CSP} loading="lazy"></iframe>
      <p class="open"><a href={primary} target="_blank" rel="noopener">Open full screen</a></p>
    {:else if primary}
      <p><a href={primary}>Download {data.sub.primary}</a></p>
    {/if}
  </div>
{/if}

{#if isAssignment}
  {@const listed = (data.sub.assets ?? []).filter((a) => a.path !== data.sub.primary || (link && primaryKind !== 'image'))}
  {#if listed.length}
    <ul class="extras">
      {#each listed as a (a.path)}
        <li><a href="{data.sub.assetBase}{a.path}">{a.path.replace(/^assets\//, '')}</a> <span>{(a.bytes / 1e6).toFixed(1)}MB</span></li>
      {/each}
    </ul>
  {/if}
{/if}

{#if Component && !isModel}
  <SandboxFrame
    meta={data.meta}
    schema={data.meta?.schema}
    {Component}
    mode="view"
    params={data.sub.params}
    assets={data.sub.assets ?? {}}
  />
{/if}

{#if data.sub.description}
  <div class="content-article desc">{@html studentMarkdown(data.sub.description)}</div>
{/if}

{#if data.promptText}
  <section class="prompt">
    <h2>Prompt</h2>
    <pre><code class="wrap">{data.promptText}</code></pre>
    <p class="open"><a href="{data.sub.assetBase}{data.promptPath}" target="_blank" rel="noopener">{data.promptPath.replace(/^assets\//, '')}</a></p>
  </section>
{/if}

{#if isAssignment && data.sub.answers && (data.assignment?.questions ?? []).length}
  <dl class="answers">
    {#each data.assignment.questions as q (q.key)}
      {#if !q.private && data.sub.answers[q.key]}
        <dt>{q.label}</dt>
        <dd>{data.sub.answers[q.key]}</dd>
      {/if}
    {/each}
  </dl>
{/if}

{#if !isAssignment || isModel}
  <details class="params-dump">
    <summary>Parameters as submitted</summary>
    <pre>{JSON.stringify(data.sub.params, null, 2)}</pre>
  </details>
{/if}

<style>
  .sub-header { margin-bottom: 1.5rem; }
  h1 { font-size: 1.4rem; margin: 0 0 0.3rem; }
  .who { font-size: 0.75rem; color: var(--fg-dim); margin: 0 0 1rem; }
  .gallery-text { font-size: 0.95rem; line-height: 1.7; max-width: 60ch; margin: 0; }
  .who a:hover, .extras a:hover, .download a:hover, .work .open a:hover, .prompt .open a:hover {
    background: var(--hi); color: var(--hi-fg); text-decoration: none;
  }
  .prompt { margin-top: 2.5rem; max-width: 80ch; }
  .prompt h2 { font-size: 0.95rem; margin: 0 0 0.75rem; }
  .prompt .open { font-size: 0.72rem; margin: 1rem 0 0; }
  .desc { margin-top: 2rem; max-width: 60ch; }
  .answers { margin-top: 2rem; max-width: 60ch; font-size: 0.9rem; }
  .answers dt { font-size: 0.72rem; font-weight: 700; margin-top: 1.1rem; }
  .answers dd { margin: 0.3rem 0 0; line-height: 1.6; white-space: pre-wrap; }
  .params-dump { margin-top: 2.5rem; font-size: 0.72rem; }
  .params-dump summary { cursor: pointer; color: var(--fg-dim); }
  .params-dump pre { background: var(--code-bg); padding: 0.75rem; overflow-x: auto; margin-top: 0.5rem; }
  .work { border: 1px solid var(--rule); background: var(--code-bg); }
  .work img { display: block; width: 100%; height: auto; }
  .work.live { margin-top: 1rem; }
  .work img.page + img.page { border-top: 1px solid var(--rule); }
  .work object, .work iframe { display: block; width: 100%; height: min(80vh, 900px); border: 0; background: #fff; }
  /* the embedded file is the student's own page; it keeps a white ground */
  .work .open { font-size: 0.72rem; margin: 0; padding: 0.4rem 0.6rem; border-top: 1px solid var(--rule); }
  .download { font-size: 0.75rem; margin: 0.75rem 0 0; }
  .extras { list-style: none; padding: 0; margin: 1rem 0 0; font-size: 0.75rem; }
  .extras span { color: var(--fg-dim); margin-left: 0.5rem; }
</style>
