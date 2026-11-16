// Boot, sign in, shell, tabs, command palette and global behaviour.
import { h, frag, icon, btn, ibtn, badge, fmtTime, toast, sheet, sheetOpen, menu, closeMenu, notices, sound, skeleton, matcher, copy, announce, builderBtn, miniFilter, exportBtn } from './ui.js';
import { S, api, loadAll, connectEvents, scoped, runJob, isAdmin, canChange } from './state.js';
import { ADMIN_PAGES, roleBadge, passkeySignIn, webauthnHere } from './admin.js';
import { settings, apply, onSetting, DEFAULTS } from './settings.js';
import { t, t2, tx, setVocabulary } from './i18n.js';
import { PAGES, refreshInv } from './pages.js';
import { PAGES2, applyVocabularyFile, getLogo } from './pages2.js';
import { PAGES3 } from './tools.js';
import { KEYS, keyOf, keyOfPage, matchKey } from './keys.js';

const EVERY = [...PAGES, ...PAGES2.slice(0, 3), ...PAGES3, ...ADMIN_PAGES, ...PAGES2.slice(3)]; let ALL = EVERY; const root = document.getElementById('root');
const R = { page: 'overview', params: null, main: null, pending: false };
apply();
try { const v = JSON.parse(localStorage.getItem('mc.vocab') || 'null'); if (v) setVocabulary(v.entries); } catch { /* no stored wording */ }
const provenance = () => `Version ${S.status.version}, ${S.status.builtAt ? 'built ' + fmtTime(S.status.builtAt) : 'build time unavailable'}`;
const markEl = () => { const logo = getLogo(); return logo ? h('span', { class: 'mark custom' }, h('img', { src: logo, alt: '' })) : h('span', { class: 'mark', html: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 9h14M7 14h14M7 19h14M11.5 9v10M16.5 9v10"/></svg>' }); };

// ---- sign in and first run -------------------------------------------------------------------
function authScreen() {
  const setup = S.status.setupNeeded; const err = h('p', { role: 'alert', style: 'color:var(--err)' }); const usePasskey = !setup && S.status.passkeysAvailable === true && webauthnHere();
  const name = h('md-outlined-text-field', { label: setup ? 'Administrator name' : t('name'), autocomplete: 'username', value: setup ? 'admin' : '' }); const pass = h('md-outlined-text-field', { label: setup ? 'Password, at least 10 characters' : t('password'), type: 'password', autocomplete: setup ? 'new-password' : 'current-password' });
  const card = h('form', { class: 'card flat rise', style: 'width:100%;max-width:460px;padding:32px;gap:18px', onsubmit: async (e) => { e.preventDefault(); err.textContent = ''; try { await api(setup ? '/api/setup' : '/api/login', { method: 'POST', body: { name: name.value, password: pass.value } }); sound('ok'); boot(); } catch (ex) { err.textContent = ex.message; card.style.animation = 'none'; requestAnimationFrame(() => { card.style.animation = 'shake calc(620ms * var(--dur))'; }); sound('err'); } } },
    h('div', { class: 'row nowrap' }, markEl(), h('div', { class: 'col gap0' }, h('b', {}, 'Material Choco hub'), h('span', { class: 'muted small' }, provenance()))), h('h1', { class: 'h1', style: 'font-size:2.2rem' }, setup ? 'Create the administrator' : t('sign_in')),
    setup && h('p', { class: 'muted' }, 'This is the first start of this hub. The password is stored as a salted scrypt hash. There is no default account.'),
    usePasskey && frag(h('md-filled-button', { type: 'button', class: 'passkeybtn', 'has-icon': true, dataset: { passkey: '1' }, onclick: async () => { err.textContent = ''; try { await passkeySignIn(name.value.trim()); sound('ok'); boot(); } catch (ex) { err.textContent = ex.message; sound('err'); } } }, (() => { const i = icon('passkey'); i.setAttribute('slot', 'icon'); return i; })(), tx('Use a passkey')), h('p', { class: 'muted small' }, tx('Your device asks for a fingerprint, face or PIN, or for a security key. Nothing secret leaves it. Type your name first if your security key needs it.')), h('div', { class: 'or' }, h('span', {}, tx('or use your password')))),
    name, pass, err, btn(setup ? 'Create and sign in' : usePasskey ? tx('Sign in with password') : t('sign_in'), { kind: usePasskey ? 'tonal' : 'filled', ic: 'lock_open', onclick: () => card.requestSubmit() }), h('button', { type: 'submit', hidden: true }));
  root.replaceChildren(h('div', { class: 'login' }, card));
}

// ---- shell ---------------------------------------------------------------------------------------
function scopeLabel() { const n = S.scope.size; return n === 0 ? `${t('all_machines')} (${S.machines.length})` : n === 1 ? scopedAll()[0]?.name : `${n} machines`; }
const scopedAll = () => S.machines.filter((m) => S.scope.has(m.id));
function scopeMenu(e) { menu(e.currentTarget, [{ label: `${t('all_machines')} (${S.machines.length})`, icon: S.scope.size ? 'dns' : 'check', run: () => { S.scope.clear(); render(); } }, ...S.machines.map((m) => ({ label: `${m.name}${m.online ? '' : ' (offline)'}`, icon: S.scope.has(m.id) ? 'check' : 'computer', run: () => { S.scope.has(m.id) ? S.scope.delete(m.id) : S.scope.add(m.id); render(); } }))], { label: 'Machines to act on' }); }
function a11yMenu(e) { const cyc = (key, vals, label) => ({ label: `${label}: ${settings[key]}`, icon: 'tune', run: () => { settings[key] = vals[(vals.indexOf(settings[key]) + 1) % vals.length]; } });
  menu(e?.currentTarget || document.querySelector('[data-a11y]') || document.body, [cyc('textScale', [1, 1.15, 1.3, 1.5, 0.9], 'Text size'), cyc('contrast', ['normal', 'high'], 'Contrast'), cyc('motion', ['system', 'reduced', 'full'], 'Motion'), cyc('targets', ['normal', 'large'], 'Touch targets'), cyc('focusRing', ['normal', 'bold'], 'Focus ring'), cyc('theme', ['system', 'light', 'dark'], 'Theme'), { label: tx('Keyboard shortcuts'), icon: 'keyboard', shortcut: keyOf('help'), run: () => go('help', { focus: 'help-Keyboard shortcuts' }) }, { label: 'All accessibility settings', icon: 'settings', run: () => go('settings', { tab: 'accessibility' }) }], { label: t('accessibility') }); }
function noticeSheet() { const list = h('div', { class: 'col' }); const mf = miniFilter(() => draw(), { label: tx('Filter notifications'), sample: () => notices.map((n) => n.message) }); const shown = () => notices.filter((n) => mf.test(n.message));
  const draw = () => list.replaceChildren(...(shown().length ? shown().map((n) => h('div', { class: 'row nowrap', style: 'align-items:flex-start' }, icon(n.kind === 'err' ? 'error' : n.kind === 'ok' ? 'check_circle' : 'info', 'sm'), h('div', { class: 'col gap0 grow' }, h('span', {}, n.message), h('span', { class: 'muted small' }, fmtTime(n.at))))) : [h('p', { class: 'muted' }, notices.length ? t('no_results') : 'No notifications since this page was opened.')]));
  const close = sheet(frag(h('div', { class: 'row' }, h('h2', { class: 'h2 grow' }, t('notifications')), notices.length ? exportBtn('material-choco-notifications', ['When', 'Kind', 'Message'], () => shown().map((n) => [n.at, n.kind || 'info', n.message])) : null, notices.length ? btn(tx('Clear all'), { kind: 'text', onclick: () => { notices.length = 0; draw(); } }) : null, ibtn('close', t('close'), () => close())), notices.length ? mf.el : null, list), { label: t('notifications') }); draw(); }
// Tab order: the saved order first, then any page it does not name, in page order.
const ordered = () => { const saved = (Array.isArray(settings.tabOrder) ? settings.tabOrder : []).map((id) => ALL.find((p) => p.id === id)).filter(Boolean); return [...saved, ...ALL.filter((p) => !saved.includes(p))]; };
const stripTabs = () => ordered().filter((p) => !settings.closedTabs.includes(p.id)).sort((a, b) => settings.pinnedTabs.includes(b.id) - settings.pinnedTabs.includes(a.id));
// Moves a tab to the place of another tab of the same kind (pinned or not) and saves the whole order.
function moveTab(id, toId, after) {
  if (id === toId) return false; const pinned = (x) => settings.pinnedTabs.includes(x); if (pinned(id) !== pinned(toId)) { toast(tx('Pinned tabs stay at the top. A tab can only be moved among tabs of the same kind.')); return false; }
  const ids = ordered().map((p) => p.id).filter((x) => x !== id); ids.splice(ids.indexOf(toId) + (after ? 1 : 0), 0, id); settings.tabOrder = ids;
  const strip = stripTabs().map((p) => p.id); announce(tx('{n} moved to position {a} of {b}.', { n: t(id), a: strip.indexOf(id) + 1, b: strip.length })); document.querySelector(`[data-tab="${id}"]`)?.focus(); return true;
}
function nudgeTab(id, dir) { const strip = stripTabs().map((p) => p.id); const to = strip[strip.indexOf(id) + dir]; if (!to || settings.pinnedTabs.includes(to) !== settings.pinnedTabs.includes(id)) { announce(tx('{n} is already at the edge.', { n: t(id) })); return; } moveTab(id, to, dir > 0); }
const openTabs = () => ALL.filter((p) => !settings.closedTabs.includes(p.id));
function tabMenu(e, p) { e.preventDefault(); const pinned = settings.pinnedTabs.includes(p.id); menu(e, [{ label: tx('Move up'), icon: 'arrow_upward', shortcut: keyOf('tabUp'), run: () => nudgeTab(p.id, -1) }, { label: tx('Move down'), icon: 'arrow_downward', shortcut: keyOf('tabDown'), run: () => nudgeTab(p.id, 1) }, settings.tabOrder.length ? { label: tx('Put every tab back in the built-in order'), icon: 'undo', run: () => { settings.tabOrder = []; } } : null, { label: pinned ? 'Unpin tab' : 'Pin tab to the top', icon: pinned ? 'keep_off' : 'keep', run: () => { settings.pinnedTabs = pinned ? settings.pinnedTabs.filter((x) => x !== p.id) : [...settings.pinnedTabs, p.id]; } }, !pinned && { label: 'Close tab', icon: 'close', run: () => closeTab(p.id) }, { label: 'Close other unpinned tabs', icon: 'tab', run: () => { settings.closedTabs = ALL.map((x) => x.id).filter((id) => id !== p.id && !settings.pinnedTabs.includes(id)); if (R.page !== p.id) go(p.id); } }, { label: 'Open every tab', icon: 'open_in_new', run: () => { settings.closedTabs = []; } }], { label: 'Tab actions' }); }
function closeTab(id) { settings.closedTabs = [...new Set([...settings.closedTabs, id])]; if (R.page === id) go(openTabs()[0]?.id || 'overview'); }
function newTabMenu(e) { const closed = ALL.filter((p) => settings.closedTabs.includes(p.id)); menu(e.currentTarget, closed.length ? [...closed.map((p) => ({ label: t(p.id), icon: p.icon, run: () => go(p.id) })), { label: 'Open every tab', icon: 'open_in_new', run: () => { settings.closedTabs = []; } }] : [{ label: 'Every tab is already open', icon: 'check', disabled: true, run: () => {} }], { label: 'Reopen a tab' }); }

function shell() {
  const d = window.desktop; const tabsSorted = stripTabs();
  const nav = h('nav', { class: 'tabs', role: 'tablist', 'aria-orientation': 'vertical', 'aria-label': 'Pages' }, tabsSorted.map((p) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(p.id === R.page), dataset: { tab: p.id }, title: keyOfPage(p.id) ? `${t(p.id)} (${keyOfPage(p.id)})` : null, draggable: true, onclick: () => go(p.id), oncontextmenu: (e) => tabMenu(e, p),
    ondragstart: (e) => { e.dataTransfer.setData('text/x-mc-tab', p.id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); }, ondragend: (e) => { e.currentTarget.classList.remove('dragging'); nav.querySelectorAll('.dropbefore, .dropafter').forEach((x) => x.classList.remove('dropbefore', 'dropafter')); },
    ondragover: (e) => { if (![...e.dataTransfer.types].includes('text/x-mc-tab')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const r = e.currentTarget.getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2; e.currentTarget.classList.toggle('dropafter', after); e.currentTarget.classList.toggle('dropbefore', !after); }, ondragleave: (e) => e.currentTarget.classList.remove('dropbefore', 'dropafter'),
    ondrop: (e) => { const id = e.dataTransfer.getData('text/x-mc-tab'); if (!id) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); moveTab(id, p.id, e.clientY > r.top + r.height / 2); },
    onkeydown: (e) => { if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); nudgeTab(p.id, e.key === 'ArrowDown' ? 1 : -1); return; } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const b = [...nav.querySelectorAll('.tab')]; b[(b.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length].focus(); } if (e.key === 'F10' && e.shiftKey) tabMenu(e, p); } },
    icon(p.icon), h('span', {}, t(p.id), t2(p.id) && h('small', {}, t2(p.id))), settings.pinnedTabs.includes(p.id) ? icon('keep', 'sm') : h('i', { class: 'x', role: 'button', 'aria-label': `Close tab ${t(p.id)}`, tabindex: '-1', onclick: (e) => { e.stopPropagation(); closeTab(p.id); } }, icon('close', 'sm')))), h('hr'), h('button', { class: 'tab', onclick: newTabMenu }, icon('add'), h('span', {}, 'New tab')));
  R.main = h('main', { id: 'main', tabindex: '-1' });
  const clock = settings.timeAware ? h('span', { class: 'badge', 'aria-label': 'Current time' }, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : null;
  const bottom = h('nav', { class: 'bottomnav', 'aria-label': 'Main' }, [['overview', 'home'], ['installed', 'inventory_2'], ['updates', 'upgrade'], ['jobs', 'list_alt']].map(([id, ic]) => h('button', { 'aria-current': R.page === id ? 'page' : 'false', onclick: () => go(id) }, h('i', {}, icon(ic)), t(id))), h('button', { onclick: () => nav.classList.toggle('open') }, h('i', {}, icon('menu')), 'More'));
  root.replaceChildren(h('div', { class: 'app' },
    d && h('div', { class: 'titlebar' }, h('b', {}, settings.displayName || 'Material Choco'), h('span', {}, S.machines.find((m) => m.local)?.elevated ? 'Running as administrator' : 'Not running as administrator'), h('span', { class: 'grow' }), ibtn('minimize', 'Minimize', () => d.win('minimize')), ibtn('crop_square', 'Maximize or restore', () => d.win('maximize')), ibtn('close', 'Close window', () => d.win('close'))),
    h('header', { class: 'topbar' }, ibtn('menu', 'Open the tab list', () => nav.classList.toggle('open'), 'menubtn'), h('div', { class: 'brand' }, markEl(), h('div', { class: 'col gap0' }, h('span', { class: 'name' }, settings.displayName || (d ? 'Material Choco' : 'Material Choco hub')), h('span', { class: 'prov' }, provenance()))),
      h('button', { class: 'scope press', onclick: scopeMenu, 'aria-haspopup': 'menu', 'aria-label': `Machines to act on: ${scopeLabel()}` }, icon('dns', 'sm'), scopeLabel(), icon('keyboard_arrow_down', 'sm')),
      h('button', { class: 'omni press', onclick: palette, 'aria-label': t('search_all') }, icon('search', 'sm'), h('span', { class: 'grow' }, t('search_all')), h('span', { class: 'hint' }, h('kbd', {}, 'Ctrl+Shift+F'))), clock,
      settings.a11yMenu && h('md-icon-button', { 'aria-label': t('accessibility'), title: t('accessibility'), dataset: { a11y: '1' }, onclick: a11yMenu }, icon('accessibility_new')), ibtn('notifications', t('notifications'), noticeSheet), roleBadge(), !d && ibtn('logout', t('sign_out'), async () => { await api('/api/logout', { method: 'POST' }); location.reload(); })),
    h('div', { class: 'body' }, nav, R.main), bottom));
  nav.addEventListener('click', () => nav.classList.remove('open'));
  renderPage();
}
function renderPage() {
  const p = ALL.find((x) => x.id === R.page) || ALL[0]; const m = R.main; if (!m) return; const y = scrollY; m.replaceChildren();
  const saved = S.scope; if (settings.oneThing && scoped().length > 1) S.scope = new Set([scoped()[0].id]);
  try { p.render(m, R.params); } catch (e) { console.error(e); m.append(h('section', { class: 'errpanel', role: 'alert' }, h('span', { class: 'mk' }, icon('close', 'xl')), h('div', { class: 'col grow' }, h('h2', { class: 'h2' }, 'This page hit an error'), h('p', {}, 'The rest of the app keeps working. The detail below helps when reporting it.'), h('pre', { class: 'log cmd' }, String(e.stack || e).slice(0, 1200))))); }
  S.scope = saved; R.params = null; scrollTo(0, y);
}
function render() { R.pending = false; shell(); }
export function go(page, params) {
  if (settings.closedTabs.includes(page)) settings.closedTabs = settings.closedTabs.filter((x) => x !== page);
  const change = () => { R.page = page; R.params = params || null; closeMenu(); shell(); scrollTo(0, 0); R.main.focus({ preventScroll: true }); if (params?.focus) teleport(params.focus); };
  if (document.startViewTransition && page !== R.page && document.documentElement.dataset.motion !== 'reduced') document.startViewTransition(change); else change();
  history.replaceState(null, '', '#' + page);
}
function teleport(pal) { setTimeout(() => { const el = document.querySelector(`[data-pal="${CSS.escape(pal)}"]`); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.animate([{ outline: '4px solid var(--ter)', outlineOffset: '6px' }, { outline: '4px solid transparent', outlineOffset: '6px' }], { duration: 1600 }); (el.querySelector('md-switch, md-outlined-text-field, md-slider, button, input') || el).focus?.({ preventScroll: true }); }, 350); }
let timer = null;
S.go = go;
S.rerender = (why) => { // live data changed: redraw without stealing typing
  clearTimeout(timer); timer = setTimeout(() => { const a = document.activeElement; const typing = a && R.main?.contains(a) && /TEXT-FIELD|INPUT|TEXTAREA|SELECT/.test(a.tagName) && !['filter', 'sel', 'console', 'job-select', 'settings-tab'].includes(why);
    if (sheetOpen() || typing) { R.pending = true; return; } if (why === 'logo') return render(); if (['filter'].includes(why)) { const id = a?.closest?.('details')?.querySelector('md-outlined-text-field') === a; renderPage(); if (id) { const f = R.main.querySelector('details.fold md-outlined-text-field'); f?.focus(); } return; } if (why === 'machine' || why === 'reconnect' || why === 'vocab') render(); else renderPage(); }, why === 'filter' ? 220 : 120);
};
document.addEventListener('focusout', () => setTimeout(() => { if (R.pending && !sheetOpen()) { R.pending = false; renderPage(); } }, 300));
onSetting((k) => { if (['lang', 'school', 'displayName', 'closedTabs', 'pinnedTabs', 'tabOrder', 'a11yMenu', 'timeAware', 'oneThing', 'focusMode', '*', 'funnyEn', 'funnyYue', 'schoolName'].includes(k) && S.status?.authenticated) render(); else if (S.status?.authenticated && R.page === 'settings') renderPage(); });

// ---- command palette ---------------------------------------------------------------------------------
const SETTING_ROWS = [['lang', 'language', 'Language mode'], ['funnyEn', 'language', 'English funny level'], ['funnyYue', 'language', 'Cantonese funny level'], ['dialogEmoji', 'language', 'Show emojis in dialogs', 1], ['school', 'language', 'School mode', 1], ['vocab', 'language', 'Personal wording file'], ['theme', 'appearance', 'Theme'], ['density', 'appearance', 'Density'], ['motion', 'appearance', 'Motion'], ['hue', 'appearance', 'Seed colour'], ['chroma', 'appearance', 'Vividness'], ['displayName', 'appearance', 'Display name'], ['schedTheme', 'appearance', 'Switch theme by time of day', 1], ['darkFrom', 'appearance', 'Dark theme starts at'], ['darkTo', 'appearance', 'Dark theme ends at'], ['logo', 'appearance', 'Logo'], ['looks', 'appearance', 'Appearance presets'], ['schedRules', 'timed', 'Timed settings'], ['drama', 'appearance', 'Full-screen install results', 1], ['paletteSize', 'appearance', 'Command palette size'], ['textScale', 'accessibility', 'Text size'], ['contrast', 'accessibility', 'Contrast'], ['targets', 'accessibility', 'Larger touch targets'], ['focusRing', 'accessibility', 'Focus ring'], ['a11yMenu', 'accessibility', 'Accessibility button in the top bar', 1], ['sounds', 'sound', 'Action sounds', 1], ['volume', 'sound', 'Volume'], ['narration', 'sound', 'Spoken narrator', 1], ['narrationLang', 'sound', 'Narration language'], ['voiceEn', 'sound', 'English voice'], ['voiceYue', 'sound', 'Cantonese voice'], ['focusMode', 'focus', 'Focus mode', 1], ['lowStim', 'focus', 'Low stimulation', 1], ['timeAware', 'focus', 'Time awareness', 1], ['oneThing', 'focus', 'One thing at a time', 1], ['momentum', 'focus', 'Momentum', 1]];
function paletteItems() {
  const items = ALL.map((p) => ({ icon: p.icon, title: t(p.id), sub: 'Page', shortcut: keyOfPage(p.id), run: () => go(p.id) }));
  if (canChange()) items.push({ icon: 'upgrade', title: t('upgrade_all'), sub: 'Command. Runs choco upgrade all on the selected machines.', run: () => runJob({ kind: 'choco', command: 'upgrade', args: ['all'] }) }, { icon: 'add', title: t('enroll'), sub: 'Command. Opens Machines to create a pairing code.', run: () => go('machines') });
  items.push({ icon: 'refresh', title: 'Refresh inventory', sub: 'Command. Re-reads packages, sources, config and features.', shortcut: keyOf('refresh'), run: () => refreshInv() }, { icon: 'accessibility_new', title: t('accessibility'), sub: 'Command', shortcut: keyOf('a11y'), run: () => a11yMenu() }, { icon: 'notifications', title: t('notifications'), sub: 'Command', shortcut: keyOf('notices'), run: () => noticeSheet() });
  for (const c of S.schema.commands) items.push({ icon: 'terminal', title: `choco ${c.name}`, sub: `Console. ${c.options.length} options. ${c.summary}`, run: () => go('console', { cmd: c.name }) });
  for (const [key, tab, label, bool] of SETTING_ROWS) items.push({ icon: 'settings', title: label, sub: `Setting, ${tab}`, control: bool ? h('md-switch', { selected: !!settings[key], 'aria-label': label, onclick: (e) => e.stopPropagation(), onchange: (e) => { settings[key] = e.target.selected; } }) : null, run: () => go('settings', { tab, focus: 'set-' + key }) });
  for (const k of KEYS) items.push({ icon: 'keyboard', title: tx(k.label), sub: 'Keyboard shortcut', shortcut: k.keys, run: () => go('help', { focus: 'help-Keyboard shortcuts' }) });
  for (const m of S.machines) items.push({ icon: 'computer', title: m.name, sub: `Machine. ${m.online ? 'Online' : 'Offline'}. Selects it and opens its packages.`, run: () => { S.scope = new Set([m.id]); go('installed'); } });
  return items;
}
let paletteOpen = false;
function palette() {
  if (paletteOpen) return; paletteOpen = true; const items = paletteItems(); let regex = false; let idx = 0; let shown = [];
  const list = h('div', { class: 'list', role: 'listbox', 'aria-label': 'Results' }); const count = h('p', { class: 'muted small', 'aria-live': 'polite' }); const input = h('input', { type: 'search', 'aria-label': t('search_all'), placeholder: t('search_all'), autofocus: true });
  const draw = () => { const m = matcher(input.value, regex); shown = items.filter((i) => m.test(i.title + ' ' + i.sub)).slice(0, 60); idx = Math.min(idx, Math.max(0, shown.length - 1)); count.textContent = m.ok ? `${t('results', { n: shown.length })}. Arrow keys move, Enter opens, Escape closes.` : 'Regex: ' + m.error;
    list.replaceChildren(...shown.map((it, i) => h('div', { class: 'prow', role: 'option', 'aria-selected': String(i === idx), onclick: () => { close(); it.run(); } }, icon(it.icon), h('span', { class: 'col gap0 grow' }, h('span', { class: 't1' }, it.title), h('span', { class: 'muted small' }, it.sub)), it.control, it.shortcut && h('kbd', {}, it.shortcut)))); list.children[idx]?.scrollIntoView({ block: 'nearest' }); };
  input.addEventListener('input', () => { idx = 0; draw(); }); const rxChip = h('md-filter-chip', { label: t('regex'), onclick: (e) => setTimeout(() => { regex = e.target.selected; draw(); }) });
  const close = sheet(h('div', { class: 'palette col', onkeydown: (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, shown.length - 1); draw(); } else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); draw(); } else if (e.key === 'Enter' && shown[idx] && e.target === input) { e.preventDefault(); const it = shown[idx]; close(); it.run(); } } },
    h('label', { class: 'q' }, icon('search'), input, rxChip, builderBtn(() => items.map((i) => i.title + ' ' + i.sub), (pat) => { input.value = pat; regex = true; rxChip.selected = true; idx = 0; draw(); input.focus(); }, tx('The preview uses the title and the description line of everything the palette can open.'))), count, list, h('div', { class: 'row small muted' }, h('kbd', {}, keyOf('palette')), 'opens this palette anywhere', h('span', { class: 'grow' }), btn(settings.paletteSize === 'full' ? 'Card size' : 'Full window', { kind: 'text', onclick: () => { settings.paletteSize = settings.paletteSize === 'full' ? 'card' : 'full'; close(); palette(); } }))),
  { cls: settings.paletteSize === 'full' ? 'full' : '', label: 'Command palette', onClose: () => { paletteOpen = false; } }); draw();
}
// ---- keyboard shortcuts: the handlers are looked up by the ids in keys.js -----------------------------------
const typingIn = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT|MD-OUTLINED-TEXT-FIELD|MD-OUTLINED-SELECT)$/.test(el.tagName) || el.isContentEditable);
const stepTab = (dir) => { const ids = stripTabs().map((p) => p.id); if (!ids.length) return; go(ids[(Math.max(0, ids.indexOf(R.page)) + dir + ids.length) % ids.length]); };
const focusFilter = () => { const d = R.main?.querySelector('details.fold'); const f = R.main?.querySelector('details.fold > div md-outlined-text-field[type=search], .minifilter md-outlined-text-field, md-outlined-text-field[type=search]'); if (!f) return announce(tx('This page has no filter.')); const fold = f.closest('details'); if (fold && !fold.open) fold.open = true; if (d && !d.open && d.contains(f)) d.open = true; f.focus(); };
const HANDLERS = { palette, a11y: () => a11yMenu(), refresh: () => { refreshInv(); toast(tx('Asked the selected machines to read their inventory again.')); }, notices: () => noticeSheet(), nextTab: () => stepTab(1), prevTab: () => stepTab(-1), filter: focusFilter };
for (const k of KEYS) if (k.page) HANDLERS[k.id] = () => go(k.page);
addEventListener('keydown', (e) => { if (!S.status?.authenticated || e.defaultPrevented) return; const id = matchKey(e); if (!id || !HANDLERS[id]) return; if (id === 'filter' && (typingIn(document.activeElement) || sheetOpen() || document.querySelector('.menu, .drama'))) return; if (document.querySelector('.drama')) return; e.preventDefault(); HANDLERS[id](); });

// ---- a context menu for everything that has none of its own ---------------------------------------------------
// Rows, tabs and machines handle the event first and stop it. Text fields, code and logs keep the
// browser menu, so copy, paste and spelling tools stay available there.
document.addEventListener('contextmenu', (e) => {
  if (e.defaultPrevented || !S.status?.authenticated) return; const el = e.target instanceof Element ? e.target : null; if (!el) return;
  if (el.closest('input, textarea, select, [contenteditable], md-outlined-text-field, md-outlined-select, pre, .menu, .drama')) return;
  e.preventDefault(); const holder = el.closest('td, th, li, p, h1, h2, h3, button, summary, label, .badge, .card, .toast') || el; const text = (holder.innerText || holder.getAttribute?.('aria-label') || '').replace(/\s+\n/g, '\n').trim().slice(0, 4000);
  const control = el.closest('button, md-filled-button, md-filled-tonal-button, md-outlined-button, md-text-button, md-icon-button, md-switch, md-checkbox, md-filter-chip, a'); const name = control ? (control.getAttribute('aria-label') || control.label || control.innerText || '').trim().slice(0, 60) : '';
  const at = e.clientX || e.clientY ? e : el;
  menu(at, [{ label: tx('Copy this text'), icon: 'content_copy', disabled: !text, run: () => copy(text) }, control && name && { label: tx('Activate: {n}', { n: name }), icon: 'play_arrow', disabled: !!control.disabled, run: () => control.click() },
    { label: tx('Search everything'), icon: 'search', shortcut: keyOf('palette'), run: palette }, R.main?.querySelector('md-outlined-text-field[type=search]') && { label: tx('Filter this page'), icon: 'filter_list', shortcut: keyOf('filter'), run: focusFilter },
    { label: tx('Refresh inventory'), icon: 'refresh', shortcut: keyOf('refresh'), run: HANDLERS.refresh }, { label: t('accessibility'), icon: 'accessibility_new', shortcut: keyOf('a11y'), run: () => a11yMenu() }, { label: t('notifications'), icon: 'notifications', shortcut: keyOf('notices'), run: () => noticeSheet() },
    { label: t('help'), icon: 'menu_book', shortcut: keyOf('help'), run: () => go('help') }, { label: t('settings'), icon: 'settings', shortcut: keyOf('settings'), run: () => go('settings') }], { label: tx('Actions for this element') });
});

// ---- desktop app: say when an update has been downloaded ---------------------------------------------------------
if (window.desktop?.onUpdate) window.desktop.onUpdate((u) => {
  if (u?.state === 'ready') toast(tx('Update {v} has been downloaded and installs when the app restarts. This build is not code signed, so its publisher cannot be verified by Windows.', { v: u.version || '' }).replace('  ', ' '), { ms: 60000, action: { label: tx('Restart'), run: () => window.desktop.restartToUpdate() } });
  else if (u?.state === 'error') toast(tx('The update check failed: {m}. The app keeps running on this version.', { m: u.message || 'unknown error' }), { kind: 'err' });
});

// ---- personal wording: drop a JSON file anywhere on the window -------------------------------------------
addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
addEventListener('drop', async (e) => { document.body.classList.remove('dropping'); const f = e.dataTransfer?.files?.[0]; if (!f) return; e.preventDefault(); if (settings.school) return toast('Personal wording is not available in this mode.'); if (!/\.json$/i.test(f.name)) return toast('Only a personal wording JSON file can be dropped here.', { kind: 'err' }); if (f.size > 256 * 1024) { sound('bad'); return toast('Personal wording file refused. It is larger than 256 KiB. Nothing was changed.', { kind: 'err' }); } applyVocabularyFile(await f.text()); });

// ---- first run wizard: each step performs a real action ------------------------------------------------------
function onboarding() {
  let step = 0; const local = S.machines.find((m) => m.local); const names = ['Chocolatey CLI', S.status.desktop ? 'Hub link (optional)' : 'First machine', 'Language and look', 'Finish']; const host = h('div', { class: 'col gap18', style: 'flex:2 1 420px' }); const side = h('div', { class: 'steps' });
  const drawSide = () => side.replaceChildren(...names.map((n, i) => h('div', { class: 'step ' + (i < step ? 'done' : i === step ? 'now' : '') }, h('span', { class: 'dot' }, i < step ? icon('check', 'sm') : i + 1), h('span', { class: 'col gap0' }, h('b', {}, n)))));
  const steps = [
    () => { const out = h('div', {}, skeleton(2)); if (local) { runJob({ kind: 'inventory' }, { machineIds: [local.id], quiet: true }); const poll = setInterval(() => { const m = S.machines.find((x) => x.local); if (!out.isConnected) return clearInterval(poll); if (m?.inventory) { clearInterval(poll); out.replaceChildren(m.inventory.available ? h('div', { class: 'card okc' }, h('div', { class: 'row nowrap' }, icon('check_circle'), h('div', { class: 'col gap0' }, h('b', {}, `Bundled Chocolatey CLI ${m.inventory.chocoVersion} is ready`), h('span', { class: 'mono small' }, m.inventory.cliPath), h('span', { class: 'small' }, `${m.inventory.packages.length} packages found. ${m.elevated ? 'Running as administrator.' : 'Not running as administrator: installs will likely fail until you restart as administrator.'}`)))) : h('div', { class: 'card ec' }, h('b', {}, 'The bundled CLI could not be started'), h('p', {}, m.inventory.reason))); } }, 500); }
      else out.replaceChildren(h('p', { class: 'muted' }, 'The hub itself does not run choco. Each Windows machine runs Material Choco, which carries its own Chocolatey CLI built from this repository, and connects to this hub as an agent.'));
      return [h('h2', { class: 'h2', style: 'font-size:1.6rem' }, 'Nothing to install'), h('p', { class: 'muted' }, 'Chocolatey ships inside Material Choco. This step checks that it starts.'), out]; },
    () => { if (S.status.desktop) return [h('h2', { class: 'h2', style: 'font-size:1.6rem' }, 'Manage this PC from elsewhere?'), h('p', { class: 'muted' }, 'Optional. A hub is a small web app you run in a container. Once this PC is paired, you can manage it from a browser on any device. You can do this later on the Machines page.'), btn('Open Machines to connect', { kind: 'tonal', ic: 'link', onclick: () => { finish(); go('machines'); } })];
      const out = h('div', { class: 'col' }); return [h('h2', { class: 'h2', style: 'font-size:1.6rem' }, 'Pair the first machine'), h('p', { class: 'muted' }, 'Create a one time code, then enter it in Material Choco on a Windows machine.'), btn('Create a pairing code', { ic: 'add', onclick: async () => { try { const r = await api('/api/pairing', { method: 'POST', body: {} }); out.replaceChildren(h('div', { class: 'code' }, r.code), h('p', { class: 'muted small' }, `Works once. Expires ${fmtTime(r.expires)}. Hub address: ${location.origin}`)); } catch (e) { toast(e.message, { kind: 'err' }); } } }), out]; },
    () => [h('h2', { class: 'h2', style: 'font-size:1.6rem' }, 'Language and look'), h('p', { class: 'muted' }, 'Messages ship at the most playful level, 5 of 5, in both languages. You can lower it in Settings. Playful wording never changes facts.'), h('div', { class: 'seg' }, [['en', 'English'], ['yue', '廣東話'], ['bi', 'Bilingual']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(settings.lang === v), onclick: (e) => { settings.lang = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } }, l))), h('div', { class: 'seg' }, [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(settings.theme === v), onclick: (e) => { settings.theme = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } }, l)))],
    () => [h('h2', { class: 'h2', style: 'font-size:1.6rem' }, 'Ready'), h('p', { class: 'muted' }, 'Press Ctrl+Shift+F anywhere to search every page, command and setting. Right click a row, or press Shift+F10, for its actions.')],
  ];
  const nav = h('div', { class: 'row' }); const finish = () => { settings.onboarded = true; close(); };
  const draw = () => { drawSide(); host.replaceChildren(h('p', { class: 'muted small' }, `Step ${step + 1} of ${names.length}`), ...steps[step]()); nav.replaceChildren(frag(step > 0 ? btn(t('back'), { kind: 'text', onclick: () => { step--; draw(); } }) : null, h('span', { class: 'grow' }), btn(t('skip'), { kind: 'outlined', onclick: finish }), step < names.length - 1 ? btn(t('next'), { ic: 'chevron_right', onclick: () => { step++; draw(); } }) : btn(t('done'), { ic: 'check', onclick: finish }))); };
  const close = sheet(h('div', { class: 'row top gap18' }, h('div', { class: 'col', style: 'flex:1 1 220px' }, h('div', { class: 'row nowrap' }, markEl(), h('b', {}, 'Material Choco')), h('span', { class: 'muted small' }, provenance()), side), h('div', { class: 'col grow', style: 'flex:2 1 420px' }, host, nav)), { cls: 'wide', label: 'First run setup', onClose: () => { settings.onboarded = true; } }); draw();
}

// ---- boot ----------------------------------------------------------------------------------------------------
async function boot() {
  root.replaceChildren(h('div', { class: 'login' }, h('div', { style: 'width:min(480px,90vw)' }, skeleton(3))));
  try { S.status = await api('/api/status'); } catch (e) { root.replaceChildren(h('div', { class: 'login' }, h('section', { class: 'errpanel' }, h('span', { class: 'mk' }, icon('cloud_off', 'xl')), h('div', { class: 'col' }, h('h2', { class: 'h2' }, 'The hub is not answering'), h('p', {}, e.message), btn('Try again', { kind: 'danger', onclick: boot }))))); return; }
  if (S.status.desktop && !S.status.authenticated) { const launch = new URLSearchParams(location.search).get('launch'); try { await api('/api/login', { method: 'POST', body: { launch } }); history.replaceState(null, '', location.pathname); S.status = await api('/api/status'); } catch { /* falls through to the message below */ } }
  if (!S.status.authenticated) { if (S.status.desktop) { root.replaceChildren(h('div', { class: 'login' }, h('p', {}, 'Open this page from the Material Choco window.'))); return; } return authScreen(); }
  ALL = EVERY.filter((p) => (!p.admin || isAdmin()) && !(p.hubOnly && S.status.desktop));
  await loadAll(); connectEvents();
  const hash = location.hash.slice(1); if (ALL.some((p) => p.id === hash)) R.page = hash;
  render(); if (!settings.onboarded) onboarding();
}
boot();
