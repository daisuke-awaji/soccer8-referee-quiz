// 単一HTMLファイルにまとめる: node build.mjs → referee-quiz.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(here, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, p) =>
  '<style>\n' + readFileSync(join(here, p), 'utf8') + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, p) =>
  '<script>\n' + readFileSync(join(here, p), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');

const out = join(here, '..', 'referee-quiz.html');
writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(1) + ' KB');
