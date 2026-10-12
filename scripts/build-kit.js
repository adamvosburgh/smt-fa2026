// Builds static/kit/ from the kit folders, one zip each, plus browser-readable
// copies of AGENTS.md and CLAUDE.md:
//
//   kit/        -> static/kit/smt-kit.zip (unpacks to smt-kit/), copies in
//                  static/kit/. Tutorial 4 and Assignment 4 link the zip.
//   kit-final/  -> static/kit/smt-final-kit.zip (unpacks to smt-final-kit/),
//                  copies in static/kit/final/. The final project page links it.
//
// static/kit/ is committed, not gitignored like the other mirrored folders, so
// the freeze and a fresh clone have it without a build. That is why the zip is
// written byte-for-byte deterministic (stored entries, a fixed timestamp, a
// fixed file order) and only rewritten when its bytes change: prebuild runs
// this, and a zip that differed on every build would leave deploy.sh's tree
// dirty and fail the next pull.
//
// Runs on prebuild, after sync-assets, and as `npm run kit`.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'static/kit');

const KITS = [
  { src: 'kit', zip: 'smt-kit.zip', folder: 'smt-kit/', copies: '' },
  { src: 'kit-final', zip: 'smt-final-kit.zip', folder: 'smt-final-kit/', copies: 'final/' }
];
const FILES = ['AGENTS.md', 'CLAUDE.md', '.gitignore'];
const COPIES = ['AGENTS.md', 'CLAUDE.md'];

// 2026-09-01 00:00, in MS-DOS date/time form.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 1;

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const isDir = name.endsWith('/');
    const crc = isDir ? 0 : crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);         // version needed
    local.writeUInt16LE(0x0800, 6);     // flags: utf-8 names
    local.writeUInt16LE(0, 8);          // method: stored
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);  // made by: unix
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);             // extra
    central.writeUInt16LE(0, 32);             // comment
    central.writeUInt16LE(0, 34);             // disk
    central.writeUInt16LE(0, 36);             // internal attrs
    // external attrs: unix mode in the high 16 bits, plus the MS-DOS dir bit
    central.writeUInt32LE(((isDir ? 0o40755 : 0o100644) << 16 | (isDir ? 0x10 : 0)) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// Write only when the bytes differ, so an unchanged kit leaves git clean.
async function put(file, data) {
  const target = path.join(dest, file);
  if (existsSync(target) && (await readFile(target)).equals(data)) return false;
  await writeFile(target, data);
  return true;
}

const changed = [];
for (const kit of KITS) {
  const src = path.join(root, kit.src);
  await mkdir(path.join(dest, kit.copies), { recursive: true });
  const entries = [{ name: kit.folder, data: Buffer.alloc(0) }];
  for (const file of FILES) {
    entries.push({ name: kit.folder + file, data: await readFile(path.join(src, file)) });
  }
  if (await put(kit.zip, zip(entries))) changed.push(kit.zip);
  for (const file of COPIES) {
    if (await put(kit.copies + file, await readFile(path.join(src, file)))) changed.push(kit.copies + file);
  }
}
console.log(`build-kit: static/kit/ ${changed.length ? 'updated ' + changed.join(', ') : 'unchanged'}`);
