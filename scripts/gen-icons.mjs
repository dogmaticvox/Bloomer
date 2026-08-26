// Rasterizes icons/bloom.svg (+ maskable variant) to the PNG sizes
// Bloomer's manifest and favicon links need. Run: node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'icons');
mkdirSync(iconsDir, { recursive: true });

const targets = [
  { file: 'bloom.svg', out: 'icon-192.png', size: 192 },
  { file: 'bloom.svg', out: 'icon-512.png', size: 512 },
  { file: 'bloom-maskable.svg', out: 'maskable-512.png', size: 512 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1, height: 1 } });

for (const t of targets) {
  const svg = readFileSync(path.join(iconsDir, t.file), 'utf8');
  await page.setViewportSize({ width: t.size, height: t.size });
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:${t.opaqueBg ? t.opaqueBg : 'transparent'};}
    svg{display:block;width:${t.size}px;height:${t.size}px;}
  </style></head><body>${svg}</body></html>`;
  await page.setContent(html);
  await page.screenshot({
    path: path.join(iconsDir, t.out),
    omitBackground: !t.opaqueBg,
  });
  console.log(`wrote ${t.out} (${t.size}x${t.size})`);
}

await browser.close();
