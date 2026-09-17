// Once a minute: every assignment that takes uploads and is past its due
// moment, with no board yet, gets one. "Past due and no board" rather than "due
// this minute", so a deploy or a restart after a due date builds whatever is
// missing on start.
import { collection, dueAt } from '$lib/content.js';
import { exists } from './boards.js';
import { buildAssignmentBoard } from './board-generate.js';

export async function tick() {
  const now = Date.now();
  for (const a of collection('assignments', { all: true })) {
    if (a.submit !== true) continue;
    const due = dueAt(a);
    if (due === null || now < due) continue;
    try {
      if (await exists(a.slug)) continue;
      const r = await buildAssignmentBoard(a.slug);
      console.log(`boards: built ${a.slug} (${r.added} tiles)`);
    } catch (err) {
      console.error(`boards: could not build ${a.slug}: ${err?.message ?? err}`);
    }
  }
}
