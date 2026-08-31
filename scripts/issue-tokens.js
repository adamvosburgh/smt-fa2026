// Issue one submission token per student. Run once at the start of the semester.
//
//   node scripts/issue-tokens.js "Vosburgh, Adam" "Doe, Jane"
//
// Prints the tokens ONCE - they are not recoverable, only the hashes are stored.
// Give each student theirs privately; they paste it into the site once and the
// browser keeps it. Reissue by running again for that student (it revokes the old).
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const names = process.argv.slice(2);
if (!names.length) {
  console.error('usage: node scripts/issue-tokens.js "Lastname, Firstname" ...');
  process.exit(1);
}

const slug = (n) =>
  n.split(',').map((s) => s.trim()).join('-').toLowerCase()
   .normalize('NFD').replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

await mkdir('var', { recursive: true });
let table = { tokens: {} };
try { table = JSON.parse(await readFile('var/tokens.json', 'utf8')); } catch {}

for (const name of names) {
  const student = slug(name);
  for (const [h, rec] of Object.entries(table.tokens)) {
    if (rec.student === student) table.tokens[h].revoked = true;
  }
  const token = randomBytes(24).toString('base64url');
  table.tokens[createHash('sha256').update(token).digest('hex')] = {
    student, name, issued: new Date().toISOString(), revoked: false
  };
  console.log(`${name}\n  slug:  ${student}\n  token: ${token}\n`);
}

await writeFile('var/tokens.json', JSON.stringify(table, null, 2));
console.log('Written to var/tokens.json (hashes only). The tokens above are not recoverable.');
