// Screenshots of the Example Project interactive:
//   cover.jpg   - the thumbnail (what the form would draw from an uploaded thumbnail)
//   image-1.png - the image in the write-up, also in the template zip
//   node scripts/example-final/shoot.js   (after build.js)
import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sub = path.join(root, 'src/submissions/example/final-project');
const page_ = pathToFileURL(path.join(sub, 'assets/index.html')).href;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function shot(query, wait, opts, hideUi) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  await page.goto(`${page_}${query}`);
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(wait);
  if (hideUi) await page.addStyleTag({ content: '#ui { display: none !important; }' });
  await page.screenshot(opts);
  await page.close();
}
await shot('?seed=7', 4000, { path: path.join(sub, 'cover.jpg'), type: 'jpeg', quality: 85 }, true);
await shot('?seed=21', 6500, { path: path.join(sub, 'assets/image-1.png') }, false);
await browser.close();

await mkdir(path.join(root, 'kit-final-template'), { recursive: true });
await copyFile(path.join(sub, 'assets/image-1.png'), path.join(root, 'kit-final-template/image-1.png'));
console.log('example-final: cover.jpg, assets/image-1.png, kit-final-template/image-1.png');
