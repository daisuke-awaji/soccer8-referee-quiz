/**
 * OGP 画像（LINE・SNS で共有したときのプレビュー）を作る。
 *   npm run og:image   → public/og-image.png（1200×630）
 * scripts/og-image.html を Chromium で開いて撮影する。フォント（Noto Sans JP）をネットから読み込むので、オンラインで実行する。
 * 画像を変えたら index.html の og:image の ?v= を上げる（LINE などのキャッシュ対策）。
 */
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const src = new URL('./og-image.html', import.meta.url);
const out = fileURLToPath(new URL('../public/og-image.png', import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(src.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() => document.fonts.check('900 80px "Noto Sans JP"', '審判'));
  if (!ok) throw new Error('Noto Sans JP を読み込めませんでした（ネットにつながっているか確かめてください）');
  await page.screenshot({ path: out, type: 'png' });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
