#!/usr/bin/env node
// Clipping check: starts a real hub and one real agent (with the test fixture standing in for
// choco.exe), signs in through the real UI in headless Chrome, then opens every main page at
// many viewport widths, device scale factors and text sizes. It fails when
//   - the document is wider than the viewport (a horizontal scroll bar would appear), or
//   - a visible button or label holds more text than fits (scrollWidth > clientWidth) and its
//     own style does not end the text with an ellipsis.
//     An element whose only overflow is an invisible touch target inside a component is counted
//     and reported as a note, not as a finding.
// It only measures. It changes no file and saves no screenshot.
//
// Usage: node test/e2e/clipping.mjs [--widths 320,390] [--scales 1,2] [--text 100,200]
//                                   [--pages overview,settings] [--json findings.json]
// Chrome is found the same way as in run.mjs: CHROME_BIN, or google-chrome on the PATH.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { installStandIn } from '../fixtures/stand-in.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const numbers = (name, fallback) => (arg(name) ? arg(name).split(',').map(Number).filter((n) => n > 0) : fallback);
const WIDTHS = numbers('--widths', [320, 390, 768, 1024, 1360, 1920]);
const SCALES = numbers('--scales', [1, 1.5, 2]);
const TEXT = numbers('--text', [100, 200]);
const ONLY_PAGES = arg('--pages') ? arg('--pages').split(',') : null;
const heightFor = (width) => (width < 768 ? 800 : width < 1360 ? 768 : 900);

// Buttons and labels of every kind the interface uses: native elements, ARIA roles, the
// Material Web buttons, chips and tabs, and the app's own chip, badge and tab classes.
const TARGETS = ['button', '[role="button"]', '[role="tab"]', 'label', 'legend', 'summary', 'md-filled-button', 'md-filled-tonal-button', 'md-outlined-button', 'md-text-button', 'md-elevated-button', 'md-assist-chip', 'md-filter-chip', 'md-suggestion-chip', 'md-input-chip', 'md-primary-tab', 'md-secondary-tab', '.chip', '.badge', '.tab', '.label'].join(',');

// Runs inside the page. Returns { innerWidth, rootFontPx, document, elements }.
const MEASURE = `
  const limit = ${'__WIDTH__'};
  const short = (el) => {
    const one = (e) => {
      let s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      s += [...e.classList].slice(0, 3).map((c) => '.' + c).join('');
      const data = [...e.attributes].find((a) => a.name.startsWith('data-') && a.value && a.value.length < 40);
      if (data) s += '[' + data.name + '="' + data.value + '"]';
      return s;
    };
    const parts = []; let e = el;
    while (e && e.nodeType === 1 && e !== document.body && parts.length < 5) { parts.unshift(one(e)); if (e.id) break; e = e.parentElement || (e.getRootNode() && e.getRootNode().host); }
    return parts.join(' > ');
  };
  const words = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
  const shown = (el) => { if (!el.getClientRects().length) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const out = { innerWidth: window.innerWidth, rootFontPx: parseFloat(getComputedStyle(document.documentElement).fontSize), document: null, elements: [], touchOnly: 0 };
  const de = document.documentElement; const docWidth = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
  if (docWidth > limit + 1) {
    // Name the innermost elements that reach past the right edge, so the cause can be found.
    // An element inside a scrolling or clipping box that itself fits does not widen the document.
    const up = (a) => a.parentElement || (a.parentNode && a.parentNode.host) || null; // crosses shadow root boundaries
    const contained = (el) => { for (let a = up(el); a && a !== document.body; a = up(a)) { if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= limit + 1) return true; } return false; };
    const past = [...document.body.querySelectorAll('*')].filter((el) => shown(el) && el.getBoundingClientRect().right > limit + 1 && !contained(el));
    // Drawing parts inside an icon say nothing useful; the element that holds the icon does.
    const holder = (el) => { const svg = el.closest('svg'); const h = svg ? svg.parentElement : el; return h && h.tagName === 'I' && h.parentElement ? h.parentElement : h; };
    let inner = [...new Set(past.filter((el) => !past.some((o) => o !== el && el.contains(o))).map(holder))].slice(0, 4); let hiddenCause = false;
    // When nothing visible reaches past the edge, a hidden or invisible element is widening the page: name that instead.
    // Material components keep their parts in shadow roots, which querySelectorAll does not enter.
    const deep = (root, acc = []) => { for (const el of root.querySelectorAll('*')) { acc.push(el); if (el.shadowRoot) deep(el.shadowRoot, acc); } return acc; };
    // Text is not an element: a long unbreakable word reaches past the edge while its box does not, so the reach of the content counts too.
    const reach = (el) => { const r = el.getBoundingClientRect(); return Math.max(r.right, getComputedStyle(el).overflowX === 'visible' ? r.left + el.scrollWidth : 0); };
    if (!inner.length) { const any = deep(document.body).filter((el) => reach(el) > limit + 1 && !contained(el)); inner = [...new Set(any.filter((el) => !any.some((o) => o !== el && el.contains(o))).map(holder))].slice(0, 4); hiddenCause = inner.length > 0; }
    out.document = { scrollWidth: docWidth, widest: inner.map((el) => ({ selector: (hiddenCause ? '(not visible) ' : '') + short(el), text: words(el), right: Math.round(el.getBoundingClientRect().right) })) };
  }
  for (const el of document.querySelectorAll(${JSON.stringify(TARGETS)})) {
    if (!shown(el) || el.clientWidth === 0) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis') continue;
    // scrollWidth also counts parts inside a component's shadow tree, such as the invisible
    // touch target around a Material icon button. Those clip nothing a person can see, so a
    // finding needs the element's own text or child elements to reach past its box.
    const box = el.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(el); const inside = range.getBoundingClientRect();
    const left = box.left + parseFloat(cs.borderLeftWidth || 0); const right = left + el.clientWidth;
    if (inside.width === 0 || (inside.right <= right + 1 && inside.left >= left - 1)) { out.touchOnly++; continue; }
    out.elements.push({ shell: !el.closest('main'), selector: short(el), text: words(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: cs.overflowX });
  }
  return out;
`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-clip-')); const port = 19000 + Math.floor(Math.random() * 1000); const hubUrl = `http://127.0.0.1:${port}`;
const bundle = path.join(tmp, 'bundle'); installStandIn(bundle);
const agentEnv = { ...process.env, MATERIAL_CHOCO_DATA: path.join(tmp, 'agent1'), MATERIAL_CHOCO_BUNDLE: bundle, MATERIAL_CHOCO_HOME: path.join(tmp, 'home1'), FAKE_CHOCO_STATE: path.join(tmp, 'state1.json') };
// Findings that differ only in a data attribute value (one per row of a list) are one pattern.
const patternOf = (selector) => selector.replace(/="[^"]*"/g, '');
function group(findings) {
  const map = new Map();
  for (const f of findings) { const key = [f.page, f.kind, patternOf(f.selector)].join('\u0001'); if (!map.has(key)) map.set(key, { page: f.page, kind: f.kind, pattern: patternOf(f.selector), count: 0, first: f }); map.get(key).count++; }
  return map;
}
const procs = []; const runs = []; let p; let setupError = null; let pages = [];

try {
  procs.push(spawn('node', [path.join(root, 'hub/server.js')], { env: { ...process.env, MATERIAL_CHOCO_DATA: path.join(tmp, 'hub'), MATERIAL_CHOCO_PORT: String(port), MATERIAL_CHOCO_HOST: '127.0.0.1' }, stdio: 'ignore' }));
  await new Promise((r) => setTimeout(r, 900));
  p = await launch({ width: 1360, height: 900 });
  // Animations move elements for a moment; measuring is done on the settled layout.
  await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const clickText = (text) => p.eval(`const e=[...document.querySelectorAll('md-filled-button,md-filled-tonal-button,md-outlined-button,md-text-button,button')].filter(x=>x.offsetParent!==null).find(x=>x.textContent.trim().includes(${JSON.stringify(text)})); if(!e) throw new Error('no button: ${text}'); e.click()`);

  // First run: create the administrator, leave the wizard, pair one machine so the pages hold real rows.
  await p.goto(hubUrl); await p.until(`document.querySelector('form')`);
  await p.eval(`const f=document.querySelectorAll('md-outlined-text-field'); f[0].value='admin'; f[1].value='correct horse battery'; document.querySelector('form').requestSubmit()`);
  await p.until(`document.querySelector('.sheet') || document.querySelector('[data-tab]')`); await p.wait(700);
  if (await p.eval(`return !!document.querySelector('.sheet')`)) { await clickText('Skip for now'); await p.wait(300); }
  await p.until(`document.querySelector('[data-tab="machines"]')`);
  await p.eval(`document.querySelector('[data-tab="machines"]').click()`); await p.wait(500);
  await clickText('New pairing code'); await p.until(`document.querySelector('.code')`);
  const code = await p.eval(`return document.querySelector('.code').textContent`);
  execFileSync('node', [path.join(root, 'core/agent-cli.js'), 'enroll', '--hub', hubUrl, '--code', code, '--name', 'BUILD-01'], { env: agentEnv, encoding: 'utf8' });
  procs.push(spawn('node', [path.join(root, 'core/agent-cli.js'), 'run'], { env: agentEnv, stdio: 'ignore' }));
  await p.until(`[...document.querySelectorAll('td')].some(x=>x.textContent.trim()==='2.5.1')`, 15000);

  pages = await p.eval(`return [...new Set([...document.querySelectorAll('[data-tab]')].map(x=>x.dataset.tab))]`);
  if (ONLY_PAGES) pages = pages.filter((id) => ONLY_PAGES.includes(id));
  if (!pages.length) throw new Error('no pages were found in the tab strip');
  console.log(`Pages (${pages.length}): ${pages.join(', ')}`);
  console.log(`Widths: ${WIDTHS.join(', ')}   device scale factors: ${SCALES.join(', ')}   text sizes: ${TEXT.map((t) => t + '%').join(', ')}\n`);

  // Opens a page: by its tab when the tab is in the document, otherwise by address.
  const open = async (id) => {
    const clicked = await p.eval(`const t=document.querySelector('[data-tab="${id}"]'); if(!t) return false; t.click(); return true`);
    if (!clicked) { await p.eval(`location.hash='#${id}'; location.reload()`); await p.wait(900); await p.until(`document.querySelector('main')`); }
    await p.wait(250);
  };
  const measure = async (width, text) => {
    await p.eval(`document.documentElement.style.setProperty('font-size', '${text}%', 'important'); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    await p.wait(120);
    return p.eval(MEASURE.replace('__WIDTH__', String(width)));
  };

  for (const width of WIDTHS) for (const scale of SCALES) for (const text of TEXT) {
    const height = heightFor(width);
    await p.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    await p.wait(250);
    const run = { width, height, scale, text, findings: [], rootFontPx: null, pages: 0, touchOnly: 0 };
    for (const id of pages) {
      await open(id);
      let m = await measure(width, text);
      // A second look after a pause drops anything that was still settling.
      if (m.document || m.elements.length) { await p.wait(600); m = await measure(width, text); }
      run.rootFontPx = m.rootFontPx; run.pages++; run.touchOnly += m.touchOnly;
      if (m.document) run.findings.push({ page: id, kind: 'document', selector: m.document.widest.map((w) => w.selector).join(' | ') || '(no single element reaches past the edge)', text: m.document.widest.map((w) => w.text).filter(Boolean).join(' | ').slice(0, 80), detail: `document scrollWidth ${m.document.scrollWidth} > viewport ${width}` });
      // Buttons and labels outside <main> (title bar, top bar, tab strip) are the same on every
      // page, so they are reported once per size under the page name "(shell)".
      for (const e of m.elements) {
        const page = e.shell ? '(shell)' : id;
        if (run.findings.some((f) => f.page === page && f.kind === 'element' && f.selector === e.selector && f.text === e.text)) continue;
        run.findings.push({ page, kind: 'element', selector: e.selector, text: e.text, detail: `scrollWidth ${e.scrollWidth} > clientWidth ${e.clientWidth}, overflow-x ${e.overflowX}, no ellipsis` });
      }
    }
    runs.push(run);
    const label = `${String(width).padStart(4)}x${String(height).padEnd(4)} scale ${String(scale).padEnd(3)} text ${String(text).padStart(3)}% (root ${run.rootFontPx}px)`;
    if (!run.findings.length) console.log(`PASS  ${label}  ${run.pages} pages`);
    else {
      console.log(`FAIL  ${label}  ${run.findings.length} findings on ${new Set(run.findings.map((f) => f.page).filter((x) => x !== '(shell)')).size} of ${run.pages} pages${run.findings.some((f) => f.page === '(shell)') ? ' and the shell' : ''}`);
      for (const g of group(run.findings).values()) console.log(`        ${g.page.padEnd(12)} ${g.kind.padEnd(8)} ${g.count > 1 ? g.count + ' x ' + g.pattern : g.first.selector + (g.first.text ? '  "' + g.first.text + '"' : '')}  (${g.count > 1 ? 'for example ' : ''}${g.first.detail})`);
    }
  }
  if (p.errors.length) console.log(`\nBrowser console errors seen during the run (${p.errors.length}): ${p.errors.slice(0, 3).join(' | ')}`);
} catch (e) { setupError = e; }
finally { if (p) await p.close().catch(() => {}); for (const c of procs) c.kill(); await new Promise((r) => setTimeout(r, 300)); fs.rmSync(tmp, { recursive: true, force: true }); }

// One entry per distinct finding pattern, with every size it was seen at.
const distinct = new Map();
for (const r of runs) for (const [key, g] of group(r.findings)) {
  if (!distinct.has(key)) distinct.set(key, { page: g.page, kind: g.kind, pattern: g.pattern, most: 0, example: g.first.selector, text: g.first.text, detail: g.first.detail, sizes: [] });
  const d = distinct.get(key); d.most = Math.max(d.most, g.count); d.sizes.push(`${r.width}@${r.scale}/${r.text}%`);
}
const failedRuns = runs.filter((r) => r.findings.length);
console.log(`\n${runs.length - failedRuns.length} of ${runs.length} sizes passed, ${distinct.size} distinct findings`);
console.log(`Not counted as findings: ${runs.reduce((n, r) => n + r.touchOnly, 0)} measurements where only an invisible touch target reached past its button or label.`);
if (distinct.size) {
  console.log('\nDistinct findings: page, kind, selector (most elements at one size), then sizes as width@scale/text');
  for (const d of distinct.values()) console.log(`  ${d.page}  ${d.kind}  ${d.pattern}  (${d.most})${d.text ? '  for example "' + d.text + '"' : ''}  ${d.detail}\n      ${d.sizes.join(' ')}`);
}
if (arg('--json')) fs.writeFileSync(path.resolve(arg('--json')), JSON.stringify({ pages, widths: WIDTHS, scales: SCALES, text: TEXT, runs, distinct: [...distinct.values()] }, null, 1) + '\n');
if (setupError) { console.error(`\nThe run did not complete: ${setupError.message}`); process.exit(2); }
const expected = WIDTHS.length * SCALES.length * TEXT.length;
if (runs.length !== expected) { console.error(`Only ${runs.length} of ${expected} sizes were measured.`); process.exit(2); }
process.exit(failedRuns.length ? 1 : 0);
