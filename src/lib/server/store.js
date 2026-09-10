// Tiny JSON-file store. This course has ~16 students; a database would be
// ceremony. Everything lives under var/ and is gitignored.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const locks = new Map();

function file(name) {
  return path.join(config.stateDir, name);
}

export async function read(name, fallback) {
  try {
    return JSON.parse(await readFile(file(name), 'utf8'));
  } catch {
    return fallback;
  }
}

// Serialised read-modify-write, so two concurrent requests cannot clobber a
// counter. Single process only - if this ever runs multi-process, replace it.
export async function update(name, fallback, fn) {
  const prev = locks.get(name) ?? Promise.resolve();
  const next = prev.then(async () => {
    const cur = await read(name, fallback);
    const out = await fn(cur);
    const dest = file(name);
    // `name` may be nested (`sessions/<id>.json`), so create the file's own
    // parent, not just stateDir - otherwise the write fails with ENOENT.
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, JSON.stringify(out.state ?? out, null, 2));
    return out.result ?? out;
  });
  locks.set(name, next.catch(() => {}));
  return next;
}
