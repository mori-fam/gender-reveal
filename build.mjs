import { rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';

const siteUrl = 'https://gender-reveal.jp/';

rmSync('docs', { recursive: true, force: true });
mkdirSync('docs', { recursive: true });
cpSync('public', 'docs', { recursive: true });
cpSync('index.html', 'docs/index.html');
cpSync('styles.css', 'docs/styles.css');
cpSync('script.js', 'docs/script.js');
cpSync('index.html', 'docs/404.html');
writeFileSync('docs/CNAME', 'gender-reveal.jp\n');
writeFileSync('docs/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
writeFileSync('docs/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n  </url>\n</urlset>\n`);
