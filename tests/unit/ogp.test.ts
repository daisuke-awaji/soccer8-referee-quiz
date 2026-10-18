import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const SITE = 'https://daisuke-awaji.github.io/soccer8-referee-quiz/';
const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

function meta(key: string): string | undefined {
  const re = new RegExp(`<meta\\s+(?:property|name)="${key.replace(/[:.]/g, '\\$&')}"\\s+content="([^"]*)"`);
  return re.exec(html)?.[1];
}

/** PNG の IHDR から幅と高さを読む */
function pngSize(file: URL): { width: number; height: number } {
  const buf = fs.readFileSync(file);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('OGP（LINE・SNS で共有したときのプレビュー）', () => {
  it('タイトル・説明・URL がある', () => {
    expect(meta('og:title')).toBeTruthy();
    expect(meta('og:description')).toBeTruthy();
    expect(meta('og:type')).toBe('website');
    expect(meta('og:url')).toBe(SITE);
    expect(meta('twitter:card')).toBe('summary_large_image');
  });

  it('og:image は公開サイトの絶対 URL で、public/ に画像がある', () => {
    const image = meta('og:image');
    expect(image).toBeDefined();
    const url = new URL(image!);
    expect(`${url.origin}${url.pathname}`.startsWith(SITE)).toBe(true);
    const file = url.pathname.slice(new URL(SITE).pathname.length);
    expect(fs.existsSync(new URL(`../../public/${file}`, import.meta.url))).toBe(true);
  });

  it('画像は 1200×630 で、og:image:width / height と一致する', () => {
    const file = new URL(meta('og:image')!).pathname.split('/').pop()!;
    const size = pngSize(new URL(`../../public/${file}`, import.meta.url));
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(meta('og:image:width')).toBe(String(size.width));
    expect(meta('og:image:height')).toBe(String(size.height));
  });

  it('共有時にすぐ表示されるよう、画像は 1MB 未満に保つ', () => {
    const file = new URL(meta('og:image')!).pathname.split('/').pop()!;
    expect(fs.statSync(new URL(`../../public/${file}`, import.meta.url)).size).toBeLessThan(1024 * 1024);
  });
});
