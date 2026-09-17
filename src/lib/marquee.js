// A gallery card title that is too long for one line scrolls sideways instead
// of wrapping. The element holds the title in a single inner <span>; this
// measures the overflow and hands it to the `.marquee` rules in app.css as
// --marquee-shift. Titles that fit are left alone.
//
//   <h3 class="project-card-title marquee" use:marquee={title}><span>{title}</span></h3>
//
// The parameter is only there so a changed title is measured again.
export function marquee(node) {
  const measure = () => {
    const inner = node.firstElementChild;
    if (!inner) return;
    const over = Math.ceil(inner.scrollWidth - node.clientWidth);
    const on = over > 1;
    node.classList.toggle('scrolling', on);
    if (on) {
      node.style.setProperty('--marquee-shift', `-${over}px`);
      // About 40px a second each way, plus the pauses at either end.
      node.style.setProperty('--marquee-time', `${Math.max(6, (over / 40) * 2 + 3)}s`);
    }
  };

  const ro = new ResizeObserver(measure);
  ro.observe(node);
  measure();
  document.fonts?.ready.then(measure);

  return {
    update: () => requestAnimationFrame(measure),
    destroy: () => ro.disconnect()
  };
}
