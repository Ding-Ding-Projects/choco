// Jobs, schedules, history, help and settings.
import { h, frag, icon, btn, ibtn, badge, fmtTime, ago, download, copy, toast, sheet, superConfirm, skeleton, errorPanel, emptyState, celebrate, sound, levelUp, alertSheet, tip, exportBtn, miniFilter, matcher, rxError, announce, lit } from './ui.js';
import { S, api, machine, scoped, runJob, TERMINAL, canChange, role } from './state.js';
import { passkeyBlock, roleName } from './admin.js';
import { settings, DEFAULTS, isDefault, resetSetting, resetAll, exportSettings, importSettings, SCHEDULABLE, eff, timedOverride, inWindow, minutesOf, validRule, activeRules } from './settings.js';
import { KEYS } from './keys.js';
import { t, t2, tx, setVocabulary, hasVocabulary } from './i18n.js';
import { title, filterBar, keptFilter, table, stateBadge, preview, bulkBar } from './pages.js';
import { b64encode } from './tools.js';

// ---- jobs ------------------------------------------------------------------------------------
// all: the S.jobs list after every job the hub keeps was loaded into it. The app loads the newest 300
// jobs at start, and loads them again after a reconnect, which makes S.jobs a new list.
const J = { sel: null, out: new Map(), listener: null, picked: new Set(), all: null, loading: false, refocus: false };
const HUB_JOBS = 2000; // the hub keeps the newest 2000 jobs (hub/server.js)
// Loads every job the hub keeps and adds the ones this browser does not have. Jobs it already has
// keep their entry, which the event stream has kept up to date.
async function loadEveryJob() {
  if (J.loading) return; J.loading = true; S.rerender('filter');
  try {
    const fresh = await api('/api/jobs?limit=' + HUB_JOBS); const known = new Set(S.jobs.map((j) => j.id));
    const merged = [...S.jobs, ...fresh.filter((j) => !known.has(j.id))].sort((a, b) => b.id - a.id);
    S.jobs = merged; J.all = merged; announce(tx('Loaded every job the hub keeps: {n} jobs.', { n: merged.length }));
  } catch (e) { toast(e.message, { kind: 'err' }); } finally { J.loading = false; J.refocus = location.hash === '#jobs'; S.rerender('filter'); }
}
// The second line of a job row, and the text the filter looks at: exactly what the row shows, so
// the filter and the pattern builder's preview, which uses the same text, find the same rows.
const jobMeta = (j) => [`#${j.id}`, machine(j.machineId)?.name || 'removed', j.by, ago(j.createdAt)].filter(Boolean).join(' · ');
const jobText = (j) => squash(`${j.command} ${jobMeta(j)} ${stateBadge(j).textContent}`);
// A polite announcement of a count after typing pauses, for counts that are not live regions.
let sayTimer = null;
const sayLater = (text) => { clearTimeout(sayTimer); if (text) sayTimer = setTimeout(() => announce(text), 250); };
function jobs(root, params) {
  if (params?.job) J.sel = Number(params.job);
  const fb = filterBar('jobs', () => S.rerender('filter'), { chips: [['active', 'Active'], ['failed', t('failed')], ['hideinv', 'Hide inventory reads']], sample: () => S.jobs.slice(0, 200).map(jobText) });
  // matched holds every loaded job that matches the filter; the list shows the newest 150 of them.
  // The count and Export use every match, so neither leaves out a match the list has no room for.
  const matched = S.jobs.filter((j) => (!fb.st.flags.active || !TERMINAL.includes(j.state)) && (!fb.st.flags.failed || j.state === 'failed') && (!fb.st.flags.hideinv || j.kind !== 'inventory') && (!fb.st.q || fb.test(jobText(j))));
  const list = matched.slice(0, 150);
  // The filter can only look at the jobs in this browser. When older jobs may be on the hub only,
  // the count says so and a button loads them, so "no match" is never said about jobs not looked at.
  const partial = J.all !== S.jobs && S.jobs.length >= 300; // state.js loads ?limit=300
  const scope = partial ? tx('The filter looks at the {n} jobs loaded in this browser. The hub keeps up to 2000, so older jobs may not be loaded.', { n: S.jobs.length }) : '';
  const filtering = !!fb.st.q || Object.values(fb.st.flags).some(Boolean);
  const counted = matched.length > list.length ? tx('{a} of {b} jobs match. The list shows the newest {c}.', { a: matched.length, b: S.jobs.length, c: list.length }) : tx('{a} of {b} jobs shown.', { a: list.length, b: S.jobs.length });
  fb.say(counted + (partial ? ' ' + scope : ''));
  if (J.refocus) { J.refocus = false; setTimeout(() => (fb.el.open ? fb.el.querySelector('md-outlined-text-field') : fb.el.querySelector('summary'))?.focus()); }
  if (J.sel === null && list.length) J.sel = list[0].id;
  const job = S.jobs.find((j) => j.id === J.sel); const detail = h('div', { class: 'col', style: 'flex:2 1 460px' });
  if (J.listener) document.removeEventListener('mc-output', J.listener);
  if (job) {
    const m = machine(job.machineId); const pre = h('pre', { class: 'log', tabindex: '0', 'aria-label': 'Job output' }, J.out.get(job.id) ?? '');
    // The output has its own search, which keeps only the matching lines. Copy output and Export
    // log always use the whole output; the copy button on the block copies what it shows.
    let state = job.state; let later = null; const full = () => J.out.get(job.id) ?? '';
    const lines = () => full().split(/\r?\n/).filter((l, i, a) => l || i < a.length - 1);
    // Not a live region: new output changes the count while a search is active. A change made by
    // the user is spoken once instead; the filter row itself speaks why a pattern cannot be used.
    const outCount = h('p', { class: 'muted small', hidden: true, dataset: { outCount: '1' } });
    const showOut = () => {
      clearTimeout(later); later = null;
      if (!of.st.q) { outCount.hidden = true; outCount.textContent = ''; pre.textContent = full() || (TERMINAL.includes(state) ? '(no output)' : ''); pre.scrollTop = pre.scrollHeight; return; }
      const mt = matcher(of.st.q, of.st.regex); const all = lines(); const hits = mt.ok ? all.filter((l) => mt.test(l)) : [];
      pre.textContent = hits.join('\n'); pre.scrollTop = 0; outCount.hidden = false;
      outCount.textContent = !mt.ok ? tx('The pattern cannot be used, so no line is shown.') : hits.length ? tx('{a} of {b} output lines match.', { a: hits.length, b: all.length }) : tx('No output line matches the filter.');
    };
    const of = keptFilter('job-output', () => { showOut(); sayLater(of.st.q && matcher(of.st.q, of.st.regex).ok ? outCount.textContent : ''); }, { label: tx('Filter the output'), sample: () => lines().filter((l) => l.trim()).slice(-200) });
    of.el.dataset.outFilter = '1';
    const load = () => api('/api/jobs/' + job.id).then((d) => { J.out.set(job.id, d.output); state = d.state; showOut(); if (d.files?.length) files.replaceChildren(d.files.map((f) => btn(`Download ${f.name}`, { kind: 'tonal', ic: 'download', onclick: () => download(f.name, f.content) }))); }).catch(() => {});
    const files = h('div', { class: 'row' }); if (of.st.q) showOut(); load();
    // New output is appended while no search is active; with one, the shown lines are worked out again.
    J.listener = (e) => { if (e.detail.id !== job.id) return; J.out.set(job.id, full() + e.detail.chunk); if (of.st.q) { later ??= setTimeout(showOut, 150); return; } pre.append(e.detail.chunk); pre.scrollTop = pre.scrollHeight; }; document.addEventListener('mc-output', J.listener);
    const elapsed = job.startedAt ? Math.round(((job.endedAt ? Date.parse(job.endedAt) : Date.now()) - Date.parse(job.startedAt)) / 1000) : null;
    let panel = null;
    if (job.state === 'failed') panel = errorPanel(`${job.kind === 'inventory' ? 'Inventory read' : 'Command'} failed on ${lit(m?.name || 'a removed machine')}`, `Exit code ${job.exitCode}. ${job.note || 'The output below shows what the CLI reported.'}`, null, [btn('Run again', { kind: 'danger', ic: 'refresh', onclick: () => rerun(job) }), btn('Copy output', { kind: 'outlined', ic: 'content_copy', onclick: () => copy(full() || pre.textContent) }), m && btn('Refresh inventory', { kind: 'text', onclick: () => runJob({ kind: 'inventory' }, { machineIds: [m.id], quiet: true }) })]);
    else if (job.state === 'succeeded' && job.kind === 'choco') { panel = h('section', { class: 'okpanel' }, h('span', { class: 'blob ok big' }, h('span', { class: 'tick', html: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' })), h('span', { class: 'h2', style: 'font-size:1.9rem' }, 'Finished with exit code 0'), h('p', {}, `${m?.name || ''} took ${elapsed ?? 0} s. Ended ${fmtTime(job.endedAt)}.`)); if (Date.now() - Date.parse(job.endedAt) < 8000) celebrate(panel); }
    else if (job.state === 'running') panel = h('div', { class: 'card' }, h('div', { class: 'row nowrap' }, h('span', { class: 'live' }), h('span', { class: 'grow' }, `Running on ${m?.name || ''}${settings.timeAware && elapsed !== null ? `, ${elapsed} s so far` : ''}`), canChange() && btn(t('cancel'), { kind: 'outlined', ic: 'stop', onclick: () => api(`/api/jobs/${job.id}/cancel`, { method: 'POST' }).catch((e) => toast(e.message, { kind: 'err' })) })), h('div', { class: 'wave' }));
    else if (job.state === 'queued') panel = h('div', { class: 'card s3' }, h('div', { class: 'row nowrap' }, h('span', { class: 'live off' }), h('span', { class: 'grow' }, m?.online ? 'Waiting for the agent to pick this up.' : `${m?.name || 'The machine'} is offline. This job waits up to 7 days, then expires.`), canChange() && btn(t('cancel'), { kind: 'outlined', onclick: () => api(`/api/jobs/${job.id}/cancel`, { method: 'POST' }).catch((e) => toast(e.message, { kind: 'err' })) })));
    detail.append(h('div', { class: 'row' }, h('h2', { class: 'h2 grow' }, `Job ${job.id}`), stateBadge(job), badge(m?.name || 'removed machine'), job.destructive && badge('destructive', 'err')), h('pre', { class: 'log cmd' }, job.command), h('p', { class: 'muted small' }, `Requested ${fmtTime(job.createdAt)} by ${job.by}${job.startedAt ? '. Started ' + fmtTime(job.startedAt) : ''}${job.endedAt ? '. Ended ' + fmtTime(job.endedAt) : ''}`), panel, of.el, outCount, pre, files,
      h('div', { class: 'row' }, btn('Export log', { kind: 'text', ic: 'download', onclick: () => download(`job-${job.id}.log`, `${job.command}\n${job.state} exit=${job.exitCode}\n\n${full() || pre.textContent}`) }), job.kind === 'choco' && TERMINAL.includes(job.state) && btn('Run again', { kind: 'text', ic: 'refresh', onclick: () => rerun(job) })));
  }
  for (const id of [...J.picked]) if (!S.jobs.some((j) => j.id === id)) J.picked.delete(id);
  const picked = S.jobs.filter((j) => J.picked.has(j.id)); const jrow = (j) => [j.id, j.command, machine(j.machineId)?.name || 'removed', j.state, j.exitCode ?? '', j.by, j.createdAt || '', j.startedAt || '', j.endedAt || ''];
  const cancelMany = async () => { const can = picked.filter((j) => !TERMINAL.includes(j.state)); let ok = 0; const failed = []; for (const j of can) { try { await api(`/api/jobs/${j.id}/cancel`, { method: 'POST' }); ok++; } catch (e) { failed.push(`#${j.id}: ${e.message}`); } } toast(tx('Asked to cancel {a} job(s). {b} skipped because they had already ended.', { a: ok, b: picked.length - can.length }) + (failed.length ? ' ' + failed.join('; ') : ''), { kind: failed.length ? 'err' : '' }); J.picked.clear(); S.rerender('sel'); };
  const logsMany = async () => { const parts = []; const failed = []; for (const j of picked) { try { const d = await api('/api/jobs/' + j.id); parts.push(`===== job ${j.id} | ${machine(j.machineId)?.name || 'removed machine'} | ${j.state} exit=${j.exitCode ?? ''} =====\n${j.command}\n\n${d.output || '(no output)'}\n`); } catch (e) { failed.push(`#${j.id}: ${e.message}`); } } if (parts.length) download('material-choco-job-logs.log', parts.join('\n')); toast(tx('Saved the logs of {a} of {b} jobs in one file.', { a: parts.length, b: picked.length }) + (failed.length ? ' ' + failed.join('; ') : ''), { kind: failed.length ? 'err' : 'ok' }); };
  root.append(frag(title('jobs'), fb.el, S.jobs.length ? h('div', { class: 'row' }, h('span', { class: 'muted small grow', dataset: { jobsCount: '1' } }, counted, partial && ' ' + scope), partial && btn(J.loading ? tx('Loading jobs') : tx('Load every job the hub keeps'), { kind: 'text', ic: 'history', disabled: J.loading, onclick: loadEveryJob }), btn(tx('Select all shown'), { kind: 'text', ic: 'select_all', onclick: () => { list.forEach((j) => J.picked.add(j.id)); S.rerender('sel'); } }), exportBtn('material-choco-jobs', ['Id', 'Command', 'Machine', 'State', 'Exit code', 'Requested by', 'Created', 'Started', 'Ended'], () => (picked.length ? picked : matched).map(jrow), { label: picked.length ? tx('Export selected') : tx('Export this list') }), tip(tx('Select and export'), tx('Tick jobs to cancel several at once or to save their logs in one file. Jobs that have already ended cannot be cancelled and are counted as skipped. Export writes the ticked jobs, or the jobs that match the filter when none is ticked. The list shows the newest 150 matches.'))) : null,
    bulkBar(picked.length, [canChange() && btn(tx('Cancel selected'), { kind: 'tonal', ic: 'stop', onclick: cancelMany }), btn(tx('Save logs'), { kind: 'tonal', ic: 'download', onclick: logsMany })], () => { J.picked.clear(); S.rerender('sel'); }),
    S.jobs.length ? h('div', { class: 'row top gap18' }, h('div', { class: 'card', style: 'flex:1 1 320px;padding:10px;gap:2px;max-height:75vh;overflow:auto' }, list.map((j) => h('div', { class: 'row nowrap gap6' }, h('md-checkbox', { checked: J.picked.has(j.id), 'aria-label': tx('Select job {n}', { n: j.id }), onchange: (e) => { e.target.checked ? J.picked.add(j.id) : J.picked.delete(j.id); S.rerender('sel'); } }), h('button', { class: 'prow', 'aria-selected': String(j.id === J.sel), onclick: () => { J.sel = j.id; S.rerender('job-select'); } }, h('span', { class: 'col gap0 grow' }, h('span', { class: 'mono' }, j.command), h('span', { class: 'muted small' }, jobMeta(j))), stateBadge(j)))), !list.length && h('p', { class: 'muted', style: 'padding:12px' }, !matcher(fb.st.q, fb.st.regex).ok ? tx('The pattern cannot be used, so no job is shown.') : filtering ? tx('No loaded job matches the filter.') + (partial ? ' ' + tx('Older jobs are not loaded yet.') : '') : t('no_results'))), detail)
    : emptyState('list_alt', 'No jobs yet', 'Every command you run appears here with its full output.', btn('Open the console', { ic: 'terminal', onclick: () => S.go('console') }))));
}
async function rerun(job) { toast('The original options are not stored in the list view. Opening the console for this command.'); S.go('console', { cmd: job.command.split(' ')[1] }); }

// filterBar draws its search field, its chips and the count of active filters once. Pages that redraw
// the whole page on every change get them right for free; Schedules and History redraw only their
// list, so after every change this brings the row in line with the filter. The pattern builder sets
// the query and Regex directly, so without this its pattern would be in force but not visible.
function syncBar(fb, chips = []) {
  const field = fb.el.querySelector('md-outlined-text-field'); if (field && field.value !== fb.st.q) field.value = fb.st.q;
  const cs = fb.el.querySelectorAll('md-filter-chip'); // the Regex chip first, then the page's own chips in order
  if (cs[0] && cs[0].selected !== fb.st.regex) cs[0].selected = fb.st.regex;
  chips.forEach(([key], i) => { const c = cs[i + 1]; if (c && c.selected !== !!fb.st.flags[key]) c.selected = !!fb.st.flags[key]; });
  const sum = fb.el.querySelector('summary'); const n = (fb.st.q ? 1 : 0) + Object.values(fb.st.flags).filter(Boolean).length;
  sum?.querySelector('.badge')?.remove(); if (sum && n) sum.append(badge(tx('{n} active', { n }), 'info'));
}
// Names the Regex switch and the pattern builder button of a miniFilter row after the search they
// belong to, in the form keptFilter in pages.js uses ("Regex: Filter the rules"). A screen with two
// searches, such as the settings search above the timed rules filter, then never offers two controls
// with the same name. The switch still shows "Regex", which starts its name.
function nameRx(el, label) {
  const chip = el.querySelector('md-filter-chip'); if (chip) chip.setAttribute('aria-label', `${t('regex')}: ${label}`);
  const b = el.querySelector('[data-rxopen]'); if (b) b.setAttribute('aria-label', `${tx('Build a pattern from parts')}: ${label}`);
}

// ---- schedules ---------------------------------------------------------------------------------
const PRESETS = [['Upgrade all packages', { kind: 'choco', command: 'upgrade', args: ['all'] }], ['Refresh inventory (finds new updates)', { kind: 'inventory' }]];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function schedules(root, params) {
  const host = h('div', { class: 'col' }, skeleton(2)); const custom = params?.spec || null;
  const groups = [...new Set(S.machines.flatMap((m) => m.groups || []))];
  const create = () => { const name = h('md-outlined-text-field', { label: 'Name', value: custom ? preview(custom).slice(0, 50) : 'Nightly upgrade' }); const time = h('md-outlined-text-field', { label: 'Time of day', type: 'time', value: '03:00', 'supporting-text': `Hub time zone: ${S.status.timezone}. Follows the hub clock, including daylight saving changes.` }); const days = new Set();
    const what = h('md-outlined-select', { label: 'What to run', value: custom ? 'custom' : '0' }, custom && h('md-select-option', { value: 'custom', selected: true }, h('div', { slot: 'headline' }, preview(custom))), PRESETS.map(([l], i) => h('md-select-option', { value: String(i), selected: !custom && i === 0 }, h('div', { slot: 'headline' }, l))));
    const target = h('md-outlined-select', { label: 'Where', value: 'all' }, h('md-select-option', { value: 'all', selected: true }, h('div', { slot: 'headline' }, 'All machines, including ones enrolled later')), h('md-select-option', { value: 'scope' }, h('div', { slot: 'headline' }, `The ${scoped().length} machine(s) selected now`)), groups.map((g) => h('md-select-option', { value: 'g:' + g }, h('div', { slot: 'headline' }, 'Group: ' + g))));
    const close = sheet(frag(h('h2', { class: 'h2' }, 'New schedule'), name, what, target, time, h('div', { class: 'col gap6' }, h('span', { class: 'muted small' }, 'Days. None selected means every day.'), h('div', { class: 'row gap6' }, DAYS.map((d, i) => h('md-filter-chip', { label: d, onclick: (e) => setTimeout(() => (e.target.selected ? days.add(i) : days.delete(i))) })))),
      h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn(t('save'), { ic: 'save', onclick: async () => { const spec = what.value === 'custom' ? custom : PRESETS[Number(what.value)][1]; const full = spec.kind === 'choco' ? { ...spec, global: { ...settings.defaultGlobal, ...spec.global } } : spec; const tv = target.value; try { await api('/api/schedules', { method: 'POST', body: { name: name.value, time: time.value, days: [...days], spec: full, target: tv === 'all' ? { all: true } : tv === 'scope' ? { machineIds: scoped().map((m) => m.id) } : { group: tv.slice(2) } } }); close(); toast('Schedule saved', { kind: 'ok' }); S.rerender('schedule'); } catch (e) { toast(e.message, { kind: 'err' }); } } }))), { label: 'New schedule' }); };
  const editSchedule = (s) => { const name = h('md-outlined-text-field', { label: 'Name', value: s.name, dataset: { sched: 'name' } }); const time = h('md-outlined-text-field', { label: 'Time of day', type: 'time', value: s.time, 'supporting-text': `Hub time zone: ${S.status.timezone}.` }); const days = new Set(s.days || []);
    const close = sheet(frag(h('h2', { class: 'h2' }, tx('Edit the schedule {n}', { n: s.name })), name, time, h('div', { class: 'col gap6' }, h('span', { class: 'muted small' }, 'Days. None selected means every day.'), h('div', { class: 'row gap6' }, DAYS.map((d, i) => h('md-filter-chip', { label: d, selected: days.has(i), onclick: (e) => setTimeout(() => (e.target.selected ? days.add(i) : days.delete(i))) })))),
      h('p', { class: 'muted small' }, tx('The command stays as it is: {c}. Secret values are shown as ******** and are kept unchanged. To run a different command, delete this schedule and make a new one from the Console.', { c: s.spec.kind === 'inventory' ? 'inventory refresh' : preview(s.spec) })),
      h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn(t('save'), { ic: 'save', onclick: async () => { try { await api('/api/schedules/' + s.id, { method: 'PATCH', body: { name: name.value, time: time.value, days: [...days] } }); close(); toast('Schedule saved', { kind: 'ok' }); S.rerender('schedule'); } catch (e) { toast(e.message, { kind: 'err' }); } } }))), { label: tx('Edit schedule') }); };
  const where = (s) => (s.target?.all ? 'All machines' : s.target?.group ? 'Group ' + s.target.group : `${(s.target?.machineIds || []).length} machine(s)`);
  const cmdOf = (s) => (s.spec.kind === 'inventory' ? 'inventory refresh' : preview(s.spec));
  const runsOf = (s) => `${s.time}${s.days?.length ? ' on ' + s.days.map((d) => DAYS[d]).join(', ') : ' every day'}`;
  // The list is read once per visit; the filter redraws it in place, so typing sends no request.
  let list = null;
  // The text of a row as the table shows it. The filter and the pattern builder's preview both use
  // it, so a pattern finds the rows the preview says it finds.
  const rowText = (s) => squash(`${s.name} ${runsOf(s)} ${cmdOf(s)} ${where(s)} ${s.lastRun ? fmtTime(s.lastRun) : 'never'}`);
  const chips = [['enabled', tx('Enabled only')]];
  const fb = filterBar('schedules', () => { syncBar(fb, chips); draw(); }, { chips, sample: () => (list || []).map(rowText) });
  const shown = () => (list || []).filter((s) => fb.test(rowText(s)) && (!fb.st.flags.enabled || s.enabled));
  // Not a live region: a change made by the user is spoken once, through fb.say or announce.
  const count = h('span', { class: 'muted small grow', dataset: { schedCount: '1' } });
  const bar = h('div', { class: 'row' }, count, exportBtn('material-choco-schedules', ['Name', 'Time', 'Days', 'Command', 'Where', 'Last run', 'Enabled'], () => shown().map((s) => [s.name, s.time, s.days?.length ? s.days.map((d) => DAYS[d]).join(' ') : 'every day', cmdOf(s), where(s), s.lastRun || 'never', s.enabled ? 'yes' : 'no']), { label: tx('Export this list') }), tip(t('schedules'), tx('The filter looks at the text of each row: the name, the time and days, the command, where it runs and the last run. Enabled only keeps the schedules that are switched on. Export writes the schedules that match the filter.')));
  // With Enabled only on, a schedule that is switched off leaves the list at once. Focus moves to
  // the switch that takes its place, or to the filter when no schedule is left.
  const afterSwitch = (sw) => {
    if (!fb.st.flags.enabled) return; const had = document.activeElement === sw; const tr = sw.closest('tr'); const at = tr ? [...tr.parentNode.children].indexOf(tr) : 0; draw(); announce(count.textContent); if (!had) return;
    const sws = host.querySelectorAll('tbody md-switch'); const next = sws[Math.min(at, sws.length - 1)] || (fb.el.open ? fb.el.querySelector('md-outlined-text-field') : fb.el.querySelector('summary'));
    // A switch that was just created draws its inner control after a moment; focus it after that.
    if (next) Promise.resolve(next.updateComplete).then(() => next.focus?.());
  };
  const enabledSwitch = (s) => h('md-switch', { selected: s.enabled, disabled: !canChange(), 'aria-label': `Schedule ${s.name} enabled`, onchange: (e) => { const sw = e.target; const on = sw.selected; api('/api/schedules/' + s.id, { method: 'PATCH', body: { enabled: on } }).then(() => { s.enabled = on; afterSwitch(sw); }).catch((er) => { sw.selected = !on; toast(er.message, { kind: 'err' }); }); } });
  const draw = () => {
    // A pattern that cannot be compiled is not applied: the empty state says so, as on Jobs and
    // History, and the error line of the filter row says why.
    if (!list) return; const rows = shown(); const usable = matcher(fb.st.q, fb.st.regex).ok;
    count.textContent = tx('{a} of {b} schedules shown.', { a: rows.length, b: list.length }); fb.say(count.textContent);
    host.replaceChildren(list.length ? bar : null, !list.length ? emptyState('calendar_month', 'No schedules yet', 'Nothing runs on its own until you add a schedule.', canChange() && btn('New schedule', { ic: 'add', onclick: create }))
      : !rows.length ? emptyState('calendar_month', t('no_results'), usable ? tx('No schedule matches the filter.') : tx('The pattern cannot be used, so no schedule is shown.'))
        : table(['Name', 'Runs', 'Command', 'Where', 'Last run', 'Enabled', ''], rows.map((s) => ({ cells: [h('b', {}, s.name), runsOf(s), h('span', { class: 'mono' }, cmdOf(s)), where(s), s.lastRun ? fmtTime(s.lastRun) : 'never', enabledSwitch(s), !canChange() ? '' : h('div', { class: 'row nowrap gap6' }, ibtn('edit', tx('Edit the schedule {n}', { n: s.name }), () => editSchedule(s)), ibtn('delete', `Delete schedule ${lit(s.name)}`, async () => { if (await superConfirm({ title: `Delete schedule ${lit(s.name)}`, detail: 'The schedule stops running. Jobs it already created are not affected.' })) { await api('/api/schedules/' + s.id, { method: 'DELETE' }); S.rerender('schedule'); } }))] })), { label: 'Schedules' }));
  };
  root.append(title('schedules'), h('div', { class: 'row' }, canChange() && btn('New schedule', { ic: 'add', onclick: create }), h('p', { class: 'muted grow' }, 'Schedules run on the hub. Offline machines receive the job when they return, within 7 days.')), fb.el, host);
  api('/api/schedules').then((r) => { list = r; draw(); }).catch((e) => host.replaceChildren(errorPanel('Schedules could not be loaded', e.message)));
  if (custom && canChange()) setTimeout(create);
}

// ---- history ------------------------------------------------------------------------------------
// The hub sends the newest entries of the log, at most 5000 at a time. The page asks for 2000, or for
// 5000 after the user asks for more, and says when older entries were not loaded, so a search that
// finds nothing never claims to have looked at the whole log.
const HIST = { limit: 2000, max: 5000, refocus: false };
function history(root) {
  const host = h('div', { class: 'col' }, skeleton(6)); let rows = []; let loaded = false;
  // The filter looks at what the table shows: the local time, who, the action and the details, in
  // that order. The raw entry starts with its keys, so a pattern anchored at the start, or a date as
  // it is shown, would never match it. Each entry's text is worked out once per visit.
  const details = (rest) => Object.entries(rest).map(([k, v]) => `${k}=${v !== null && typeof v === 'object' ? JSON.stringify(v) : v}`).join('  ');
  const texts = new WeakMap();
  const rowText = (r) => { let s = texts.get(r); if (s === undefined) { const { at, user, action, ...rest } = r; s = squash(`${fmtTime(at)} ${user ?? ''} ${action ?? ''} ${details(rest)}`); texts.set(r, s); } return s; };
  const fb = filterBar('history', () => { syncBar(fb); draw(); }, { sample: () => rows.slice(0, 200).map(rowText) });
  const shownRows = () => rows.filter((r) => fb.test(rowText(r)));
  // The hub sent as many entries as were asked for, so the log may hold older ones.
  const cut = () => rows.length >= HIST.limit;
  const more = () => btn(tx('Load up to {n} entries', { n: HIST.max }), { kind: 'tonal', ic: 'history', onclick: () => { HIST.limit = HIST.max; HIST.refocus = true; load(); } });
  const draw = () => {
    const list = shownRows(); const m = matcher(fb.st.q, fb.st.regex);
    const scope = !cut() ? '' : HIST.limit < HIST.max ? tx('Only the newest {n} entries are loaded, so older entries are not searched.', { n: rows.length }) : tx('The hub sends at most the newest {n} entries, so older entries are not searched here.', { n: rows.length });
    const counted = tx('{a} of {b} loaded entries match.', { a: list.length, b: rows.length });
    fb.say(scope ? counted + ' ' + scope : counted);
    const empty = !rows.length ? emptyState('history', tx('No history yet'), tx('The hub writes a line here for every sign in, pairing, job and setting change.'))
      : !m.ok ? emptyState('history', t('no_results'), tx('The pattern cannot be used, so no entry is shown.'))
        : emptyState('history', t('no_results'), scope ? tx('No loaded history entry matches the filter.') + ' ' + scope : tx('No history entry matches the filter.'), cut() && HIST.limit < HIST.max ? more() : null);
    host.replaceChildren(list.length ? table(['When', 'Who', 'Action', 'Details'], list.slice(0, 400).map((r) => { const { at, user, action, ...rest } = r; return { cells: [h('span', { class: 'mono small' }, fmtTime(at)), user, badge(action, /fail|remove|cancel/.test(action) ? 'err' : /ok|succeeded|complete/.test(action) ? 'ok' : ''), h('span', { class: 'mono small' }, details(rest))] }; }), { label: 'History' }) : empty,
      h('div', { class: 'row' }, h('p', { class: 'muted small grow', dataset: { historyCount: '1' } }, `${counted} ${scope ? scope + ' ' : ''}${tx('The log is append only on the hub.')}`), list.length && cut() && HIST.limit < HIST.max ? more() : null));
  };
  const load = () => {
    if (loaded) host.replaceChildren(skeleton(6));
    api('/api/audit?limit=' + HIST.limit).then((r) => {
      rows = r; loaded = true; draw();
      // The button that asked for more is gone; the keyboard goes back to the filter.
      if (HIST.refocus) { HIST.refocus = false; if (fb.el.isConnected) { announce(tx('{n} entries loaded.', { n: rows.length })); (fb.el.open ? fb.el.querySelector('md-outlined-text-field') : fb.el.querySelector('summary'))?.focus(); } }
    }).catch((e) => host.replaceChildren(errorPanel('History could not be loaded', e.message)));
  };
  root.append(title('history'), h('div', { class: 'row' }, exportBtn('material-choco-history', ['When', 'Who', 'Action', 'Details'], () => shownRows().map((r) => { const { at, user, action, ...rest } = r; return [at, user, action, JSON.stringify(rest)]; }), { label: tx('Export this list'), kind: 'tonal' }), tip(t('history'), tx('The hub writes one line for every sign in, pairing, job and setting change, and never rewrites a line. This page loads the newest 2000 entries, or up to 5000 when you ask, and says when older entries were not loaded. The filter and the export cover the loaded entries: the export holds every loaded entry that matches the filter, with all details, as CSV, JSON or Markdown. The table shows the newest 400 matches.'))), fb.el, host);
  load();
}

// ---- help ------------------------------------------------------------------------------------------
export const SHORTCUTS = KEYS.map((k) => [k.keys, k.label]);
const ARTICLES = [
  ['Getting started', 'Material Choco manages Chocolatey packages on this computer and on other Windows computers.\n\n- The Chocolatey CLI is built from this repository and ships inside the app. Nothing else has to be installed. Because it is built from this repository and not by Chocolatey Software, the agent adds `--allow-unofficial-build` to every command.\n- The desktop app manages This PC directly.\n- The hub is a web app in a container. Each managed computer runs an agent that connects out to the hub, so no inbound port is opened on the managed computers.\n- Pick the machines to act on with the machine button in the top bar.'],
  ['Remote agents and pairing', 'On the hub, open Machines and create a pairing code. The code works once and expires after 10 minutes.\n\nOn the Windows computer, open Material Choco, go to Machines and choose Connect this PC to a hub. On a server without a desktop session run `MaterialChoco.exe --agent enroll --hub <address> --code <code>` and then `MaterialChoco.exe --agent run`.\n\nA read only agent refuses every command that changes the machine. The refusal is enforced on the agent, not only in the hub.'],
  ['Security', '- The hub can run package installs with administrator rights on enrolled machines. Treat hub access like administrator access.\n- Use HTTPS. Agents refuse plain HTTP to a remote hub unless you opt in for a trusted LAN.\n- Agents only run the bundled choco with arguments checked against the CLI option list. There is no shell.\n- Secrets such as source passwords and API keys are masked in job logs and history.\n- Destructive actions need the two key confirmation.\n- The app is not code signed. Windows may show an unknown publisher warning.'],
  ['Offline machines', 'Jobs for an offline machine wait in the queue for up to 7 days and then expire. Inventory shown for an offline machine is the last one it reported and is labelled with its time.'],
  ['Filters and the pattern builder', 'Every filter keeps the rows that contain what you type, without regard to upper and lower case.\n\nTurn on Regex to filter with a regular expression. The button beside the switch opens the pattern builder. Fill in any of its parts and it writes the pattern for you:\n\n- Starts with: the row begins with this text.\n- Contains: this text appears anywhere.\n- Ends with: the row finishes with this text.\n- Any of these: at least one of the choices appears. Separate them with commas.\n- Does not contain: rows with this text are left out.\n\nThe builder escapes special characters, shows whether the pattern compiles, and previews it against rows of the current page and against lines you type. A pattern longer than 200 characters, or one that does not compile, filters nothing and says why.\n\nThe command palette, the settings search, the changelog, the timed settings rules and the output of a job have the same builder. Each search keeps its own text, Regex choice and pattern while the app runs, also when the page is drawn again for live data. The output search on Jobs keeps only the lines that match; Copy output and Export log still use the whole output.\n\nJobs and History search what is loaded in this browser. When the hub may hold older jobs or entries, the page says so and offers to load more, so a search that finds nothing never claims to have looked at what was not loaded.\n\nThe search at the top of Settings looks through every category at once: the name, the description and the choices of each setting, as the page shows them. It shows the matching settings grouped by category, ready to change. Sign in and locks and the changelog are described there and open in their own category. Clear the search to return to the categories.'],
  ['Tabs: reorder, pin, close and reopen', 'The pages are tabs in the strip on the left.\n\n- Drag a tab onto another tab to move it there.\n- With the keyboard, focus a tab and press `Alt+ArrowUp` or `Alt+ArrowDown`.\n- Right click a tab, or press `Shift+F10` on it, for pin, close, move and reopen actions.\n- Pinned tabs stay at the top and can only be reordered among themselves.\n\nThe order, the pins and the closed tabs are saved in this browser. New tab reopens a closed tab.'],
  ['Context menus', 'Right click anything, or focus it and press `Shift+F10`. Rows, tabs and machines have their own actions. Everything else opens a general menu: copy the text under the pointer, search everything, refresh the inventory, accessibility tools and settings.\n\nEvery menu opens with a filter field. Type to narrow it, press `ArrowDown` to move into the list, `Enter` to run the first match and `Escape` to clear the filter and then close. A shortcut shown beside an item is the shortcut that works.\n\nText fields, code blocks and logs keep the browser menu so that copy, paste and spelling tools stay available.'],
  ['Bulk actions and exports', 'Lists with a tick box in each row act on several rows at once: packages, machines, sources and jobs. The bar that appears names the count and the actions. Rows that an action cannot apply to are skipped and the result says how many.\n\nRemoving in bulk asks for the two key confirmation once and names every affected item.\n\nExport writes a list as CSV for spreadsheets, as JSON, or as a Markdown table, or copies the Markdown. It holds the ticked rows, or every row that matches the filter when none is ticked. Passwords and API keys are never part of these exports.'],
  ['Base64 tools', 'Base64 tools turn text or a file into Base64 and back. Everything happens in this browser; nothing is sent to the hub.\n\n- Text is encoded as UTF-8.\n- The URL-safe switch uses `-` and `_` and leaves out the `=` padding.\n- Decoding is strict. Input that is not Base64 in the chosen alphabet is reported with the position of the problem, and nothing is decoded.\n- Encode a file reads one file of up to 5 MB. Save decoded bytes writes the decoded bytes to a file.\n- Bytes that are not UTF-8 text are not shown as text.'],
  ['Timed settings', 'Settings can switch by the clock of this device.\n\n- Settings, Appearance, Switch theme by time of day turns the dark theme on between two times.\n- Settings, Timed settings holds rules for theme, density, motion, contrast, action sounds and full-screen install results. A rule has a value, a start, an end and optional weekdays.\n- A rule whose end is earlier than its start runs past midnight. Its weekdays name the day it starts on.\n- While a rule is active it wins over the stored setting. Later rules in the list win over earlier ones. The stored setting is never changed and returns when the rule ends.\n- Rules are checked every minute. The page lists what is in force right now.'],
  ['Custom logo', 'Settings, Appearance, Logo replaces the mark in the top bar with your own picture: PNG, JPEG, WebP or SVG, up to 256 KB. The file is checked by its content, must decode as a picture, and is stored in this browser only. Reset brings the built-in mark back. Installer and window icons are not changed.'],
];
const md = (text) => frag(text.split('\n\n').map((block) => (block.startsWith('- ') ? h('ul', { class: 'muted' }, block.split('\n').map((l) => h('li', {}, inline(l.slice(2))))) : block.startsWith('## ') ? h('h3', { class: 'h2', style: 'font-size:1.15rem' }, block.slice(3)) : block.startsWith('# ') ? h('h2', { class: 'h2' }, block.slice(2)) : h('p', { class: 'muted' }, inline(block)))));
const inline = (s) => s.split(/(`[^`]+`)/).map((x) => (x.startsWith('`') ? h('code', { class: 'mono' }, x.slice(1, -1)) : x));
// The text of an article as md() shows it: no list markers, no heading marks and no backticks, so a
// phrase copied from the page finds the article it was copied from.
const shown = (text) => text.split('\n').map((l) => l.replace(/^(?:- |#{1,2} )/, '')).join('\n').replace(/`([^`]+)`/g, '$1');
function help(root, params) {
  // The pattern builder previews against the same text the search reads, every article included.
  const fb = filterBar('help', () => S.rerender('filter'), { placeholder: 'Search help', sample: () => all.map((a) => a.text) });
  // Each article is searched as one line that starts with its title: the pattern builder writes
  // patterns with "." and anchors, which do not reach past a line break. A command shows its summary
  // above its help text when the help text does not already contain it.
  const cliBody = (c) => { const sum = c.help && c.summary && !squash(c.help).includes(squash(c.summary)) ? c.summary : ''; return { sum, text: squash(`choco ${c.name} ${sum} ${c.help || c.summary || ''}`), body: frag(sum ? h('p', { class: 'muted' }, sum) : null, h('pre', { class: 'log', style: 'background:var(--s3);color:var(--on)' }, c.help || c.summary)) }; };
  const all = [...ARTICLES.map(([a, b]) => ({ title: a, body: md(b), text: squash(`${a} ${shown(b)}`) })), { title: 'Keyboard shortcuts', body: table(['Keys', 'Action'], KEYS.map((k) => ({ cells: [h('kbd', {}, k.keys), tx(k.label)] })), { label: 'Keyboard shortcuts' }), text: squash('Keyboard shortcuts ' + KEYS.map((k) => `${k.keys} ${k.label} ${tx(k.label)}`).join(' ')) }, ...S.schema.commands.map((c) => { const b = cliBody(c); return { title: `choco ${c.name}`, body: b.body, text: b.text, cli: true }; })];
  // Opening Help at one article (from Settings or the command palette) must show that article. When
  // the search kept from earlier hides it, the search is cleared and that is said.
  const want = params?.focus ? all.find((a) => 'help-' + a.title === params.focus) : null;
  if (want && fb.st.q && !fb.test(want.text)) {
    fb.st.q = ''; syncBar(fb); const err = fb.el.querySelector('[data-filter-error]'); if (err) err.textContent = '';
    setTimeout(() => announce(tx('The help search was cleared to show {t}.', { t: want.title })), 500);
  }
  const usable = matcher(fb.st.q, fb.st.regex).ok; const arts = all.filter((a) => fb.test(a.text)); const said = tx('{a} articles shown: {b} about the app, {c} from the CLI.', { a: arts.length, b: arts.filter((a) => !a.cli).length, c: arts.filter((a) => a.cli).length }); fb.say(said);
  root.append(frag(title('help', 'Works offline. Command help comes from the CLI source in this repository.'), fb.el, h('div', { class: 'row' }, h('span', { class: 'muted small grow' }, said), btn(tx('Open all'), { kind: 'text', onclick: () => root.querySelectorAll('details.card').forEach((d) => { d.open = true; }) }), btn(tx('Close all'), { kind: 'text', onclick: () => root.querySelectorAll('details.card').forEach((d) => { d.open = false; }) }), exportBtn('material-choco-shortcuts', ['Keys', 'Action'], () => KEYS.map((k) => [k.keys, k.label]), { label: tx('Export shortcuts') })),
    // The article asked for opens and can take focus, so the route that asked for it lands on it.
    arts.map((a, i) => h('details', { class: 'card fold rise', style: `--i:${Math.min(i, 10)}`, open: a === want || (!a.cli && !!fb.st.q), tabindex: a === want ? '-1' : null, 'aria-label': a === want ? a.title : null, dataset: { pal: 'help-' + a.title } }, h('summary', {}, icon('keyboard_arrow_down', 'sm'), h('span', { class: 'h2', style: 'font-size:1.1rem;color:var(--on)' }, a.title)), a.body)), !arts.length && emptyState('menu_book', t('no_results'), usable ? tx('No help article matches.') : tx('The pattern cannot be used, so no help article is shown.'))));
}

// ---- settings ------------------------------------------------------------------------------------------
const ST = { tab: 'language' };
export const SETTINGS_INDEX = []; // filled while rendering, used by the command palette
function row(key, tab, label, desc, control) {
  if (!SETTINGS_INDEX.some((s) => s.key === key)) SETTINGS_INDEX.push({ key, tab, label, bool: typeof DEFAULTS[key] === 'boolean' });
  const dv = DEFAULTS[key]; const prov = isDefault(key) ? `Built-in default: ${typeof dv === 'object' ? JSON.stringify(dv) : dv === '' ? 'empty' : dv}` : 'Changed on this device';
  // A switch, a slider or a group of choices is named by the label the row shows, not by the
  // internal key of the setting, also when the settings search shows the row on its own.
  if (control?.matches?.('md-switch, md-slider') && control.getAttribute('aria-label') === key) control.setAttribute('aria-label', label);
  if (control?.classList?.contains('seg') && !control.hasAttribute('aria-label')) control.setAttribute('aria-label', label);
  // The provenance line and the timed setting note describe the state of the setting, not the
  // setting, so the settings search does not look at them (data-nosearch).
  return h('div', { class: 'opt', dataset: { pal: 'set-' + key }, style: 'flex:1 1 100%' }, control, h('div', { class: 'col gap0 grow' }, h('span', { class: 't1' }, label), h('span', { class: 'muted small' }, desc), h('span', { class: 'small', dataset: { nosearch: '1' } }, prov, ' ', !isDefault(key) && h('a', { href: '#', onclick: (e) => { e.preventDefault(); resetSetting(key); } }, t('reset'))),
    timedOverride(key) && h('span', { class: 'row gap6 small', dataset: { nosearch: '1' } }, badge(tx('A timed setting has replaced this with "{v}" for now', { v: valName(eff(key)) }), 'info'), h('a', { href: '#', onclick: (e) => { e.preventDefault(); S.go('settings', { tab: 'timed' }); } }, tx('Open timed settings')))));
}
const valName = (v) => (v === true ? tx('on') : v === false ? tx('off') : String(v));
// A block of a category that the settings search can show on its own. data-find names a block
// that has no heading of its own.
const part = (key, find, ...kids) => h('div', { class: 'col', dataset: find ? { pal: 'set-' + key, find } : { pal: 'set-' + key } }, kids);

// ---- settings search: one search across every category ---------------------------------------------
// It keeps its text and Regex choice for the session, also when the page is drawn again after a
// setting changes, because the search row is the same element every time.
const TABS = [['language', 'language', 'translate'], ['appearance', 'appearance', 'palette'], ['accessibility', 'accessibility', 'accessibility_new'], ['sound', 'sound', 'volume_up'], ['focus', 'focus_modes', 'psychology'], ['timed', 'timed_settings', 'schedule'], ['account', 'account', 'lock'], ['data', 'data', 'save'], ['about', 'about', 'info']];
// SS.box holds the search row and the explanation its info button opens, which is placed after the
// row. Keeping both in one element that is reused means an open explanation is still shown, and
// its button still tells the truth, after the page is drawn again.
// SS.said is the count line of the last drawing of the results, spoken once after a change by the user.
const SS = { mf: null, box: null, sig: '', said: '', draw: () => {}, sample: () => [] };
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
function settingsSearch() {
  const label = tx('Search all settings'); const about = tx('Searches the name, the description and the choices of every setting in every category, and shows the matches grouped by category. Change a setting right in the results. Sign in and locks and the changelog are described here and open in their own category. Upper and lower case are treated the same. Turn on Regex to use a regular expression; the button beside it builds one from plain parts. A pattern that cannot be compiled shows nothing and says why. Clear the search to return to the categories.');
  const sig = [label, about, t('regex'), t('settings'), tx('Explain'), tx('Build a pattern from parts')].join('|');
  if (SS.mf && SS.sig === sig) return SS.mf;
  // The wording changed, so the row is built again in the new wording, keeping the query, the
  // Regex choice and the reason a pattern cannot be used.
  // The result of a change made by the user is spoken once, after typing pauses, like every other
  // filter: the count, or why the pattern cannot be used. Neither the count nor the error line is a
  // live region, so typing does not interrupt a screen reader on every key.
  const old = SS.mf?.st; const mf = miniFilter(() => { SS.draw(); const m = matcher(mf.st.q, mf.st.regex); sayLater(!mf.st.q ? '' : m.ok ? SS.said : rxError(m)); }, { label, sample: () => SS.sample() });
  mf.el.dataset.settingsSearch = '1';
  const errLine = mf.el.querySelector('[data-filter-error]'); if (errLine) errLine.removeAttribute('role');
  nameRx(mf.el, label);
  mf.el.append(tip(label, about));
  if (old && (old.q || old.regex)) {
    mf.st.q = old.q; mf.st.regex = old.regex; const f = mf.el.querySelector('md-outlined-text-field'); const c = mf.el.querySelector('md-filter-chip'); if (f) f.value = old.q; if (c) c.selected = old.regex;
    if (errLine) errLine.textContent = rxError(matcher(old.q, old.regex));
  }
  SS.mf = mf; SS.box = h('div', { class: 'col' }, mf.el); SS.sig = sig; return mf;
}
function clearSearch(silent) {
  const mf = SS.mf; if (!mf) return; mf.st.q = ''; sayLater(''); // a count still waiting to be spoken no longer applies
  const f = mf.el.querySelector('md-outlined-text-field'); if (f) f.value = ''; const err = mf.el.querySelector('[data-filter-error]'); if (err) err.textContent = '';
  if (!silent) SS.draw();
}
// Changing a setting draws the page again. Focus goes back to the control that had it: the same
// control of the search row, the selected category chip, or, inside a block, the control with the
// same name, data and text. When that control is gone (a rule was deleted), it goes to the control of
// the same kind nearest to where it was. Every control of a block, the colour field included, is in
// FOCUSABLE, so the one that had focus is always found again.
const FOCUSABLE = 'md-switch, md-slider, md-outlined-text-field, md-outlined-select, md-filled-button, md-filled-tonal-button, md-outlined-button, md-text-button, md-icon-button, md-filter-chip, md-checkbox, button, input, a[href], summary, [tabindex="0"]';
const controlsOf = (b) => [...b.querySelectorAll(FOCUSABLE)];
const sigOf = (el) => [el.tagName, el.getAttribute('aria-label') || '', typeof el.label === 'string' ? el.label : '', Object.entries(el.dataset || {}).map(([k, v]) => `${k}=${v}`).join(','), squash(el.textContent).slice(0, 80)].join('|');
document.addEventListener('focusin', (e) => {
  const el = e.target; if (el?.closest?.('[data-settings-search]')) { SS.focus = { kind: 'search', el }; return; }
  if (el?.closest?.('#main [role="tablist"][data-settings-tabs]')) { SS.focus = { kind: 'tab' }; return; }
  const b = el?.closest?.('#main [data-pal^="set-"]'); if (!b) { SS.focus = null; return; }
  const c = el.closest(FOCUSABLE) || el; const all = controlsOf(b); const sig = sigOf(c); const view = b.closest('[data-settings-view]');
  SS.focus = { kind: 'block', pal: b.dataset.pal, name: b.dataset.searchName || '', at: view ? blocksOf(view).indexOf(b) : 0, sig, tag: c.tagName, same: all.filter((x) => sigOf(x) === sig).indexOf(c), nth: all.filter((x) => x.tagName === c.tagName).indexOf(c) };
});
const blocksOf = (view) => [...view.querySelectorAll('[data-pal^="set-"]')];
function keepFocus(view) {
  const want = SS.focus; if (!want) return;
  setTimeout(() => { const a = document.activeElement; if (a && a !== document.body) return;
    let target = null; let gone = false;
    if (want.kind === 'search') target = want.el?.isConnected ? want.el : SS.mf?.el.querySelector('md-outlined-text-field');
    else if (want.kind === 'tab') target = [...view.querySelectorAll('[data-settings-tabs] md-filter-chip')].find((c) => c.selected);
    else {
      const b = view.querySelector(`[data-pal="${CSS.escape(want.pal)}"]`); const all = b ? controlsOf(b) : [];
      const pick = (list, i) => (list.length ? list[Math.min(Math.max(i, 0), list.length - 1)] : null);
      target = pick(all.filter((x) => sigOf(x) === want.sig), want.same) || pick(all.filter((x) => x.tagName === want.tag), want.nth) || all[0] || null;
      // The change made the setting stop matching the search, so it left the results. Focus goes to
      // the setting that now has its place, or to Clear the search when no setting is left, or to the
      // search field, and the reason is spoken.
      if (!b) {
        gone = true; const next = pick(blocksOf(view), want.at);
        target = (next && controlsOf(next)[0]) || view.querySelector('[data-clear-search]') || SS.mf?.el.querySelector('md-outlined-text-field') || null;
      }
    }
    if (target?.isConnected) target.focus({ preventScroll: true });
    if (gone && SS.mf?.st.q) announce([want.name && tx('{n} no longer matches the search, so it left the results.', { n: want.name }), SS.said].filter(Boolean).join(' '));
  });
}
// The text of a block as the page shows it. Elements that are not inline start a new word, so choices
// such as Light, Dark and System read as three words. The visible label of a Material field or chip
// is included; aria-labels, icons, and parts marked data-nosearch (provenance and status lines, and a
// filter row of the block's own) are not.
const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'CODE', 'KBD', 'A', 'SMALL', 'MARK', 'ABBR', 'SUB', 'SUP', 'U', 'S']);
function shownText(root) {
  const out = [];
  const walk = (n) => {
    if (n.nodeType === 3) { out.push(n.nodeValue); return; }
    if (n.nodeType !== 1 || n.namespaceURI !== 'http://www.w3.org/1999/xhtml' || n.dataset.nosearch !== undefined || n.hidden) return;
    const gap = !INLINE.has(n.tagName); if (gap) out.push(' ');
    if (n.tagName.startsWith('MD-') && typeof n.label === 'string' && n.label) out.push(n.label, ' ');
    for (const k of n.childNodes) walk(k);
    if (gap) out.push(' ');
  };
  walk(root); return squash(out.join(''));
}
// matcher() in ui.js tests a regular expression against the first 2000 characters of a text.
const RX_READ = 2000;
// Builds every category and keeps its top level blocks whose data-pal starts with "set-". The text a
// search looks at starts with the name of the setting, so a pattern anchored at the start finds it.
// The name is the heading or label the block shows; data-find names only a block that shows none.
// A block whose text is longer than a regular expression is tested against, such as a long list of
// timed rules, is also searched one table row or list item at a time. Each of those lines starts with
// the name and the category of the block, so Regex finds a row however far down the block it is.
function searchParts(build) {
  const out = [];
  for (const [id, key, ic] of TABS) {
    const category = t(key); const nodes = [build(id)].flat(Infinity).filter(Boolean).flatMap((n) => (n.nodeType === 11 ? [...n.childNodes] : [n]));
    for (const el of nodes) {
      if (el.nodeType !== 1 || !String(el.dataset.pal || '').startsWith('set-')) continue;
      const name = squash(el.querySelector('.t1, h2, h3')?.textContent || el.dataset.find || el.textContent);
      el.setAttribute('role', 'group'); el.setAttribute('aria-label', tx('{n}, in {c}', { n: name, c: category })); el.dataset.category = id; el.dataset.searchName = name;
      const text = squash(`${name} ${category} ${shownText(el)}`);
      const rows = text.length > RX_READ ? [...el.querySelectorAll('tbody tr, li')].filter((r) => !r.closest('[data-nosearch]')).map((r) => squash(`${name} ${category} ${shownText(r)}`)) : [];
      out.push({ id, key, ic, category, el, name, text, lines: [text, ...rows] });
    }
  }
  return out;
}

// ---- custom logo: checked by content, decoded locally, kept in this browser only -------------------
const LOGO_KEY = 'mc.logo'; const LOGO_MAX = 256 * 1024;
export const getLogo = () => { try { const v = localStorage.getItem(LOGO_KEY); return v && v.startsWith('data:image/') ? v : null; } catch { return null; } };
export function sniffImage(bytes) {
  const at = (i, ...v) => v.every((x, k) => bytes[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  let text = ''; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 4096)); } catch { try { text = new TextDecoder('utf-8').decode(bytes.subarray(0, 2048)); } catch { return null; } }
  return /^\ufeff?\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text) ? 'image/svg+xml' : null;
}
// Returns the stored data URL. Throws with the reason, and leaves the current logo alone, on any problem.
export async function applyLogoFile(file) {
  if (file.size > LOGO_MAX) throw new Error(tx('The file is {n} KB. The limit is 256 KB.', { n: Math.ceil(file.size / 1024) }));
  if (!file.size) throw new Error(tx('The file is empty.'));
  const bytes = new Uint8Array(await file.arrayBuffer()); const mime = sniffImage(bytes);
  if (!mime) throw new Error(tx('The content is not a PNG, JPEG, WebP or SVG picture, whatever the file name says.'));
  const url = `data:${mime};base64,${b64encode(bytes)}`; const img = new Image(); img.src = url;
  try { await img.decode(); } catch { throw new Error(tx('The picture is damaged and could not be decoded.')); }
  if (img.naturalWidth > 4096 || img.naturalHeight > 4096) throw new Error(tx('The picture is {w} by {h} pixels. The limit is 4096 on each side.', { w: img.naturalWidth, h: img.naturalHeight }));
  try { localStorage.setItem(LOGO_KEY, url); } catch { throw new Error(tx('This browser refused to store the picture. Its storage may be full or switched off.')); }
  return url;
}
const BUILTIN_MARK = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 9h14M7 14h14M7 19h14M11.5 9v10M16.5 9v10"/></svg>';
const LG = { note: '', bad: false };
function logoBlock() {
  const cur = getLogo(); const note = h('p', { class: 'small' + (LG.bad ? ' bad' : ''), role: 'status', dataset: { logoNote: '1' } }, LG.note);
  const choose = () => { const i = h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml', onchange: async () => { const f = i.files[0]; if (!f) return; try { await applyLogoFile(f); LG.note = tx('The logo was replaced with {n}. It is stored in this browser only.', { n: f.name }); LG.bad = false; } catch (e) { LG.note = tx('The logo was not changed.') + ' ' + e.message; LG.bad = true; } S.rerender('logo'); } }); i.click(); };
  return h('div', { class: 'col', dataset: { pal: 'set-logo' } }, h('h3', { class: 'h2', style: 'font-size:1.15rem' }, tx('Logo')),
    h('div', { class: 'row' }, cur ? h('span', { class: 'mark custom big' }, h('img', { src: cur, alt: tx('The custom logo in use') })) : h('span', { class: 'mark big', html: BUILTIN_MARK }),
      h('div', { class: 'col gap6 grow' }, h('span', { class: 'muted small' }, cur ? tx('A custom logo is in use. It is shown in the top bar and stays in this browser.') : tx('The built-in mark is in use. No custom logo is stored.')),
        h('div', { class: 'row' }, btn(cur ? tx('Replace the logo') : tx('Upload a logo'), { kind: 'tonal', ic: 'image', onclick: choose }), cur && btn(tx('Reset to the built-in mark'), { kind: 'text', ic: 'undo', onclick: () => { try { localStorage.removeItem(LOGO_KEY); } catch { /* nothing stored */ } LG.note = tx('The built-in mark is back. The custom logo was removed from this browser.'); LG.bad = false; S.rerender('logo'); } }),
          tip(tx('Logo'), tx('Choose a PNG, JPEG, WebP or SVG picture of up to 256 KB and at most 4096 pixels on each side. The file is recognised by its content, not its name, and must decode as a picture; otherwise nothing changes. It replaces the mark in the top bar on this device only. The window icon, the installer and the hub are not changed. An SVG is shown as a picture, so scripts inside it do not run.'))))), note);
}

// ---- appearance presets: each one says exactly which settings it writes --------------------------------
const LOOKS = [['Cocoa', { hue: DEFAULTS.hue, chroma: DEFAULTS.chroma }], ['Mint', { hue: 160, chroma: 1.1 }], ['Harbour', { hue: 240, chroma: 1 }], ['Plum', { hue: 330, chroma: 1.2 }], ['Graphite', { hue: 260, chroma: 0.15 }], ['Compact night', { theme: 'dark', density: 'compact' }]];
const LOOK_NAMES = { hue: 'hue', chroma: 'vividness', theme: 'theme', density: 'density' };
function looksBlock() {
  const says = (vals) => Object.entries(vals).map(([k, v]) => `${LOOK_NAMES[k]} ${v}`).join(', ');
  const use = (name, vals) => { const before = Object.fromEntries(Object.keys(vals).map((k) => [k, isDefault(k) ? undefined : settings[k]])); for (const [k, v] of Object.entries(vals)) settings[k] = v; toast(tx('Preset {n} applied: {s}.', { n: name, s: says(vals) }), { kind: 'ok', action: { label: tx('Undo'), run: () => { for (const [k, v] of Object.entries(before)) { if (v === undefined) resetSetting(k); else settings[k] = v; } } } }); };
  return h('div', { class: 'col', dataset: { pal: 'set-looks' } }, h('div', { class: 'row nowrap' }, h('h3', { class: 'h2 grow', style: 'font-size:1.15rem;min-width:0;overflow-wrap:anywhere' }, tx('Appearance presets')), tip(tx('Appearance presets'),tx('A preset writes only the settings named under it and leaves everything else alone. Cocoa writes the built-in seed colour. The notification that follows has Undo, which puts back exactly the values that were there before.'))),
    h('div', { class: 'looks' }, LOOKS.map(([name, vals]) => { const on = Object.entries(vals).every(([k, v]) => settings[k] === v); return h('button', { type: 'button', class: 'look press', 'aria-pressed': String(on), dataset: { look: name }, style: `--lh:${vals.hue ?? settings.hue};--lc:${vals.chroma ?? settings.chroma}`, onclick: () => use(name, vals) }, h('i', { class: vals.theme === 'dark' ? 'dark' : '' }), h('span', { class: 'col gap0' }, h('b', {}, name), h('span', { class: 'small' }, tx('Sets') + ' ' + says(vals)), on && h('span', { class: 'small' }, tx('In use')))); })));
}

// ---- timed settings ---------------------------------------------------------------------------------------
const TKEYS = { theme: 'Theme', density: 'Density', motion: 'Motion', contrast: 'Contrast', sounds: 'Action sounds', drama: 'Full-screen install results' };
const TF = { key: 'theme', value: 'dark', from: '22:00', to: '07:00', days: new Set() };
const timeInput = (value, label, onchange, name) => h('label', { class: 'col gap0 timef' }, h('span', { class: 'small muted' }, label), h('input', { type: 'time', class: 'time', value, required: true, dataset: { time: name }, onchange: (e) => onchange(e.target.value) }));
const daysText = (d) => (d?.length ? [...d].sort().map((i) => DAYS[i]).join(', ') : tx('every day'));
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return tx('unknown'); } };
// quiet: the copy built for the settings search. It lists every rule, without the rules filter, so
// what the settings search finds never depends on what the rules filter was left holding, and the
// results show one search, not a second one inside them.
function timedTab(quiet) {
  const rules = (Array.isArray(settings.schedRules) ? settings.schedRules : []).filter(validRule); const active = new Set(activeRules().map((r) => r.id));
  const now = Object.keys(SCHEDULABLE).filter((k) => timedOverride(k)).map((k) => { const r = [...activeRules()].reverse().find((x) => x.key === k); return h('li', {}, h('b', {}, tx(TKEYS[k])), `: ${valName(eff(k))} ${tx('instead of')} ${valName(settings[k])}. `, r ? tx('From the rule {a} to {b}, {d}.', { a: r.from, b: r.to, d: daysText(r.days) }) : tx('From Switch theme by time of day, {a} to {b}.', { a: settings.darkFrom, b: settings.darkTo })); });
  const err = h('p', { class: 'small bad', role: 'alert' });
  const add = () => { err.textContent = ''; if (minutesOf(TF.from) === null || minutesOf(TF.to) === null) return (err.textContent = tx('Enter both times as hours and minutes.')); if (TF.from === TF.to) return (err.textContent = tx('The start and the end are the same time, so the rule would never run. Nothing was added.')); if (rules.length >= 50) return (err.textContent = tx('There are already 50 rules. Delete one first.'));
    settings.schedRules = [...rules, { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), key: TF.key, value: TF.value, from: TF.from, to: TF.to, days: [...TF.days].sort(), enabled: true }]; announce(tx('Timed rule added.')); };
  const del = (r) => { const before = settings.schedRules; settings.schedRules = rules.filter((x) => x.id !== r.id); toast(tx('Timed rule deleted.'), { action: { label: tx('Undo'), run: () => { settings.schedRules = before; } } }); };
  // The rules have a search of their own. It looks at the text of each row as the table shows it,
  // keeps its text and Regex choice while the app runs, and redraws only the table, so typing never
  // draws the page again. Export writes the rules that match it. It is part of the category only; the
  // copy the settings search shows has every rule and no filter row (quiet).
  const stateOf = (r) => (r.enabled === false ? tx('Switched off') : active.has(r.id) ? tx('Active now') : tx('Waiting'));
  const toText = (r) => r.to + (minutesOf(r.to) < minutesOf(r.from) ? ' ' + tx('(next day)') : '');
  const ruleText = (r) => squash(`${tx(TKEYS[r.key])} ${valName(r.value)} ${r.from} ${toText(r)} ${daysText(r.days)} ${stateOf(r)}`);
  const rf = rules.length && !quiet ? keptFilter('timed-rules', () => { drawRules(); const m = matcher(rf.st.q, rf.st.regex); sayLater(rf.st.q && m.ok ? rulesCount.textContent : ''); }, { label: tx('Filter the rules'), sample: () => rules.map(ruleText) }) : null;
  if (rf) rf.el.dataset.nosearch = '1';
  const shownRules = () => (rf ? rules.filter((r) => rf.test(ruleText(r))) : rules);
  const rulesCount = h('p', { class: 'muted small', hidden: true, dataset: { rulesCount: '1' } }); const rulesHost = h('div', { class: 'col' });
  const drawRules = () => {
    const list = shownRules(); const m = rf ? matcher(rf.st.q, rf.st.regex) : { ok: true };
    rulesCount.textContent = rf?.st.q && m.ok ? tx('{a} of {b} rules shown.', { a: list.length, b: rules.length }) : ''; rulesCount.hidden = !rulesCount.textContent;
    rulesHost.replaceChildren(list.length ? table([tx('Setting'), tx('Value'), tx('From'), tx('To'), tx('Days'), tx('State'), tx('Enabled'), ''], list.map((r) => ({ cells: [h('b', {}, tx(TKEYS[r.key])), valName(r.value), h('span', { class: 'mono' }, r.from), h('span', { class: 'mono' }, toText(r)), daysText(r.days), r.enabled === false ? badge(stateOf(r)) : active.has(r.id) ? badge(stateOf(r), 'ok') : badge(stateOf(r), 'info'),
      h('md-switch', { selected: r.enabled !== false, 'aria-label': tx('Rule for {k} enabled', { k: tx(TKEYS[r.key]) }), onchange: (e) => { settings.schedRules = rules.map((x) => (x.id === r.id ? { ...x, enabled: e.target.selected } : x)); } }), ibtn('delete', tx('Delete this rule'), () => del(r))] })), { label: tx('Timed rules') })
      : h('p', { class: 'muted' }, m.ok ? tx('No rule matches the filter.') : tx('The pattern cannot be used, so no rule is shown.')));
  };
  if (rules.length) drawRules();
  return [h('h2', { class: 'h2' }, t('timed_settings')), h('p', { class: 'muted' }, tx('Rules that replace a setting between two times of day. They follow the clock of this device ({z}), daylight saving changes included, and are checked every minute. A rule never changes the stored setting: when it ends, the stored value is back.', { z: zone() })),
    h('div', { class: 'card ' + (now.length ? 'pc' : 's3'), dataset: { timedNow: '1', pal: 'set-timedNow' } }, h('h3', { class: 'h2', style: 'font-size:1.15rem' }, tx('In force right now')), now.length ? h('ul', { style: 'margin:0;padding-left:20px' }, now) : h('p', {}, tx('No timed setting is replacing anything at the moment. Every setting has its stored value.'))),
    part('schedRules', null, h('h3', { class: 'h2', style: 'font-size:1.15rem' }, tx('Timed rules')),
    rules.length ? frag(rf?.el, rulesCount,rulesHost, h('div', { class: 'row' }, h('span', { class: 'muted small grow' }, tx('When two active rules set the same setting, the one lower in this list wins.')), exportBtn('material-choco-timed-settings', ['Setting', 'Value', 'From', 'To', 'Days', 'Enabled'], () => shownRules().map((r) => [r.key, String(r.value), r.from, r.to, daysText(r.days), r.enabled === false ? 'no' : 'yes']), { label: tx('Export this list') })))
      : h('p', { class: 'muted' }, tx('There are no rules yet. Add the first one below.'))),
    h('div', { class: 'card flat', dataset: { timedForm: '1', pal: 'set-timedAdd' } }, h('div', { class: 'row nowrap' }, h('h3', { class: 'h2 grow', style: 'font-size:1.15rem;min-width:0;overflow-wrap:anywhere' }, tx('Add a timed rule')), tip(tx('Add a timed rule'),tx('Pick the setting, the value it should have, and the two times. If the end is earlier than the start, the rule runs past midnight. Tick weekdays to limit it; with none ticked it runs every day. For a rule that runs past midnight the weekday is the day it starts.'))),
      h('div', { class: 'col gap6' }, h('span', { class: 'small muted' }, tx('Setting')), h('div', { class: 'seg', role: 'group', 'aria-label': tx('Setting') }, Object.keys(SCHEDULABLE).map((k) => h('button', { type: 'button', 'aria-pressed': String(TF.key === k), dataset: { tkey: k }, onclick: () => { TF.key = k; TF.value = SCHEDULABLE[k].includes(TF.value) ? TF.value : SCHEDULABLE[k][SCHEDULABLE[k].length - 1]; S.rerender('settings-tab'); } }, tx(TKEYS[k]))))),
      h('div', { class: 'row top' }, h('div', { class: 'col gap6' }, h('span', { class: 'small muted' }, tx('Value')), h('div', { class: 'seg', role: 'group', 'aria-label': tx('Value') }, SCHEDULABLE[TF.key].map((v) => h('button', { type: 'button', 'aria-pressed': String(TF.value === v), dataset: { tval: String(v) }, onclick: () => { TF.value = v; S.rerender('settings-tab'); } }, valName(v))))), timeInput(TF.from, tx('From'), (v) => { TF.from = v; }, 'from'), timeInput(TF.to, tx('To'), (v) => { TF.to = v; }, 'to')),
      h('div', { class: 'col gap6' }, h('span', { class: 'small muted' }, tx('Days. None ticked means every day.')), h('div', { class: 'row gap6' }, DAYS.map((d, i) => h('md-filter-chip', { label: d, selected: TF.days.has(i), onclick: (e) => setTimeout(() => (e.target.selected ? TF.days.add(i) : TF.days.delete(i))) })))),
      err, h('div', { class: 'row' }, btn(tx('Add rule'), { ic: 'add', onclick: add })))];
}

// ---- changelog viewer ---------------------------------------------------------------------------------
export function parseChangelog(text) {
  const out = []; let cur = null;
  for (const line of String(text).split(/\r?\n/)) { const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) { const v = /^\[?v?([^\]\s(]+)\]?\s*(?:[-(]\s*([^)]+?)\s*\)?)?$/.exec(m[1]); cur = { version: v ? v[1] : m[1], note: v && v[2] ? v[2] : '', items: [] }; out.push(cur); }
    else if (cur && /^\s*[-*]\s+/.test(line)) cur.items.push(line.replace(/^\s*[-*]\s+/, '').trim());
    else if (cur && cur.items.length && line.trim() && !line.startsWith('#')) cur.items[cur.items.length - 1] += ' ' + line.trim(); }
  return out;
}
// The changelog file is read once while the app runs. Settings is drawn again on every job, machine
// and setting event, and each drawing reuses the text instead of fetching the file again.
const CL = { text: null, load: null };
const changelogFile = () => (CL.load ??= fetch('changelog.md').then((r) => (r.ok ? r.text() : Promise.reject(new Error('missing')))).then((text) => (CL.text = text)));
function changelogViewer() {
  const host = h('div', { class: 'col', dataset: { changelog: '1' } }, skeleton(2)); let sections = [];
  const count = h('p', { class: 'muted small', 'aria-live': 'polite' }); const body = h('div', { class: 'col' });
  // keptFilter keeps the text, the Regex choice, the reason a pattern cannot be used and the keyboard
  // place while the app runs, so a redraw for live data does not bring every change back.
  const mf = keptFilter('changelog', () => draw(), { label: tx('Filter changes'), sample: () => sections.flatMap((s) => s.items) });
  const rows = () => sections.flatMap((s) => s.items.filter((i) => mf.test(`${s.version} ${s.note} ${i}`)).map((i) => [s.version, s.note, i]));
  const draw = () => { const total = sections.reduce((n, s) => n + s.items.length, 0); const shown = rows().length; count.textContent = tx('{a} of {b} changes shown, in {c} version(s).', { a: shown, b: total, c: sections.length });
    const parts = sections.map((s) => { const items = s.items.filter((i) => mf.test(`${s.version} ${s.note} ${i}`)); return items.length ? h('details', { class: 'fold', open: true, dataset: { version: s.version } }, h('summary', {}, icon('keyboard_arrow_down', 'sm'), h('span', { class: 'h2', style: 'font-size:1.15rem;color:var(--on)' }, tx('Version {v}', { v: s.version })), s.note && badge(s.note, 'info'), badge(items.length === s.items.length ? tx('{n} changes', { n: items.length }) : tx('{a} of {b} changes', { a: items.length, b: s.items.length }))), h('ul', { class: 'muted' }, items.map((i) => h('li', {}, inline(i))))) : null; }).filter(Boolean);
    body.replaceChildren(...(parts.length ? parts : [h('p', { class: 'muted' }, !sections.length ? tx('The changelog file has no version sections.') : matcher(mf.st.q, mf.st.regex).ok ? tx('No change matches the filter.') : tx('The pattern cannot be used, so no change is shown.'))])); };
  const fill = (text) => { sections = parseChangelog(text); host.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'grow' }), exportBtn('material-choco-changelog', ['Version', 'Date or state', 'Change'], rows, { label: tx('Export shown changes') }), tip(tx('Changelog'), tx('The list is read from the changelog file that ships inside this build, so it works offline. Each version is a section that folds. The filter searches the version, its date or state, and the text of each change. Dates are shown only where the file gives one. Links to individual commits are not available here.'))), mf.el, count, body); draw(); };
  // Once the file has been read, the viewer is complete before it is placed on the page, so the
  // redraw keeps the filter, its result and the keyboard place without a skeleton in between.
  if (CL.text !== null) fill(CL.text);
  else changelogFile().then(fill).catch(() => host.replaceChildren(h('p', { class: 'muted' }, 'The changelog file is missing from this build.')));
  return host;
}
// The key given as aria-label is a placeholder: row() replaces it with the label the row shows.
// A control used outside row() passes its visible name.
const sw = (key, onchange) => h('md-switch', { selected: !!settings[key], 'aria-label': key, onchange: (e) => { settings[key] = e.target.selected; onchange && onchange(e.target.selected, e.target); } });
const seg = (key, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(settings[key] === v), onclick: () => { settings[key] = v; } }, settings[key] === v && icon('check', 'sm'), l)));
const slider = (key, min, max, step = 1, name = key) => h('md-slider', { min, max, step, value: settings[key], labeled: true, 'aria-label': name, style: 'min-width:200px', onchange: (e) => { settings[key] = Number(e.target.value); } });
export function validateVocabulary(text) {
  if (new TextEncoder().encode(text).length > 256 * 1024) throw new Error('The file is larger than 256 KiB.');
  const j = JSON.parse(text); const depth = (x, d = 1) => { if (d > 8) throw new Error('The file is nested deeper than 8 levels.'); if (x && typeof x === 'object') for (const v of Object.values(x)) depth(v, d + 1); }; depth(j);
  if (typeof j !== 'object' || !j || typeof j.schemaVersion !== 'number' || typeof j.entries !== 'object' || !j.entries || Array.isArray(j.entries)) throw new Error('Expected an object with a numeric schemaVersion and an entries object.');
  for (const [k, v] of Object.entries(j.entries)) { if ([...k].length > 160) throw new Error('A key is longer than 160 characters.'); if (typeof v !== 'string' || [...v].length > 1000) throw new Error('Every value must be text of at most 1,000 characters.'); }
  return { name: typeof j.name === 'string' ? j.name.slice(0, 80) : '', entries: j.entries };
}
export function applyVocabularyFile(text) { try { const v = validateVocabulary(text); localStorage.setItem('mc.vocab', JSON.stringify(v)); setVocabulary(v.entries); levelUp(v.name || 'Personal wording applied'); S.rerender('vocab'); return true; } catch (e) { sound('bad'); toast('Personal wording file refused. Nothing was changed. ' + e.message, { kind: 'err' }); return false; } }
function hexToHueChroma(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null; const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b); const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b); const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); const A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s; const B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s; return { hue: Math.round(((Math.atan2(B, A) * 180) / Math.PI + 360) % 360), chroma: Math.hypot(A, B) }; }
function tokenRgb(name) { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); }
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
function colourPicker() {
  const dot = h('i'); const read = h('div', { class: 'col gap6 mono small', 'aria-live': 'polite' });
  const paint = () => { dot.style.left = (settings.hue / 360) * 100 + '%'; dot.style.top = (1 - Math.min(settings.chroma, 1.6) / 1.6) * 100 + '%'; const rgb = tokenRgb('--pri'); const on = tokenRgb('--onpri'); const hex = '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(); const max = Math.max(...rgb) / 255; const min = Math.min(...rgb) / 255; const L = (max + min) / 2; const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * L - 1)); const ratio = (Math.max(lum(rgb), lum(on)) + 0.05) / (Math.min(lum(rgb), lum(on)) + 0.05);
    read.replaceChildren(h('span', {}, `Primary  HEX ${hex}  RGB ${rgb.join(' ')}`), h('span', {}, `HSL ${Math.round(settings.hue)}° ${Math.round(sat * 100)}% ${Math.round(L * 100)}%  (hue shown in OKLCH)`), h('span', {}, `OKLCH seed  hue ${settings.hue}  chroma x${Number(settings.chroma).toFixed(2)}  gamut sRGB`), h('span', {}, `Contrast of text on primary: ${ratio.toFixed(2)} to 1 ${ratio >= 4.5 ? '(passes 4.5)' : '(below 4.5, pick a lower chroma)'}`)); };
  const field = h('div', { class: 'picker', role: 'application', tabindex: '0', 'aria-label': 'Seed colour field. Arrow keys change hue and vividness.', onpointerdown: (e) => { field.setPointerCapture(e.pointerId); move(e); }, onpointermove: (e) => { if (e.buttons) move(e); }, onkeydown: (e) => { const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key]; if (!d) return; e.preventDefault(); settings.hue = (settings.hue + d[0] + 360) % 360; settings.chroma = Math.max(0, Math.min(1.6, +(settings.chroma + d[1]).toFixed(2))); paint(); } }, dot);
  const move = (e) => { const r = field.getBoundingClientRect(); settings.hue = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 360) % 360; settings.chroma = +(1.6 * (1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)))).toFixed(2); paint(); };
  const hex = h('md-outlined-text-field', { label: 'Take the hue from a HEX colour', placeholder: '#8A3F0B', 'supporting-text': 'Named colours and other spaces are not accepted here yet.', onchange: (e) => { const r = hexToHueChroma(e.target.value); if (!r) return toast('Enter a HEX colour such as #8A3F0B.', { kind: 'err' }); settings.hue = r.hue; settings.chroma = Math.max(0.2, Math.min(1.6, +(r.chroma / 0.12).toFixed(2))); paint(); } });
  setTimeout(paint); return h('div', { class: 'col', dataset: { pal: 'set-hue' } }, h('h3', { class: 'h2', style: 'font-size:1.15rem' }, 'Seed colour'), h('p', { class: 'muted small' }, 'Every colour in the app derives from this hue and vividness.'), field, h('div', { class: 'row' }, h('label', { class: 'col gap0' }, h('span', { class: 'small muted' }, 'Hue'), slider('hue', 0, 359, 1, 'Hue')), hex), read);
}
function settingsPage(root, params) {
  const mf = settingsSearch();
  if (params?.tab) { ST.tab = params.tab; clearSearch(true); } // a request for one category shows that category
  const school = settings.school;
  const P = {
    language: () => [h('h2', { class: 'h2' }, t('language')), school ? h('p', { class: 'muted' }, `${settings.schoolName} is on, so the app stays in English and playful options are not available.`) : frag(
      row('lang', 'language', 'Language mode', 'English, Hong Kong Cantonese, or both with English first and a compact Cantonese line beneath.', seg('lang', [['en', 'English'], ['yue', '廣東話'], ['bi', 'Bilingual']])),
      row('funnyEn', 'language', 'English funny level', '1 is fully serious, 5 is most playful. Changes the voice of messages, never the facts.', slider('funnyEn', 1, 5)), row('funnyYue', 'language', 'Cantonese funny level', 'Set separately from English.', slider('funnyYue', 1, 5)),
      row('dialogEmoji', 'language', 'Show emojis in dialogs and message boxes', 'Adds one decorative emoji to dialog titles. Never inside buttons or labels.', sw('dialogEmoji')),
      part('vocab', null, h('h2', { class: 'h2' }, 'Personal wording'), h('p', { class: 'muted' }, hasVocabulary() ? 'A personal wording file is loaded. It stays on this device and is never sent to the hub.' : 'No file loaded. Drop a personal wording JSON anywhere on the window, or choose one. It stays on this device. Up to 256 KiB. The whole file is checked before anything changes.'),
        h('div', { class: 'row' }, btn(hasVocabulary() ? 'Replace file' : 'Choose file', { kind: 'tonal', ic: 'upload_file', onclick: () => { const i = h('input', { type: 'file', accept: '.json,application/json', onchange: async () => i.files[0] && applyVocabularyFile(await i.files[0].text()) }); i.click(); } }), hasVocabulary() && btn('Clear', { kind: 'text', onclick: () => { localStorage.removeItem('mc.vocab'); setVocabulary(null); toast('Personal wording cleared'); S.rerender('vocab'); } })))),
      row('school', 'language', settings.schoolName, 'Forces English and hides playful features. Turning it off needs your PIN if you set one. This is a convenience lock, not security: clearing this site\'s storage resets it.', sw('school', (on, el) => { if (!on && settings.schoolPin) { settings.school = true; const pin = h('md-outlined-text-field', { label: 'PIN', type: 'password', inputmode: 'numeric' }); const close = sheet(frag(h('h2', { class: 'h2' }, `Turn off ${settings.schoolName}`), pin, h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn('Turn off', { onclick: () => { if (pin.value === settings.schoolPin) { settings.school = false; close(); } else toast('Wrong PIN', { kind: 'err' }); } }))), { label: 'PIN' }); } })),
      row('schoolName', 'language', 'Name of this mode', 'Shown everywhere instead of the default name.', h('md-outlined-text-field', { value: settings.schoolName, 'aria-label': 'Mode name', onchange: (e) => { settings.schoolName = e.target.value.trim() || DEFAULTS.schoolName; } })), row('schoolPin', 'language', 'PIN to turn it off', 'Stored on this device only.', h('md-outlined-text-field', { type: 'password', value: settings.schoolPin, 'aria-label': 'PIN', onchange: (e) => { settings.schoolPin = e.target.value; } }))],
    timed: timedTab,
    appearance: () => [h('h2', { class: 'h2' }, t('appearance')), row('theme', 'appearance', 'Theme', 'System follows the operating system.', seg('theme', [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']])),
      row('schedTheme', 'appearance', tx('Switch theme by time of day'), tx('Uses the dark theme between the two times below and the light theme for the rest of the day, by the clock of this device. While this is on it replaces the Theme choice above. It is checked every minute.') + ' ' + (settings.schedTheme ? tx('Right now: {v}.', { v: inWindow(settings.darkFrom, settings.darkTo) ? tx('dark until {t}', { t: settings.darkTo }) : tx('light until {t}', { t: settings.darkFrom }) }) : ''), sw('schedTheme')),
      row('darkFrom', 'appearance', tx('Dark theme starts at'), tx('Hours and minutes on this device. If the end below is earlier than this, the dark period runs past midnight.'), timeInput(settings.darkFrom, tx('Start'), (v) => { if (minutesOf(v) !== null) settings.darkFrom = v; }, 'darkFrom')),
      row('darkTo', 'appearance', tx('Dark theme ends at'), tx('The light theme returns at this time. If both times are the same, the schedule does nothing.'), timeInput(settings.darkTo, tx('End'), (v) => { if (minutesOf(v) !== null) settings.darkTo = v; }, 'darkTo')),
      h('p', { class: 'small' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); S.go('settings', { tab: 'timed' }); } }, tx('More timed settings: density, motion, contrast, sounds and install results')), '.'),
      logoBlock(), looksBlock(), row('density', 'appearance', 'Density', 'Compact shrinks controls to 40 px.', seg('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']])), row('motion', 'appearance', 'Motion', 'System follows the operating system reduced motion setting. Reduced replaces movement with instant changes.', seg('motion', [['full', 'Full'], ['reduced', 'Reduced'], ['system', 'System']])),
      row('drama', 'appearance', 'Full-screen install results', 'Every install or upgrade that finishes takes over the screen: a celebration on success, an alarm with the exit code and last output on failure. Failures stay until you dismiss them. Low stimulation turns this off and uses notifications instead.', sw('drama')),
      colourPicker(), row('chroma', 'appearance', 'Vividness', 'Multiplies colour strength.', slider('chroma', 0, 1.6, 0.05)),
      row('displayName', 'appearance', 'Display name', 'Shown in the title bar and the tab title. Does not change files, ids or update feeds.', h('md-outlined-text-field', { value: settings.displayName, placeholder: 'Material Choco', 'aria-label': 'Display name', onchange: (e) => { settings.displayName = e.target.value.trim().slice(0, 40); api('/api/audit', { method: 'POST', body: { action: 'display-name', detail: settings.displayName || '(reset)' } }).catch(() => {}); } })), row('paletteSize', 'appearance', 'Command palette size', 'A card, or the full window.', seg('paletteSize', [['card', 'Card'], ['full', 'Full window']]))],
    accessibility: () => [h('h2', { class: 'h2' }, t('accessibility')), row('textScale', 'accessibility', 'Text size', 'Scales all text and spacing.', seg('textScale', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Larger'], [1.5, 'Largest']])), row('contrast', 'accessibility', 'Contrast', 'High contrast darkens secondary text and outlines.', seg('contrast', [['normal', 'Normal'], ['high', 'High']])), row('targets', 'accessibility', 'Touch targets', 'Large raises controls to 56 px.', seg('targets', [['normal', 'Normal'], ['large', 'Large']])), row('focusRing', 'accessibility', 'Focus ring', 'Bold draws a thicker ring around the focused control.', seg('focusRing', [['normal', 'Normal'], ['bold', 'Bold']])), row('a11yMenu', 'accessibility', 'Show the accessibility button in the top bar', 'Settings search still reaches these controls when it is hidden.', sw('a11yMenu'))],
    sound: () => { const voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : []; const vp = (key, test) => h('md-outlined-select', { label: 'Voice', value: settings[key], style: 'min-width:240px', onchange: (e) => { settings[key] = e.target.value; } }, h('md-select-option', { value: '', selected: !settings[key] }, h('div', { slot: 'headline' }, 'Choose automatically')), voices.filter(test).map((v) => h('md-select-option', { value: v.name, selected: settings[key] === v.name }, h('div', { slot: 'headline' }, `${v.name} (${v.lang})`))));
      return [h('h2', { class: 'h2' }, t('sound')), row('sounds', 'sound', 'Action sounds', 'Short cues when a job is queued, finishes or fails. Visible feedback is always complete without sound.', sw('sounds', (on) => on && sound('ok'))), row('volume', 'sound', 'Volume', '', slider('volume', 0, 1, 0.1)), row('narration', 'sound', 'Spoken narrator', 'Reads job results aloud. Off unless you turn it on.', sw('narration')), row('narrationLang', 'sound', 'Narration language', '', seg('narrationLang', [['en', 'English'], ['yue', 'Cantonese'], ['both', 'Both']])),
        row('voiceEn', 'sound', 'English voice', `${voices.filter((v) => v.lang.startsWith('en')).length} English voice(s) on this device.`, vp('voiceEn', (v) => v.lang.startsWith('en'))), row('voiceYue', 'sound', 'Cantonese voice', voices.some((v) => /HK|yue/i.test(v.lang)) ? 'A Hong Kong Cantonese voice is available.' : 'This device has no Hong Kong Cantonese voice, so Cantonese narration stays silent.', vp('voiceYue', (v) => /HK|yue/i.test(v.lang))), row('rate', 'sound', 'Speaking rate', '', slider('rate', 0.5, 2, 0.1)), row('pitch', 'sound', 'Pitch', '', slider('pitch', 0.5, 2, 0.1)), part('narratorTest', 'Test the narrator', h('div', { class: 'row' }, btn('Test the narrator', { kind: 'tonal', ic: 'volume_up', onclick: () => { const u = new SpeechSynthesisUtterance('Material Choco narrator test'); u.rate = settings.rate; u.pitch = settings.pitch; speechSynthesis.speak(u); } })))]; },
    focus: () => [h('h2', { class: 'h2' }, t('focus_modes')), h('p', { class: 'muted' }, 'Each mode is separate and off by default. They change the layout only.'), row('focusMode', 'focus', 'Focus', 'Collapses the tab strip to icons and hides the overview banner.', sw('focusMode')), row('lowStim', 'focus', 'Low stimulation', 'Turns off movement, mutes colour and silences sounds. Works together with the system reduced motion setting.', sw('lowStim')), row('timeAware', 'focus', 'Time awareness', 'Shows a clock in the top bar and elapsed time on running jobs.', sw('timeAware')), row('oneThing', 'focus', 'One thing at a time', 'Pages show one machine at a time: the first machine selected in the top bar.', sw('oneThing')), row('momentum', 'focus', 'Momentum', 'After a job finishes, the notification offers the next logical step.', sw('momentum'))],
    // The search shows a description instead, because building this category reads from the hub.
    account: (quiet) => { if (quiet) return [part('account', tx('Sign in, password and passkeys'), h('p', { class: 'muted' }, tx('Shows who is signed in and with which role, changes the password, adds and deletes passkeys, and signs out. In the desktop app it names the Windows user, restarts the app as administrator and opens the data folder. Per-element locks are not built yet. The details are read from the hub when you open this category.')))];
      const host = h('div', { class: 'col' }, skeleton(2)); api('/api/account').then((a) => { const cur = h('md-outlined-text-field', { label: 'Current password', type: 'password' }); const nxt = h('md-outlined-text-field', { label: 'New password, at least 10 characters', type: 'password' });
        host.replaceChildren(a.desktop ? frag(h('p', { class: 'muted' }, `The desktop app signs you in as the Windows user ${a.name}. It listens on this computer only.`), window.desktop && h('div', { class: 'row' }, btn('Restart as administrator', { kind: 'tonal', ic: 'admin_panel_settings', onclick: () => window.desktop.relaunchElevated() }), btn('Open the data folder', { kind: 'text', ic: 'open_in_new', onclick: () => window.desktop.openData() })))
          : frag(h('p', { dataset: { accountRole: a.role || role() } }, `Signed in as ${a.name}. `, tx('Role: {r}.', { r: roleName(a.role || role()) })), h('h3', { class: 'h2', style: 'font-size:1.15rem' }, 'Change password'), h('div', { class: 'row' }, cur, nxt, btn(t('save'), { kind: 'tonal', onclick: async () => { try { await api('/api/account/password', { method: 'POST', body: { current: cur.value, next: nxt.value } }); toast('Password changed', { kind: 'ok' }); cur.value = nxt.value = ''; } catch (e) { toast(e.message, { kind: 'err' }); } } })), passkeyBlock(a), btn(t('sign_out'), { kind: 'outlined', ic: 'logout', onclick: async () => { await api('/api/logout', { method: 'POST' }); location.reload(); } }))); }).catch((e) => host.replaceChildren(errorPanel('Account could not be loaded', e.message)));
      return [h('h2', { class: 'h2' }, t('account')), host, h('p', { class: 'muted small' }, 'Per-element locks are not built yet. See the roadmap.')]; },
    data: () => [h('h2', { class: 'h2' }, t('data')), row('autoRefresh', 'data', 'Refresh inventory after every change', 'Agents re-read packages, sources, config and features after a command that changes the machine. This is always on in the agent; this switch is kept for clarity.', h('md-switch', { selected: true, disabled: true, 'aria-label': 'Always on' })),
      part('defaultGlobal', tx('Default global options'), h('p', { class: 'muted' }, 'Default global options added to every command you run from this browser:'), h('pre', { class: 'log cmd' }, Object.keys(settings.defaultGlobal).map((k) => '--' + k).join(' '))), h('div', { class: 'row', dataset: { pal: 'set-backup', find: tx('Export, import or reset settings') } }, btn('Export settings', { kind: 'tonal', ic: 'download', onclick: () => download('material-choco-settings.json', exportSettings(), 'application/json') }), btn('Import settings', { kind: 'text', ic: 'upload_file', onclick: () => { const i = h('input', { type: 'file', accept: '.json', onchange: async () => { try { importSettings(await i.files[0].text()); toast('Settings imported', { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err' }); } } }); i.click(); } }), btn('Reset every setting', { kind: 'outlined', ic: 'undo', onclick: async () => { if (await superConfirm({ title: 'Reset every setting on this device', detail: 'Language, appearance, accessibility, sound and tab choices return to their defaults. Machines, jobs and history on the hub are not touched.', action: 'reset' })) resetAll(); } }))],
    // In the search the changelog is described instead, because the viewer reads the changelog file.
    about: (quiet) => [h('h2', { class: 'h2' }, settings.displayName || 'Material Choco'),
      part('version', tx('Version and licence'), h('p', {}, `Version ${S.status.version}. ${S.status.builtAt ? 'Built ' + fmtTime(S.status.builtAt) : 'Build time unavailable: this copy was not produced by the release build.'}${S.status.commit ? ' Commit ' + S.status.commit.slice(0, 10) + '.' : ''}`), h('p', { class: 'muted' }, `CLI schema: ${S.schema.commands.length} commands, ${S.schema.commands.reduce((n, c) => n + c.options.length, 0)} command options, ${S.schema.globalOptions.length} global options, ${S.schema.configSettings.length} config settings, ${S.schema.features.length} features.`), h('p', { class: 'muted' }, 'Apache-2.0. Built on the Chocolatey CLI source in this repository. Not affiliated with or endorsed by Chocolatey Software. The installer is not code signed.')),
      h('div', { class: 'row', dataset: { pal: 'set-helpLinks', find: tx('Help and keyboard shortcuts') } }, btn(tx('Open Help'), { kind: 'tonal', ic: 'menu_book', onclick: () => S.go('help') }), btn(tx('Keyboard shortcuts'), { kind: 'text', ic: 'keyboard', onclick: () => S.go('help', { focus: 'help-Keyboard shortcuts' }) })),
      part('changelog', null, h('h2', { class: 'h2' }, 'Changelog'), quiet ? h('p', { class: 'muted' }, tx('Every change by version, with its own filter and export. It is read from the changelog file inside this build when you open this category.')) : changelogViewer())],
  };
  // Not a live region: it changes on every key. A change made by the user is spoken once, after
  // typing pauses, by the settings search row (settingsSearch).
  const count = h('p', { class: 'muted small', dataset: { settingsCount: '1' } });
  const view = h('div', { class: 'col', dataset: { settingsView: '1' } });
  let parts = null; const all = () => (parts ??= searchParts((id) => P[id](true)));
  const openCat = (id) => { ST.tab = id; SS.focus = { kind: 'tab' }; clearSearch(); keepFocus(view); };
  const openBtn = (id, key) => { const b = btn(t('open'), { kind: 'text', ic: 'chevron_right', onclick: () => openCat(id) }); b.setAttribute('aria-label', tx('Open {c}', { c: t(key) })); b.dataset.openCat = id; return b; };
  const draw = () => {
    const q = mf.st.q;
    if (!q) {
      count.hidden = true; count.textContent = ''; SS.said = ''; const body = h('div', { class: 'card rise' }); body.append(...P[ST.tab]().flat().filter(Boolean));
      return view.replaceChildren(h('div', { class: 'row gap6', role: 'tablist', 'aria-label': t('settings'), dataset: { settingsTabs: '1' } }, TABS.map(([id, key, ic]) => h('md-filter-chip', { label: t(key), selected: ST.tab === id, role: 'tab', onclick: (e) => { e.preventDefault(); ST.tab = id; S.rerender('settings-tab'); } }, icon(ic, 'sm')))), body);
    }
    const m = matcher(q, mf.st.regex); const list = all(); const hits = m.ok ? list.filter((x) => x.lines.some((l) => m.test(l))) : [];
    const groups = TABS.filter(([id]) => hits.some((x) => x.id === id));
    // A pattern that cannot be compiled is not applied. The error line of the search row says why and
    // the empty state says that nothing is shown, so the count is hidden instead of saying it a third time.
    count.textContent = m.ok ? tx('{a} of {b} settings match, in {c} of {d} categories.', { a: hits.length, b: list.length, c: groups.length, d: TABS.length }) : ''; count.hidden = !m.ok; SS.said = count.textContent;
    view.replaceChildren(...(groups.length ? groups.map(([id, key, ic]) => { const mine = hits.filter((x) => x.id === id); return h('div', { class: 'card', dataset: { settingsGroup: id } }, h('div', { class: 'row' }, icon(ic), h('h2', { class: 'h2', style: 'flex:1 1 10rem;min-width:0;overflow-wrap:anywhere' }, t(key)), h('span', { class: 'muted small' }, tx('{n} found', { n: mine.length })), openBtn(id, key)), mine.map((x) => x.el)); })
      : [emptyState('search', t('no_results'), m.ok ? tx('No setting in any category matches the search.') : tx('The pattern cannot be used, so no setting is shown.'), (() => { const b = btn(tx('Clear the search'), { kind: 'tonal', ic: 'close', onclick: () => { SS.focus = { kind: 'search' }; clearSearch(); keepFocus(view); } }); b.dataset.clearSearch = '1'; return b; })())]));
  };
  // The pattern builder previews against the lines the search tests: one per setting, and the rows of
  // a block too long for one regular expression test.
  SS.draw = draw; SS.sample = () => all().flatMap((x) => x.lines);
  root.append(title('settings'), SS.box, count, view); draw(); keepFocus(view);
}

export const PAGES2 = [{ id: 'jobs', icon: 'list_alt', render: jobs }, { id: 'schedules', icon: 'calendar_month', render: schedules }, { id: 'history', icon: 'history', render: history }, { id: 'help', icon: 'menu_book', render: help }, { id: 'settings', icon: 'settings', render: settingsPage }];
