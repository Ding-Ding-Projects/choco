#!/usr/bin/env node
// Checks an assembled copy of the site: every internal link, image, stylesheet and script
// resolves to a file, and every #fragment resolves to an id on the target page.
//   node check-links.mjs <assembled folder> [--prefix /choco/]
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '_site');
const prefix = process.argv.includes('--prefix') ? process.argv[process.argv.indexOf('--prefix') + 1] : '/choco/';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pages = walk(root).filter((f) => f.endsWith('.html') && !f.startsWith(path.join(root, 'demo') + path.sep));
const ids = new Map(); const idsOf = (f) => { if (!ids.has(f)) ids.set(f, new Set([...fs.readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))); return ids.get(f); };
let bad = 0; let seen = 0; let external = 0; let demoLinks = 0;
const demoDir = path.join(root, 'demo'); const hasDemo = fs.existsSync(path.join(demoDir, 'index.html'));
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const m of html.matchAll(/\s(?:href|src|data-full)="([^"]+)"/g)) {
    const ref = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|data:)/.test(ref)) { external++; continue; }
    seen++;
    const [pq, frag] = ref.split('#'); const p = pq.split('?')[0]; // a version query on an asset link is not part of the file name
    let file = p === '' ? page : p.startsWith('/') ? (p.startsWith(prefix) ? path.join(root, p.slice(prefix.length)) : null) : path.resolve(path.dirname(page), p);
    // The demo is copied in by the deploy workflow. A copy of the site assembled without it keeps its links, and they are counted, not failed.
    if (file !== null && !hasDemo && (file === demoDir || file.startsWith(demoDir + path.sep))) { demoLinks++; continue; }
    if (file === null) { console.error(`${path.relative(root, page)}: ${ref} is outside ${prefix}`); bad++; continue; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { console.error(`${path.relative(root, page)}: ${ref} does not exist`); bad++; continue; }
    if (frag && file.endsWith('.html') && !idsOf(file).has(frag)) { console.error(`${path.relative(root, page)}: ${ref} has no element with id "${frag}"`); bad++; }
  }
  for (const need of ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']) if (!new RegExp(`<meta property="${need}" content="[^"]+">`).test(html)) { console.error(`${path.relative(root, page)}: missing ${need}`); bad++; }
  if (!/<meta name="twitter:card" content="summary_large_image">/.test(html)) { console.error(`${path.relative(root, page)}: missing twitter:card`); bad++; }
  const img = /<meta property="og:image" content="([^"]+)">/.exec(html); if (img && !/^https:\/\//.test(img[1])) { console.error(`${path.relative(root, page)}: og:image is not an absolute https URL`); bad++; }
}
try { for (const e of JSON.parse(fs.readFileSync(path.join(root, 'search.json'), 'utf8'))) { seen++; const [p, frag] = e.url.split('#'); let file = path.join(root, p); if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); if (!fs.existsSync(file) || (frag && !idsOf(file).has(frag))) { console.error(`search.json: ${e.url} does not resolve`); bad++; } } } catch (e) { console.error('search.json: ' + e.message); bad++; }
console.log(`${pages.length} pages, ${seen} internal references checked, ${external} external links not followed, ${bad} problem(s).`);
console.log(hasDemo ? 'The demo is present at demo/ and links to it were checked.' : `The demo is NOT present in this copy: ${demoLinks} link(s) to demo/ could not be checked.`);
process.exit(bad ? 1 : 0);
