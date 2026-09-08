import { collection } from '$lib/content.js';
export function load() {
  const all = collection('tutorials');
  // The weekly tutorials. The five sandbox dev notes (`devnotes: true`) keep
  // their URLs - the build doctor's FAILURE_MAP points into them - but are
  // reached from each sandbox's page rather than listed here.
  return {
    items: all.filter((d) => d.devnotes !== true),
    devnotes: all.filter((d) => d.devnotes === true),
    title: 'Tutorials'
  };
}
