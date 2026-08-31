<script>
  import '../app.css';
  import { page } from '$app/state';
  import { site, nav } from '$lib/site.js';
  import Assistant from '$lib/components/Assistant.svelte';
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

<main class="site-main" class:wide={page.data.wide}>
  {#if page.data.title && page.data.showTitle !== false}
    <h1 class="page-title">{page.data.title}</h1>
  {/if}
  {@render children()}
</main>

<Assistant />
