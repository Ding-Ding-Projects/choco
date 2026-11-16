// Shared client state, API calls and the live event stream.
import { settings, eff } from './settings.js';
import { t } from './i18n.js';
import { toast, speak, sound, drama, lit } from './ui.js';

export const S = { status: null, schema: null, machines: [], jobs: [], scope: new Set(), mine: new Set(), samples: [], go: () => {}, rerender: () => {} };
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; e.data = data; throw e; }
  return data;
}
// Roles: admin, operator, viewer. A hub that does not report one is treated as a single admin.
export const role = () => (S.status?.authenticated ? S.status.role || 'admin' : null);
export const isAdmin = () => role() === 'admin';
export const canChange = () => role() !== 'viewer';
export const machine = (id) => S.machines.find((m) => m.id === id);
export const scoped = () => (S.scope.size ? S.machines.filter((m) => S.scope.has(m.id)) : S.machines);
export const TERMINAL = ['succeeded', 'failed', 'cancelled', 'expired'];
const waiting = new Map();
export function waitJob(id) { const j = S.jobs.find((x) => x.id === id); if (j && TERMINAL.includes(j.state)) return api('/api/jobs/' + id); return new Promise((resolve) => waiting.set(id, resolve)).then(() => api('/api/jobs/' + id)); }

// Queue a choco command on machines. Returns the created jobs.
export async function runJob(spec, { machineIds, quiet = false } = {}) {
  const ids = machineIds || scoped().map((m) => m.id);
  if (!ids.length) { toast('No machine is selected. Enroll or select a machine first.', { kind: 'err' }); return []; }
  const full = spec.kind === 'choco' ? { ...spec, global: { ...settings.defaultGlobal, ...spec.global } } : spec;
  try {
    const r = await api('/api/jobs', { method: 'POST', body: { machineIds: ids, spec: full } });
    for (const j of r.jobs) { upsertJob(j); if (!quiet) S.mine.add(j.id); }
    for (const s of r.skipped) toast(`${lit(s.machine)}: ${s.reason}`, { kind: 'err' });
    if (!quiet && r.jobs.length) { sound('tap'); toast(t('job_queued', { n: r.jobs.length }), { action: { label: t('open'), run: () => S.go('jobs', { job: r.jobs[0].id }) } }); }
    return r.jobs;
  } catch (e) { toast(e.message, { kind: 'err' }); return []; }
}

// A switch that changes a machine (a source, a feature) runs a job that takes many seconds with the
// real CLI. Until that job ends the switch shows the requested state and is locked, so a second press
// cannot queue the same command again. key names the switch, for example "<machine id>|feature|<name>".
export const pendingSwitches = new Map();
export const switchState = (key, current) => (pendingSwitches.has(key) ? { selected: pendingSwitches.get(key), disabled: true } : { selected: current, disabled: false });
export async function toggleJob(key, want, spec, opts) {
  if (pendingSwitches.has(key)) return [];
  pendingSwitches.set(key, want); S.rerender('pending');
  // After the job ends the lock stays until the machine's inventory has been read again, so the
  // switch never shows the old value in between. A refresh that never comes releases it after 20 s.
  const at = (id) => machine(id)?.inventory?.at || '';
  const before = new Map((opts?.machineIds || []).map((id) => [id, at(id)]));
  const jobs = await runJob(spec, opts);
  const done = () => { pendingSwitches.delete(key); S.rerender('pending'); };
  if (!jobs.length) { done(); return jobs; }
  const refreshed = () => jobs.every((j) => at(j.machineId) !== (before.get(j.machineId) ?? ''));
  Promise.all(jobs.map((j) => waitJob(j.id))).then(() => { const end = Date.now() + 20000; const tick = () => (refreshed() || Date.now() > end ? done() : setTimeout(tick, 500)); tick(); }, done);
  return jobs;
}
function upsertJob(j) { const i = S.jobs.findIndex((x) => x.id === j.id); if (i >= 0) S.jobs[i] = j; else S.jobs.unshift(j); }

export async function loadAll() {
  [S.schema, S.machines, S.jobs] = await Promise.all([S.schema || api('/api/schema'), api('/api/machines'), api('/api/jobs?limit=300')]);
  for (const id of [...S.scope]) if (!machine(id)) S.scope.delete(id);
}
let es = null;
export function connectEvents() {
  if (es) es.close(); es = new EventSource('/api/events');
  es.addEventListener('machine', (e) => { const m = JSON.parse(e.data); const i = S.machines.findIndex((x) => x.id === m.id); if (i >= 0) S.machines[i] = m; else S.machines.push(m); S.rerender('machine'); });
  es.addEventListener('machine-removed', (e) => { const { id } = JSON.parse(e.data); S.machines = S.machines.filter((m) => m.id !== id); S.scope.delete(id); S.rerender('machine'); });
  es.addEventListener('job', (e) => {
    const j = JSON.parse(e.data); upsertJob(j);
    if (TERMINAL.includes(j.state)) {
      const w = waiting.get(j.id); if (w) { waiting.delete(j.id); w(); }
      const isInstall = j.kind === 'choco' && /^choco (install|upgrade)\b/.test(j.command) && !/--what-if\b/.test(j.command);
      if (isInstall && eff('drama') && !settings.lowStim && (j.state === 'succeeded' || j.state === 'failed')) {
        const known = machine(j.machineId)?.name; const name = known || 'a removed machine'; const verb = j.command.startsWith('choco upgrade') ? 'Upgrade' : 'Install'; const secs = j.startedAt && j.endedAt ? Math.round((Date.parse(j.endedAt) - Date.parse(j.startedAt)) / 1000) : null;
        if (j.state === 'succeeded') drama({ kind: 'ok', title: `${verb} complete`, command: j.command, detail: `${lit(name)} finished with exit code 0${secs === null ? '' : ` in ${secs} s`}.` });
        else api('/api/jobs/' + j.id).then((d) => d.output, () => '').then((out) => drama({ kind: 'err', title: `${verb} failed`, command: j.command, detail: `${lit(name)} reported exit code ${j.exitCode}. ${j.note || 'Nothing else was changed on this machine by this job.'}`, output: out.trim().split(/\r?\n/).slice(-8).join('\n'), open: () => S.go('jobs', { job: j.id }) }));
        S.mine.delete(j.id);
      }
      if (S.mine.has(j.id)) { S.mine.delete(j.id); const name = machine(j.machineId)?.name || ''; const c = `${j.command} (${name})`;
        if (j.state === 'succeeded') { toast(t('job_ok', { c }), { kind: 'ok', action: { label: t('open'), run: () => S.go('jobs', { job: j.id }) } }); speak('Job finished on ' + lit(name), '工作完成'); if (settings.momentum && j.kind === 'choco') toast('Next step: check what is still out of date.', { action: { label: 'Updates', run: () => S.go('updates') } }); }
        else if (j.state === 'failed') { toast(lit(t('job_fail', { c, x: j.exitCode })) + (j.note ? ' ' + j.note : ''), { kind: 'err', action: { label: t('open'), run: () => S.go('jobs', { job: j.id }) } }); speak(`Job failed on ${lit(name)} with exit code ${j.exitCode}`, '工作失敗'); } }
    }
    S.rerender('job');
  });
  es.addEventListener('job-output', (e) => { const d = JSON.parse(e.data); document.dispatchEvent(new CustomEvent('mc-output', { detail: d })); });
  es.addEventListener('audit', () => document.dispatchEvent(new CustomEvent('mc-audit')));
  es.onerror = () => { document.documentElement.dataset.link = 'down'; };
  es.onopen = () => { if (document.documentElement.dataset.link === 'down') { document.documentElement.dataset.link = 'up'; loadAll().then(() => S.rerender('reconnect')); } };
  setInterval(() => { S.samples.push(S.jobs.filter((j) => j.state === 'running' || j.state === 'queued').length); if (S.samples.length > 60) S.samples.shift(); document.dispatchEvent(new CustomEvent('mc-sample')); }, 2000);
}
