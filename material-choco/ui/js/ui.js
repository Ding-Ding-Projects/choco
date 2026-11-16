// Small DOM toolkit: element builder, icons, overlays, menus, confirmation, sound.
import { ICONS } from '../vendor/icons.js';
import { settings, reducedMotion } from './settings.js';
import { t, emoji } from './i18n.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (typeof v === 'boolean' || (k in el && !k.startsWith('aria') && k !== 'role' && k !== 'list' && k !== 'form')) { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  add(el, kids); return el;
}
function add(el, kids) { for (const k of kids.flat(Infinity)) { if (k === null || k === undefined || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); } }
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
export async function copy(text) { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast('Copy failed. Select the text and copy it by hand.', { kind: 'err' }); } }

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
  if (!settings.sounds || settings.lowStim) return;
  try {
    ctx = ctx || new AudioContext(); const now = ctx.currentTime;
    const notes = { ok: [[523, 0], [784, .09]], err: [[220, 0], [165, .12]], tap: [[660, 0]], level: [[523, 0], [659, .1], [784, .2], [1047, .3]], bad: [[196, 0], [196, .15]] }[kind] || [[440, 0]];
    for (const [f, at] of notes) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = kind === 'err' || kind === 'bad' ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, now + at); g.gain.linearRampToValueAtTime(.18 * settings.volume, now + at + .015); g.gain.exponentialRampToValueAtTime(.0001, now + at + .22); o.connect(g).connect(ctx.destination); o.start(now + at); o.stop(now + at + .25); }
  } catch { /* audio is optional feedback */ }
}
let lastSpoken = 0;
export function speak(text, textYue) {
  if (!settings.narration || !('speechSynthesis' in window) || Date.now() - lastSpoken < 1500) return; lastSpoken = Date.now();
  const say = (txt, lang, voiceName) => { const u = new SpeechSynthesisUtterance(txt); u.lang = lang; u.rate = settings.rate; u.pitch = settings.pitch; const v = speechSynthesis.getVoices().find((x) => (voiceName ? x.name === voiceName : x.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)) && (lang !== 'zh-HK' || /HK|yue|Cantonese/i.test(x.lang + x.name)))); if (v) u.voice = v; else if (lang === 'zh-HK') return; speechSynthesis.speak(u); };
  const m = settings.narrationLang; if (m === 'en' || m === 'both') say(text, 'en-US', settings.voiceEn); if ((m === 'yue' || m === 'both') && textYue && !settings.school) say(textYue, 'zh-HK', settings.voiceYue);
}

// --- toasts and notification centre --------------------------------------------------
export const notices = [];
const toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
export function toast(message, { kind = '', action, ms = 5000 } = {}) {
  if (!toastHost.isConnected) document.body.append(toastHost);
  notices.unshift({ at: new Date().toISOString(), message, kind }); if (notices.length > 100) notices.pop();
  document.dispatchEvent(new CustomEvent('mc-notice'));
  const el = h('div', { class: 'toast ' + kind }, icon(kind === 'err' ? 'error' : kind === 'ok' ? 'check_circle' : 'info'), h('span', { class: 'grow' }, message), action && h('button', { onclick: () => { action.run(); el.remove(); } }, action.label), h('button', { 'aria-label': t('close'), onclick: () => el.remove() }, icon('close', 'sm')));
  toastHost.append(el); if (kind === 'err') sound('err'); else if (kind === 'ok') sound('ok');
  if (kind !== 'err') setTimeout(() => el.remove(), ms); else setTimeout(() => el.remove(), 15000);
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
export function alertSheet(title, body, emo = '') { const close = sheet(frag(h('h2', { class: 'h2' }, emoji(emo), title), typeof body === 'string' ? h('p', { class: 'muted' }, body) : body, h('div', { class: 'row' }, h('span', { class: 'grow' }), btn(t('close'), { kind: 'tonal', onclick: () => close() }))), { label: title }); return close; }

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
  return new Promise((resolve) => {
    let done = false; const keys = [false, false];
    const slider = h('md-slider', { min: 0, max: 100, value: 0, disabled: true, 'aria-label': t('slide_confirm'), style: 'width:100%' });
    const state = h('p', { class: 'small', 'aria-live': 'polite' }, 'Both keys are needed before the slider unlocks.');
    const mk = (i, key) => { const b = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { keys[i] = !keys[i]; b.setAttribute('aria-pressed', keys[i]); b.textContent = keys[i] ? `${i ? 'B' : 'A'} ${t('held')}` : t(key); sound('tap'); const both = keys[0] && keys[1]; slider.disabled = !both; if (!both) slider.value = 0; state.textContent = both ? 'Both keys are held. Slide to the end to confirm.' : 'Both keys are needed before the slider unlocks.'; } }, t(key)); return b; };
    slider.addEventListener('change', () => { if (slider.value >= 100 && keys[0] && keys[1] && !done) { done = true; close(true); } else if (slider.value < 100) { slider.value = 0; } });
    const close = sheet(h('div', { class: 'card ec', style: 'gap:16px' },
      h('div', { class: 'row nowrap' }, icon('delete'), h('h2', { class: 'h2' }, emoji('⚠️'), title)), h('p', {}, detail),
      h('div', { class: 'keys' }, mk(0, 'key_a'), mk(1, 'key_b')), h('div', { class: 'col gap6' }, h('span', { class: 'small', style: 'font-weight:600' }, t('slide_confirm')), slider), state,
      h('div', { class: 'row' }, btn(t('emergency_exit'), { kind: 'outlined', ic: 'close', onclick: () => close(false) }), h('span', { class: 'small grow' }, `Escape also cancels. "${action}" does not run until both keys and the slider are complete.`))),
    { label: title, onClose: (r) => resolve(r === true) });
  });
}

export function celebrate(host) { if (reducedMotion()) return; const cols = ['var(--pri)', 'var(--ter)', 'var(--sec)', 'var(--ok)']; for (let i = 0; i < 9; i++) host.append(h('span', { class: 'confetti', style: `left:${6 + i * 11}%;background:${cols[i % 4]};animation-delay:${i * 80}ms` })); }
export function levelUp(text) { const el = h('div', { class: 'levelup', role: 'status' }, h('div', {}, text)); document.body.append(el); sound('level'); setTimeout(() => el.remove(), reducedMotion() ? 3000 : 3600); }
export function skeleton(rows = 5) { return h('div', { class: 'card', 'aria-busy': 'true', 'aria-label': 'Loading' }, h('div', { class: 'wave' }), Array.from({ length: rows }, (_x, i) => h('div', { class: 'row nowrap' }, h('span', { class: 'skel', style: 'width:18px;height:18px' }), h('span', { class: 'skel', style: `width:${[34, 26, 40, 22, 30][i % 5]}%` }), h('span', { class: 'grow' }), h('span', { class: 'skel', style: 'width:72px' })))); }
export function errorPanel(title, detail, output, actions = []) { sound('err'); return h('section', { class: 'errpanel', role: 'alert' }, h('span', { class: 'mk' }, icon('close', 'xl')), h('div', { class: 'col grow' }, h('h2', { class: 'h2', style: 'font-size:1.75rem' }, title), h('p', {}, detail), output && h('pre', { class: 'log cmd' }, output), h('div', { class: 'row' }, actions))); }
export function emptyState(ic, title, text, action) { return h('div', { class: 'card empty rise' }, h('div', { class: 'float' }, h('span', { class: 'blob pc' }, icon(ic, 'xl'))), h('h2', { class: 'h2' }, title), h('p', { class: 'muted' }, text), action); }
