// Build doctor, stages 2 and 3.
//
// Stage 2 - RUN. Headlessly load the submission in its sandbox and capture
// uncaught exceptions, console errors, failed fetches, and whether the render
// produced anything (window.__metrics populated, canvas non-blank). Nearly free:
// Playwright is already in the pipeline for cover images, so this is the same
// page load reading two more things. No model.
//
// Stage 3 - DIAGNOSE. Fires ONLY when stage 2 fails in a way stage 1 did not
// predict. Input: the error and stack, the student's changed files, and a table
// of contents of the tutorials with their anchors. Output: one plain sentence
// and one anchor link. Cost is near zero because it only runs on failure.
//
// It is not a reviewer. It makes no judgement about the work and touches nothing
// about quality. Its only job is to catch a submission that will not run and
// point at the part of the tutorial that fixes it.
import { json } from '@sveltejs/kit';

export async function POST() {
  return json(
    { ok: false, error: 'not implemented - see scripts/cover.js for the stage-2 harness' },
    { status: 501 }
  );
}
