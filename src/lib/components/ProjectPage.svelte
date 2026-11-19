<script>
  // Final project page: gallery text, cover item in a window (fullscreen-able),
  // then the markdown write-up.
  import { writeupMarkdown } from '$lib/student-markdown.js';
  import { FRAME_CSP } from '$lib/frame-policy.js';
  import { MODE } from '$lib/data.js';
  let { sub, writeupText, assignmentTitle } = $props();

  const primary = $derived(sub.primary ? `${sub.assetBase}${sub.primary}` : null);
  const link = $derived(sub.link ?? null);

  // youtube / vimeo -> embed url
  function embedOf(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^(www\.|m\.)/, '');
      if (host === 'youtu.be') return { src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`, player: true };
      if (host === 'youtube.com') {
        const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
        if (id) return { src: `https://www.youtube-nocookie.com/embed/${id}`, player: true };
      }
      if (host === 'vimeo.com') {
        const id = u.pathname.match(/^\/(\d+)/)?.[1];
        if (id) return { src: `https://player.vimeo.com/video/${id}`, player: true };
      }
      if (host === 'player.vimeo.com') return { src: url, player: true };
    } catch {}
    return { src: url, player: false };
  }

  const kind = $derived(
    link ? (embedOf(link).player ? 'player' : 'site')
      : /\.(png|jpe?g|webp|gif)$/i.test(primary ?? '') ? 'image'
      : /\.(mp4|webm)$/i.test(primary ?? '') ? 'video'
      : /\.html?$/i.test(primary ?? '') ? 'html'
      : 'file'
  );
  // archive: hosted sites aren't framed (may not outlast it); players are
  const frameLink = $derived(link && (kind === 'player' || MODE !== 'archive'));

  let full = $state(false);
  $effect(() => {
    if (!full) return;
    const key = (e) => e.key === 'Escape' && (full = false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', key);
    };
  });

  const html = $derived(writeupText ? writeupMarkdown(writeupText, sub.assetBase) : '');
</script>

<header class="head">
  <h1>{sub.title}</h1>
  <p class="authors">{sub.group || sub.student}</p>
  <p class="who"><a href="/assignments/{sub.sandbox}/">{assignmentTitle ?? sub.sandbox}</a></p>
  {#if sub.gallery_text}<p class="gallery-text">{sub.gallery_text}</p>{/if}
</header>

<div class="window" class:full data-cover-target data-cover-ready="true" data-timeline-paused="true">
  <div class="bar">
    {#if full}
      <button type="button" class="close" onclick={() => (full = false)}>Close</button>
    {:else}
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    {/if}
    <span class="bar-title">{sub.title}</span>
    {#if !full}
      <button type="button" class="expand" onclick={() => (full = true)} aria-label="Full screen" title="Full screen">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5" fill="none" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </button>
    {/if}
  </div>
  <div class="stage {kind}" class:framed={kind === 'html' || (link && frameLink)}>
    {#if link && frameLink}
      {@const e = embedOf(link)}
      {#if e.player}
        <iframe src={e.src} title={sub.title} allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>
      {:else}
        <iframe src={e.src} title={sub.title} sandbox="allow-scripts" loading="lazy"></iframe>
      {/if}
    {:else if link}
      <img src={sub.coverUrl} alt={sub.title} />
    {:else if kind === 'image'}
      <img src={primary} alt={sub.title} />
    {:else if kind === 'video'}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video src={primary} controls playsinline preload="metadata" poster={sub.coverUrl}></video>
    {:else if kind === 'html'}
      <iframe src={primary} title={sub.title} sandbox="allow-scripts" csp={MODE === 'archive' ? undefined : FRAME_CSP}></iframe>
    {:else if primary}
      <p class="open"><a href={primary}>Download {sub.primary.replace(/^assets\//, '')}</a></p>
    {/if}
  </div>
</div>
{#if link}
  <p class="link"><a href={link} target="_blank" rel="noopener">{link}</a></p>
{/if}

{#if html}
  <article class="content-article writeup">{@html html}</article>
{/if}

<style>
  .head { margin-bottom: 1.25rem; max-width: 68ch; }
  h1 { font-size: 1.4rem; margin: 0 0 0.3rem; }
  .authors { font-size: 0.9rem; margin: 0 0 0.3rem; }
  .who { font-size: 0.72rem; color: var(--fg-dim); margin: 0 0 0.75rem; }
  .who a:hover, .link a:hover { background: var(--hi); color: var(--hi-fg); text-decoration: none; }
  .gallery-text { font-size: 0.8rem; line-height: 1.6; color: var(--fg-dim); margin: 0; }

  .window { border: 1px solid var(--rule); }
  .stage { background: #fff; }
  .bar {
    display: flex; align-items: center; gap: 0.6rem; height: 1.9rem; padding: 0 0.5rem;
    background: var(--code-bg); border-bottom: 1px solid var(--rule); font-size: 0.7rem;
  }
  .dots { display: flex; gap: 0.3rem; }
  .dots i { width: 0.55rem; height: 0.55rem; border-radius: 50%; border: 1px solid var(--rule); }
  .bar-title { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--fg-dim); }
  .expand {
    display: grid; place-items: center; width: 1.5rem; height: 1.5rem; padding: 0; cursor: pointer;
    background: transparent; color: var(--fg); border: 1px solid transparent;
  }
  .expand:hover { background: var(--hi); color: var(--hi-fg); }

  .stage img, .stage video { display: block; width: 100%; height: auto; }
  .stage.framed iframe { display: block; width: 100%; aspect-ratio: 16 / 9; height: auto; border: 0; background: #fff; }
  .stage .open { padding: 0.75rem; margin: 0; font-size: 0.75rem; color: #000; }

  /* fullscreen: same element, so the interactive keeps its state */
  .window.full { position: fixed; inset: 0; z-index: 3000; border: 0; display: flex; flex-direction: column; }
  .window.full .bar { background: #fff; color: #000; border-bottom: 1px solid #ddd; height: 2.6rem; }
  .window.full .bar-title { color: #555; }
  .window.full .stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .window.full .stage img, .window.full .stage video { width: 100%; height: 100%; object-fit: contain; }
  .window.full .stage.framed iframe { aspect-ratio: auto; width: 100%; height: 100%; }
  .close {
    font: inherit; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.9rem; cursor: pointer;
    background: #2424e0; color: #fff; border: 0;
  }
  .close:hover { background: var(--hi); color: var(--hi-fg); }

  .link { font-size: 0.72rem; margin: 0.4rem 0 0; }

  .writeup { max-width: 68ch; margin: 2.5rem 0 0; font-size: 1rem; line-height: 1.75; }
  .writeup :global(p) { margin: 0 0 1.1rem; }
  /* **Section** on its own line = a section label */
  .writeup :global(p > strong:first-child:has(+ br)) { display: block; margin: 2.2rem 0 0.3rem; }
  .writeup :global(p:first-child > strong:first-child:has(+ br)) { margin-top: 0; }
  .writeup :global(p > strong:first-child + br) { display: none; }
  .writeup :global(img) { display: block; width: 100%; margin: 1.5rem 0; border-radius: 0; }
  .writeup :global(hr) { border: 0; border-top: 1px solid var(--rule); margin: 2.5rem 0; }
  .writeup :global(h4) { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2rem; }
</style>
