#!/usr/bin/env node
// Checks an assembled copy of the site: the feature index, the guides index and the screens page each
// have a search with a labelled search field, a Regex switch and a pattern builder.
//   node check-searches.mjs <assembled folder> [--prefix /choco/]
// check-links.mjs runs the same check.
//
// site.js adds the Regex switch and the pattern builder to every element marked data-site-search, in
// the row marked "srow", and skips a box without a count line. So a page passes when it has such a
// box with a labelled search field and those parts, loads a script that still adds both controls, and
// has items marked data-search-item to filter. A box that carries both controls in its own markup
// passes without the script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The pages that must have a search, written by hand on purpose: a page that loses its search fails by name.
export const SEARCH_PAGES = [['features/index.html', 'the feature index'], ['articles/index.html', 'the guides index'], ['screens.html', 'the screens page']];
// What a script must contain to add a Regex switch and a pattern builder to a data-site-search box.
const SCRIPT_NEEDS = [
  [/\[data-site-search\]/, 'finds the boxes marked data-site-search'],
  [/\brxswitch\b/, 'adds the Regex switch (class "rxswitch")'],
  [/role['"]?\s*[:=,]\s*['"]switch['"]/, 'gives the Regex switch the switch role'],
  [/\brxbuild\b/, 'adds the pattern builder button (class "rxbuild")'],
  [/Pattern builder/, 'opens the pattern builder dialog'],
];

const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const attrsOf = (tag) => Object.fromEntries([...tag.replace(/^<[\w-]+/, '').matchAll(/([\w:-]+)(?:\s*=\s*"([^"]*)")?/g)].map((m) => [m[1].toLowerCase(), m[2] ?? '']));
const hasClass = (html, name) => new RegExp(`\\sclass="[^"]*\\b${name}\\b[^"]*"`).test(html);
// The markup of the element whose opening tag starts at start, up to its matching end tag.
function block(html, start) {
  const tag = /^<([\w-]+)/.exec(html.slice(start))[1].toLowerCase();
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi'); re.lastIndex = start; let depth = 0; let m;
  while ((m = re.exec(html))) { if (m[1]) { depth--; if (depth === 0) return html.slice(start, m.index + m[0].length); } else if (!m[0].endsWith('/>')) depth++; }
  return html.slice(start);
}
// The local files of the scripts a page loads, resolved like check-links.mjs resolves links.
function scriptsOf(html, page, root, prefix) {
  return [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"[^>]*>/gi)].map((m) => m[1].split(/[?#]/)[0]).filter((src) => !/^(https?:|data:)/.test(src))
    .map((src) => (src.startsWith('/') ? (src.startsWith(prefix) ? path.join(root, src.slice(prefix.length)) : null) : path.resolve(path.dirname(page), src)))
    .filter((f) => f && fs.existsSync(f) && fs.statSync(f).isFile());
}

// Returns { checked, problems }: one problem line per missing part, naming the page.
export function checkSearches(root, { prefix = '/choco/' } = {}) {
  const problems = []; let checked = 0;
  for (const [rel, what] of SEARCH_PAGES) {
    const file = path.join(root, rel); const say = (msg) => problems.push(`${rel} (${what}): ${msg}`);
    if (!fs.existsSync(file)) { say('the page is missing from the site'); continue; }
    checked++;
    const html = fs.readFileSync(file, 'utf8');
    const starts = [...html.matchAll(/<[\w-]+\b[^>]*\sdata-site-search\b[^>]*>/gi)];
    if (!starts.length) { say('no search box (an element marked data-site-search)'); continue; }
    const scripts = scriptsOf(html, file, root, prefix).map((f) => fs.readFileSync(f, 'utf8'));
    const scriptGaps = scripts.length ? SCRIPT_NEEDS.filter(([re]) => !scripts.some((s) => re.test(s))).map(([, why]) => why) : ['loads no local script'];
    for (const s of starts) {
      const box = block(html, s.index); const gaps = [];
      const fields = [...box.matchAll(/<input\b[^>]*>/gi)].map((m) => attrsOf(m[0])).filter((a) => a.type === 'search');
      if (!fields.length) gaps.push('no search field (input type="search")');
      for (const a of fields) {
        const label = a.id ? [...html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)].find((l) => attrsOf('<label' + l[1] + '>').for === a.id) : null;
        const byId = (a['aria-labelledby'] || '').split(/\s+/).filter(Boolean).map((id) => { const at = html.search(new RegExp(`\\sid="${id}"`)); if (at < 0) return ''; const open = html.lastIndexOf('<', at); return text(block(html, open)); }).join(' ');
        if (!((label && text(label[2])) || (a['aria-label'] || '').trim() || byId.trim())) gaps.push(`the search field${a.id ? ' #' + a.id : ''} has no label`);
      }
      const ownSwitch = /role="switch"/.test(box) && /regex/i.test(text(box)); const ownBuilder = /\sdata-rxopen\b/.test(box) || hasClass(box, 'rxbuild');
      if (!(ownSwitch && ownBuilder)) {
        if (!hasClass(box, 'srow')) gaps.push('no row (class "srow") for site.js to put the Regex switch and the pattern builder in');
        if (!hasClass(box, 'count')) gaps.push('no count line (class "count"); site.js skips a box without one');
        if (scriptGaps.length) gaps.push(`no Regex switch or pattern builder in the markup, and no script of the page ${scriptGaps.join(', ')}`);
      }
      if (gaps.length) say(gaps.join('; '));
    }
    if (!/\sdata-search-item\b/.test(html)) say('nothing on the page is marked data-search-item, so the search has nothing to filter');
  }
  return { checked, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || '_site');
  const prefix = process.argv.includes('--prefix') ? process.argv[process.argv.indexOf('--prefix') + 1] : '/choco/';
  const { checked, problems } = checkSearches(root, { prefix });
  for (const p of problems) console.error(p);
  console.log(`${checked} of ${SEARCH_PAGES.length} search pages present, ${problems.length} search problem(s).`);
  process.exit(problems.length ? 1 : 0);
}
