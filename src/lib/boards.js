// Whiteboards, from wherever they are in this mode. The shape of submissions.js:
//
//   live    - /api/boards, behind the student token. The pages call these from
//             the browser, where the token is.
//   archive - import.meta.glob reads src/boards/<slug>/board.json at build
//             time, written there by scripts/export-boards.js at the freeze,
//             and the files are mirrored into static/boards/ by
//             scripts/sync-assets.js.
import { MODE } from './data.js';
import { summarize } from './board/model.js';

// The mode is a build-time constant, so in the live build this folds away and
// no board is baked into the bundle.
const archived =
  MODE === 'archive' ? import.meta.glob('/src/boards/*/board.json', { eager: true, import: 'default' }) : {};

const slugOf = (p) => p.split('/')[3];

export function archivedSlugs() {
  return Object.keys(archived).map(slugOf);
}

const auth = (token) => (token ? { authorization: `Bearer ${token}` } : {});

// Every board, newest first, as index rows.
export async function boards(fetch, token) {
  if (MODE === 'archive') {
    return Object.values(archived)
      .map(summarize)
      .sort((a, b) => String(b.created).localeCompare(String(a.created)));
  }
  const res = await fetch('/api/boards', { headers: auth(token) });
  if (!res.ok) throw Object.assign(new Error('boards'), { status: res.status });
  return res.json();
}

export async function board(fetch, slug, token) {
  if (MODE === 'archive') {
    const hit = Object.entries(archived).find(([p]) => slugOf(p) === slug);
    return hit ? hit[1] : null;
  }
  const res = await fetch(`/api/boards/${slug}`, { headers: auth(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw Object.assign(new Error('board'), { status: res.status });
  return res.json();
}

// Whether a board is there, without a token. The assignment page shows its
// board link on this, never on the due time.
export async function boardExists(fetch, slug) {
  if (MODE === 'archive') return archivedSlugs().includes(slug);
  try {
    return (await fetch(`/api/boards/${slug}/exists`)).status === 204;
  } catch {
    return false;
  }
}
