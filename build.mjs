import { rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';

rmSync('docs', { recursive: true, force: true });
mkdirSync('docs', { recursive: true });
cpSync('index.html', 'docs/index.html');
cpSync('styles.css', 'docs/styles.css');
cpSync('script.js', 'docs/script.js');
cpSync('public/templates', 'docs/templates', { recursive: true });
cpSync('index.html', 'docs/404.html');
writeFileSync('docs/CNAME', 'gender-reveal.jp\n');
