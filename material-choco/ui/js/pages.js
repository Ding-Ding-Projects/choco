// Working pages: overview, machines, packages, updates, sources, config, pins, keys, tools, builder, console.
import { h, frag, icon, btn, ibtn, badge, fmtTime, ago, download, copy, matcher, rxError, announce, toast, sheet, menu, superConfirm, skeleton, errorPanel, emptyState, mdIcon, qrSvg, tip, exportBtn, builderBtn, miniFilter, lit } from './ui.js';
import { S, api, machine, scoped, runJob, waitJob, isAdmin, canChange, role, switchState, toggleJob } from './state.js';
import { settings } from './settings.js';
import { t, t2, tx } from './i18n.js';

export const title = (key, sub) => h('h1', { class: 'h1' }, t(key), (t2(key) || sub) && h('small', {}, [t2(key), sub].filter(Boolean).join(' · ')));
// ---- filters ----------------------------------------------------------------------------------
// Every filter row has a search field, a Regex switch and a pattern builder, and keeps its own query,
// Regex choice and error line. Pages and cards rebuild their filter row whenever they redraw (on live
// data, and for page filters after every change to the filter), so three things are carried over
// from one copy of the row to the next: keyboard focus (holdFocus), the error line (drawn from the
// saved state when the row is made) and one spoken line per change made by the user (sayLater).

// The outcome of a filter change, spoken once through the shared polite status line after typing
// pauses: how many rows are left, or why the pattern cannot be used. Empty text cancels a pending line.
let sayTimer = null;
const sayLater = (text) => { clearTimeout(sayTimer); if (text) sayTimer = setTimeout(() => announce(text), 250); };
// Each control of a filter row is named in data-fpart. holdFocus remembers which one has keyboard
// focus and, when the row is a fresh copy made by a redraw, focuses the same control once it has
// rendered. A control made by a web component cannot take focus before its first update, so focusing
// it straight after the redraw does nothing. Nothing moves when focus went somewhere else in the
// meantime, such as after opening another page; the saved choice is then dropped.
function holdFocus(row, st) {
  row.addEventListener('focusin', (e) => { const part = e.target.closest?.('[data-fpart]'); if (part && row.contains(part)) st.focus = part.dataset.fpart; });
  row.addEventListener('focusout', (e) => { if (e.relatedTarget && !row.contains(e.relatedTarget)) { st.focus = null; return; } setTimeout(() => { if (row.isConnected && !row.contains(document.activeElement)) st.focus = null; }); });
  const field = row.querySelector('[data-fpart="q"]');
  if (field) { const caret = () => { try { st.caret = field.selectionEnd; } catch { st.caret = null; } }; for (const ev of ['input', 'keyup', 'pointerup']) field.addEventListener(ev, caret); }
  const want = st.focus; const el = want && row.querySelector(`[data-fpart="${CSS.escape(want)}"]`); if (!el) return;
  (async () => {
    await el.updateComplete; if (!el.isConnected || st.focus !== want) return;
    const a = document.activeElement; if (a && a !== document.body) { if (!row.contains(a)) st.focus = null; return; }
    el.focus(); if (want === 'q' && st.caret != null) { try { el.setSelectionRange(st.caret, st.caret); } catch { /* the caret stays where focus put it */ } }
  })();
}
const F = {}; // per-page filter state, kept while the app runs
// Lets a line that repeats a typed pattern break anywhere, so it never widens the page.
const WRAP = 'overflow-wrap:anywhere;min-width:0';
// An error panel is a role="alert" region, which is announced each time it is inserted. A failure
// that is kept and drawn again on every redraw is announced the first time it is on screen; later
// redraws insert the same panel without the role, so the message is not repeated.
function showAlertOnce(host, panel) {
  if (panel.dataset.shown) panel.removeAttribute('role');
  host.replaceChildren(panel); if (host.isConnected) panel.dataset.shown = '1';
}
// Every filter has its own Regex switch and pattern builder. Their names carry the name of the field
// they belong to, so a page with several filters has no two controls with the same name, and the
// visible word stays at the start of the name.
const nameFor = (control, field) => (field ? `${control}: ${field}` : control);
// The onchange of a page filter whose page draws the filtered list: it redraws the whole page.
// filterBar recognises it and makes sure that redraw happens (see fire below).
export const redrawPage = () => S.rerender('filter');
// sample: the lines the pattern builder previews, read when it opens. By default the rows that are
// on the page; a page that knows the text it filters passes that text, filtered out rows included.
// After the page has drawn the result of a change, it can pass a summary to say(), which speaks it
// once when the change came from the user.
export function filterBar(id, onchange, { chips = [], placeholder = t('filter'), sample } = {}) {
  const st = (F[id] ??= { q: '', regex: false, flags: {}, rev: 0, drawn: 0 });
  // A page that makes its filter bar is drawing the current filter. rev counts the changes made
  // here and drawn is the change the page on screen shows.
  st.drawn = st.rev;
  // Not a live region: the row is rebuilt on every redraw and would repeat the reason each time.
  // A change made by the user is spoken once through sayLater instead. The reason repeats the
  // pattern as one long token, which must be able to wrap in a narrow window with large text.
  const err = h('span', { class: 'small', style: `color:var(--err);${WRAP}`, dataset: { filterError: '1' } }, rxError(matcher(st.q, st.regex)));
  // S.rerender keeps one timer for every reason, so a live update that arrives within the delay of a
  // filter redraw takes its place; while the field has focus the page then waits for focus to leave
  // it, and the list and its count go on showing the old filter. A page filter therefore asks for
  // the redraw again until the page shows the latest change, it is gone, or it has asked 25 times.
  const recheck = (tries) => { clearTimeout(st.retry); st.retry = setTimeout(() => { if (!el.isConnected || st.drawn === st.rev || tries >= 25) return; onchange(); recheck(tries + 1); }, 400); };
  const fire = () => { const m = matcher(st.q, st.regex); err.textContent = rxError(m); st.say = true; st.rev++; sayLater(rxError(m)); onchange(); if (onchange === redrawPage) recheck(0); };
  const input = h('md-outlined-text-field', { label: placeholder, value: st.q, type: 'search', style: 'flex:1 1 260px', dataset: { fpart: 'q' }, oninput: (e) => { st.q = e.target.value; fire(); } }, h('span', { slot: 'leading-icon' }, icon('filter_list')));
  const chip = (label, part, get, set, name) => h('md-filter-chip', { label, selected: get(), 'aria-label': name, dataset: { fpart: part }, onclick: (e) => setTimeout(() => { set(e.target.selected); fire(); }) });
  const build = sample ? builderBtn(sample, (pat) => { st.q = pat; st.regex = true; fire(); }) : builderBtn(pageRows, (pat) => { st.q = pat; st.regex = true; fire(); }, tx('The preview uses the rows that were on this page when the builder opened.')); build.dataset.fpart = 'build';
  build.setAttribute('aria-label', nameFor(tx('Build a pattern from parts'), placeholder));
  const help = tip(t('filter'), tx('Type to keep only the rows that contain the text. Upper and lower case are treated the same. Turn on Regex to use a regular expression instead; the button beside it builds one from plain parts. A pattern that cannot be compiled filters nothing and says why.')); help.dataset.fpart = 'tip';
  const active = () => (st.q ? 1 : 0) + Object.values(st.flags).filter(Boolean).length;
  const open = settings.collapsed[id] !== true;
  const el = h('details', { class: 'fold', open, ontoggle: (e) => { settings.collapsed = { ...settings.collapsed, [id]: !e.target.open }; } },
    h('summary', { dataset: { fpart: 'summary' } }, icon('keyboard_arrow_down', 'sm'), t('filter'), active() ? badge(tx('{n} active', { n: active() }), 'info') : null),
    h('div', { class: 'row', style: 'padding:6px 0' }, input, chip(t('regex'), 'rx', () => st.regex, (v) => { st.regex = v; }, nameFor(t('regex'), placeholder)), build, chips.map(([key, label]) => chip(label, 'flag-' + key, () => !!st.flags[key], (v) => { st.flags[key] = v; })), help, err));
  holdFocus(el, st);
  return { st, el, test: (s) => matcher(st.q, st.regex).test(s),
    say: (text) => { if (!st.say) return; st.say = false; if (matcher(st.q, st.regex).ok) sayLater(text); } };
}
const pageRows = () => [...document.querySelectorAll('#main tbody tr, #main .prow, #main details.card > summary')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 200);
// Puts a query and a Regex choice into a miniFilter from ui.js, with the error line it would show.
function seedFilter(mf, q, regex) {
  if (!q && !regex) return mf; mf.st.q = q || ''; mf.st.regex = !!regex;
  const input = mf.el.querySelector('md-outlined-text-field'); if (input) input.value = mf.st.q;
  const chip = mf.el.querySelector('md-filter-chip'); if (chip) chip.selected = mf.st.regex;
  const err = mf.el.querySelector('[data-filter-error]'); if (err) err.textContent = rxError(matcher(mf.st.q, mf.st.regex));
  return mf;
}
// Empties a miniFilter: no query, Regex off and no error line.
function clearFilter(mf) {
  mf.st.q = ''; mf.st.regex = false;
  const input = mf.el.querySelector('md-outlined-text-field'); if (input) input.value = '';
  const chip = mf.el.querySelector('md-filter-chip'); if (chip) chip.selected = false;
  const err = mf.el.querySelector('[data-filter-error]'); if (err) err.textContent = '';
}
// The count line a redraw set, while a filter change made by the user runs that redraw. null otherwise.
let heard = null;
// A filter for one list: the miniFilter from ui.js (search field, Regex switch, pattern builder) with
// its query and Regex choice in saved. onchange redraws only the list the filter belongs to. The
// result of a change made by the user is spoken once: the count line that redraw set, or why the
// pattern cannot be used.
function listFilter(saved, onchange, opts, { narrow = false } = {}) {
  const mf = miniFilter(() => {
    saved.q = mf.st.q; saved.regex = mf.st.regex; heard = '';
    try { onchange(); } finally { const said = heard; heard = null; const m = matcher(saved.q, saved.regex); sayLater(m.ok ? said : rxError(m)); }
  }, opts);
  const input = mf.el.querySelector('md-outlined-text-field'); const chip = mf.el.querySelector('md-filter-chip'); const build = mf.el.querySelector('[data-rxopen]');
  if (input) input.dataset.fpart = 'q'; if (chip) chip.dataset.fpart = 'rx'; if (build) build.dataset.fpart = 'build';
  if (chip) chip.setAttribute('aria-label', nameFor(t('regex'), opts?.label)); if (build) build.setAttribute('aria-label', nameFor(tx('Build a pattern from parts'), opts?.label));
  // Escape in a field that holds text clears this search only, as it does in the page filters and in
  // the menus. Many of these filters sit in dialogs, which close on Escape and would drop what was
  // entered there. Escape in an empty field reaches the dialog as before.
  if (input) input.addEventListener('keydown', (e) => { if (e.key !== 'Escape' || e.isComposing || !input.value) return; e.preventDefault(); e.stopPropagation(); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true, composed: true })); });
  // These filters often sit in narrow cards: a smaller starting width keeps the Regex switch and
  // the pattern builder on the same line as the field when the card is about 300 px wide.
  if (narrow && input) input.style.flex = '1 1 160px';
  // The error line is not a live region, for the same reason as in filterBar, and it may wrap anywhere.
  const err = mf.el.querySelector('[role="alert"]'); if (err) { err.removeAttribute('role'); err.dataset.filterError = '1'; err.style.overflowWrap = 'anywhere'; err.style.minWidth = '0'; }
  seedFilter(mf, saved.q, saved.regex); holdFocus(mf.el, saved);
  return mf;
}
// A filter for one list inside a card or a section, with its query and Regex choice kept per id
// while the app runs. Pages redraw on live data, so a plain miniFilter would forget what was typed,
// and where the keyboard was. Each id is independent of every other filter.
const KF = {};
export function keptFilter(id, onchange, opts) { return listFilter((KF[id] ??= { q: '', regex: false }), onchange, opts, { narrow: true }); }
// A line that says how many rows a filter keeps. Empty text hides it. It is not a live region: the
// lines are rebuilt on every redraw, and a change made by the user is spoken once by listFilter.
const countLine = () => h('p', { class: 'muted small', hidden: true });
const setCount = (el, text) => { el.textContent = text || ''; el.hidden = !text; if (heard !== null) heard = text || ''; };
// The hidden attribute alone loses to the display rule of .col, .field and .tab, so set both.
const showEl = (el, on) => { el.hidden = !on; el.style.display = on ? '' : 'none'; };
// A selection is kept while a filter hides some of the selected rows, and the actions of the bar
// still apply to those rows. This line says so, on a line of its own under the actions.
const hiddenNote = (hidden) => (hidden ? h('p', { class: 'small', style: `flex:1 1 100%;${WRAP}`, dataset: { hiddenSelected: String(hidden) } }, tx('{n} of the selected rows are hidden by the filter. The actions here still apply to them.', { n: hidden })) : null);
// Selection bar shared by the lists that support bulk actions. hidden: how many of the n selected rows
// the filter hides.
export const bulkBar = (n, actions, clear, hidden = 0) => (n ? h('div', { class: 'bulk row', role: 'toolbar', 'aria-label': tx('Actions for the selection') }, h('b', { class: 'grow' }, tx('{n} selected', { n })), actions, btn(tx('Clear selection'), { kind: 'text', onclick: clear }), hiddenNote(hidden)) : null);
export function table(heads, rows, { label } = {}) {
  return h('div', { class: 'tablewrap' }, h('table', { class: 't', 'aria-label': label }, h('thead', {}, h('tr', {}, heads.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', {}, rows.map((r, i) => { const tr = h('tr', { class: r.sel ? 'sel' : '', style: `--i:${i}`, oncontextmenu: r.menu && ((e) => { e.preventDefault(); menu(e, r.menu(), { label: 'Row actions' }); }) }, r.cells.map((c) => h('td', {}, c))); return tr; }))));
}
const G = () => ({ ...settings.defaultGlobal });
// Role gates. W: needs a role that may change machines (operator or admin). A: admin only.
const W = (x) => (canChange() ? x : null); const A = (x) => (isAdmin() ? x : null);
// What a viewer may run, as the hub defines it: plain read only queries.
export const readOnlySpec = (spec) => spec.kind === 'inventory' || ['list', 'outdated', 'search', 'info'].includes(spec.command) || (['pin', 'source', 'config', 'feature'].includes(spec.command) && spec.subcommand === 'list') || (spec.command === 'config' && spec.subcommand === 'get');
const viewerNote = () => (canChange() ? null : h('p', { class: 'small', dataset: { viewerNote: '1' } }, icon('visibility', 'sm'), ' ', tx('Your role is Viewer. You can look, refresh inventories and run read only queries. Controls that change machines are not shown.')));
const refuseViewer = (spec) => { if (canChange() || readOnlySpec(spec)) return false; toast(tx('Your role is Viewer, and this command changes a machine or is not a plain query. Nothing was run.'), { kind: 'err' }); return true; };
const choco = (command, extra = {}) => ({ kind: 'choco', command, ...extra });
export const preview = (spec) => { const cmd = S.schema.commands.find((c) => c.name === spec.command); const parts = ['choco', spec.command]; if (spec.subcommand) parts.push(spec.subcommand); parts.push(...(spec.args || [])); const add = (list, vals) => { for (const [id, v] of Object.entries(vals || {})) { const o = list.find((x) => x.id === id); if (!o || v === false || v === '' || v == null) continue; parts.push(o.takesValue ? `${o.flag}=${o.secret ? '********' : /\s/.test(v) ? `"${v}"` : v}` : o.flag); } }; add(cmd.options, spec.options); add(S.schema.globalOptions, spec.global); return parts.join(' '); };
const hasInvJob = (m) => S.jobs.some((j) => j.machineId === m.id && j.kind === 'inventory' && (j.state === 'queued' || j.state === 'running'));
export const refreshInv = (ms) => runJob({ kind: 'inventory' }, { machineIds: (ms || scoped()).map((m) => m.id), quiet: true });
const statusBadge = (m) => (m.online ? badge(t('online'), 'ok') : badge(`${t('offline')}, seen ${ago(m.lastSeen)}`, 'err'));

// One card per machine in scope, with honest loading, empty and error states.
export function perMachine(render, { actions } = {}) {
  const ms = scoped();
  if (!S.machines.length) return emptyState('dns', t('no_machines'), 'Nothing is enrolled, so there is nothing to show. Pair the first Windows machine to begin.', btn(t('enroll'), { ic: 'add', onclick: () => S.go('machines') }));
  return frag(ms.map((m, i) => {
    const inv = m.inventory; let body;
    if (!inv) body = hasInvJob(m) ? (m.online ? skeleton(4) : h('p', { class: 'muted' }, 'An inventory request is waiting for this machine to come online.')) : h('div', { class: 'row' }, h('p', { class: 'muted grow' }, 'No inventory has been read from this machine yet.'), btn(t('refresh'), { kind: 'tonal', ic: 'refresh', onclick: () => refreshInv([m]) }));
    else if (!inv.available) body = errorPanel('Chocolatey CLI is not available', inv.reason || 'The agent could not start the bundled CLI.', null, [btn('Try again', { kind: 'danger', ic: 'refresh', onclick: () => refreshInv([m]) })]);
    else body = render(m, inv);
    return h('section', { class: 'card rise', style: `--i:${i}`, dataset: { machine: m.id } },
      h('div', { class: 'row' }, h('span', { class: 'live ' + (m.online ? '' : 'off') }), h('h2', { class: 'h2' }, m.name), statusBadge(m), m.readOnly && badge('Read only', 'info'), inv?.available && badge('choco ' + inv.chocoVersion), h('span', { class: 'grow' }), actions && inv?.available && actions(m, inv), ibtn('refresh', `Refresh inventory of ${m.name}`, () => refreshInv([m]))),
      inv && h('p', { class: 'muted small' }, `Inventory read ${fmtTime(inv.at)}${m.online ? '' : '. This machine is offline, so this may be stale.'}${inv.errors?.length ? '. Problems: ' + inv.errors.join('; ') : ''}`), body);
  }));
}

// ---- command form generated from the CLI schema: every option of every command ------------
const splitArgs = (s) => (s.match(/"[^"]*"|\S+/g) || []).map((x) => x.replace(/^"|"$/g, ''));
// What an options filter searches for one option: the flag, the label, every accepted spelling and
// the description. The options filter of a form and the Package builder filter use the same text.
const optSearchText = (o) => [o.flag, o.label, ...(o.names || []).map((n) => (n.length === 1 ? '-' : '--') + n), o.description || ''].join(' ');
export function optionControl(o, bag, changed) {
  const explain = h('div', { class: 'explain', hidden: true }, h('p', {}, o.description || 'No description in the CLI source.'), h('p', { class: 'mono', style: 'margin-top:6px' }, 'Accepted spellings: ' + o.names.map((n) => (n.length === 1 ? '-' : '--') + n).join(', ')), o.takesValue && h('p', { style: 'margin-top:6px' }, `Example: ${o.flag}=${o.secret ? '<secret>' : 'value'}`));
  const info = h('md-icon-button', { class: 'infob', 'aria-label': `Explain ${o.flag}`, 'aria-expanded': 'false', onclick: (e) => { explain.hidden = !explain.hidden; e.currentTarget.setAttribute('aria-expanded', String(!explain.hidden)); } }, icon('info', 'sm'));
  const short = (o.description || '').replace(/^[^-]{1,60} - /, '').split(/(?<=\.)\s/)[0].slice(0, 140);
  // The switch label below sits in a column, where the 300px basis of .opt would become its height.
  const text = optSearchText(o);
  if (o.takesValue) return h('div', { class: 'field', dataset: { opt: o.id, text } }, h('div', { class: 'row nowrap gap6' }, h('md-outlined-text-field', { label: o.label + (o.deprecated ? ' (deprecated)' : ''), value: bag[o.id] || '', type: o.secret ? 'password' : 'text', 'supporting-text': o.flag, class: 'grow', oninput: (e) => { bag[o.id] = e.target.value; changed(); } }), info), explain);
  return h('div', { class: 'col gap6', style: 'flex:1 1 300px', dataset: { opt: o.id, text } }, h('label', { class: 'opt', style: 'flex:0 0 auto' }, h('md-switch', { selected: bag[o.id] === true, 'aria-label': o.label, onchange: (e) => { bag[o.id] = e.target.selected; changed(); } }), h('span', { class: 'col gap0 grow' }, h('span', { class: 't1' }, o.label + (o.deprecated ? ' (deprecated)' : '')), h('span', { class: 'muted small' }, short), h('span', { class: 'mono small' }, o.flag)), info), explain);
}
export function commandForm(name, init = {}) {
  const cmd = S.schema.commands.find((c) => c.name === name);
  const st = { sub: init.subcommand || cmd.subcommands[0] || '', args: (init.args || []).join(' '), options: { ...init.options }, global: { ...G(), ...init.global } };
  const subs = init.lockSub ? [] : cmd.subcommands; const listeners = []; const changed = () => listeners.forEach((f) => f());
  const optBox = h('div', { class: 'row top' }, cmd.options.map((o) => optionControl(o, st.options, changed)));
  const gBox = h('div', { class: 'row top' }, S.schema.globalOptions.map((o) => optionControl(o, st.global, changed)));
  const gFold = h('details', { class: 'fold' }, h('summary', {}, icon('keyboard_arrow_down', 'sm'), `Global options (${S.schema.globalOptions.length})`), gBox);
  // Options filter: its own search field, Regex switch and pattern builder. init.filterId keeps the
  // query while the app runs (the Console); init.filter starts it with a query (the Package builder).
  const all = [...optBox.children, ...gBox.children]; const optCount = countLine(); const useFilter = all.length > 6;
  const applyFilter = () => { let n = 0; for (const el of all) { const on = optF.test(el.dataset.text); showEl(el, on); if (on) n++; } if (optF.st.q) gFold.open = true; setCount(optCount, optF.st.q ? (n ? tx('{a} of {b} options shown.', { a: n, b: all.length }) : tx('No option matches the filter.')) : ''); };
  const fopts = { label: tx('Filter {n} options', { n: all.length }), sample: () => all.map((el) => el.dataset.text) };
  const optF = init.filterId ? keptFilter(init.filterId, applyFilter, fopts) : listFilter({ q: init.filter?.q || '', regex: !!init.filter?.regex }, applyFilter, fopts);
  if (useFilter && (optF.st.q || optF.st.regex)) applyFilter();
  const filt = useFilter ? h('div', { class: 'col gap6', dataset: { optFilter: '1' } }, optF.el, optCount) : null;
  const seg = subs.length ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Subcommand' }, subs.map((s) => h('button', { type: 'button', 'aria-pressed': String(s === st.sub), onclick: (e) => { st.sub = s; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); changed(); } }, s))) : null;
  const argsField = init.noArgs ? null : h('md-outlined-text-field', { label: init.argsLabel || 'Arguments, for example package ids, separated by spaces', value: st.args, style: 'width:100%', oninput: (e) => { st.args = e.target.value; changed(); } });
  const clean = (b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== false && v !== '' && v != null));
  return { cmd, onChange: (f) => listeners.push(f), spec: () => choco(cmd.name, { subcommand: st.sub || undefined, args: splitArgs(st.args), options: clean(st.options), global: clean(st.global) }),
    el: h('div', { class: 'col gap18' }, seg, argsField, filt, cmd.options.length ? optBox : h('p', { class: 'muted' }, 'This command has no options of its own.'), gFold) };
}
// The machines a command runs on. With more than 6 machines the list has a filter of its own; it
// only hides rows, so a ticked machine still runs the command while the filter hides it, and the
// count line says so. filterId keeps the query while the app runs (the Console).
export function machinePicker(preset, { filterId } = {}) {
  const chosen = new Set((preset || scoped()).map((m) => m.id)); let f = null; let draw = () => {};
  const rows = S.machines.map((m) => [m, h('label', { class: 'row nowrap' }, h('md-checkbox', { checked: chosen.has(m.id), 'aria-label': m.name, onchange: (e) => { e.target.checked ? chosen.add(m.id) : chosen.delete(m.id); draw(); } }), h('span', {}, m.name), m.online ? badge(t('online'), 'ok') : badge('Offline. The job waits in the queue.', 'err'))]);
  const ids = () => [...chosen]; if (rows.length <= 6) return { ids, el: h('div', { class: 'col gap6' }, rows.map(([, r]) => r)) };
  const text = (m) => [m.name, m.hostname, m.os, ...(m.groups || []), m.online ? t('online') : t('offline')].filter(Boolean).join(' ');
  const count = countLine();
  draw = () => { let n = 0; let hidden = 0; for (const [m, r] of rows) { const on = f.test(text(m)); showEl(r, on); if (on) n++; else if (chosen.has(m.id)) hidden++; }
    setCount(count, f.st.q ? [n ? tx('{a} of {b} machines shown.', { a: n, b: rows.length }) : tx('No machine matches the filter.'), hidden ? tx('{n} ticked machines are hidden by the filter. The command still runs on them.', { n: hidden }) : ''].filter(Boolean).join(' ') : ''); };
  const opts = { label: tx('Filter machines'), sample: () => S.machines.map(text) };
  f = filterId ? keptFilter(filterId, draw, opts) : listFilter({ q: '', regex: false }, draw, opts); draw();
  return { ids, el: h('div', { class: 'col gap6' }, h('div', { class: 'col gap6', dataset: { machineFilter: '1' } }, f.el, count), rows.map(([, r]) => r)) };
}
// A full options dialog for one command, with preview, machine choice and dry run.
export function runDialog(name, init = {}, { heading, destructive, machines } = {}) {
  const form = commandForm(name, init); const pick = machinePicker(machines);
  const pre = h('pre', { class: 'log cmd' }); const upd = () => { pre.textContent = preview(form.spec()); }; form.onChange(upd); upd();
  const go = async (dry) => { const spec = form.spec(); if (refuseViewer(spec)) return; if (dry) spec.global = { ...spec.global, 'what-if': true };
    if (destructive && !dry && !(await superConfirm({ title: heading || `choco ${lit(name)}`, detail: `${lit(preview(spec))} on ${pick.ids().length} machine(s). This cannot be undone from here.`, action: name }))) return;
    const jobs = await runJob(spec, { machineIds: pick.ids() }); if (jobs.length) close(); };
  const close = sheet(frag(h('div', { class: 'row' }, h('h2', { class: 'h2 grow' }, heading || `choco ${name}`), badge(`${form.cmd.options.length} options from the CLI source`, 'info'), ibtn('close', t('close'), () => close())),
    h('div', { class: 'row top gap18' }, h('div', { class: 'col grow', style: 'flex:2 1 460px' }, form.el), h('div', { class: 'col', style: 'flex:1 1 280px' }, h('div', { class: 'card' }, h('h3', { class: 'h2', style: 'font-size:1.1rem' }, t('command_preview')), pre, h('div', { class: 'row' }, btn('Dry run with --what-if', { kind: 'outlined', onclick: () => go(true) }))),
      h('div', { class: 'card' }, h('h3', { class: 'h2', style: 'font-size:1.1rem' }, t('run_on')), pick.el, h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn(t('run'), { kind: destructive ? 'danger' : 'filled', ic: 'play_arrow', onclick: () => go(false) })))))), { cls: 'wide', label: heading || name });
}
// Run a read command on one machine and show its output in place.
async function runShow(host, m, spec, parse) {
  host.replaceChildren(skeleton(3)); const [job] = await runJob(spec, { machineIds: [m.id], quiet: true }); if (!job) { host.replaceChildren(); return null; }
  const done = await waitJob(job.id);
  if (done.state !== 'succeeded') { host.replaceChildren(errorPanel(`${lit(done.command)} failed`, `Exit code ${done.exitCode} on ${lit(m.name)}. ${done.note || ''}`, done.output.slice(-2000), [btn('Open the full log', { kind: 'outlined', onclick: () => S.go('jobs', { job: done.id }) })])); return null; }
  host.replaceChildren(parse ? parse(done.output) : h('pre', { class: 'log' }, done.output || '(no output)')); return done;
}
const rowsOf = (text) => text.split(/\r?\n/).filter((l) => l.includes('|')).map((l) => l.trim().split('|'));
const firstOnline = () => scoped().find((m) => m.online && m.inventory?.available) || scoped().find((m) => m.online);

// ---- overview ---------------------------------------------------------------------------
function spark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'spark'); svg.setAttribute('viewBox', '0 0 600 72'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img');
  const a = document.createElementNS(svg.namespaceURI, 'path'); a.setAttribute('class', 'a'); const l = document.createElementNS(svg.namespaceURI, 'path'); l.setAttribute('class', 'l'); svg.append(a, l);
  const draw = () => { if (!svg.isConnected && S.samples.length > 1) { document.removeEventListener('mc-sample', draw); return; } const d = S.samples.slice(-60); const max = Math.max(1, ...d); const pts = d.map((v, i) => [600 - (d.length - 1 - i) * 10, 66 - (v / max) * 56]); if (!pts.length) return; const line = 'M' + pts.map((p) => p.join(',')).join(' L'); l.setAttribute('d', line); a.setAttribute('d', `${line} L600,72 L${pts[0][0]},72 Z`); svg.setAttribute('aria-label', `Active jobs over the last ${d.length * 2} seconds. Now ${d[d.length - 1]}, peak ${max}.`); };
  document.addEventListener('mc-sample', draw); setTimeout(draw); return svg;
}
function overview(root) {
  const ms = scoped(); const out = ms.reduce((n, m) => n + (m.inventory?.outdated?.filter((o) => !o.pinned).length || 0), 0); const pkgs = ms.reduce((n, m) => n + (m.inventory?.packages?.length || 0), 0);
  const running = S.jobs.filter((j) => j.state === 'running'); const queued = S.jobs.filter((j) => j.state === 'queued');
  const attention = [];
  for (const m of ms) { const o = m.inventory?.outdated?.length; if (o) attention.push([m.name, `${o} package(s) are out of date`, btn('Review updates', { kind: 'tonal', ic: 'upgrade', onclick: () => S.go('updates') })]); if (!m.online) attention.push([m.name, `Agent last seen ${ago(m.lastSeen)}`, btn('Open machines', { kind: 'text', onclick: () => S.go('machines') })]); if (m.inventory && !m.inventory.available) attention.push([m.name, 'The Chocolatey CLI could not be started', btn('Open machines', { kind: 'text', onclick: () => S.go('machines') })]); for (const s of m.inventory?.sources || []) if (s.disabled) attention.push([m.name, `Source "${s.name}" is disabled`, btn('Open sources', { kind: 'text', onclick: () => S.go('sources') })]); if (m.local && m.elevated === false) attention.push([m.name, 'Not running as administrator. Installs and upgrades will likely fail.', window.desktop ? btn('Restart as administrator', { kind: 'tonal', ic: 'admin_panel_settings', onclick: () => window.desktop.relaunchElevated() }) : null]); }
  const failed = S.jobs.filter((j) => j.state === 'failed' && j.kind === 'choco').slice(0, 2); for (const j of failed) attention.push([machine(j.machineId)?.name || '', `Failed with exit code ${j.exitCode}: ${j.command}`, btn('Open job', { kind: 'text', onclick: () => S.go('jobs', { job: j.id }) })]);
  // Each card has its own filter. Without a query the dashboard shows 8 attention rows and 5 jobs;
  // with one it shows every attention row that matches and the 5 newest matching jobs.
  const attnText = (c) => `${c[0]} ${c[1]}`; const attnHost = h('div', { class: 'col' }); const attnCount = countLine();
  const af = keptFilter('overview-attention', () => drawAttn(), { label: tx('Filter what needs attention'), sample: () => attention.map(attnText) });
  const drawAttn = () => { const list = attention.filter((c) => af.test(attnText(c))); const rows = af.st.q ? list : list.slice(0, 8); setCount(attnCount, tx('{a} of {b} items shown.', { a: rows.length, b: attention.length }));
    attnHost.replaceChildren(rows.length ? table(['Machine', 'What', 'Action'], rows.map((c) => ({ cells: c }))) : h('p', { class: 'muted' }, tx('Nothing that needs attention matches the filter.'))); };
  const recent = S.jobs.filter((j) => j.kind === 'choco'); const jobsHost = h('div', { class: 'col' }); const jobsCount = countLine();
  const jobText = (j) => `${j.command} ${machine(j.machineId)?.name || ''} ${j.state === 'failed' ? `${t('failed')}, exit ${j.exitCode}` : t(j.state)}`;
  const jf = keptFilter('overview-jobs', () => drawJobs(), { label: tx('Filter recent jobs'), sample: () => recent.map(jobText) });
  const jobRow = (j) => h('button', { class: 'prow', onclick: () => S.go('jobs', { job: j.id }) }, h('span', { class: 'col gap0 grow' }, h('span', { class: 'mono' }, j.command), h('span', { class: 'muted small' }, `${machine(j.machineId)?.name || 'removed machine'}, ${ago(j.createdAt)}`)), stateBadge(j));
  const drawJobs = () => { const list = recent.filter((j) => jf.test(jobText(j))); setCount(jobsCount, jf.st.q ? tx('Matching jobs: {a} of {b}. Showing the newest {c}.', { a: list.length, b: recent.length, c: Math.min(5, list.length) }) : '');
    jobsHost.replaceChildren(...(list.length ? list.slice(0, 5).map(jobRow) : [h('p', { class: 'muted' }, tx('No job matches the filter.'))])); };
  if (attention.length) drawAttn(); if (recent.length) drawJobs();
  root.append(title('overview'),
    !S.machines.length ? emptyState('dns', t('no_machines'), 'Nothing is enrolled, so there is nothing to show. Pair the first Windows machine to begin.', btn(t('enroll'), { ic: 'add', onclick: () => S.go('machines') })) : frag(
      settings.focusMode ? null : h('section', { class: 'hero rise' }, h('span', { class: 'blob' }, icon(out ? 'upgrade' : 'check', 'xl')), h('div', { class: 'col grow', style: 'flex:1 1 300px;gap:8px' }, h('span', { class: 'big' }, out ? t('updates_ready', { n: out }) : t('all_current')), t2(out ? 'updates_ready' : 'all_current', { n: out }) && h('span', {}, t2(out ? 'updates_ready' : 'all_current', { n: out })),
        h('div', { class: 'row nowrap' }, h('span', { class: 'live ' + (running.length ? '' : 'off') }), h('span', {}, running.length ? `${running.length} job(s) running, ${queued.length} queued` : queued.length ? `${queued.length} job(s) waiting for machines` : 'No job is running')), running.length ? h('div', { class: 'wave', style: 'max-width:420px;--wc:var(--pc)' }) : null),
      h('button', { class: 'cta press', disabled: !out || !canChange(), title: canChange() ? null : tx('Your role is Viewer, so upgrades are not available.'), onclick: () => runJob(choco('upgrade', { args: ['all'] }), { machineIds: ms.filter((m) => m.inventory?.outdated?.length).map((m) => m.id) }) }, icon('upgrade'), t('upgrade_all'))),
      h('div', { class: 'row stretch' }, [[ms.length, 'machines_enrolled', badge(`${ms.filter((m) => m.online).length} ${t('online').toLowerCase()}`, 'ok')], [pkgs, 'packages_installed'], [out, 'updates_available', out ? badge('ready', 'warn') : badge(t('current'), 'ok')], [running.length, 'jobs_running', queued.length ? badge(`${queued.length} queued`, 'info') : null]].map(([n, k, b], i) => h('div', { class: 'card stat lift rise', style: `--i:${i + 1}` }, h('span', { class: 'n' }, n), h('p', { class: 'muted' }, t(k), t2(k) && h('span', { class: 'bi small' }, t2(k))), b))),
      h('div', { class: 'row stretch' }, h('div', { class: 'card rise', style: '--i:5;flex:2 1 480px', dataset: { attention: '1' } }, h('h2', { class: 'h2' }, t('needs_attention')), attention.length ? frag(af.el, attnCount, attnHost) : h('p', { class: 'muted' }, t('nothing_attention'))),
        h('div', { class: 'card rise', style: '--i:6;flex:1 1 300px', dataset: { recentJobs: '1' } }, h('h2', { class: 'h2' }, t('recent_jobs')), h('div', { class: 'row nowrap' }, h('span', { class: 'live ' + (running.length ? '' : 'off') }), h('span', { class: 'muted small' }, 'Active jobs, sampled every 2 seconds')), spark(),
          recent.length ? frag(jf.el, jobsCount, jobsHost) : null, btn(t('jobs'), { kind: 'text', onclick: () => S.go('jobs') })))));
}
export const stateBadge = (j) => badge(j.state === 'failed' ? `${t('failed')}, exit ${j.exitCode}` : t(j.state), { succeeded: 'ok', failed: 'err', running: 'info', queued: 'warn', cancelled: '', expired: '' }[j.state]);

// ---- machines -----------------------------------------------------------------------------
const PAIR = { code: null, ro: false }; const msel = new Set();
function machines(root) {
  const pairHost = h('div', { class: 'col' });
  const drawCode = () => { const r = PAIR.code; if (!r || Date.parse(r.expires) < Date.now()) return pairHost.replaceChildren(); const cmd = `MaterialChoco.exe --agent enroll --hub ${location.origin} --code ${r.code}${r.readOnly ? ' --read-only' : ''}${location.protocol === 'http:' ? ' --allow-insecure' : ''}`;
    pairHost.replaceChildren(frag(h('div', { class: 'code', 'aria-label': 'Pairing code ' + r.code.split('').join(' ') }, r.code), h('p', { class: 'muted small' }, `Works once. Expires ${fmtTime(r.expires)}.${r.readOnly ? ' Read only agent.' : ''}`), h('pre', { class: 'log cmd' }, cmd), h('div', { class: 'row' }, btn('Copy code', { kind: 'tonal', ic: 'content_copy', onclick: () => copy(r.code) })),
      h('details', { class: 'fold' }, h('summary', {}, icon('keyboard_arrow_down', 'sm'), icon('qr_code_2', 'sm'), tx('Show as a QR code')), h('div', { class: 'col' }, qrSvg(JSON.stringify({ hub: location.origin, code: r.code }), tx('hub address and pairing code')), h('p', { class: 'small' }, tx('The QR code holds the hub address and this code as JSON, so a phone or another computer can read them without typing. It is drawn in this page; nothing is sent to a QR service. The desktop app does not scan it yet: type the code there.')))), location.protocol === 'http:' ? h('p', { class: 'small' }, 'This hub is served over plain HTTP. Agents on other computers must opt in with --allow-insecure. Use HTTPS outside a trusted LAN.') : null)); };
  const newCode = async (readOnly) => { try { const r = await api('/api/pairing', { method: 'POST', body: { readOnly } }); PAIR.code = { ...r, readOnly }; drawCode(); } catch (e) { toast(e.message, { kind: 'err' }); } };
  drawCode();
  const ro = h('md-switch', { 'aria-label': 'Read only agent', dataset: { ro: '1' }, selected: PAIR.ro, onchange: (e) => { PAIR.ro = e.target.selected; } });
  const edit = (m) => { const name = h('md-outlined-text-field', { label: 'Display name', value: m.name }); const groups = h('md-outlined-text-field', { label: 'Groups, separated by commas', value: (m.groups || []).join(', '), 'supporting-text': 'Schedules can target a group.' }); const r = h('md-switch', { selected: m.readOnly, disabled: m.local || !isAdmin(), 'aria-label': 'Read only' });
    const all = S.schema.commands.map((c) => c.name); let limited = Array.isArray(m.allowedCommands); const allowed = new Set(limited ? m.allowedCommands : all); const chipHost = h('div', { class: 'row gap6', dataset: { allowChips: '1' } }); const allowCount = h('span', { class: 'small muted', 'aria-live': 'polite' });
    // The command chips have a filter of their own. It only hides chips: a ticked command that the
    // filter hides stays allowed, and the count above still counts it.
    const chipCount = countLine(); const chipFilter = listFilter({ q: '', regex: false }, () => drawChips(), { label: tx('Filter commands'), sample: () => all });
    const chipFilterHost = h('div', { class: 'col gap6', dataset: { allowFilter: '1' } }, chipFilter.el, chipCount);
    const drawChips = () => { showEl(chipHost, limited); showEl(chipFilterHost, limited); allowCount.textContent = limited ? (allowed.size ? tx('{a} of {b} commands allowed. Inventory refreshes are always allowed.', { a: allowed.size, b: all.length }) : tx('No command is allowed. Only inventory refreshes will run.')) : tx('Every command is accepted for this machine.');
      const shown = all.filter((c) => chipFilter.test(c)); setCount(chipCount, chipFilter.st.q ? (shown.length ? tx('{a} of {b} commands shown.', { a: shown.length, b: all.length }) : tx('No command matches the filter.')) : '');
      chipHost.replaceChildren(...shown.map((c) => h('md-filter-chip', { label: c, selected: allowed.has(c), dataset: { allow: c }, onclick: (e) => setTimeout(() => { e.target.selected ? allowed.add(c) : allowed.delete(c); drawChips(); }) }))); };
    const modeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': tx('Allowed commands') }, [[false, tx('Every command')], [true, tx('Only the ticked commands')]].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(limited === v), dataset: { allowMode: String(v) }, onclick: (e) => { limited = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); drawChips(); } }, l))); drawChips();
    const body = () => { const b = { name: name.value, groups: groups.value.split(',') }; if (isAdmin()) { if (!m.local) b.readOnly = r.selected; const next = limited ? [...allowed].sort() : null; const prev = Array.isArray(m.allowedCommands) ? [...m.allowedCommands].sort() : null; if (JSON.stringify(next) !== JSON.stringify(prev)) b.allowedCommands = next; } return b; };
    const close = sheet(frag(h('h2', { class: 'h2' }, `Edit ${m.name}`), name, groups, h('label', { class: 'row nowrap' }, r, h('span', {}, 'Read only. The hub and the agent refuse commands that change this machine.')),
      h('div', { class: 'row nowrap' }, h('h3', { class: 'h2 grow', style: 'font-size:1.1rem' }, tx('Allowed commands')), tip(tx('Allowed commands'), tx('Limits which choco commands the hub accepts for this machine. A job for any other command is not created and the machine is reported as skipped with the reason. Schedules skip it too. The agent can carry its own list, set on the machine with --allow; both lists apply and the hub cannot change the agent\'s.'))),
      isAdmin() ? frag(modeSeg, allowCount, chipFilterHost, chipHost) : h('p', { class: 'muted', dataset: { allowReadonly: '1' } }, (Array.isArray(m.allowedCommands) ? tx('The hub accepts only: {l}.', { l: m.allowedCommands.join(', ') || tx('inventory refreshes') }) : tx('The hub accepts every command for this machine.')) + ' ' + tx('Only an admin can change this and the read only setting.')),
      h('p', { class: 'muted small', dataset: { agentAllow: '1' } }, Array.isArray(m.agentAllowedCommands) ? tx('The agent on this machine enforces its own list, which cannot be changed from here: {l}.', { l: m.agentAllowedCommands.join(', ') || tx('inventory refreshes only') }) : tx('The agent on this machine has no list of its own.')),
      h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn(t('save'), { ic: 'save', onclick: async () => { try { await api('/api/machines/' + m.id, { method: 'PATCH', body: body() }); close(); toast(tx('Saved {n}.', { n: name.value }), { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err' }); } } }))), { label: 'Edit machine' }); };
  const actions = (m) => [{ label: 'Open packages', icon: 'inventory_2', run: () => { S.scope = new Set([m.id]); S.go('installed'); } }, { label: 'Refresh inventory', icon: 'refresh', run: () => refreshInv([m]) }, W({ label: isAdmin() ? 'Rename, groups, policy' : tx('Rename and groups'), icon: 'edit', run: () => edit(m) }), !m.local && isAdmin() && { label: 'Remove from hub', icon: 'delete', danger: true, run: async () => { if (await superConfirm({ title: `Remove ${lit(m.name)}`, detail: 'The hub forgets this machine, its inventory and its agent token. Queued jobs are cancelled. Nothing is uninstalled on the machine itself.' })) api('/api/machines/' + m.id, { method: 'DELETE' }).catch((e) => toast(e.message, { kind: 'err' })); } }];
  const machineText = (m) => `${m.name} ${m.hostname} ${m.os} ${(m.groups || []).join(' ')}`;
  const fb = filterBar('machines', redrawPage, { chips: [['online', t('online')], ['updates', tx('Has updates')]], sample: () => S.machines.map(machineText).slice(0, 200) });
  const list = S.machines.filter((m) => fb.test(machineText(m)) &&(!fb.st.flags.online || m.online) && (!fb.st.flags.updates || m.inventory?.outdated?.length));
  for (const id of [...msel]) if (!machine(id)) msel.delete(id);
  const picked = S.machines.filter((m) => msel.has(m.id)); const pick = (m, on) => { on ? msel.add(m.id) : msel.delete(m.id); S.rerender('sel'); };
  const removeMany = async () => { const can = picked.filter((m) => !m.local); const skipped = picked.length - can.length; if (!can.length) return toast(tx('This PC cannot be removed from its own hub. Nothing was removed.'), { kind: 'err' });
    if (!(await superConfirm({ title: tx('Remove {n} machines from the hub', { n: can.length }), detail: tx('The hub forgets these machines, their inventory and their agent tokens: {l}. Queued jobs for them are cancelled. Nothing is uninstalled on the machines themselves.', { l: can.map((m) => m.name).join(', ') }) + (skipped ? ' ' + tx('This PC is skipped because it cannot be removed from its own hub.') : '') }))) return;
    let ok = 0; const failed = []; for (const m of can) { try { await api('/api/machines/' + m.id, { method: 'DELETE' }); ok++; msel.delete(m.id); } catch (e) { failed.push(`${m.name}: ${e.message}`); } } toast(tx('Removed {a} of {b} machines.', { a: ok, b: can.length }) + (failed.length ? ' ' + failed.join('; ') : ''), { kind: failed.length ? 'err' : 'ok' }); };
  const setPolicy = async (readOnly) => { const can = picked.filter((m) => !m.local); let ok = 0; const failed = []; for (const m of can) { try { await api('/api/machines/' + m.id, { method: 'PATCH', body: { name: m.name, groups: m.groups || [], readOnly } }); ok++; } catch (e) { failed.push(`${m.name}: ${e.message}`); } } toast(tx('Changed {a} of {b} machines.', { a: ok, b: picked.length }) + (picked.length - can.length ? ' ' + tx('This PC was skipped: its policy is fixed.') : '') + (failed.length ? ' ' + failed.join('; ') : ''), { kind: failed.length ? 'err' : 'ok' }); };
  const mrow = (m) => [m.name, m.hostname || '', m.os || '', m.online ? 'online' : 'offline', m.lastSeen || '', m.inventory?.chocoVersion || '', m.inventory?.packages?.length ?? '', m.inventory?.outdated?.length ?? '', (m.groups || []).join(' '), m.readOnly ? 'yes' : 'no'];
  root.append(title('machines'), fb.el, h('div', { class: 'row top gap18' },
    h('div', { class: 'col', style: 'flex:2 1 520px' }, S.machines.length ? h('div', { class: 'row' }, h('span', { class: 'muted small grow' }, tx('{a} of {b} machines shown.', { a: list.length, b: S.machines.length })), exportBtn('material-choco-machines', ['Machine', 'Host name', 'System', 'State', 'Last seen', 'Chocolatey', 'Packages', 'Updates', 'Groups', 'Read only'], () => (picked.length ? picked : list).map(mrow), { label: picked.length ? tx('Export selected') : tx('Export this list') }), tip(tx('Select and export'), tx('Tick machines to act on several at once: refresh, upgrade, change the read only policy or remove them. Export writes the ticked machines, or every machine that matches the filter when none is ticked, as CSV, JSON or Markdown.'))) : null,
      bulkBar(picked.length, [btn(tx('Refresh inventory'), { kind: 'tonal', ic: 'refresh', onclick: () => refreshInv(picked) }), W(btn(t('upgrade_all'), { ic: 'upgrade', onclick: () => runJob(choco('upgrade', { args: ['all'] }), { machineIds: picked.map((m) => m.id) }) })), btn(tx('Act on these only'), { kind: 'tonal', ic: 'dns', title: tx('Sets the machine choice in the top bar to the ticked machines'), onclick: () => { S.scope = new Set(picked.map((m) => m.id)); msel.clear(); S.rerender('machine'); } }), A(btn(tx('Make read only'), { kind: 'tonal', ic: 'lock', onclick: () => setPolicy(true) })), A(btn(tx('Allow changes'), { kind: 'tonal', ic: 'lock_open', onclick: () => setPolicy(false) })), A(btn(tx('Remove from hub'), { kind: 'danger', ic: 'delete', onclick: removeMany }))], () => { msel.clear(); S.rerender('sel'); }, picked.filter((m) => !list.includes(m)).length),
      S.machines.length ? table([h('md-checkbox', { 'aria-label': tx('Select all shown'), checked: list.length > 0 && list.every((m) => msel.has(m.id)), indeterminate: list.some((m) => msel.has(m.id)) && !list.every((m) => msel.has(m.id)), onchange: (e) => { list.forEach((m) => (e.target.checked ? msel.add(m.id) : msel.delete(m.id))); S.rerender('sel'); } }), 'Machine', 'Status', 'Chocolatey', 'Packages', 'Updates', 'Groups', ''], list.map((m) => ({ sel: msel.has(m.id), menu: () => actions(m), cells: [h('md-checkbox', { checked: msel.has(m.id), 'aria-label': tx('Select {n}', { n: m.name }), onchange: (e) => pick(m, e.target.checked) }), h('div', { style: 'min-width:150px' }, h('b', {}, m.name), h('div', { class: 'mono small' }, [m.hostname, m.os].filter(Boolean).join(' · '))), h('div', { class: 'col gap6' }, statusBadge(m), m.elevated ? badge('Administrator', 'info') : badge('Not elevated', 'warn')), h('span', { class: 'mono' }, m.inventory?.chocoVersion || 'unknown'), m.inventory?.packages?.length ?? 'unknown', m.inventory?.outdated ? badge(String(m.inventory.outdated.length), m.inventory.outdated.length ? 'warn' : 'ok') : badge('unknown'), h('div', { class: 'row gap6' }, (m.groups || []).map((g) => badge(g)), m.readOnly && badge('Read only', 'info')), ibtn('more_vert', `Actions for ${m.name}`, (e) => menu(e.currentTarget, actions(m)))] })), { label: 'Machines' }) : emptyState('dns', t('no_machines'), 'Create a pairing code on the right, then enter it on the Windows machine.'),
      window.desktop ? desktopLink() : null),
    !canChange() ? h('div', { class: 'card s3 rise', style: 'flex:1 1 320px;--i:2', dataset: { noPairing: '1' } }, h('h2', { class: 'h2' }, t('pair_title')), h('p', {}, tx('Your role is Viewer. Pairing a machine needs the Operator or Admin role.'))) : h('div', { class: 'card pc rise', style: 'flex:1 1 320px;--i:2', dataset: { pairing: '1' } }, h('h2', { class: 'h2' }, t('pair_title')), h('p', {}, 'On the Windows machine, open Material Choco and choose Connect to a hub, or run the command below. No separate Chocolatey install is needed: the CLI is inside the app.'), h('div', { class: 'row nowrap' }, h('label', { class: 'row nowrap grow' }, ro, h('span', {}, 'Read only agent. It refuses install, upgrade and uninstall.')), tip(tx('Read only agent'), tx('Turn this on before creating the code for a machine that should only be watched. That agent reports its packages and updates and refuses every command that would change the machine. The refusal happens on the machine itself, so the hub cannot override it. It can be changed later from the row menu.'))), btn('New pairing code', { ic: 'add', onclick: () => newCode(ro.selected) }), pairHost)));
  fb.say(tx('{a} of {b} machines shown.', { a: list.length, b: S.machines.length }));
}
function desktopLink() {
  const host = h('div', { class: 'card rise' }, h('h2', { class: 'h2' }, 'Connect this PC to a hub'), skeleton(1));
  const draw = async () => { const s = await window.desktop.agent.status(); const url = h('md-outlined-text-field', { label: 'Hub address', value: s.hubUrl || 'https://', class: 'grow' }); const code = h('md-outlined-text-field', { label: 'Pairing code', placeholder: 'XXXX-XXXX' }); const insecure = h('md-checkbox', { 'aria-label': 'Allow plain HTTP on a trusted LAN' });
    host.replaceChildren(h('h2', { class: 'h2' }, 'Connect this PC to a hub'), s.connected ? frag(h('div', { class: 'row' }, h('span', { class: 'live ' + (s.state === 'online' ? '' : 'err') }), h('span', {}, `Enrolled with ${s.hubUrl}. Agent state: ${s.state}${s.lastError ? ' (' + s.lastError + ')' : ''}.`)), h('p', { class: 'muted' }, 'The hub can run choco on this PC. Local use keeps working without the hub.'), h('div', { class: 'row' }, btn('Open the hub', { kind: 'outlined', ic: 'open_in_new', onclick: () => window.desktop.openExternal(s.hubUrl) }), btn('Disconnect', { kind: 'text', ic: 'link_off', onclick: async () => { await window.desktop.agent.disconnect(); draw(); } })))
      : frag(h('p', { class: 'muted' }, 'Optional. A hub lets you manage this PC from a browser on another device. Get a pairing code from the Machines page of the hub.'), h('div', { class: 'row' }, url, code), h('label', { class: 'row nowrap' }, insecure, h('span', {}, 'Allow plain HTTP. Only for a hub on a LAN you trust.')), btn('Connect', { ic: 'link', onclick: async () => { const r = await window.desktop.agent.connect({ hubUrl: url.value, code: code.value, allowInsecure: insecure.checked }); if (r.error) toast(r.error, { kind: 'err' }); else { toast('Connected to the hub', { kind: 'ok' }); draw(); } } })));
    // The agent comes online a moment after enrolling; read its state again until it does, while the card is shown.
    if (s.connected && s.state !== 'online') setTimeout(() => { if (host.isConnected) draw(); }, 2000); };
  draw(); return host;
}

// ---- installed ---------------------------------------------------------------------------------
const sel = new Map(); // machineId -> Set(package)
const selOf = (id) => sel.get(id) || sel.set(id, new Set()).get(id);
const pkgConfig = (list) => '<?xml version="1.0" encoding="utf-8"?>\n<packages>\n' + list.map((p) => `  <package id="${p.name}" version="${p.version}" />`).join('\n') + '\n</packages>\n';
function pkgActions(m, p, out, pinned) {
  if (!canChange()) return [{ label: 'Package information', icon: 'info', run: () => infoSheet(m, p.name) }, { label: 'Copy package id', icon: 'content_copy', run: () => copy(p.name) }];
  return [out && { label: `${t('upgrade')} to ${out.available}`, icon: 'upgrade', run: () => runJob(choco('upgrade', { args: [p.name] }), { machineIds: [m.id] }) }, { label: 'Upgrade with options', icon: 'tune', run: () => runDialog('upgrade', { args: [p.name] }, { machines: [m] }) },
    pinned ? { label: t('unpin'), icon: 'keep_off', run: () => runJob(choco('pin', { subcommand: 'remove', options: { name: p.name } }), { machineIds: [m.id] }) } : { label: t('pin'), icon: 'keep', run: () => runJob(choco('pin', { subcommand: 'add', options: { name: p.name } }), { machineIds: [m.id] }) },
    { label: 'Package information', icon: 'info', run: () => infoSheet(m, p.name) }, { label: 'Reinstall with --force', icon: 'cached', run: () => runJob(choco('install', { args: [p.name], global: { force: true } }), { machineIds: [m.id] }) }, { label: 'Copy package id', icon: 'content_copy', run: () => copy(p.name) },
    { label: 'Uninstall with options', icon: 'tune', run: () => runDialog('uninstall', { args: [p.name] }, { machines: [m], destructive: true }) }, { label: t('uninstall'), icon: 'delete', danger: true, run: () => uninstall(m, [p.name]) }];
}
async function uninstall(m, names) { if (await superConfirm({ title: `Uninstall ${names.length === 1 ? lit(names[0]) : names.length + ' packages'} from ${lit(m.name)}`, detail: `This runs choco uninstall ${lit(names.join(' '))} and the package uninstall scripts. It cannot be undone from here.`, action: 'uninstall' })) { runJob(choco('uninstall', { args: names }), { machineIds: [m.id] }); selOf(m.id).clear(); S.rerender('sel'); } }
function infoSheet(m, name) { const host = h('div', {}); sheet(frag(h('h2', { class: 'h2' }, `${name} on ${m.name}`), host), { cls: 'wide', label: 'Package information' }); runShow(host, m, choco('info', { args: [name], global: { 'no-color': true } })); }
function installed(root) {
  const fb = filterBar('installed', redrawPage, { chips: [['outdated', t('outdated_only')], ['pinned', t('pinned')]], sample: () => [...new Set(scoped().flatMap((m) => (m.inventory?.packages || []).map((p) => p.name)))].slice(0, 200) }); let shownAll = 0; let totalAll = 0;
  // The packages of one machine that the filter keeps: the text, Outdated only and Pinned. The table
  // and Export list use the same test.
  const kept = (inv) => { const outd = new Set(inv.outdated.map((o) => o.name)); const pins = new Set(inv.pins.map((p) => p.name)); return inv.packages.filter((p) => fb.test(p.name) && (!fb.st.flags.outdated || outd.has(p.name)) && (!fb.st.flags.pinned || pins.has(p.name))); };
  root.append(title('installed'), fb.el, viewerNote() || '', perMachine((m, inv) => {
    const outd = new Map(inv.outdated.map((o) => [o.name, o])); const pins = new Set(inv.pins.map((p) => p.name)); const s = selOf(m.id);
    const list = kept(inv); shownAll += list.length; totalAll += inv.packages.length;
    const chosen = inv.packages.filter((p) => s.has(p.name)).map((p) => p.name); const hidden = chosen.filter((n) => !list.some((p) => p.name === n)).length;
    if (!inv.packages.length) return h('p', { class: 'muted' }, 'No packages are installed with Chocolatey on this machine.');
    return frag(chosen.length ? h('div', { class: 'bulk row' }, h('b', { class: 'grow' }, `${chosen.length} selected`), W(btn(t('upgrade'), { ic: 'upgrade', onclick: () => { runJob(choco('upgrade', { args: chosen }), { machineIds: [m.id] }); } })), W(btn(t('pin'), { kind: 'tonal', ic: 'keep', onclick: () => chosen.forEach((n) => runJob(choco('pin', { subcommand: 'add', options: { name: n } }), { machineIds: [m.id] })) })), btn('packages.config', { kind: 'tonal', ic: 'download', onclick: () => download('packages.config', pkgConfig(inv.packages.filter((p) => s.has(p.name))), 'application/xml') }), W(btn(t('uninstall'), { kind: 'danger', ic: 'delete', onclick: () => uninstall(m, chosen) })), btn('Clear', { kind: 'text', onclick: () => { s.clear(); S.rerender('sel'); } }), hiddenNote(hidden)) : null,
      table([h('md-checkbox', { 'aria-label': 'Select all shown', checked: list.length > 0 && list.every((p) => s.has(p.name)), onchange: (e) => { list.forEach((p) => (e.target.checked ? s.add(p.name) : s.delete(p.name))); S.rerender('sel'); } }), 'Package', 'Installed', 'Status', 'Pin', ''], list.map((p) => { const o = outd.get(p.name); return { sel: s.has(p.name), menu: () => pkgActions(m, p, o, pins.has(p.name)), cells: [h('md-checkbox', { checked: s.has(p.name), 'aria-label': `Select ${p.name}`, onchange: (e) => { e.target.checked ? s.add(p.name) : s.delete(p.name); S.rerender('sel'); } }), h('b', {}, p.name), h('span', { class: 'mono' }, p.version), o ? badge(`${o.available} available`, 'warn') : badge(t('current'), 'ok'), pins.has(p.name) ? badge(t('pinned'), 'info') : '', h('div', { class: 'row nowrap gap6' }, o && canChange() ? btn(t('upgrade'), { kind: 'text', onclick: () => runJob(choco('upgrade', { args: [p.name] }), { machineIds: [m.id] }) }) : null, ibtn('more_vert', `Actions for ${p.name}`, (e) => menu(e.currentTarget, pkgActions(m, p, o, pins.has(p.name)))))] }; }), { label: `Packages on ${m.name}` }),
      h('p', { class: 'muted small' }, tx('{a} of {b} packages shown.', { a: list.length, b: inv.packages.length })));
  }, { actions: (m, inv) => frag(exportBtn(`packages-${m.name}`, ['Package', 'Installed', 'Available', 'Pinned'], () => { const o = new Map(inv.outdated.map((x) => [x.name, x.available])); const pn = new Set(inv.pins.map((x) => x.name)); const s = selOf(m.id); return (s.size ? inv.packages.filter((p) => s.has(p.name)) : kept(inv)).map((p) => [p.name, p.version, o.get(p.name) || '', pn.has(p.name) ? 'yes' : 'no']); }, { label: tx('Export list') }), btn('Export all', { kind: 'text', ic: 'download', title: tx('Downloads a packages.config that choco install can read'), onclick: () => download(`packages-${m.name}.config`, pkgConfig(inv.packages), 'application/xml') }), W(btn('Import packages.config', { kind: 'text', ic: 'upload_file', onclick: () => importConfig(m) }))) }));
  fb.say(tx('{a} of {b} packages shown.', { a: shownAll, b: totalAll }));
}
function importConfig(m) { const input = h('input', { type: 'file', accept: '.config,.xml', onchange: async () => { const f = input.files[0]; if (!f) return; if (f.size > 512 * 1024) return toast('That file is larger than 512 KB.', { kind: 'err' }); const text = await f.text(); if (!/<packages[\s>]/.test(text)) return toast('That file is not a packages.config.', { kind: 'err' }); runJob({ ...choco('install'), file: { name: 'packages.config', content: text } }, { machineIds: [m.id] }); } }); input.click(); }

// ---- discover -------------------------------------------------------------------------------------
// The longest piece of plain text that every match of a regular expression must contain, or '' when
// there is none. A remote search cannot take a pattern, so a Regex search sends this text to the
// sources and keeps the results the whole pattern matches. Optional parts, alternatives, character
// classes and negative lookarounds are left out, so the text it returns is always safe to require.
export function requiredText(pattern) {
  const s = String(pattern || ''); let i = 0;
  // The quantifier after an atom, if any: -1 for none, 0 when the atom may be absent, 1 when it must appear.
  const quant = () => { let min = -1; const c = s[i];
    if (c === '?' || c === '*') { i++; min = 0; } else if (c === '+') { i++; min = 1; }
    else if (c === '{') { const m = /^\{(\d+)(?:,\d*)?\}/.exec(s.slice(i)); if (m) { i += m[0].length; min = Number(m[1]) > 0 ? 1 : 0; } }
    if (min !== -1 && s[i] === '?') i++; return min; };
  // Reads up to the ")" that closes the current group. alt is true when the group has alternatives,
  // in which case none of its text is required.
  const seq = () => { const runs = []; let run = ''; let alt = false; const end = () => { if (run) runs.push(run); run = ''; };
    while (i < s.length && s[i] !== ')') {
      const c = s[i];
      if (c === '|') { alt = true; end(); i++; continue; }
      if (c === '(') { end(); let skip = false;
        if (s.startsWith('(?:', i) || s.startsWith('(?=', i)) i += 3; else if (s.startsWith('(?!', i)) { i += 3; skip = true; } else if (s.startsWith('(?<=', i)) i += 4; else if (s.startsWith('(?<!', i)) { i += 4; skip = true; } else if (s.startsWith('(?<', i)) { const close = s.indexOf('>', i); i = close < 0 ? s.length : close + 1; } else i++;
        const inner = seq(); if (s[i] === ')') i++; const q = quant(); if (!skip && !inner.alt && q !== 0) runs.push(...inner.runs); continue; }
      if (c === '[') { end(); i++; if (s[i] === '^') i++; if (s[i] === ']') i++; while (i < s.length && s[i] !== ']') i += s[i] === '\\' ? 2 : 1; i++; quant(); continue; }
      if (c === '.' || c === '^' || c === '$') { end(); i++; quant(); continue; }
      if (c === '?' || c === '*' || c === '+') { end(); i++; continue; }
      let ch = c; i++;
      if (c === '\\') { const d = s[i]; i++; if (d === undefined) break;
        // A letter or digit after the backslash is a class, a boundary or a reference, not text.
        if (/[A-Za-z0-9]/.test(d)) { end(); if (d === 'x' && /^[0-9a-f]{2}/i.test(s.slice(i))) i += 2; else if (d === 'u' && /^[0-9a-f]{4}/i.test(s.slice(i))) i += 4; else if (d === 'c') i++; else if ('pPk'.includes(d) && (s[i] === '{' || s[i] === '<')) { const close = s.indexOf(s[i] === '{' ? '}' : '>', i); i = close < 0 ? s.length : close + 1; } quant(); continue; }
        ch = d; }
      const q = quant(); if (q === 0) end(); else { run += ch; if (q === 1) end(); }
    }
    end(); return { runs, alt };
  };
  const top = seq(); let best = ''; if (!top.alt) for (const r of top.runs) if (r.length > best.length) best = r; return best;
}
// The search state lives here, outside the page, because the page redraws on every job event while
// the search runs. draw always paints the page that is on screen now. failed keeps the error panel.
// rx: the search field holds a regular expression. raw: what the sources returned for the last
// search; results: the part of it that is shown (all of it, or the ids the pattern matches).
// word: the text a Regex search sent to the sources.
const D = { q: '', rx: false, asked: '', word: '', pre: false, exact: false, raw: null, results: null, busy: false, on: '', failed: null, draw: () => {}, clearFilter: () => {} };
// What the search field asks for: the text sent to the sources, or why nothing can be sent.
function searchPlan() {
  const q = D.q.trim(); if (!D.rx || !q) return { ok: !!q, send: q, error: '' };
  const m = matcher(q, true); if (!m.ok) return { ok: false, send: '', error: rxError(m) };
  const word = requiredText(q); if (word.length < 2) return { ok: false, send: '', error: tx('This pattern has no plain text of 2 or more characters to send to the sources. Add a word that every package id you want contains.') };
  return { ok: true, send: word, error: '', match: m };
}
function discover(root) {
  const src = firstOnline(); const out = h('div', { class: 'col' });
  // The results filter narrows what the remote search returned. It never runs a new search.
  const rText = ([name, version]) => `${name} ${version}`; const listHost = h('div', { class: 'col' }); const rCount = countLine();
  const rf = keptFilter('discover-results', () => drawResults(), { label: tx('Filter these results'), sample: () => (D.results || []).map(rText) });
  // A new search starts with an empty results filter, so a query typed for earlier results never hides new ones.
  D.clearFilter = () => { const kf = KF['discover-results']; if (kf) { kf.q = ''; kf.regex = false; } clearFilter(rf); };
  const drawResults = () => { const list = (D.results || []).filter((r) => rf.test(rText(r))); setCount(rCount, tx('{a} of {b} results shown.', { a: list.length, b: (D.results || []).length }));
    listHost.replaceChildren(list.length ? table(['Package', 'Latest version', ''], list.map(([name, version]) => ({ cells: [h('b', {}, name), h('span', { class: 'mono' }, version), h('div', { class: 'row nowrap gap6' }, W(btn(t('install'), { kind: 'tonal', ic: 'download', onclick: () => runJob(choco('install', { args: [name] })) })), W(btn('Options', { kind: 'text', ic: 'tune', onclick: () => runDialog('install', { args: [name] }, { heading: `Install ${name}` }) })), src && ibtn('info', `Information about ${name}`, () => infoSheet(src, name)))] })), { label: 'Search results' }) : h('p', { class: 'muted' }, tx('No result matches the filter.'))); };
  // After a Regex search: what was sent to the sources and how many of their results the pattern kept.
  const rxNote = () => tx('The sources were searched for "{w}". {a} of the {b} results they returned have a package id that matches the pattern.', { w: D.word, a: D.results.length, b: D.raw.length });
  const show = () => { if (D.busy) return out.replaceChildren(skeleton(5)); if (D.failed) return showAlertOnce(out, D.failed); if (!D.results) return out.replaceChildren(h('p', { class: 'muted' }, src ? `Searches run through ${src.name} against its enabled sources.` : 'Select or enroll an online machine to search its sources.'));
    if (!D.results.length) return out.replaceChildren(emptyState('search', t('no_results'), D.word ? rxNote() : `No package matched "${lit(D.asked)}" on the sources of ${lit(D.on)}.`));
    out.replaceChildren(h('div', { class: 'col gap6', dataset: { resultsFilter: '1' } }, rf.el, rCount), listHost, h('p', { class: 'muted small', style: WRAP }, `${t('results', { n: D.results.length })} from ${D.on}. Install runs on the machines selected in the top bar.`, D.word ? ' ' + rxNote() : '')); drawResults(); };
  D.draw = show;
  // The line under the search field: with Regex on, the text that will be sent, or why the pattern
  // cannot be used. It is drawn again on every change; a reason is spoken once after typing pauses.
  const hint = h('p', { class: 'small', style: WRAP, dataset: { searchHint: '1' } });
  const drawHint = (spoken) => { const plan = searchPlan(); hint.style.color = plan.error ? 'var(--err)' : '';
    hint.textContent = plan.error || (D.rx && plan.send ? tx('Regex is on: the sources are searched for "{w}", and a result is kept when its package id matches the pattern.', { w: plan.send }) : '');
    hint.hidden = !hint.textContent; if (spoken) sayLater(plan.error); };
  const go = async () => { if (!src) return; const plan = searchPlan(); if (!plan.ok) { if (plan.error) { drawHint(false); announce(plan.error); } return; }
    D.busy = true; D.failed = null; D.on = src.name; D.asked = D.q.trim(); D.word = D.rx ? plan.send : ''; D.clearFilter(); D.draw();
    const [job] = await runJob(choco('search', { args: [plan.send], options: { prerelease: D.pre, exact: D.exact }, global: { 'limit-output': true } }), { machineIds: [src.id], quiet: true }); if (!job) { D.busy = false; return D.draw(); }
    const done = await waitJob(job.id); D.busy = false;
    if (done.state !== 'succeeded') { D.raw = null; D.results = null; D.failed = errorPanel('Search failed', `choco search exited with code ${done.exitCode} on ${lit(src.name)}.`, done.output.slice(-1500), [btn('Open the full log', { kind: 'outlined', onclick: () => S.go('jobs', { job: done.id }) })]); D.draw(); return; }
    D.raw = rowsOf(done.output).filter((r) => r.length >= 2); D.results = plan.match ? D.raw.filter(([name]) => plan.match.test(name)) : D.raw; D.draw(); };
  const chip = (label, key) => h('md-filter-chip', { label, selected: D[key], onclick: (e) => setTimeout(() => { D[key] = e.target.selected; }) });
  // The search field has its own Regex switch and pattern builder. They change this field only.
  const field = h('md-outlined-text-field', { label: 'Search packages', value: D.q, type: 'search', style: 'flex:1 1 300px', oninput: (e) => { D.q = e.target.value; drawHint(true); }, dataset: { pal: 'discover-search', fpart: 'q' } }, h('span', { slot: 'leading-icon' }, icon('search')));
  const rxChip = h('md-filter-chip', { label: t('regex'), selected: D.rx, dataset: { fpart: 'rx' }, onclick: (e) => setTimeout(() => { D.rx = e.target.selected; drawHint(true); }) });
  const build = builderBtn(() => (D.raw || []).map(([name]) => name), (pat) => { D.q = pat; D.rx = true; field.value = pat; rxChip.selected = true; drawHint(true); field.focus(); }, tx('The preview uses the package ids from the last search.')); build.dataset.fpart = 'build';
  const form = h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); go(); } }, field, rxChip, build, chip('Prerelease', 'pre'), chip('Exact id', 'exact'), tip(tx('Search options'), tx('Prerelease also lists versions marked as previews. Exact id returns only the package whose id equals what you typed. The search runs choco search on the first online machine you have selected and uses the sources enabled there.')), btn('Search', { ic: 'search', onclick: go, disabled: !src }), W(btn('Install by id', { kind: 'outlined', ic: 'download', onclick: () => runDialog('install', { args: D.q && !D.rx ? [D.q] : [] }, { heading: 'Install packages' }) })));
  holdFocus(form, D); drawHint(false);
  root.append(title('discover'), form, hint, out); show();
}

// ---- updates ----------------------------------------------------------------------------------------
function updates(root) {
  const withUp = scoped().filter((m) => m.inventory?.outdated?.some((o) => !o.pinned));
  // One filter for the outdated packages on every machine card. The upgrade buttons still act on every update.
  const upText = (o) => `${o.name} ${o.version} ${o.available} ${o.pinned ? t('pinned') : ''}`;
  const fb = filterBar('updates', redrawPage, { placeholder: tx('Filter updates'), sample: () => scoped().flatMap((m) => (m.inventory?.outdated || []).map(upText)).slice(0, 200) });
  const keep = (o) => fb.test(upText(o)); let shownAll = 0; let totalAll = 0;
  root.append(title('updates'), fb.el, h('div', { class: 'row' }, W(btn(`${t('upgrade_all')} (${withUp.length})`, { ic: 'upgrade', disabled: !withUp.length, onclick: () => runJob(choco('upgrade', { args: ['all'] }), { machineIds: withUp.map((m) => m.id) }) })), btn('Check again', { kind: 'outlined', ic: 'refresh', onclick: () => refreshInv() }), W(btn('Upgrade all with options', { kind: 'text', ic: 'tune', onclick: () => runDialog('upgrade', { args: ['all'] }) })), exportBtn('material-choco-updates', ['Machine', 'Package', 'Installed', 'Available', 'Pinned'], () => scoped().flatMap((m) => (m.inventory?.outdated || []).filter(keep).map((o) => [m.name, o.name, o.version, o.available, o.pinned ? 'yes' : 'no'])), { label: tx('Export this list') }),
      tip(t('updates'), tx('Upgrade everything runs choco upgrade all on each selected machine that has an update. Pinned packages are skipped by the CLI. Check again asks every selected machine to re-read what is out of date. Export writes the table below for all selected machines.'))),
    perMachine((m, inv) => { if (!inv.outdated.length) return h('div', { class: 'row nowrap' }, icon('check_circle'), h('p', {}, t('all_current'))); const list = inv.outdated.filter(keep); shownAll += list.length; totalAll += inv.outdated.length;
      return frag(list.length ? table(['Package', 'Installed', 'Available', 'Pin', ''], list.map((o) => ({ menu: () => pkgActions(m, o, o, o.pinned), cells: [h('b', {}, o.name), h('span', { class: 'mono' }, o.version), h('span', { class: 'mono' }, o.available), o.pinned ? badge(t('pinned'), 'info') : '', !canChange() ? '' : o.pinned ? btn(t('unpin'), { kind: 'text', onclick: () => runJob(choco('pin', { subcommand: 'remove', options: { name: o.name } }), { machineIds: [m.id] }) }) : btn(t('upgrade'), { kind: 'text', ic: 'upgrade', onclick: () => runJob(choco('upgrade', { args: [o.name] }), { machineIds: [m.id] }) })] })), { label: `Updates for ${m.name}` }) : h('p', { class: 'muted' }, tx('No update matches the filter.')),
        h('p', { class: 'muted small' }, tx('{a} of {b} updates shown.', { a: list.length, b: inv.outdated.length }))); },
    { actions: (m, inv) => { const n = inv.outdated.filter((o) => !o.pinned).length; return n && canChange() ? btn(`${t('upgrade')} ${n}`, { kind: 'tonal', ic: 'upgrade', onclick: () => runJob(choco('upgrade', { args: ['all'] }), { machineIds: [m.id] }) }) : null; } }));
  fb.say(tx('{a} of {b} updates shown.', { a: shownAll, b: totalAll }));
}

// ---- sources, config, features, pins --------------------------------------------------------------------
function sources(root) {
  const srow = (m, s) => [m.name, s.name, s.url, s.priority, s.disabled ? 'no' : 'yes', s.user ? 'yes' : 'no'];
  // One filter for the sources on every machine card: name, location, priority, flags and state.
  const srcText = (s) => [s.name, s.url, s.priority, s.disabled ? 'disabled' : 'enabled', s.user && 'Authenticated', s.certificate && 'Certificate', s.bypassProxy && 'Bypass proxy', s.selfService && 'Self service', s.adminOnly && 'Admin only'].filter((x) => x || x === 0).join(' ');
  const fb = filterBar('sources', redrawPage, { placeholder: tx('Filter sources'), sample: () => scoped().flatMap((m) => (m.inventory?.sources || []).map(srcText)).slice(0, 200) });
  const keep = (s) => fb.test(srcText(s)); let shownAll = 0; let totalAll = 0;
  root.append(title('sources'), fb.el, h('div', { class: 'row' }, W(btn('Add source', { ic: 'add', onclick: () => runDialog('source', { subcommand: 'add', lockSub: true, noArgs: true }, { heading: 'Add or update a source' }) })), exportBtn('material-choco-sources', ['Machine', 'Source', 'Location', 'Priority', 'Enabled', 'Authenticated'], () => scoped().flatMap((m) => (m.inventory?.sources || []).filter(keep).map((s) => srow(m, s))), { label: tx('Export this list') }),
      tip(t('sources'), tx('A source is a feed that packages are found in. Add source opens every option of choco source add. Tick sources to enable, disable or remove several at once; each change runs as its own job on that machine. Passwords are never part of an export.'))),
    perMachine((m, inv) => { const ss = ssel.get(m.id) || ssel.set(m.id, new Set()).get(m.id); for (const n of [...ss]) if (!inv.sources.some((x) => x.name === n)) ss.delete(n); const chosen = inv.sources.filter((x) => ss.has(x.name)); const shownSrc = inv.sources.filter(keep); shownAll += shownSrc.length; totalAll += inv.sources.length;
      const many = (sub) => { const todo = chosen.filter((x) => (sub === 'enable' ? x.disabled : !x.disabled)); const skip = chosen.length - todo.length; todo.forEach((x) => runJob(choco('source', { subcommand: sub, options: { name: x.name } }), { machineIds: [m.id] })); if (skip) toast(tx('{n} skipped: already in that state.', { n: skip })); ss.clear(); S.rerender('sel'); };
      const removeMany = async () => { if (await superConfirm({ title: tx('Remove {n} sources from {m}', { n: chosen.length, m: m.name }), detail: tx('Packages can no longer be found in these sources on this machine until they are added again: {l}.', { l: chosen.map((x) => x.name).join(', ') }) })) { chosen.forEach((x) => runJob(choco('source', { subcommand: 'remove', options: { name: x.name } }), { machineIds: [m.id] })); ss.clear(); S.rerender('sel'); } };
      return frag(bulkBar(chosen.length, [W(btn(tx('Enable'), { kind: 'tonal', ic: 'check', onclick: () => many('enable') })), W(btn(tx('Disable'), { kind: 'tonal', ic: 'close', onclick: () => many('disable') })), exportBtn(`sources-${m.name}`, ['Machine', 'Source', 'Location', 'Priority', 'Enabled', 'Authenticated'], () => chosen.map((x) => srow(m, x)), { label: tx('Export selected'), kind: 'tonal' }), W(btn(t('remove'), { kind: 'danger', ic: 'delete', onclick: removeMany }))], () => { ss.clear(); S.rerender('sel'); }, chosen.filter((x) => !shownSrc.includes(x)).length),
      !inv.sources.length ? h('p', { class: 'muted' }, 'No sources are configured on this machine.') : !shownSrc.length ? h('p', { class: 'muted' }, tx('No sources match the filter.')) : table([h('md-checkbox', { 'aria-label': tx('Select all shown'), checked: shownSrc.every((x) => ss.has(x.name)), onchange: (e) => { shownSrc.forEach((x) => (e.target.checked ? ss.add(x.name) : ss.delete(x.name))); S.rerender('sel'); } }), 'Name', 'Location', 'Priority', 'Flags', 'Enabled', ''], shownSrc.map((s) => { const acts = () => [W({ label: 'Edit (re-add with the same name)', icon: 'edit', run: () => runDialog('source', { subcommand: 'add', lockSub: true, noArgs: true, options: { name: s.name, source: s.url, priority: String(s.priority || '') } }, { machines: [m], heading: `Edit source ${s.name}` }) }), { label: 'Copy location', icon: 'content_copy', run: () => copy(s.url) }, W({ label: t('remove'), icon: 'delete', danger: true, run: async () => { if (await superConfirm({ title: `Remove source ${lit(s.name)} from ${lit(m.name)}`, detail: `Packages can no longer be found at ${lit(s.url)} on this machine until the source is added again.` })) runJob(choco('source', { subcommand: 'remove', options: { name: s.name } }), { machineIds: [m.id] }); } })];
      return { sel: ss.has(s.name), menu: acts, cells: [h('md-checkbox', { checked: ss.has(s.name), 'aria-label': tx('Select {n}', { n: s.name }), onchange: (e) => { e.target.checked ? ss.add(s.name) : ss.delete(s.name); S.rerender('sel'); } }), h('b', {}, s.name), h('span', { class: 'mono' }, s.url), s.priority, h('div', { class: 'row gap6' }, s.user && badge('Authenticated', 'info'), s.certificate && badge('Certificate', 'info'), s.bypassProxy && badge('Bypass proxy'), s.selfService && badge('Self service'), s.adminOnly && badge('Admin only')), ((k, st) => h('md-switch', { selected: st.selected, disabled: st.disabled || !canChange(), 'aria-busy': String(st.disabled), 'aria-label': `Source ${s.name} enabled`, onchange: (e) => toggleJob(k, e.target.selected, choco('source', { subcommand: e.target.selected ? 'enable' : 'disable', options: { name: s.name } }), { machineIds: [m.id] }) }))(`${m.id}|source|${s.name}`, switchState(`${m.id}|source|${s.name}`, !s.disabled)), ibtn('more_vert', `Actions for ${s.name}`, (e) => menu(e.currentTarget, acts()))] }; }), { label: `Sources on ${m.name}` }),
      inv.sources.length ? h('p', { class: 'muted small' }, tx('{a} of {b} sources shown.', { a: shownSrc.length, b: inv.sources.length })) : null); }));
  fb.say(tx('{a} of {b} sources shown.', { a: shownAll, b: totalAll }));
}
const ssel = new Map(); // machineId -> Set(source name)
function config(root) {
  // The filter searches the name and the description of each setting and feature. The pattern
  // builder previews the same text, for every setting and feature of the selected machines.
  const cfgText = (c) => `${c.name} ${c.description || ''}`;
  let shownAll = 0; let totalAll = 0;
  const fb = filterBar('config', redrawPage, { placeholder: tx('Filter settings and features'), sample: () => [...new Set([...S.schema.configSettings, ...S.schema.features, ...scoped().flatMap((m) => [...(m.inventory?.config || []), ...(m.inventory?.features || [])])].map((c) => cfgText(c).trim()))].slice(0, 200) });
  root.append(title('config'), fb.el, h('div', { class: 'row' }, exportBtn('material-choco-config', ['Machine', 'Kind', 'Name', 'Value', 'Description'], () => scoped().flatMap((m) => [...(m.inventory?.config || []).filter((c) => fb.test(cfgText(c))).map((c) => [m.name, 'setting', c.name, S.schema.configSettings.find((x) => x.name === c.name)?.secret && c.value ? '(set, hidden)' : c.value, c.description]), ...(m.inventory?.features || []).filter((f) => fb.test(cfgText(f))).map((f) => [m.name, 'feature', f.name, f.enabled ? 'enabled' : 'disabled', f.description])]), { label: tx('Export this list') }), tip(t('config'), tx('Settings hold a value; features are on or off. Open a setting to read what it does, then Set or Unset it. A feature switch runs choco feature enable or disable on that machine at once. The export follows the filter and hides the value of secret settings.'))), perMachine((m, inv) => {
    const cv = new Map(inv.config.map((c) => [c.name, c])); const fv = new Map(inv.features.map((f) => [f.name, f]));
    // Settings and features the machine reports beyond the schema are listed too, and counted in the total.
    const allCfg = [...S.schema.configSettings, ...inv.config.filter((c) => !S.schema.configSettings.some((x) => x.name === c.name)).map((c) => ({ name: c.name, description: c.description, default: '' }))];
    const allFeats = [...S.schema.features, ...inv.features.filter((f) => !S.schema.features.some((x) => x.name === f.name)).map((f) => ({ name: f.name, description: f.description, default: null }))];
    const cfg = allCfg.filter((c) => fb.test(cfgText(c))); const feats = allFeats.filter((f) => fb.test(cfgText(f)));
    shownAll += cfg.length + feats.length; totalAll += allCfg.length + allFeats.length;
    // A column that the filter empties says so, and the line under both columns counts what is shown.
    const none = (list, all, text) => (!list.length && all.length ? h('p', { class: 'muted' }, text) : null);
    return frag(h('div', { class: 'row top gap18' }, h('div', { class: 'col', style: 'flex:1 1 420px' }, h('div', { class: 'row' }, h('h3', { class: 'h2', style: 'font-size:1.15rem' }, 'Config settings'), badge(`${cfg.length} of ${allCfg.length}`)), none(cfg, allCfg, tx('No setting matches the filter.')), cfg.map((c) => { const cur = cv.get(c.name); const val = cur?.value || ''; const input = h('md-outlined-text-field', { label: c.name, value: val, type: c.secret ? 'password' : 'text', placeholder: 'Not set', class: 'grow', 'supporting-text': val ? 'Set on this machine' : `Not set. CLI default: ${c.default === '' || c.default == null ? 'empty' : c.default}` });
        return h('details', { class: 'fold' }, h('summary', {}, icon('keyboard_arrow_down', 'sm'), h('span', { class: 'mono grow' }, c.name), val ? badge(c.secret ? 'set' : val.slice(0, 28), 'info') : badge('default')), h('div', { class: 'col', style: 'padding:6px 0 12px' }, h('p', { class: 'muted small' }, c.description || cur?.description || ''), h('div', { class: 'row' }, input, !canChange() ? null : btn('Set', { kind: 'tonal', onclick: () => (input.value ? runJob(choco('config', { subcommand: 'set', options: { name: c.name, value: input.value } }), { machineIds: [m.id] }) : toast('Enter a value, or use Unset.', { kind: 'err' })) }), !canChange() ? null : btn('Unset', { kind: 'text', onclick: async () => { if (await superConfirm({ title: `Unset ${lit(c.name)} on ${lit(m.name)}`, detail: 'The stored value is removed and the CLI default applies again.', action: 'unset' })) runJob(choco('config', { subcommand: 'unset', options: { name: c.name } }), { machineIds: [m.id] }); } })))); })),
      h('div', { class: 'col', style: 'flex:1 1 420px' }, h('div', { class: 'row' }, h('h3', { class: 'h2', style: 'font-size:1.15rem' }, 'Features'), badge(`${feats.length} of ${allFeats.length}`)), none(feats, allFeats, tx('No feature matches the filter.')), feats.map((f) => { const cur = fv.get(f.name); return h('label', { class: 'opt' }, ((k, st) => h('md-switch', { selected: st.selected, disabled: st.disabled || !cur || !canChange(), 'aria-busy': String(st.disabled), 'aria-label': f.name, onchange: (e) => toggleJob(k, e.target.selected, choco('feature', { subcommand: e.target.selected ? 'enable' : 'disable', options: { name: f.name } }), { machineIds: [m.id] }) }))(`${m.id}|feature|${f.name}`, switchState(`${m.id}|feature|${f.name}`, !!cur?.enabled)), h('span', { class: 'col gap0 grow' }, h('span', { class: 'mono' }, f.name), h('span', { class: 'muted small' }, f.description || cur?.description || ''), h('span', { class: 'small' }, cur ? `CLI default: ${f.default === null ? 'unknown' : f.default ? 'enabled' : 'disabled'}` : 'This CLI version does not report this feature.'))); }))),
    h('p', { class: 'muted small' }, tx('{a} of {b} settings and features shown.', { a: cfg.length + feats.length, b: allCfg.length + allFeats.length })));
  }));
  fb.say(tx('{a} of {b} settings and features shown.', { a: shownAll, b: totalAll }));
}
const PICK = new Map(); // machineId -> the package chosen in 'Package to pin'
function pins(root) {
  // One filter for the pinned packages on every machine card. The package picker of each card has a
  // filter of its own when it offers more than 6 packages.
  const pinText = (p) => `${p.name} ${p.version}`;
  const fb = filterBar('pins', redrawPage, { placeholder: tx('Filter pins'), sample: () => scoped().flatMap((m) => (m.inventory?.pins || []).map(pinText)).slice(0, 200) }); const keep = (p) => fb.test(pinText(p)); let shownAll = 0; let totalAll = 0;
  root.append(title('pins'), fb.el, h('div', { class: 'row' }, h('p', { class: 'muted grow' }, 'A pinned package is skipped by upgrades until it is unpinned.'), exportBtn('material-choco-pins', ['Machine', 'Package', 'Pinned version'], () => scoped().flatMap((m) => (m.inventory?.pins || []).filter(keep).map((p) => [m.name, p.name, p.version])), { label: tx('Export this list') })), perMachine((m, inv) => { const pinned = new Set(inv.pins.map((p) => p.name)); const list = inv.pins.filter(keep); shownAll += list.length; totalAll += inv.pins.length;
    const pickable = inv.packages.filter((p) => !pinned.has(p.name)); if (pinned.has(PICK.get(m.id))) PICK.delete(m.id);
    const mkSelect = (opts, value) => h('md-outlined-select', { label: 'Package to pin', style: 'flex:1 1 240px', onchange: (e) => { if (e.target.value) PICK.set(m.id, e.target.value); } }, opts.map((p) => h('md-select-option', { value: p.name, selected: p.name === value }, h('div', { slot: 'headline' }, pinText(p)))));
    // The select is made again with the matching packages on each change, keeping the choice when it
    // still matches. The choice is also kept in PICK, so a redraw of the page (after a change to the
    // page filter or on live data) does not lose it.
    let select = null; let pf = null; const pickCount = countLine();
    const drawPick = () => { const opts = pf ? pickable.filter((p) => pf.test(pinText(p))) : pickable; const next = mkSelect(opts, select?.value || PICK.get(m.id)); if (select?.parentNode) select.replaceWith(next); select = next;
      setCount(pickCount, pf?.st.q ? (opts.length ? tx('{a} of {b} packages shown.', { a: opts.length, b: pickable.length }) : tx('No package matches the filter.')) : ''); };
    if (canChange() && pickable.length > 6) pf = keptFilter('pins-pick-' + m.id, drawPick, { label: tx('Filter packages'), sample: () => pickable.map(pinText) });
    drawPick(); const pickFilter = pf && h('div', { class: 'col gap6', dataset: { pinPickFilter: '1' } }, pf.el, pickCount);
    return frag(!inv.pins.length ? h('p', { class: 'muted' }, 'Nothing is pinned on this machine.') : list.length ? table(['Package', 'Pinned version', ''], list.map((p) => ({ cells: [h('b', {}, p.name), h('span', { class: 'mono' }, p.version), W(btn(t('unpin'), { kind: 'text', ic: 'keep_off', onclick: () => runJob(choco('pin', { subcommand: 'remove', options: { name: p.name } }), { machineIds: [m.id] }) })) || ''] })), { label: `Pins on ${m.name}` }) : h('p', { class: 'muted' }, tx('No pin matches the filter.')), inv.pins.length ? h('p', { class: 'muted small' }, tx('{a} of {b} pins shown.', { a: list.length, b: inv.pins.length })) : null, !canChange() ? null : pickFilter, !canChange() ? null : h('div', { class: 'row' }, select, btn(t('pin'), { kind: 'tonal', ic: 'keep', onclick: () => (select.value ? runJob(choco('pin', { subcommand: 'add', options: { name: select.value } }), { machineIds: [m.id] }) : toast('Choose a package first.', { kind: 'err' })) }))); }));
  fb.say(tx('{a} of {b} pins shown.', { a: shownAll, b: totalAll }));
}

// ---- api keys, cache, templates, rules, licence, support --------------------------------------------------
// A reader card runs one read command on one machine and shows what it printed. The result is kept
// per card id while the app runs, because the page redraws on every job event and would otherwise
// lose it before it arrives. readerDraw holds the draw function of the card that is on screen now.
// A kept result names the machine it was read from and when, and says so when that machine is no
// longer in the machine choice of the top bar.
const RD = new Map(); const readerDraw = new Map();
function readerCard(id, heading, text, buttons, view = (output) => h('pre', { class: 'log' }, output || '(no output)')) {
  const out = h('div', { class: 'col', dataset: { reader: id } });
  const from = (r) => h('p', { class: 'muted small', style: WRAP, dataset: { readerFrom: r.machineId } }, tx('Read from {m} at {t}.', { m: r.machine, t: fmtTime(r.at) }), scoped().some((x) => x.id === r.machineId) ? '' : ' ' + tx('{m} is no longer in the machine choice in the top bar. Run the command again to read a selected machine.', { m: r.machine }));
  const draw = () => { const r = RD.get(id); if (r?.state === 'failed') return showAlertOnce(out, r.panel); out.replaceChildren(...(!r ? [] : r.state === 'busy' ? [skeleton(3)] : [from(r), view(r.output, r)])); };
  const run = async (m, spec) => { const redraw = () => readerDraw.get(id)?.(); RD.set(id, { state: 'busy', machine: m.name, machineId: m.id }); redraw();
    const [job] = await runJob(spec, { machineIds: [m.id], quiet: true }); if (!job) { RD.delete(id); return redraw(); }
    const done = await waitJob(job.id);
    // The error panel is made once and kept, so a redraw does not play its sound again.
    RD.set(id, done.state === 'succeeded' ? { state: 'done', machine: m.name, machineId: m.id, at: done.endedAt || new Date().toISOString(), output: done.output } : { state: 'failed', machine: m.name, machineId: m.id, panel: errorPanel(`${lit(done.command)} failed`, `Exit code ${done.exitCode} on ${lit(m.name)}. ${done.note || ''}`, done.output.slice(-2000), [btn('Open the full log', { kind: 'outlined', onclick: () => S.go('jobs', { job: done.id }) })]) }); redraw(); };
  readerDraw.set(id, draw); draw();
  return h('div', { class: 'card rise' }, h('h2', { class: 'h2' }, heading), h('p', { class: 'muted' }, text), h('div', { class: 'row' }, buttons(run)), out);
}
// Output shown as lines with a filter of its own: the cache, template and rule lists.
function lineList(id, output, label) {
  const lines = String(output || '').split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return h('pre', { class: 'log' }, '(no output)');
  const host = h('div', { class: 'col' }); const count = countLine();
  const f = keptFilter(id, () => draw(), { label, sample: () => lines });
  const draw = () => { const keepLines = lines.filter((l) => f.test(l)); setCount(count, tx('{a} of {b} lines shown.', { a: keepLines.length, b: lines.length })); host.replaceChildren(keepLines.length ? h('pre', { class: 'log' }, keepLines.join('\n')) : h('p', { class: 'muted' }, tx('No line matches the filter.'))); };
  draw(); return frag(h('div', { class: 'col gap6' }, f.el, count), host);
}
const needMachine = (fn) => () => { const m = firstOnline(); if (!m) return toast('Select or enroll an online machine first.', { kind: 'err' }); fn(m); };
function keyList(text, name) {
  const rows = rowsOf(text); if (!rows.length) return h('p', { class: 'muted' }, `No API keys are stored on ${name}.`);
  const host = h('div', { class: 'col' }); const count = countLine();
  const f = keptFilter('apikeys', () => draw(), { label: tx('Filter sources with a key'), sample: () => rows.map(([s]) => s) });
  const draw = () => { const list = rows.filter(([s]) => f.test(s)); setCount(count, tx('{a} of {b} keys shown.', { a: list.length, b: rows.length })); host.replaceChildren(list.length ? table(['Source', 'Key'], list.map(([s]) => ({ cells: [h('span', { class: 'mono' }, s), badge('stored, hidden', 'info')] }))) : h('p', { class: 'muted' }, tx('No key matches the filter.'))); };
  draw(); return frag(h('div', { class: 'col gap6' }, f.el, count), host);
}
function apikeys(root) {
  root.append(title('apikeys'), readerCard('apikeys', 'Stored API keys', 'Keys are stored encrypted by the CLI on each machine. The hub never shows or stores key values.', (run) => [btn('List keys', { kind: 'tonal', ic: 'key', onclick: needMachine((m) => run(m, choco('apikey', { subcommand: 'list', global: { 'limit-output': true } }))) }), W(btn('Add a key', { ic: 'add', onclick: () => runDialog('apikey', { subcommand: 'add', lockSub: true, noArgs: true }, { heading: 'Store an API key' }) })), W(btn('Remove a key', { kind: 'outlined', ic: 'delete', onclick: () => runDialog('apikey', { subcommand: 'remove', lockSub: true, noArgs: true }, { heading: 'Remove an API key', destructive: true }) }))], (output, r) => keyList(output, r.machine)));
}
function tools(root) {
  // filterLabel: the output is a list, shown as lines with a filter of its own. choco rule has no
  // subcommands; without an argument the CLI lists the rules.
  const reader =(id, heading, text, label, spec, extra = () => [], filterLabel) => readerCard(id, heading, text, (run) => [btn(label, { kind: 'tonal', ic: 'play_arrow', onclick: needMachine((m) => run(m, spec)) }), ...extra()], filterLabel ? (output) => lineList(id, output, filterLabel) : undefined);
  root.append(title('tools'), reader('tools-cache', 'HTTP cache', 'Cached source queries on the machine.', 'List cache', choco('cache', { subcommand: 'list' }), () => !canChange() ? [] : [btn('Remove expired', { kind: 'outlined', onclick: () => runJob(choco('cache', { subcommand: 'remove', options: { expired: true } })) }), btn('Remove all', { kind: 'outlined', ic: 'delete', onclick: async () => { if (await superConfirm({ title: 'Remove the HTTP cache', detail: 'All cached source queries are deleted on the selected machines. The next query downloads them again.' })) runJob(choco('cache', { subcommand: 'remove' })); } })], tx('Filter cached entries')),
    reader('tools-templates', 'Templates', 'Package templates installed on the machine, used by choco new.', 'List templates', choco('template', { subcommand: 'list' }), undefined, tx('Filter templates')), reader('tools-rules', 'Package rules', 'Validation rules the CLI applies when packing.', 'List rules', choco('rule'), undefined, tx('Filter rules')), reader('tools-licence', 'Licence', 'Licence information reported by the CLI.', 'Show licence', choco('license', { subcommand: 'info' })), reader('tools-support', 'Support', 'Support information reported by the CLI.', 'Show support', choco('support')));
}

// ---- package builder and console ----------------------------------------------------------------------------
function builder(root) {
  const TOOLS = [['new', 'New package from a template', 'Runs choco new. Set --output-directory to where the package folder should be created on the machine.', { argsLabel: 'Package name, then optional template values such as key=value' }], ['pack', 'Pack a nuspec into a nupkg', 'Runs choco pack on a .nuspec path on the machine.', { argsLabel: 'Path to the .nuspec file on the machine' }], ['push', 'Push a nupkg to a source', 'Runs choco push. The API key is never written to the job log.', { argsLabel: 'Path to the .nupkg file on the machine' }], ['export', 'Export installed packages', 'Runs choco export on the machine. Use Installed, Export all to download a packages.config in the browser instead.', { noArgs: true }]];
  // The page is a list of tool cards, each opening a form. The filter keeps the cards whose title,
  // description or command matches, and the cards with an option of their own that matches (the
  // same text the options filter of the form searches: flag, label, every accepted spelling and
  // description). Such a card lists the options its form will show when Open starts it filtered:
  // its own matching options, then the matching global options, which every form has.
  const toolText = ([name, heading, text]) => `${heading} ${text} choco ${name}`; const toolOpts = (name) => S.schema.commands.find((c) => c.name === name)?.options || [];
  const fb = filterBar('builder', redrawPage, { placeholder: tx('Filter tools and options'), sample: () => TOOLS.flatMap((tool) => [toolText(tool), ...toolOpts(tool[0]).map(optSearchText)]).slice(0, 200) });
  const globalHits = fb.st.q ? S.schema.globalOptions.filter((o) => fb.test(optSearchText(o))) : [];
  const cards = TOOLS.map(([name, heading, text, init]) => { const own = fb.st.q ? toolOpts(name).filter((o) => fb.test(optSearchText(o))) : []; return { name, heading, text, init, opts: own.length ? [...own, ...globalHits] : [], keep: !fb.st.q || fb.test(toolText([name, heading, text])) || own.length > 0 }; });
  const shownCards = cards.filter((c) => c.keep);
  const mk = ({ name, heading, text, init, opts }) => h('div', { class: 'card rise', dataset: { tool: name } }, h('div', { class: 'row' }, h('h2', { class: 'h2 grow' }, heading), W(btn('Open', { kind: 'tonal', ic: 'construction', onclick: () => runDialog(name, opts.length ? { ...init, filter: { q: fb.st.q, regex: fb.st.regex } } : init, { heading }) }))), h('p', { class: 'muted' }, text),
    opts.length ? h('p', { class: 'small', dataset: { matchedOptions: String(opts.length) } }, tx('Matching options ({n}): {l}', { n: opts.length, l: opts.slice(0, 8).map((o) => o.flag).join(', ') + (opts.length > 8 ? ', …' : '') })) : null);
  root.append(title('builder'), fb.el, viewerNote() || '', h('p', { class: 'muted' }, 'These commands work with files on the target machine. Paths you enter are paths on that machine.'),
    frag(shownCards.length ? shownCards.map(mk) : h('p', { class: 'muted' }, tx('No tool matches the filter.'))), h('p', { class: 'muted small' }, tx('{a} of {b} tools shown.', { a: shownCards.length, b: cards.length })));
  fb.say(shownCards.length ? tx('{a} of {b} tools shown.', { a: shownCards.length, b: cards.length }) : tx('No tool matches the filter.'));
}
const C = { cmd: 'list' };
function consolePage(root, params) {
  if (params?.cmd && S.schema.commands.some((c) => c.name === params.cmd)) C.cmd = params.cmd;
  const cmd = S.schema.commands.find((c) => c.name === C.cmd); const form = commandForm(C.cmd, { filterId: 'console-options-' + C.cmd }); const pick = machinePicker(undefined, { filterId: 'console-machines' });
  // The command list has its own filter: name, aliases, subcommands and summary. It only hides buttons.
  const cmdText = (c) => `${c.name} ${c.aliases.join(' ')} ${c.subcommands.join(' ')} ${c.summary || ''}`;
  const navBtns = S.schema.commands.map((c) => [c, h('button', { class: 'tab', 'aria-selected': String(c.name === C.cmd), dataset: { cmd: c.name }, onclick: () => { C.cmd = c.name; S.rerender('console'); } }, h('span', { class: 'mono' }, c.name), c.deprecated && badge('deprecated', 'warn'))]);
  const navCount = countLine();
  const nf = keptFilter('console-commands', () => drawNav(), { label: tx('Filter commands'), sample: () => S.schema.commands.map(cmdText) });
  const drawNav = () => { let n = 0; for (const [c, b] of navBtns) { const on = nf.test(cmdText(c)); showEl(b, on); if (on) n++; } setCount(navCount, nf.st.q ? (n ? tx('{a} of {b} commands shown.', { a: n, b: navBtns.length }) : tx('No command matches the filter.')) : ''); };
  drawNav();
  const pre = h('pre', { class: 'log cmd' }); const upd = () => { pre.textContent = preview(form.spec()); }; form.onChange(upd); upd();
  const run = async () => { const spec = form.spec(); if (refuseViewer(spec)) return; const cls = ['uninstall', 'unpackself'].includes(spec.command) || ['remove', 'unset'].includes(spec.subcommand); if (cls && !(await superConfirm({ title: `Run choco ${spec.command} ${spec.subcommand || ''}`, detail: `${lit(preview(spec))} on ${pick.ids().length} machine(s).`, action: spec.command }))) return; const jobs = await runJob(spec, { machineIds: pick.ids() }); if (jobs.length) S.go('jobs', { job: jobs[0].id }); };
  root.append(title('console', `${S.schema.commands.length} commands, ${S.schema.commands.reduce((n, c) => n + c.options.length, 0)} options, read from the CLI source`), h('div', { class: 'row top gap18' },
    h('nav', { class: 'card cmdlist', style: 'flex:1 1 200px;padding:12px;gap:2px', 'aria-label': 'Commands' }, h('div', { class: 'col gap6', style: 'padding-bottom:8px', dataset: { cmdFilter: '1' } }, nf.el, navCount), navBtns.map(([, b]) => b)),
    h('div', { class: 'col gap18', style: 'flex:999 1 480px' }, h('div', { class: 'card rise' }, h('div', { class: 'row' }, h('h2', { class: 'h2' }, `choco ${cmd.name}`), badge(`${cmd.options.length} options`), cmd.subcommands.length ? badge(`${cmd.subcommands.length} subcommands`) : null, cmd.since && badge(`since ${cmd.since}`, 'info'), cmd.aliases.length ? badge('alias: ' + cmd.aliases.join(', ')) : null), h('p', { class: 'muted' }, cmd.summary), form.el, cmd.help ? h('details', { class: 'fold' }, h('summary', {}, icon('keyboard_arrow_down', 'sm'), 'Help text from the CLI source'), h('pre', { class: 'log', style: 'background:var(--s3);color:var(--on)' }, cmd.help)) : null),
      h('div', { class: 'card rise', style: '--i:1' }, h('h2', { class: 'h2' }, t('command_preview')), pre, h('div', { class: 'row nowrap' }, h('h3', { class: 'h2 grow', style: 'font-size:1.05rem' }, t('run_on')), tip(t('run_on'), tx('The command runs once on every ticked machine. An offline machine keeps the job in its queue for up to 7 days. The button in the corner of the preview copies the command, Schedule opens a new schedule with this command, and Run starts it now. Uninstall, remove and unset ask for the two key confirmation first.'))), pick.el, h('div', { class: 'row' }, W(btn('Schedule', { kind: 'outlined', ic: 'calendar_month', onclick: () => S.go('schedules', { spec: form.spec() }) })), h('span', { class: 'grow' }), btn(t('run'), { ic: 'play_arrow', onclick: run })), viewerNote()))));
}

export const PAGES = [
  { id: 'overview', icon: 'home', render: overview }, { id: 'machines', icon: 'dns', render: machines }, { id: 'installed', icon: 'inventory_2', render: installed }, { id: 'discover', icon: 'search', render: discover }, { id: 'updates', icon: 'upgrade', render: updates },
  { id: 'sources', icon: 'database', render: sources }, { id: 'config', icon: 'tune', render: config }, { id: 'pins', icon: 'keep', render: pins }, { id: 'apikeys', icon: 'key', render: apikeys }, { id: 'tools', icon: 'cached', render: tools }, { id: 'builder', icon: 'construction', render: builder }, { id: 'console', icon: 'terminal', render: consolePage },
];
