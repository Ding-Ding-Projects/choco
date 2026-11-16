// Small DOM toolkit: element builder, icons, overlays, menus, confirmation, sound.
import { ICONS } from '../vendor/icons.js';
import qrcode from '../vendor/qr.js';
import { settings, reducedMotion, eff } from './settings.js';
import { t, tx, emoji, say, unmark, lit } from './i18n.js';
export { lit, say };

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (let [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue; if (typeof v === 'string') v = unmark(v);
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (typeof v === 'boolean' || (k in el && !k.startsWith('aria') && k !== 'role' && k !== 'list' && k !== 'form')) { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  add(el, kids); return el;
}
function add(el, kids) { for (const k of kids.flat(Infinity)) { if (k === null || k === undefined || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(unmark(String(k)))); } }
export const frag = (...kids) => { const f = document.createDocumentFragment(); add(f, kids); return f; };
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 -960 960 960'); s.setAttribute('class', 'ic ' + cls); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICONS[name] || ICONS.help); s.append(p); return s;
}
export const mdIcon = (name) => { const s = icon(name); s.setAttribute('slot', 'icon'); return s; };
export function btn(label, { kind = 'filled', ic, onclick, cls = '', disabled, title } = {}) {
  const tag = { filled: 'md-filled-button', tonal: 'md-filled-tonal-button', outlined: 'md-outlined-button', text: 'md-text-button', danger: 'md-filled-button' }[kind];
  return h(tag, { class: (kind === 'danger' ? 'danger ' : '') + cls, onclick, disabled, title, 'has-icon': !!ic }, ic && mdIcon(ic), label);
}
export function ibtn(ic, label, onclick, cls = '') { return h('md-icon-button', { 'aria-label': label, title: label, onclick, class: cls }, icon(ic)); }
export const badge = (text, kind = '') => h('span', { class: 'badge ' + kind }, text);
export function fmtTime(iso) { if (!iso) return ''; const d = new Date(iso); return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' }); }
export function ago(iso) { if (!iso) return 'never'; const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); if (s < 90) return Math.round(s) + ' s ago'; if (s < 5400) return Math.round(s / 60) + ' min ago'; if (s < 172800) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' days ago'; }
export function download(name, text, mime = 'text/plain') { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
export async function copy(text) { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast(tx('Copy failed. Select the text and copy it by hand.'), { kind: 'err' }); } }

// Plain text by default; regex on request. A bad or slow pattern never throws.
export function matcher(query, regex) {
  if (!query) return { ok: true, test: () => true };
  if (!regex) { const q = query.toLowerCase(); return { ok: true, test: (s) => String(s).toLowerCase().includes(q) }; }
  if (query.length > 200) return { ok: false, error: 'Pattern is longer than 200 characters', test: () => false };
  try { const re = new RegExp(query, 'i'); return { ok: true, test: (s) => re.test(String(s).slice(0, 2000)) }; } catch (e) { return { ok: false, error: e.message, test: () => false }; }
}

// --- sound and narration ---------------------------------------------------------
let ctx;
export function sound(kind) {
  if (!eff('sounds') || settings.lowStim) return;
  try {
    ctx = ctx || new AudioContext(); const now = ctx.currentTime;
    const notes = { ok: [[523, 0], [784, .09]], err: [[220, 0], [165, .12]], tap: [[660, 0]], level: [[523, 0], [659, .1], [784, .2], [1047, .3]], bad: [[196, 0], [196, .15]] }[kind] || [[440, 0]];
    for (const [f, at] of notes) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = kind === 'err' || kind === 'bad' ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, now + at); g.gain.linearRampToValueAtTime(.18 * settings.volume, now + at + .015); g.gain.exponentialRampToValueAtTime(.0001, now + at + .22); o.connect(g).connect(ctx.destination); o.start(now + at); o.stop(now + at + .25); }
  } catch { /* audio is optional feedback */ }
}
let lastSpoken = 0;
export function speak(text, textYue) {
  if (!settings.narration || !('speechSynthesis' in window) || Date.now() - lastSpoken < 1500) return; lastSpoken = Date.now();
  text = say(text); const utter = (txt, lang, voiceName) => { const u = new SpeechSynthesisUtterance(txt); u.lang = lang; u.rate = settings.rate; u.pitch = settings.pitch; const v = speechSynthesis.getVoices().find((x) => (voiceName ? x.name === voiceName : x.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)) && (lang !== 'zh-HK' || /HK|yue|Cantonese/i.test(x.lang + x.name)))); if (v) u.voice = v; else if (lang === 'zh-HK') return; speechSynthesis.speak(u); };
  const m = settings.narrationLang; if (m === 'en' || m === 'both') utter(text, 'en-US', settings.voiceEn); if ((m === 'yue' || m === 'both') && textYue && !settings.school) utter(textYue, 'zh-HK', settings.voiceYue);
}

// --- toasts and notification centre --------------------------------------------------
export const notices = [];
const toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
export function toast(message, { kind = '', action, ms = 5000 } = {}) {
  if (!toastHost.isConnected) document.body.append(toastHost); message = say(String(message)); if (action) action = { ...action, label: say(action.label) };
  notices.unshift({ at: new Date().toISOString(), message, kind }); if (notices.length > 100) notices.pop();
  document.dispatchEvent(new CustomEvent('mc-notice'));
  const el = h('div', { class: 'toast ' + kind }, icon(kind === 'err' ? 'error' : kind === 'ok' ? 'check_circle' : 'info'), h('span', { class: 'grow' }, message), action && h('button', { onclick: () => { action.run(); el.remove(); } }, action.label), h('button', { 'aria-label': t('close'), onclick: () => el.remove() }, icon('close', 'sm')));
  toastHost.append(el); if (kind === 'err') sound('err'); else if (kind === 'ok') sound('ok');
  // ms: 0 keeps the notice until it is closed or its action is used.
  if (kind === 'err') setTimeout(() => el.remove(), 15000); else if (ms > 0) setTimeout(() => el.remove(), ms);
}

// --- sheets (dialogs) -------------------------------------------------------------------
const open = [];
export function sheet(content, { cls = '', onClose, label } = {}) {
  const opener = document.activeElement;
  const box = h('div', { class: 'sheet ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': label || 'Dialog', tabindex: '-1' }, content);
  const scrim = h('div', { class: 'scrim', onmousedown: (e) => { if (e.target === scrim) close(); } }, box);
  function close(result) { if (!scrim.isConnected) return; scrim.remove(); open.splice(open.indexOf(close), 1); onClose && onClose(result); opener && opener.focus && opener.focus(); }
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') { const f = [...box.querySelectorAll('button, input, select, textarea, [tabindex], md-filled-button, md-filled-tonal-button, md-outlined-button, md-text-button, md-icon-button, md-switch, md-checkbox, md-outlined-text-field, md-outlined-select, md-filter-chip, md-slider')].filter((x) => !x.disabled && x.offsetParent); if (!f.length) return; const first = f[0]; const last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  });
  document.body.append(scrim); open.push(close);
  requestAnimationFrame(() => { const f = box.querySelector('[autofocus], input, md-outlined-text-field, md-filled-button'); (f || box).focus(); });
  return close;
}
export const sheetOpen = () => open.length > 0;
export function alertSheet(title, body, emo = '') { title = say(title); if (typeof body === 'string') body = say(body); const close = sheet(frag(h('h2', { class: 'h2' }, emoji(emo), title), typeof body === 'string' ? h('p', { class: 'muted' }, body) : body, h('div', { class: 'row' }, h('span', { class: 'grow' }), btn(t('close'), { kind: 'tonal', onclick: () => close() }))), { label: title }); return close; }

// --- context menus: every menu opens with a filter field --------------------------------
let menuEl = null;
export function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
export function menu(at, items, { label = 'Menu' } = {}) {
  closeMenu(); const opener = document.activeElement;
  const list = h('div', { class: 'col gap0', role: 'menu', 'aria-label': label });
  const count = h('span', { class: 'sr', 'aria-live': 'polite' });
  const input = h('input', { type: 'search', placeholder: t('filter'), 'aria-label': t('filter') });
  const render = () => { const m = matcher(input.value, false); list.replaceChildren(); let n = 0; for (const it of items) { if (!it || !m.test(it.label)) continue; n++; list.append(h('button', { class: 'mi' + (it.danger ? ' danger' : ''), role: 'menuitem', disabled: it.disabled, onclick: () => { closeMenu(); it.run(); } }, it.icon && icon(it.icon, 'sm'), h('span', {}, it.label), it.control, it.shortcut && h('kbd', { 'aria-label': 'Shortcut ' + it.shortcut }, it.shortcut))); } count.textContent = n + ' items'; };
  input.addEventListener('input', render);
  menuEl = h('div', { class: 'menu', onkeydown: (e) => {
    const btns = [...list.querySelectorAll('button:not([disabled])')]; const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || btns[0])?.focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : btns[i - 1]).focus(); }
    else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); btns[0]?.click(); }
    else if (e.key === 'Escape') { e.stopPropagation(); if (input.value) { input.value = ''; render(); input.focus(); } else { closeMenu(); opener?.focus?.(); } }
  } }, h('div', { class: 'filter' }, icon('filter_list', 'sm'), input), list, count);
  render(); document.body.append(menuEl);
  const r = at.getBoundingClientRect ? at.getBoundingClientRect() : { left: at.clientX, bottom: at.clientY, top: at.clientY };
  const mw = menuEl.offsetWidth; const mh = menuEl.offsetHeight;
  menuEl.style.left = Math.max(8, Math.min(r.left, innerWidth - mw - 8)) + 'px';
  menuEl.style.top = Math.max(8, r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
  input.focus();
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); if (!menuEl) document.removeEventListener('pointerdown', off); }), 0);
}

// --- two key super confirmation for destructive actions -----------------------------------
export function superConfirm({ title, detail, action = t('remove') }) {
  title = say(title); detail = say(detail);
  return new Promise((resolve) => {
    let done = false; const keys = [false, false];
    const slider = h('md-slider', { min: 0, max: 100, value: 0, disabled: true, 'aria-label': t('slide_confirm'), style: 'width:100%' });
    const state = h('p', { class: 'small', 'aria-live': 'polite' }, say('Both keys are needed before the slider unlocks.'));
    const mk = (i, key) => { const b = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { keys[i] = !keys[i]; b.setAttribute('aria-pressed', keys[i]); b.textContent = keys[i] ? `${i ? 'B' : 'A'} ${t('held')}` : t(key); sound('tap'); const both = keys[0] && keys[1]; slider.disabled = !both; if (!both) slider.value = 0; state.textContent = say(both ? 'Both keys are held. Slide to the end to confirm.' : 'Both keys are needed before the slider unlocks.'); } }, t(key)); return b; };
    slider.addEventListener('change', () => { if (slider.value >= 100 && keys[0] && keys[1] && !done) { done = true; close(true); } else if (slider.value < 100) { slider.value = 0; } });
    const close = sheet(h('div', { class: 'card ec', style: 'gap:16px' },
      h('div', { class: 'row nowrap' }, icon('delete'), h('h2', { class: 'h2' }, emoji('⚠️'), title)), h('p', {}, detail),
      h('div', { class: 'keys' }, mk(0, 'key_a'), mk(1, 'key_b')), h('div', { class: 'col gap6' }, h('span', { class: 'small', style: 'font-weight:600' }, t('slide_confirm')), slider), state,
      h('div', { class: 'row' }, btn(t('emergency_exit'), { kind: 'outlined', ic: 'close', onclick: () => close(false) }), h('span', { class: 'small grow' }, say(`Escape also cancels. "${lit(action)}" does not run until both keys and the slider are complete.`)))),
    { label: title, onClose: (r) => resolve(r === true) });
  });
}

export function celebrate(host) { if (reducedMotion()) return; const cols = ['var(--pri)', 'var(--ter)', 'var(--sec)', 'var(--ok)']; for (let i = 0; i < 9; i++) host.append(h('span', { class: 'confetti', style: `left:${6 + i * 11}%;background:${cols[i % 4]};animation-delay:${i * 80}ms` })); }
export function levelUp(text) { const el = h('div', { class: 'levelup', role: 'status' }, h('div', {}, text)); document.body.append(el); sound('level'); setTimeout(() => el.remove(), reducedMotion() ? 3000 : 3600); }
export function skeleton(rows = 5) { return h('div', { class: 'card', 'aria-busy': 'true', 'aria-label': 'Loading' }, h('div', { class: 'wave' }), Array.from({ length: rows }, (_x, i) => h('div', { class: 'row nowrap' }, h('span', { class: 'skel', style: 'width:18px;height:18px' }), h('span', { class: 'skel', style: `width:${[34, 26, 40, 22, 30][i % 5]}%` }), h('span', { class: 'grow' }), h('span', { class: 'skel', style: 'width:72px' })))); }
export function errorPanel(title, detail, output, actions = []) { title = say(title); detail = say(detail); sound('err'); return h('section', { class: 'errpanel', role: 'alert' }, h('span', { class: 'mk' }, icon('close', 'xl')), h('div', { class: 'col grow' }, h('h2', { class: 'h2', style: 'font-size:1.75rem' }, title), h('p', {}, detail), output && h('pre', { class: 'log cmd' }, output), h('div', { class: 'row' }, actions))); }
export function emptyState(ic, title, text, action) { title = say(title); text = say(text); return h('div', { class: 'card empty rise' }, h('div', { class: 'float' }, h('span', { class: 'blob pc' }, icon(ic, 'xl'))), h('h2', { class: 'h2' }, title), h('p', { class: 'muted' }, text), action); }

// --- full-screen takeover for install and upgrade results -----------------------------------
// One overlay at a time. More successes that arrive while it is open are counted on it;
// failures queue and are shown one by one, and stay until dismissed.
const dramaQueue = []; let dramaNow = null;
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'; const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export function drama(item) {
  if (dramaNow && dramaNow.kind === 'ok' && item.kind === 'ok') { dramaNow.count += 1; dramaNow.bump(item); return; }
  dramaQueue.push(item); if (!dramaNow) nextDrama();
}
function nextDrama() {
  let item = dramaQueue.shift(); if (!item) { dramaNow = null; return; }
  const ok = item.kind === 'ok'; const calm = reducedMotion(); const opener = document.activeElement; let timer = null;
  item = { ...item, title: say(item.title), detail: say(item.detail) };
  const sub = h('p', { class: 'sub' }, item.detail);
  const el = h('div', { class: 'drama ' + (ok ? 'ok' : 'err'), role: ok ? 'status' : 'alertdialog', 'aria-modal': ok ? null : 'true', 'aria-label': item.title, tabindex: '-1' });
  const close = () => { if (!el.isConnected || el.classList.contains('out')) return; clearTimeout(timer); el.classList.add('out'); setTimeout(() => { el.remove(); opener?.focus?.(); nextDrama(); }, calm ? 0 : 340); };
  const stage = h('div', { class: 'stage' }, h('div', { class: 'medal', html: ok ? TICK : CROSS }), h('div', { class: 'big' }, emoji(ok ? '🎉' : '💥'), item.title), h('div', { class: 'what' }, item.command), sub,
    !ok && item.output ? h('pre', { tabindex: '0', 'aria-label': 'Last lines of output' }, item.output) : null,
    !ok ? h('div', { class: 'acts' }, h('button', { type: 'button', onclick: () => { close(); item.open?.(); } }, say('Open the full log')), h('button', { type: 'button', class: 'ghost', onclick: close }, t('close'))) : null);
  el.append(h('div', { class: 'rays' }), h('div', { class: 'ring' }), h('div', { class: 'ring', style: 'animation-delay:.5s' }), stage, h('div', { class: 'hint' }, say(ok ? 'Click or press Escape to continue' : 'Press Escape to dismiss')));
  if (!calm) {
    if (ok) { const cols = ['#fff', 'var(--pc)', 'var(--sc)', 'var(--tc)', 'var(--okc)', '#ffd54a']; for (let i = 0; i < 70; i++) el.append(h('span', { class: 'bit', style: `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--dx:${(Math.random() - 0.5) * 30}vw;--rot:${(Math.random() - 0.5) * 1400}deg;animation-duration:${1.8 + Math.random() * 2.2}s;animation-delay:${Math.random() * 1.4}s;width:${8 + Math.random() * 10}px` })); }
    else for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; el.append(h('span', { class: 'shard', style: `--sx:${Math.cos(a) * (30 + Math.random() * 30)}vmax;--sy:${Math.sin(a) * (30 + Math.random() * 30)}vmax;--rot:${(Math.random() - 0.5) * 900}deg` })); }
  }
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' || (ok && (e.key === 'Enter' || e.key === ' '))) { e.preventDefault(); e.stopPropagation(); close(); } if (!ok && e.key === 'Tab') { const f = [...el.querySelectorAll('button, pre')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } });
  if (ok) { el.addEventListener('click', close); timer = setTimeout(close, 5200); }
  dramaNow = { kind: item.kind, count: 1, bump: (more) => { clearTimeout(timer); timer = setTimeout(close, 4200); sub.replaceChildren(h('b', {}, say(`${dramaNow.count} installs finished. `)), say('Latest: ') + more.command); sound('ok'); } };
  document.body.append(el); (ok ? el : el.querySelector('.acts button')).focus(); sound(ok ? 'level' : 'bad');
}

// --- polite announcements for changes that have no visible message of their own ----------------
const live = h('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
export function announce(text) { if (!live.isConnected) document.body.append(live); live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); }

// --- QR code drawn in the page as SVG. Nothing is sent anywhere. -------------------------------
// Always dark modules on a white field with a four module quiet zone, in both themes.
export function qrSvg(text, label = '') {
  const box = h('div', { class: 'qr', role: 'img', 'aria-label': 'QR code' + (label ? ': ' + label : '') });
  try {
    const q = qrcode(0, 'M'); q.addData(String(text)); q.make(); const n = q.getModuleCount(); const pad = 4; let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + pad} ${y + pad}h1v1h-1z`;
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); const size = n + pad * 2; svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true');
    const bg = document.createElementNS(ns, 'rect'); bg.setAttribute('width', size); bg.setAttribute('height', size); bg.setAttribute('fill', '#fff');
    const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('fill', '#000'); svg.append(bg, path); box.append(svg);
  } catch (e) { box.removeAttribute('role'); box.removeAttribute('aria-label'); box.append(h('p', { class: 'small', role: 'alert' }, tx('This text is too long for a QR code.'))); }
  return box;
}

// --- info button: explains one control, in place, without running anything ---------------------
export function tip(label, text) {
  const explain = h('div', { class: 'explain tip', role: 'note', hidden: true }, h('b', {}, label), h('p', {}, text));
  const b = h('md-icon-button', { class: 'infob', 'aria-label': `${tx('Explain')}: ${label}`, title: `${tx('Explain')}: ${label}`, 'aria-expanded': 'false', dataset: { tip: '1' }, onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (!explain.isConnected) (b.closest('.row') || b).after(explain); explain.hidden = !explain.hidden; b.setAttribute('aria-expanded', String(!explain.hidden)); } }, icon('info', 'sm'));
  return b;
}

// --- export any list as CSV, JSON or Markdown ---------------------------------------------------
const cell = (x) => (x === null || x === undefined ? '' : String(x));
export const toCsv = (cols, rows) => [cols, ...rows].map((r) => r.map((x) => `"${cell(x).replace(/"/g, '""')}"`).join(',')).join('\r\n') + '\r\n';
export const toJson = (cols, rows) => JSON.stringify(rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? '']))), null, 1) + '\n';
export const toMarkdown = (cols, rows) => { const esc = (x) => cell(x).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); return `| ${cols.map(esc).join(' | ')} |\n| ${cols.map(() => '---').join(' | ')} |\n` + rows.map((r) => `| ${cols.map((_c, i) => esc(r[i])).join(' | ')} |`).join('\n') + '\n'; };
// name: file name without extension. rows: a function returning arrays of plain values (may be async).
export function exportBtn(name, cols, rows, { label = t('export'), kind = 'text' } = {}) {
  const run = async (fmt) => { let data; try { data = await rows(); } catch (e) { return toast(e.message, { kind: 'err' }); } if (!data.length) return toast(tx('There is nothing to export in this list.'));
    if (fmt === 'csv') download(name + '.csv', '﻿' + toCsv(cols, data), 'text/csv'); else if (fmt === 'json') download(name + '.json', toJson(cols, data), 'application/json'); else if (fmt === 'md') download(name + '.md', toMarkdown(cols, data), 'text/markdown'); else return copy(toMarkdown(cols, data));
    toast(tx('Exported {n} rows as {f}', { n: data.length, f: fmt.toUpperCase() }), { kind: 'ok' }); };
  return h(kind === 'tonal' ? 'md-filled-tonal-button' : 'md-text-button', { 'has-icon': true, 'aria-haspopup': 'menu', dataset: { export: name }, onclick: (e) => menu(e.currentTarget, [{ label: tx('CSV, for spreadsheets (UTF-8)'), icon: 'download', run: () => run('csv') }, { label: tx('JSON, one object per row'), icon: 'download', run: () => run('json') }, { label: tx('Markdown table'), icon: 'download', run: () => run('md') }, { label: tx('Copy as a Markdown table'), icon: 'content_copy', run: () => run('copy') }], { label: tx('Export format') }) }, mdIcon('download'), label);
}

// --- pattern builder: composes an anchored regular expression from plain parts -------------------
const rxEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rxList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
export function composePattern({ starts = '', contains = '', ends = '', anyOf = '', not = '' } = {}) {
  let head = ''; const any = rxList(anyOf);
  if (not) head += `(?!.*${rxEsc(not)})`;
  if (any.length) head += `(?=.*(?:${any.map(rxEsc).join('|')}))`;
  if (contains) head += `(?=.*${rxEsc(contains)})`;
  if (!head && !starts && !ends) return '';
  return '^' + head + rxEsc(starts) + (ends ? '.*' + rxEsc(ends) + '$' : '');
}
export function regexBuilder({ sample = [], onApply, where = '' } = {}) {
  const parts = { starts: '', contains: '', ends: '', anyOf: '', not: '' }; let own = '';
  const out = h('pre', { class: 'log cmd', 'aria-label': tx('Pattern'), dataset: { rxPattern: '1' } }); const status = h('p', { class: 'small', 'aria-live': 'polite', dataset: { rxStatus: '1' } }); const list = h('div', { class: 'rxlist' }); const words = h('p', { class: 'muted' });
  const field = (key, label, hint) => h('md-outlined-text-field', { label, 'supporting-text': hint, class: 'grow', style: 'flex:1 1 240px', dataset: { rx: key }, oninput: (e) => { parts[key] = e.target.value; draw(); } });
  const use = btn(tx('Use this pattern'), { ic: 'check', onclick: () => { const pat = composePattern(parts); if (!pat || !matcher(pat, true).ok) return; close(); onApply && onApply(pat); } });
  const draw = () => {
    const pat = composePattern(parts); const m = matcher(pat, true); const lines = [...own.split(/\r?\n/).filter((x) => x.trim()), ...sample].slice(0, 200); out.textContent = pat || tx('(no pattern yet)'); use.disabled = !pat || !m.ok;
    const said = [parts.starts && tx('starts with "{v}"', { v: parts.starts }), parts.contains && tx('contains "{v}"', { v: parts.contains }), rxList(parts.anyOf).length && tx('contains any of: {v}', { v: rxList(parts.anyOf).join(', ') }), parts.not && tx('does not contain "{v}"', { v: parts.not }), parts.ends && tx('ends with "{v}"', { v: parts.ends })].filter(Boolean);
    words.textContent = said.length ? tx('Matches text that') + ' ' + said.join(', ') + '. ' + tx('Upper and lower case are treated the same.') : tx('Fill in one or more parts. Every part you fill in must hold for a row to match.');
    if (!pat) { status.textContent = ''; list.replaceChildren(); return; }
    if (!m.ok) { status.textContent = tx('This pattern cannot be used') + ': ' + m.error; status.style.color = 'var(--err)'; list.replaceChildren(); return; }
    const hits = lines.filter((l) => m.test(l)).length; status.style.color = ''; status.textContent = lines.length ? tx('The pattern compiles. {a} of {b} preview lines match.', { a: hits, b: lines.length }) : tx('The pattern compiles. There are no lines to preview against; type some below.');
    list.replaceChildren(...lines.slice(0, 40).map((l) => { const ok = m.test(l); return h('div', { class: 'rxrow' + (ok ? ' hit' : ''), dataset: { hit: String(ok) } }, icon(ok ? 'check' : 'close', 'sm'), h('span', { class: 'sr' }, ok ? tx('Match') : tx('No match')), h('span', { class: 'mono' }, l.slice(0, 160))); }));
  };
  const close = sheet(frag(h('div', { class: 'row' }, icon('regular_expression'), h('h2', { class: 'h2 grow' }, tx('Pattern builder')), ibtn('close', t('close'), () => close())),
    h('p', { class: 'muted' }, tx('Describe the text you are looking for. The builder writes the regular expression, anchored to the start of each row, and escapes special characters for you.') + (where ? ' ' + where : '')),
    h('div', { class: 'row top' }, field('starts', tx('Starts with'), tx('The row begins with this text')), field('contains', tx('Contains'), tx('This text appears anywhere')), field('ends', tx('Ends with'), tx('The row finishes with this text'))),
    h('div', { class: 'row top' }, field('anyOf', tx('Any of these'), tx('Separate choices with commas')), field('not', tx('Does not contain'), tx('Rows with this text are left out'))),
    words, out, status, h('h3', { class: 'h2', style: 'font-size:1.05rem' }, tx('Live preview')), list,
    h('md-outlined-text-field', { type: 'textarea', rows: 2, label: tx('Your own lines to test, one per line'), style: 'width:100%', dataset: { rx: 'own' }, oninput: (e) => { own = e.target.value; draw(); } }),
    h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), btn(tx('Copy pattern'), { kind: 'text', ic: 'content_copy', onclick: () => { const pat = composePattern(parts); if (pat) copy(pat); } }), h('span', { class: 'grow' }), use)), { label: tx('Pattern builder') }); draw();
  return close;
}
export const builderBtn = (sample, onApply, where) => h('md-icon-button', { 'aria-label': tx('Build a pattern from parts'), title: tx('Build a pattern from parts'), dataset: { rxopen: '1' }, onclick: () => regexBuilder({ sample: sample(), onApply, where }) }, icon('regular_expression'));
// A self-contained filter row for lists that redraw themselves: text, regex switch, builder.
export function miniFilter(onchange, { label = t('filter'), sample = () => [] } = {}) {
  const st = { q: '', regex: false }; const err = h('span', { class: 'small', style: 'color:var(--err)', role: 'alert' });
  const fire = () => { const m = matcher(st.q, st.regex); err.textContent = m.ok ? '' : 'Regex: ' + m.error; onchange(); };
  const input = h('md-outlined-text-field', { label, type: 'search', style: 'flex:1 1 220px', oninput: (e) => { st.q = e.target.value; fire(); } }, h('span', { slot: 'leading-icon' }, icon('filter_list')));
  const chip = h('md-filter-chip', { label: t('regex'), onclick: (e) => setTimeout(() => { st.regex = e.target.selected; fire(); }) });
  return { st, test: (s) => matcher(st.q, st.regex).test(s), el: h('div', { class: 'row minifilter' }, input, chip, builderBtn(sample, (pat) => { st.q = pat; st.regex = true; input.value = pat; chip.selected = true; fire(); }), err) };
}

// --- copy button on every code block ---------------------------------------------------------
// Every <pre> gets one icon-only button as its first child. It holds no text node, so
// pre.textContent is exactly the block's own text. A block that is rewritten (textContent = ...)
// loses the button and gets it back from the observer; appended output leaves it in place.
function armPre(pre) {
  const first = pre.firstChild; if (first && first.nodeType === 1 && first.classList.contains('precopy')) return;
  for (const old of pre.querySelectorAll(':scope > .precopy')) old.remove();
  const b = h('button', { type: 'button', class: 'precopy', 'aria-label': tx('Copy this block'), title: tx('Copy this block'), dataset: { done: t('copied') }, onclick: async (e) => { e.preventDefault(); e.stopPropagation(); const text = pre.textContent;
    if (!text) return announce(tx('This block is empty, so nothing was copied.'));
    try { await navigator.clipboard.writeText(text); } catch { return toast(tx('Copy failed. Select the text and copy it by hand.'), { kind: 'err' }); }
    b.classList.add('done'); b.replaceChildren(icon('check', 'sm')); announce(t('copied')); sound('tap'); setTimeout(() => { b.classList.remove('done'); b.replaceChildren(icon('content_copy', 'sm')); }, 1800); } }, icon('content_copy', 'sm'));
  pre.prepend(b);
}
new MutationObserver((list) => { for (const m of list) { if (m.target.nodeName === 'PRE') armPre(m.target); for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; if (n.nodeName === 'PRE') armPre(n); else if (n.firstElementChild) for (const pre of n.querySelectorAll('pre')) armPre(pre); } } }).observe(document.documentElement, { childList: true, subtree: true });
