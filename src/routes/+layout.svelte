<script>
  import '../app.css';
  import { page } from '$app/state';
  import { site, nav } from '$lib/site.js';
  import Assistant from '$lib/components/Assistant.svelte';
  import MouseAgents from '$lib/components/MouseAgents.svelte';
  let { children } = $props();
  const isActive = (href) =>
    href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
  <title>{page.data.title ? page.data.title + ' - ' : ''}{site.title}</title>
  <meta name="description" content={page.data.description ?? site.description} />
</svelte:head>

<header class="site-header">
  <a href="/" class="site-title">{site.title}</a>
</header>

<nav class="main-nav">
  <div class="nav-items">
    {#each nav as item}
      <a
        href={item.href}
        class="nav-item"
        class:active={!item.external && isActive(item.href)}
        class:external={item.external}
        target={item.external ? '_blank' : null}
        rel={item.external ? 'noopener noreferrer' : null}
      >
        <span class="nav-text">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>

<main class="site-main" class:wide={page.data.wide} class:full={page.data.wide === 'full'}>
  {#if page.data.title && page.data.showTitle !== false}
    <h1 class="page-title">
      {page.data.title}{#if page.data.pending}<span class="pending">publishes {page.data.pending}</span>{/if}
    </h1>
  {/if}
  {@render children()}
</main>

<Assistant />
<MouseAgents />

<style>
  /* Shown only under SMT_SHOW_UNPUBLISHED=1: this page is not on the site yet. */
  .pending {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--fg-dim);
    margin-left: 0.75rem;
    white-space: nowrap;
  }
</style>
