<script>
  let { data } = $props();
</script>

<div class="project-grid">
  {#each data.submissions as s (s.url)}
    <a href={s.url} class="project-card">
      <div class="project-card-image">
        <img src="{s.assetBase}cover.png" alt="Cover image for {s.title}" loading="lazy" />
      </div>
      <div class="project-card-info">
        <h2 class="project-card-title">{s.title}</h2>
        <p class="project-card-author">{s.student} · {s.sandbox}</p>
      </div>
    </a>
  {:else}
    <p class="content-article">No submissions yet.</p>
  {/each}
</div>
