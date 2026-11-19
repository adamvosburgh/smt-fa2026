// Builds the Example Project interactive as one self-contained index.html
// (three.js + font inlined; the gallery frame allows no network requests).
//   node scripts/example-final/build.js
import { build } from 'esbuild';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../src/submissions/example/final-project/assets/index.html');

const { outputFiles } = await build({
  entryPoints: [path.join(here, 'scene.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none'
});
const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Example Project</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #fff; }
  canvas { display: block; cursor: grab; }
  canvas:active { cursor: grabbing; }
  #ui { position: fixed; right: 14px; bottom: 14px; display: flex; flex-direction: column; gap: 8px;
    padding: 12px; background: rgba(255,255,255,0.82); border: 1px solid #2424e0; backdrop-filter: blur(4px); }
  #ui label { display: flex; flex-direction: column; gap: 3px; font: 600 10px/1 system-ui, sans-serif;
    letter-spacing: 0.06em; text-transform: uppercase; color: #2424e0; }
  #ui input[type=range] { width: 150px; accent-color: #2424e0; margin: 0; }
  #ui .row { display: flex; gap: 6px; }
  #ui button { flex: 1; height: 26px; border: 1px solid #2424e0; background: #fff; color: #2424e0;
    font: 12px/1 system-ui, sans-serif; cursor: pointer; }
  #ui button:hover, #ui button.on { background: #2424e0; color: #fff; }
</style>
</head>
<body>
<script>${js}</script>
</body>
</html>
`;
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, html);
console.log(`example-final: ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)}KB)`);
