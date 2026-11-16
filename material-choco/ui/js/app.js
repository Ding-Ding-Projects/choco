// Boot, sign in, shell, tabs, command palette and global behaviour.
import { h, frag, icon, btn, ibtn, badge, fmtTime, toast, sheet, sheetOpen, menu, closeMenu, notices, sound, skeleton, matcher } from './ui.js';
import { S, api, loadAll, connectEvents, scoped, runJob } from './state.js';
import { settings, apply, onSetting, DEFAULTS } from './settings.js';
import { t, t2, setVocabulary } from './i18n.js';
import { PAGES, refreshInv } from './pages.js';
import { PAGES2, SHORTCUTS, applyVocabularyFile } from './pages2.js';

const ALL = [...PAGES, ...PAGES2]; const root = document.getElementById('root');
const R = { page: 'overview', params: null, main: null, pending: false };
apply();
try { const v = JSON.parse(localStorage.getItem('mc.vocab') || 'null'); if (v) setVocabulary(v.entries); } catch { /* no stored wording */ }
const provenance = () => `Version ${S.status.version}, ${S.status.builtAt ? 'built ' + fmtTime(S.status.builtAt) : 'build time unavailable'}`;
const markEl = () => h('span', { class: 'mark', html: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 9h14M7 14h14M7 19h14M11.5 9v10M16.5 9v10"/></svg>' });

// ---- sign in and first run -------------------------------------------------------------------
function authScreen() {
  const setup = S.status.setupNeeded; const err = h('p', { role: 'alert', style: 'color:var(--err)' });
  const name = h('md-outlined-text-field', { label: setup ? 'Administrator name' : t('name'), autocomplete: 'username', value: setup ? 'admin' : '' }); const pass = h('md-outlined-text-field', { label: setup ? 'Password, at least 10 characters' : t('password'), type: 'password', autocomplete: setup ? 'new-password' : 'current-password' }); const totp = h('md-outlined-text-field', { label: 'Authenticator code', inputmode: 'numeric', hidden: true });
  const card = h('form', { class: 'card flat rise', style: 'width:100%;max-width:460px;padding:32px;gap:18px', onsubmit: async (e) => { e.preventDefault(); err.textContent = ''; try { await api(setup ? '/api/setup' : '/api/login', { method: 'POST', body: { name: name.value, password: pass.value, totp: totp.value || undefined } }); sound('ok'); boot(); } catch (ex) { if (ex.data?.totpRequired) { totp.hidden = false; totp.focus(); } err.textContent = ex.message; card.style.animation = 'none'; requestAnimationFrame(() => { card.style.animation = 'shake calc(620ms * var(--dur))'; }); sound('err'); } } },
    h('div', { class: 'row nowrap' }, markEl(), h('div', { class: 'col gap0' }, h('b', {}, 'Material Choco hub'), h('span', { class: 'muted small' }, provenance()))), h('h1', { class: 'h1', style: 'font-size:2.2rem' }, setup ? 'Create the administrator' : t('sign_in')),
    setup && h('p', { class: 'muted' }, 'This is the first start of this hub. The password is stored as a salted scrypt hash. There is no default account.'), name, pass, totp, err, btn(setup ? 'Create and sign in' : t('sign_in'), { ic: 'lock_open', onclick: () => card.requestSubmit() }), h('button', { type: 'submit', hidden: true }));
  root.replaceChildren(h('div', { class: 'login' }, card));
}

// ---- shell ---------------------------------------------------------------------------------------
function scopeLabel() { const n = S.scope.size; return n === 0 ? `${t('all_machines')} (${S.machines.length})` : n === 1 ? scopedAll()[0]?.name : `${n} machines`; }
const scopedAll = () => S.machines.filter((m) => S.scope.has(m.id));
function scopeMenu(e) { menu(e.currentTarget, [{ label: `${t('all_machines')} (${S.machines.length})`, icon: S.scope.size ? 'dns' : 'check', run: () => { S.scope.clear(); render(); } }, ...S.machines.map((m) => ({ label: `${m.name}${m.online ? '' : ' (offline)'}`, icon: S.scope.has(m.id) ? 'check' : 'computer', run: () => { S.scope.has(m.id) ? S.scope.delete(m.id) : S.scope.add(m.id); render(); } }))], { label: 'Machines to act on' }); }
function a11yMenu(e) { const cyc = (key, vals, label) => ({ label: `${label}: ${settings[key]}`, icon: 'tune', run: () => { settings[key] = vals[(vals.indexOf(settings[key]) + 1) % vals.length]; } });
  menu(e?.currentTarget || document.querySelector('[data-a11y]') || document.body, [cyc('textScale', [1, 1.15, 1.3, 1.5, 0.9], 'Text size'), cyc('contrast', ['normal', 'high'], 'Contrast'), cyc('motion', ['system', 'reduced', 'full'], 'Motion'), cyc('targets', ['normal', 'large'], 'Touch targets'), cyc('focusRing', ['normal', 'bold'], 'Focus ring'), cyc('theme', ['system', 'light', 'dark'], 'Theme'), { label: 'Keyboard shortcuts', icon: 'help', run: () => go('help') }, { label: 'All accessibility settings', icon: 'settings', shortcut: 'Ctrl+Shift+A', run: () => go('settings', { tab: 'accessibility' }) }], { label: t('accessibility') }); }
function noticeSheet() { const close = sheet(frag(h('div', { class: 'row' }, h('h2', { class: 'h2 grow' }, t('notifications')), ibtn('close', t('close'), () => close())), notices.length ? notices.map((n) => h('div', { class: 'row nowrap', style: 'align-items:flex-start' }, icon(n.kind === 'err' ? 'error' : n.kind === 'ok' ? 'check_circle' : 'info', 'sm'), h('div', { class: 'col gap0 grow' }, h('span', {}, n.message), h('span', { class: 'muted small' }, fmtTime(n.at))))) : h('p', { class: 'muted' }, 'No notifications since this page was opened.')), { label: t('notifications') }); }
const openTabs = () => ALL.filter((p) => !settings.closedTabs.includes(p.id));
function tabMenu(e, p) { e.preventDefault(); const pinned = settings.pinnedTabs.includes(p.id); menu(e, [{ label: pinned ? 'Unpin tab' : 'Pin tab to the top', icon: pinned ? 'keep_off' : 'keep', run: () => { settings.pinnedTabs = pinned ? settings.pinnedTabs.filter((x) => x !== p.id) : [...settings.pinnedTabs, p.id]; } }, !pinned && { label: 'Close tab', icon: 'close', run: () => closeTab(p.id) }, { label: 'Close other unpinned tabs', icon: 'tab', run: () => { settings.closedTabs = ALL.map((x) => x.id).filter((id) => id !== p.id && !settings.pinnedTabs.includes(id)); if (R.page !== p.id) go(p.id); } }, { label: 'Open every tab', icon: 'open_in_new', run: () => { settings.closedTabs = []; } }], { label: 'Tab actions' }); }
function closeTab(id) { settings.closedTabs = [...new Set([...settings.closedTabs, id])]; if (R.page === id) go(openTabs()[0]?.id || 'overview'); }
function newTabMenu(e) { const closed = ALL.filter((p) => settings.closedTabs.includes(p.id)); menu(e.currentTarget, closed.length ? [...closed.map((p) => ({ label: t(p.id), icon: p.icon, run: () => go(p.id) })), { label: 'Open every tab', icon: 'open_in_new', run: () => { settings.closedTabs = []; } }] : [{ label: 'Every tab is already open', icon: 'check', disabled: true, run: () => {} }], { label: 'Reopen a tab' }); }

function shell() {
  const d = window.desktop; const tabsSorted = [...openTabs()].sort((a, b) => settings.pinnedTabs.includes(b.id) - settings.pinnedTabs.includes(a.id));
  const nav = h('nav', { class: 'tabs', role: 'tablist', 'aria-orientation': 'vertical', 'aria-label': 'Pages' }, tabsSorted.map((p) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(p.id === R.page), dataset: { tab: p.id }, onclick: () => go(p.id), oncontextmenu: (e) => tabMenu(e, p), onkeydown: (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const b = [...nav.querySelectorAll('.tab')]; b[(b.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length].focus(); } if (e.key === 'F10' && e.shiftKey) tabMenu(e, p); } },
    icon(p.icon), h('span', {}, t(p.id), t2(p.id) && h('small', {}, t2(p.id))), settings.pinnedTabs.includes(p.id) ? icon('keep', 'sm') : h('i', { class: 'x', role: 'button', 'aria-label': `Close tab ${t(p.id)}`, tabindex: '-1', onclick: (e) => { e.stopPropagation(); closeTab(p.id); } }, icon('close', 'sm')))), h('hr'), h('button', { class: 'tab', onclick: newTabMenu }, icon('add'), h('span', {}, 'New tab')));
  R.main = h('main', { id: 'main', tabindex: '-1' });
  const clock = settings.timeAware ? h('span', { class: 'badge', 'aria-label': 'Current time' }, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : null;
  const bottom = h('nav', { class: 'bottomnav', 'aria-label': 'Main' }, [['overview', 'home'], ['installed', 'inventory_2'], ['updates', 'upgrade'], ['jobs', 'list_alt']].map(([id, ic]) => h('button', { 'aria-current': R.page === id ? 'page' : 'false', onclick: () => go(id) }, h('i', {}, icon(ic)), t(id))), h('button', { onclick: () => nav.classList.toggle('open') }, h('i', {}, icon('menu')), 'More'));
  root.replaceChildren(h('div', { class: 'app' },
    d && h('div', { class: 'titlebar' }, h('b', {}, settings.displayName || 'Material Choco'), h('span', {}, S.machines.find((m) => m.local)?.elevated ? 'Running as administrator' : 'Not running as administrator'), h('span', { class: 'grow' }), ibtn('minimize', 'Minimize', () => d.win('minimize')), ibtn('crop_square', 'Maximize or restore', () => d.win('maximize')), ibtn('close', 'Close window', () => d.win('close'))),
    h('header', { class: 'topbar' }, ibtn('menu', 'Open the tab list', () => nav.classList.toggle('open'), 'menubtn'), h('div', { class: 'brand' }, markEl(), h('div', { class: 'col gap0' }, h('span', { class: 'name' }, settings.displayName || (d ? 'Material Choco' : 'Material Choco hub')), h('span', { class: 'prov' }, provenance()))),
      h('button', { class: 'scope press', onclick: scopeMenu, 'aria-haspopup': 'menu', 'aria-label': `Machines to act on: ${scopeLabel()}` }, icon('dns', 'sm'), scopeLabel(), icon('keyboard_arrow_down', 'sm')),
      h('button', { class: 'omni press', onclick: palette, 'aria-label': t('search_all') }, icon('search', 'sm'), h('span', { class: 'grow' }, t('search_all')), h('span', { class: 'hint' }, h('kbd', {}, 'Ctrl+Shift+F'))), clock,
      settings.a11yMenu && h('md-icon-button', { 'aria-label': t('accessibility'), title: t('accessibility'), dataset: { a11y: '1' }, onclick: a11yMenu }, icon('accessibility_new')), ibtn('notifications', t('notifications'), noticeSheet), !d && ibtn('logout', t('sign_out'), async () => { await api('/api/logout', { method: 'POST' }); location.reload(); })),
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
    if (sheetOpen() || typing) { R.pending = true; return; } if (['filter'].includes(why)) { const id = a?.closest?.('details')?.querySelector('md-outlined-text-field') === a; renderPage(); if (id) { const f = R.main.querySelector('details.fold md-outlined-text-field'); f?.focus(); } return; } if (why === 'machine' || why === 'reconnect' || why === 'vocab') render(); else renderPage(); }, why === 'filter' ? 220 : 120);
};
document.addEventListener('focusout', () => setTimeout(() => { if (R.pending && !sheetOpen()) { R.pending = false; renderPage(); } }, 300));
onSetting((k) => { if (['lang', 'school', 'displayName', 'closedTabs', 'pinnedTabs', 'a11yMenu', 'timeAware', 'oneThing', 'focusMode', '*', 'funnyEn', 'funnyYue', 'schoolName'].includes(k) && S.status?.authenticated) render(); else if (S.status?.authenticated && R.page === 'settings') renderPage(); });

// ---- command palette ---------------------------------------------------------------------------------
const SETTING_ROWS = [['lang', 'language', 'Language mode'], ['funnyEn', 'language', 'English funny level'], ['funnyYue', 'language', 'Cantonese funny level'], ['dialogEmoji', 'language', 'Show emojis in dialogs', 1], ['school', 'language', 'School mode', 1], ['vocab', 'language', 'Personal wording file'], ['theme', 'appearance', 'Theme'], ['density', 'appearance', 'Density'], ['motion', 'appearance', 'Motion'], ['hue', 'appearance', 'Seed colour'], ['chroma', 'appearance', 'Vividness'], ['displayName', 'appearance', 'Display name'], ['paletteSize', 'appearance', 'Command palette size'], ['textScale', 'accessibility', 'Text size'], ['contrast', 'accessibility', 'Contrast'], ['targets', 'accessibility', 'Larger touch targets'], ['focusRing', 'accessibility', 'Focus ring'], ['a11yMenu', 'accessibility', 'Accessibility button in the top bar', 1], ['sounds', 'sound', 'Action sounds', 1], ['volume', 'sound', 'Volume'], ['narration', 'sound', 'Spoken narrator', 1], ['narrationLang', 'sound', 'Narration language'], ['voiceEn', 'sound', 'English voice'], ['voiceYue', 'sound', 'Cantonese voice'], ['focusMode', 'focus', 'Focus mode', 1], ['lowStim', 'focus', 'Low stimulation', 1], ['timeAware', 'focus', 'Time awareness', 1], ['oneThing', 'focus', 'One thing at a time', 1], ['momentum', 'focus', 'Momentum', 1]];
function paletteItems() {
  const items = ALL.map((p) => ({ icon: p.icon, title: t(p.id), sub: 'Page', run: () => go(p.id) }));
  items.push({ icon: 'upgrade', title: t('upgrade_all'), sub: 'Command. Runs choco upgrade all on the selected machines.', run: () => runJob({ kind: 'choco', command: 'upgrade', args: ['all'] }) }, { icon: 'refresh', title: 'Refresh inventory', sub: 'Command. Re-reads packages, sources, config and features.', run: () => refreshInv() }, { icon: 'add', title: t('enroll'), sub: 'Command. Opens Machines to create a pairing code.', run: () => go('machines') }, { icon: 'accessibility_new', title: t('accessibility'), sub: 'Command', shortcut: 'Ctrl+Shift+A', run: () => a11yMenu() });
  for (const c of S.schema.commands) items.push({ icon: 'terminal', title: `choco ${c.name}`, sub: `Console. ${c.options.length} options. ${c.summary}`, run: () => go('console', { cmd: c.name }) });
  for (const [key, tab, label, bool] of SETTING_ROWS) items.push({ icon: 'settings', title: label, sub: `Setting, ${tab}`, control: bool ? h('md-switch', { selected: !!settings[key], 'aria-label': label, onclick: (e) => e.stopPropagation(), onchange: (e) => { settings[key] = e.target.selected; } }) : null, run: () => go('settings', { tab, focus: 'set-' + key }) });
  for (const [k, a] of SHORTCUTS) items.push({ icon: 'help', title: a, sub: 'Keyboard shortcut', shortcut: k, run: () => go('help') });
  for (const m of S.machines) items.push({ icon: 'computer', title: m.name, sub: `Machine. ${m.online ? 'Online' : 'Offline'}. Selects it and opens its packages.`, run: () => { S.scope = new Set([m.id]); go('installed'); } });
  return items;
}
let paletteOpen = false;
function palette() {
  if (paletteOpen) return; paletteOpen = true; const items = paletteItems(); let regex = false; let idx = 0; let shown = [];
  const list = h('div', { class: 'list', role: 'listbox', 'aria-label': 'Results' }); const count = h('p', { class: 'muted small', 'aria-live': 'polite' }); const input = h('input', { type: 'search', 'aria-label': t('search_all'), placeholder: t('search_all'), autofocus: true });
  const draw = () => { const m = matcher(input.value, regex); shown = items.filter((i) => m.test(i.title + ' ' + i.sub)).slice(0, 60); idx = Math.min(idx, Math.max(0, shown.length - 1)); count.textContent = m.ok ? `${t('results', { n: shown.length })}. Arrow keys move, Enter opens, Escape closes.` : 'Regex: ' + m.error;
    list.replaceChildren(...shown.map((it, i) => h('div', { class: 'prow', role: 'option', 'aria-selected': String(i === idx), onclick: () => { close(); it.run(); } }, icon(it.icon), h('span', { class: 'col gap0 grow' }, h('span', { class: 't1' }, it.title), h('span', { class: 'muted small' }, it.sub)), it.control, it.shortcut && h('kbd', {}, it.shortcut)))); list.children[idx]?.scrollIntoView({ block: 'nearest' }); };
  input.addEventListener('input', () => { idx = 0; draw(); });
  const close = sheet(h('div', { class: 'palette col', onkeydown: (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, shown.length - 1); draw(); } else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); draw(); } else if (e.key === 'Enter' && shown[idx] && e.target === input) { e.preventDefault(); const it = shown[idx]; close(); it.run(); } } },
    h('label', { class: 'q' }, icon('search'), input, h('md-filter-chip', { label: t('regex'), onclick: (e) => setTimeout(() => { regex = e.target.selected; draw(); }) })), count, list, h('div', { class: 'row small muted' }, h('kbd', {}, 'Ctrl+Shift+F'), 'opens this palette anywhere', h('span', { class: 'grow' }), btn(settings.paletteSize === 'full' ? 'Card size' : 'Full window', { kind: 'text', onclick: () => { settings.paletteSize = settings.paletteSize === 'full' ? 'card' : 'full'; close(); palette(); } }))),
  { cls: settings.paletteSize === 'full' ? 'full' : '', label: 'Command palette', onClose: () => { paletteOpen = false; } }); draw();
}
addEventListener('keydown', (e) => { if (!S.status?.authenticated || !(e.ctrlKey || e.metaKey) || !e.shiftKey) return; const k = e.key.toLowerCase(); const map = { f: palette, u: () => go('updates'), j: () => go('jobs'), a: () => a11yMenu() }; if (map[k]) { e.preventDefault(); map[k](); } });

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
  await loadAll(); connectEvents();
  const hash = location.hash.slice(1); if (ALL.some((p) => p.id === hash)) R.page = hash;
  render(); if (!settings.onboarded) onboarding();
}
boot();
