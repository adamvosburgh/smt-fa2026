<script>
  // The syllabus is the home page. Three navigation aids are added over the
  // rendered markdown after mount rather than in the markdown pipeline, so the
  // content file stays a plain syllabus and the freeze prerenders it unchanged:
  //
  //   1. an arrow in the left margin at the next class,
  //   2. everything after that week at 75% opacity,
  //   3. collapsible week sections, with the overview table's rows as jumps.
  //
  // The `{#week-N}` ids come from markdown-it-attrs and are what everything
  // here keys off. The anchor plugin's permalink lives inside each heading and
  // is left alone; the heading's own click is intercepted so it toggles rather
  // than jumps.
  import Prose from '$lib/components/Prose.svelte';
  import { CLASS_DATES, short, nextClass } from '$lib/schedule.js';

  let { data } = $props();
  let root = $state(null);

  const END_OF_WEEKS = 'class-requirements-and-grading';
  const isWeekHeading = (el) =>
    el.tagName === 'H3' && (el.id.startsWith('week-') || el.id === 'website-due');

  // "9/10" -> 1, for the overview table's first column.
  const weekByDate = new Map(CLASS_DATES.map((iso, i) => [short(iso), i + 1]));

  function wrapWeeks(article) {
    const headings = [...article.querySelectorAll('h3')].filter(isWeekHeading);
    for (const h of headings) {
      // Collect first, wrap after: moving nodes while walking siblings loses
      // the rest of the section.
      const body = [];
      for (let n = h.nextElementSibling; n; n = n.nextElementSibling) {
        if (isWeekHeading(n)) break;
        if (n.tagName === 'H2') break;
        body.push(n);
      }
      const section = document.createElement('section');
      section.className = 'week';
      section.dataset.week = h.id;
      h.replaceWith(section);
      section.append(h, ...body);

      h.setAttribute('role', 'button');
      h.setAttribute('tabindex', '0');
      h.classList.add('week-toggle');
    }
    return [...article.querySelectorAll('section.week')];
  }

  function setOpen(section, open) {
    section.classList.toggle('open', open);
    section.querySelector('.week-toggle')?.setAttribute('aria-expanded', String(open));
  }

  function open(id) {
    const section = root?.querySelector(`section.week[data-week="${CSS.escape(id)}"]`);
    if (section) setOpen(section, true);
    return section;
  }

  function enhance(article) {
    if (!article || article.dataset.enhanced) return;
    article.dataset.enhanced = 'true';

    const { week: arrowWeek } = nextClass();
    const sections = wrapWeeks(article);

    // Week sections: the arrow's week and the one before it start open; the
    // rest start closed. State is never persisted - the rule is the state.
    for (const section of sections) {
      const n = Number(section.dataset.week.replace('week-', ''));
      const isWeek = Number.isFinite(n) && section.dataset.week.startsWith('week-');
      setOpen(section, isWeek && (n === arrowWeek || n === arrowWeek - 1));
      // Weeks after the next class are dimmed, as their table rows are.
      if (!isWeek || n > arrowWeek) section.classList.add('later');
      if (isWeek && n === arrowWeek) section.classList.add('is-next');

      const toggle = section.querySelector('.week-toggle');
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        setOpen(section, !section.classList.contains('open'));
      });
      toggle.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        setOpen(section, !section.classList.contains('open'));
      });
    }

    // The Course Overview table: each dated row jumps to its week, and the
    // rows after the next class are dimmed.
    const table = article.querySelector('h2#course-overview + table, h2#course-overview ~ table');
    for (const row of table ? table.querySelectorAll('tbody tr') : []) {
      const cell = row.cells[0];
      const label = cell?.textContent.trim();
      const n = weekByDate.get(label);
      const target = n ? `week-${n}` : label === 'TBD' ? 'website-due' : null;
      if (!target) continue;

      row.classList.add('jump');
      if (n === arrowWeek) row.classList.add('is-next');
      if (!n || n > arrowWeek) row.classList.add('later');
      row.setAttribute('role', 'link');
      row.setAttribute('tabindex', '0');
      const go = () => {
        const section = open(target);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      row.addEventListener('click', go);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    }

    // The arrow itself: the overview row for the next class, and its heading.
    const arrowAt = [
      table?.querySelector('tbody tr.is-next td'),
      article.querySelector(`section.week.is-next .week-toggle`)
    ];
    for (const el of arrowAt) {
      if (!el) continue;
      const arrow = document.createElement('span');
      arrow.className = 'next-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '▶';
      el.prepend(arrow);
    }

    // A hash in the URL opens that week on load, and on every later change.
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.replace(/^#/, ''));
      if (id) open(id)?.scrollIntoView({ block: 'start' });
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  $effect(() => {
    enhance(root?.querySelector('.content-article'));
  });
</script>

{#if data.doc}
  <div class="syllabus" bind:this={root}>
    <Prose html={data.doc.html} />
  </div>
{:else}
  <article class="content-article">
    <p>The syllabus is not written yet. It goes in <code>content/syllabus/syllabus.md</code>.</p>
  </article>
{/if}

<style>
  /* Everything below styles nodes created by the script above or by the
     markdown pipeline, so it has to be :global. Scoped under .syllabus, which
     only exists on this page. */

  /* The arrow. It sits in the left margin, which is gone under 768px - there a
     left border on the row and the heading says the same thing. */
  .syllabus :global(.next-arrow) {
    position: absolute;
    left: -1.6rem;
    top: 0.15em;
    font-size: 0.8em;
    line-height: inherit;
    color: var(--hi);
  }

  .syllabus :global(section.week) {
    position: relative;
    margin: 1.75rem 0;
    /* Clears the fixed header and nav when a table row jumps here. */
    scroll-margin-top: calc(var(--chrome-top) + 1rem);
  }

  .syllabus :global(.week-toggle) {
    position: relative;
    cursor: pointer;
    padding: 0.5rem 1.5rem 0.5rem 0;
    margin-top: 0;
    border-bottom: 1px solid var(--rule);
  }

  .syllabus :global(section.week.open > .week-toggle) {
    border-bottom-color: transparent;
  }

  .syllabus :global(.week-toggle::after) {
    content: '\25BE';
    position: absolute;
    right: 0.2rem;
    font-size: 0.75em;
    transition: transform 0.15s ease;
  }

  .syllabus :global(section.week.open > .week-toggle::after) {
    transform: rotate(180deg);
  }

  .syllabus :global(.week-toggle:focus-visible) {
    outline: 2px solid var(--hi);
    outline-offset: 2px;
  }

  /* Closed is the default; the script adds .open. */
  .syllabus :global(section.week > *:not(.week-toggle)) {
    display: none;
  }

  .syllabus :global(section.week.open > *) {
    display: revert;
  }

  /* Weeks and rows after the next class. Applied to the wrapper so links and
     images fade with the text. */
  .syllabus :global(section.week.later),
  .syllabus :global(tr.later) {
    opacity: 0.75;
  }

  .syllabus :global(tr.jump) {
    cursor: pointer;
  }

  .syllabus :global(tr.jump td:first-child) {
    position: relative;
  }

  .syllabus :global(tr.jump:hover td),
  .syllabus :global(tr.jump:focus-visible td) {
    background: var(--hi);
    color: var(--hi-fg);
  }

  .syllabus :global(tr.jump:focus-visible) {
    outline: 2px solid var(--hi);
  }

  @media (max-width: 768px) {
    .syllabus :global(.next-arrow) {
      display: none;
    }
    .syllabus :global(section.week.is-next) {
      border-left: 3px solid var(--hi);
      padding-left: 0.75rem;
    }
    .syllabus :global(tr.is-next td:first-child) {
      border-left: 3px solid var(--hi);
    }
  }
</style>
