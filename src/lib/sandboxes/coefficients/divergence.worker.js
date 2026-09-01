// The divergence chart's runs, off the main thread.
//
// Several thousand simulation steps per seed would lock the page for seconds if
// they ran on it. Nothing in engine.js touches the DOM, which is what lets the
// identical code run here.
//
// This worker is OURS and runs no submitted code. It exists to keep the page
// responsive, not to contain anything - see NOTICE.md on why rules.js is
// deliberately unwired.
import { headlessRun } from './engine.js';

self.onmessage = (e) => {
  const { seeds, params, assets, ticks } = e.data;
  const runs = [];
  for (const s of seeds) {
    runs.push(headlessRun({ seed: s, params, assets, ticks }));
    // Report after each run so the chart can fill in rather than appear at the
    // end, and so a long run visibly progresses instead of looking hung.
    self.postMessage({ type: 'progress', done: runs.length, total: seeds.length });
  }
  self.postMessage({ type: 'done', runs });
};
