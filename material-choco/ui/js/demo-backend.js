// Demo backend. Loaded by demo.html before the app. It stands in for the hub: every request to
// /api/ is answered from memory in this page, and /api/events is a local event source. Nothing
// is sent anywhere and nothing is installed anywhere. The simulated choco behaves like the test
// fixture in test/fixtures/fake-choco.js. Reloading the page starts again from the same state.
(() => {
  'use strict';
  const realFetch = window.fetch.bind(window);
  const iso = (ms = Date.now()) => new Date(ms).toISOString();
  const ago = (min) => iso(Date.now() - min * 60000);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

  // ---- event stream stand-in -----------------------------------------------------------------
  const streams = new Set();
  class DemoEventSource {
    constructor(url) { this.url = String(url); this.readyState = 1; this.listeners = new Map(); this.onopen = null; this.onerror = null; streams.add(this); setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0); }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    close() { this.readyState = 2; streams.delete(this); }
  }
  const emit = (type, payload) => { const data = JSON.stringify(payload); for (const s of streams) for (const fn of s.listeners.get(type) || []) { try { fn({ type, data }); } catch (e) { console.error(e); } } };
  window.EventSource = DemoEventSource;

  // ---- simulated machines ----------------------------------------------------------------------
  const CATALOGUE = { git: '2.47.1', '7zip': '24.08', putty: '0.81.0', vscode: '1.95.3', firefox: '132.0.2', notepadplusplus: '8.7.1', python: '3.13.0', nodejs: '22.11.0', vlc: '3.0.21', googlechrome: '131.0.6778.86' };
  const SOURCE = ['chocolatey', 'https://community.chocolatey.org/api/v2/', false, '', 0];
  let schema = null; let db = null;
  const fresh = () => ({
    nextJob: 1, pairings: [], schedules: [], webhooks: [], audit: [],
    users: [{ name: 'demo', role: 'admin', disabled: false, createdAt: ago(60 * 24 * 30), lastLogin: iso(), passkeys: 0 }, { name: 'olive', role: 'operator', disabled: false, createdAt: ago(60 * 24 * 12), lastLogin: ago(60 * 26), passkeys: 0 }, { name: 'vera', role: 'viewer', disabled: false, createdAt: ago(60 * 24 * 3), lastLogin: null, passkeys: 0 }],
    machines: [
      { id: 'demo-1', name: 'DESK-ANNA', hostname: 'desk-anna', os: 'Windows 11 Pro 23H2 (simulated)', groups: ['office'], readOnly: false, elevated: true, online: true, enrolledAt: ago(60 * 24 * 20), allowedCommands: null, agentAllow: null,
        st: { packages: { git: '2.46.0', '7zip': '24.07', putty: '0.81.0', vscode: '1.94.2', firefox: '132.0.2' }, pins: {}, sources: [[...SOURCE]], config: { commandExecutionTimeoutSeconds: '2700' }, features: {} } },
      { id: 'demo-2', name: 'KIOSK-LOBBY', hostname: 'kiosk-lobby', os: 'Windows 10 IoT Enterprise (simulated)', groups: ['kiosks'], readOnly: true, elevated: true, online: true, enrolledAt: ago(60 * 24 * 9), allowedCommands: null, agentAllow: null,
        st: { packages: { googlechrome: '130.0.6723.117', vlc: '3.0.21', '7zip': '24.08' }, pins: { vlc: true }, sources: [[...SOURCE]], config: { commandExecutionTimeoutSeconds: '2700' }, features: {} } },
      { id: 'demo-3', name: 'LAPTOP-SAM', hostname: 'laptop-sam', os: 'Windows 11 Home 24H2 (simulated)', groups: ['office'], readOnly: false, elevated: false, online: false, lastSeen: ago(60 * 52), enrolledAt: ago(60 * 24 * 15), allowedCommands: null, agentAllow: null,
        st: { packages: { git: '2.45.2', python: '3.12.7', notepadplusplus: '8.7.1' }, pins: {}, sources: [[...SOURCE], ['internal', 'https://packages.example.test/nuget/', true, 'svc-choco', 5]], config: { commandExecutionTimeoutSeconds: '2700', cacheLocation: 'D:\\choco-cache' }, features: {} } },
    ],
  });
  const inventoryOf = (m, at = iso()) => {
    const st = m.st; const packages = Object.entries(st.packages).map(([name, version]) => ({ name, version }));
    return { available: true, at, chocoVersion: '2.5.1', errors: [], packages,
      outdated: packages.filter((p) => CATALOGUE[p.name] && CATALOGUE[p.name] !== p.version).map((p) => ({ name: p.name, version: p.version, available: CATALOGUE[p.name], pinned: !!st.pins[p.name] })),
      sources: st.sources.map(([name, url, disabled, user, priority]) => ({ name, url, disabled: !!disabled, user: user || '', certificate: '', priority: Number(priority) || 0, bypassProxy: false, selfService: false, adminOnly: false })),
      config: schema.configSettings.map((c) => ({ name: c.name, value: st.config[c.name] ?? '', description: c.description })),
      features: schema.features.map((f) => ({ name: f.name, enabled: f.name in st.features ? st.features[f.name] : !!f.default, description: f.description })),
      pins: Object.keys(st.pins).filter((n) => st.packages[n]).map((name) => ({ name, version: st.packages[name] })) };
  };
  const publicMachine = (m) => ({ allowedCommands: Array.isArray(m.allowedCommands) ? m.allowedCommands : null, agentAllowedCommands: Array.isArray(m.agentAllow) ? m.agentAllow : null, id: m.id, name: m.name, hostname: m.hostname, os: m.os, arch: 'x64', groups: m.groups || [], readOnly: !!m.readOnly, local: false, elevated: !!m.elevated, agentVersion: 'demo', enrolledAt: m.enrolledAt, lastSeen: m.online ? iso() : m.lastSeen, online: !!m.online, inventory: m.inventory || null });
  const publicJob = (j) => ({ id: j.id, machineId: j.machineId, kind: j.spec.kind, command: j.display, state: j.state, createdAt: j.createdAt, startedAt: j.startedAt || null, endedAt: j.endedAt || null, exitCode: j.exitCode ?? null, by: j.by, note: j.note || '', destructive: !!j.destructive });
  const audit = (user, action, detail = {}) => { const row = { at: iso(), user, action, ...detail }; db.audit.unshift(row); if (db.audit.length > 2000) db.audit.pop(); emit('audit', row); };
  const machineById = (id) => { const m = db.machines.find((x) => x.id === id); if (!m) throw new HttpError(404, 'No such machine'); return m; };

  // ---- command line, classification and allow lists, the way the hub does them ---------------------
  const cmdOf = (name) => schema.commands.find((c) => c.name === name || (c.aliases || []).includes(name));
  function display(spec) {
    const cmd = cmdOf(spec.command); if (!cmd) throw new HttpError(400, `Unknown choco command: ${spec.command}`);
    const parts = [cmd.name]; if (spec.subcommand) { if (!cmd.subcommands.includes(spec.subcommand)) throw new HttpError(400, `Unknown subcommand for ${cmd.name}: ${spec.subcommand}`); parts.push(spec.subcommand); }
    for (const a of spec.args || []) { if (String(a).startsWith('-')) throw new HttpError(400, `Arguments cannot start with "-": ${a}`); if (a) parts.push(String(a)); }
    const add = (list, values, kind) => { for (const [id, v] of Object.entries(values || {})) { const o = list.find((x) => x.id === id); if (!o) throw new HttpError(400, `Unknown ${kind} option for ${cmd.name}: ${id}`); if (v === false || v === '' || v == null) continue; parts.push(o.takesValue ? `${o.flag}=${o.secret ? '********' : v}` : o.flag); } };
    add(cmd.options, spec.options, 'command'); add(schema.globalOptions, spec.global, 'global'); return parts.join(' ');
  }
  function classify(spec) {
    const cmd = cmdOf(spec.command); if (!cmd || (spec.global && spec.global['what-if'])) return { mutating: false, destructive: false };
    const sub = spec.subcommand || 'list'; const bySub = ['pin', 'source', 'config', 'feature', 'apikey', 'cache'].includes(cmd.name);
    return { mutating: ['install', 'upgrade', 'uninstall', 'unpackself', 'push'].includes(cmd.name) || (bySub && !['list', 'get', 'info'].includes(sub)), destructive: ['uninstall', 'unpackself'].includes(cmd.name) || (bySub && ['remove', 'unset'].includes(sub)) };
  }
  const allowedBy = (allow, spec) => !Array.isArray(allow) || spec.kind !== 'choco' || allow.includes(cmdOf(spec.command)?.name);

  // ---- the simulated choco: same rules as the test fixture -------------------------------------------
  // Returns the output lines and the exit code, and changes the machine's state as the command would.
  function runChoco(m, spec) {
    const st = m.st; const out = []; let code = 0; const cmd = cmdOf(spec.command).name; const sub = spec.subcommand || ''; const pos = (spec.args || []).filter(Boolean); const opt = (n) => (spec.options || {})[n] ?? (spec.global || {})[n];
    if (spec.global && spec.global['what-if']) { out.push(`Chocolatey would have run 'choco ${cmd}${sub ? ' ' + sub : ''} ${pos.join(' ')}'.`, 'This was a dry run (--what-if). Nothing was changed.'); return { out, code }; }
    if (cmd === 'list') for (const [n, v] of Object.entries(st.packages)) out.push(`${n}|${v}`);
    else if (cmd === 'outdated') for (const [n, v] of Object.entries(st.packages)) { if (CATALOGUE[n] && CATALOGUE[n] !== v) out.push(`${n}|${v}|${CATALOGUE[n]}|${st.pins[n] ? 'true' : 'false'}`); }
    else if (cmd === 'search') for (const [n, v] of Object.entries(CATALOGUE)) { if (!pos[0] || (opt('exact') ? n === pos[0] : n.includes(pos[0]))) out.push(`${n}|${v}`); }
    else if (cmd === 'info') { const n = pos[0]; if (!CATALOGUE[n]) out.push('0 packages found.'); else out.push(`${n} ${CATALOGUE[n]}`, ` Title: ${n} | Published: 2026-01-01`, ' Summary: sample package in the demo catalogue'); }
    else if (cmd === 'install' || cmd === 'upgrade') { const names = pos[0] === 'all' ? Object.keys(st.packages) : pos; if (!names.length) { out.push(`No package was named for ${cmd}.`); code = 1; }
      for (const n of names) { if (!CATALOGUE[n]) { out.push(`${n} not found`); code = 1; continue; } if (cmd === 'upgrade' && st.pins[n]) { out.push(`${n} is pinned, skipping`); continue; } const v = opt('version') || CATALOGUE[n]; if (st.packages[n] === v && !opt('force')) { out.push(`${n} v${v} is the latest version available based on your source(s).`); continue; } out.push(`Installing ${n} ${v}...`, `Downloading ${n} from the simulated source...`, ` The ${cmd} of ${n} was successful.`); st.packages[n] = v; }
      out.push(code ? 'Chocolatey finished with failures. See the lines above.' : `Chocolatey ${cmd === 'install' ? 'installed' : 'upgraded'} ${names.filter((n) => CATALOGUE[n]).length}/${names.length} packages.`); }
    else if (cmd === 'uninstall') for (const n of pos) { if (!st.packages[n]) { out.push(`${n} is not installed`); code = 1; } else { delete st.packages[n]; delete st.pins[n]; out.push(`${n} has been uninstalled.`); } }
    else if (cmd === 'pin') { const n = opt('name'); if (!sub || sub === 'list') for (const k of Object.keys(st.pins)) out.push(`${k}|${st.packages[k]}`); else if (!st.packages[n]) { out.push(`${n} is not installed, so it cannot be pinned`); code = 1; } else if (sub === 'add') { st.pins[n] = true; out.push(`Created a pin for ${n}`); } else { delete st.pins[n]; out.push(`Removed pin for ${n}`); } }
    else if (cmd === 'source') { const n = opt('name'); if (!sub || sub === 'list') for (const s of st.sources) out.push(`${s[0]}|${s[1]}|${s[2] ? 'True' : 'False'}|${s[3]}||${s[4]}|False|False|False`);
      else if (!n) { out.push('A source name is required.'); code = 1; } else if (sub === 'add') { if (!opt('source')) { out.push('A source location is required.'); code = 1; } else { st.sources = st.sources.filter((s) => s[0] !== n); st.sources.push([n, String(opt('source')), false, opt('user') || '', Number(opt('priority')) || 0]); out.push(`Added ${n}`); } }
      else if (sub === 'remove') { st.sources = st.sources.filter((s) => s[0] !== n); out.push(`Removed ${n}`); } else { for (const s of st.sources) if (s[0] === n) s[2] = sub === 'disable'; out.push(`${sub}d ${n}`); } }
    else if (cmd === 'config') { const n = opt('name'); if (!sub || sub === 'list') for (const c of schema.configSettings) out.push(`${c.name}|${st.config[c.name] ?? ''}|${c.description}`); else if (sub === 'get') out.push(st.config[n] || ''); else if (sub === 'set') { st.config[n] = String(opt('value')); out.push(`Updated ${n}`); } else { delete st.config[n]; out.push(`Unset ${n}`); } }
    else if (cmd === 'feature') { const n = opt('name'); if (!sub || sub === 'list') for (const f of schema.features) out.push(`${f.name}|${(f.name in st.features ? st.features[f.name] : !!f.default) ? 'Enabled' : 'Disabled'}|${f.description}`); else { st.features[n] = sub === 'enable'; out.push(`${sub}d ${n}`); } }
    else out.push(`demo: choco ${cmd}${sub ? ' ' + sub : ''} ${pos.join(' ')}`.trim(), 'This command is not modelled in the demo, so it did nothing here.');
    return { out, code };
  }

  // ---- jobs --------------------------------------------------------------------------------------
  const timers = new Map();
  function createJob(m, spec, by) {
    let shown = 'inventory refresh'; let cls = { mutating: false, destructive: false };
    if (spec.kind === 'choco') { shown = 'choco ' + display(spec) + (spec.file ? ` [${spec.file.name}]` : ''); cls = classify(spec); } else if (spec.kind !== 'inventory') throw new HttpError(400, 'Unknown job kind');
    if (m.readOnly && cls.mutating) throw new HttpError(409, `${m.name} is read only and will refuse this command`);
    for (const list of [m.allowedCommands, m.agentAllow]) if (!allowedBy(list, spec)) throw new HttpError(409, `${m.name} only allows these commands: ${list.join(', ') || '(none)'}`);
    const job = { id: db.nextJob++, machineId: m.id, spec: clone(spec), display: shown, state: 'queued', createdAt: iso(), by, destructive: cls.destructive, mutating: cls.mutating, output: '' };
    db.jobs.push(job); audit(by, 'job.create', { job: job.id, machine: m.name, command: shown }); emit('job', publicJob(job)); if (m.online) start(job, m); return job;
  }
  function start(job, m) {
    const steps = []; const later = (ms, fn) => steps.push(setTimeout(fn, ms)); timers.set(job.id, steps);
    later(250, () => {
      job.state = 'running'; job.startedAt = iso(); emit('job', publicJob(job));
      if (job.spec.kind === 'inventory') return later(450, () => finish(job, m, 0, true));
      let res; if (job.spec.file) res = { out: ['Reading packages.config...', 'The demo does not install from an uploaded file. Nothing was changed.'], code: 0 }; else res = runChoco(m, job.spec);
      const lines = [`Chocolatey v2.5.1 (simulated in this page)`, ...res.out]; const gap = Math.max(90, Math.min(320, 1500 / lines.length));
      lines.forEach((line, i) => later(gap * (i + 1), () => { job.output += line + '\n'; emit('job-output', { id: job.id, chunk: line + '\n' }); }));
      later(gap * (lines.length + 1) + 120, () => finish(job, m, res.code, job.mutating));
    });
  }
  function finish(job, m, code, refresh) {
    timers.delete(job.id); job.state = code === 0 ? 'succeeded' : 'failed'; job.exitCode = code; job.endedAt = iso();
    if (refresh && db.machines.includes(m)) { m.inventory = inventoryOf(m); emit('machine', publicMachine(m)); }
    audit('agent', code === 0 ? 'job.succeeded' : 'job.failed', { job: job.id, machine: m.name, exitCode: code }); emit('job', publicJob(job));
  }
  function cancel(job) { if (['succeeded', 'failed', 'cancelled', 'expired'].includes(job.state)) throw new HttpError(409, 'That job has already ended'); for (const t of timers.get(job.id) || []) clearTimeout(t); timers.delete(job.id); job.state = 'cancelled'; job.endedAt = iso(); job.note = 'Cancelled in the demo.'; emit('job', publicJob(job)); }

  // ---- routes --------------------------------------------------------------------------------------
  const ROLES = ['viewer', 'operator', 'admin']; const EVENTS = ['job.failed', 'job.succeeded', 'machine.offline', 'login.lockout', 'test']; const NOT_HERE = 'This needs a real hub, so it is not available in the demo.';
  const publicUser = (u) => ({ name: u.name, role: u.role, disabled: !!u.disabled, createdAt: u.createdAt, lastLogin: u.lastLogin, totpEnabled: false, passkeys: u.passkeys || 0 });
  const admins = () => db.users.filter((u) => u.role === 'admin' && !u.disabled);
  const userByName = (n) => { const u = db.users.find((x) => x.name.toLowerCase() === decodeURIComponent(n).toLowerCase()); if (!u) throw new HttpError(404, 'No such user'); return u; };
  const cleanHook = (b, prev = {}) => { const w = { ...prev }; if (b.name !== undefined) w.name = String(b.name).trim().slice(0, 60); if (!w.name) throw new HttpError(400, 'Name the webhook');
    if (b.url !== undefined) w.url = String(b.url).trim(); if (!/^https:\/\/[^\s/]+/.test(w.url || '') && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(w.url || '')) throw new HttpError(400, 'The address must be HTTPS. Plain HTTP is accepted for localhost only.');
    if (b.format !== undefined) w.format = ['json', 'discord'].includes(b.format) ? b.format : 'json'; w.format = w.format || 'json'; if (b.events !== undefined) w.events = (Array.isArray(b.events) ? b.events : []).filter((e) => EVENTS.includes(e) && e !== 'test'); w.events = w.events || ['job.failed'];
    if (b.offlineMinutes !== undefined) w.offlineMinutes = Math.max(2, Math.min(10080, Number(b.offlineMinutes) || 10)); w.offlineMinutes = w.offlineMinutes || 10; if (b.enabled !== undefined) w.enabled = !!b.enabled; if (w.enabled === undefined) w.enabled = true; return w; };
  const cleanSchedule = (b, prev = {}) => { const s = { ...prev }; if (b.name !== undefined) s.name = String(b.name).trim().slice(0, 60); if (!s.name) throw new HttpError(400, 'Name the schedule'); if (b.time !== undefined) s.time = String(b.time); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time || '')) throw new HttpError(400, 'Time must be HH:MM in 24 hour form');
    if (b.days !== undefined) s.days = (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 0 && d <= 6); if (b.target !== undefined) s.target = b.target; if (b.enabled !== undefined) s.enabled = !!b.enabled; if (b.spec !== undefined) { if (!b.spec || typeof b.spec !== 'object') throw new HttpError(400, 'Missing command'); if (b.spec.kind === 'choco') display(b.spec); else if (b.spec.kind !== 'inventory') throw new HttpError(400, 'Unknown job kind'); s.spec = clone(b.spec); } return s; };
  const code = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const pick = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => a[x % a.length]).join(''); return `${pick()}-${pick()}`; };

  const routes = [
    ['GET', /^\/api\/status$/, () => ({ product: 'Material Choco', version: 'demo', builtAt: null, commit: null, desktop: false, demo: true, setupNeeded: false, authenticated: true, user: 'demo', role: 'admin', passkeysAvailable: false, roles: ROLES, hubTime: iso(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, tls: false, hostname: 'demo' })],
    ['GET', /^\/api\/schema$/, () => schema],
    ['POST', /^\/api\/(setup|login|login\/passkey\/begin|login\/passkey\/finish)$/, () => { throw new HttpError(400, 'The demo is already signed in as a sample admin. ' + NOT_HERE); }],
    ['POST', /^\/api\/logout$/, () => ({ ok: true })],
    ['GET', /^\/api\/machines$/, () => db.machines.map(publicMachine)],
    ['PATCH', /^\/api\/machines\/([^/]+)$/, (b, id) => { const m = machineById(id); if (b.name !== undefined) { const n = String(b.name).trim().slice(0, 60); if (!n) throw new HttpError(400, 'Name the machine'); m.name = n; } if (b.groups !== undefined) m.groups = (Array.isArray(b.groups) ? b.groups : []).map((g) => String(g).trim()).filter(Boolean).slice(0, 12); if (typeof b.readOnly === 'boolean') m.readOnly = b.readOnly;
      if (b.allowedCommands !== undefined) { if (b.allowedCommands === null || b.allowedCommands === 'all') m.allowedCommands = null; else { if (!Array.isArray(b.allowedCommands)) throw new HttpError(400, 'allowedCommands must be a list of choco command names, or null'); m.allowedCommands = [...new Set(b.allowedCommands.map((c) => { const k = cmdOf(String(c)); if (!k) throw new HttpError(400, `Unknown choco command in the allow list: ${c}`); return k.name; }))].sort(); } audit('demo', 'machine.allow', { machine: m.name, allowed: m.allowedCommands ? m.allowedCommands.join(',') || '(none)' : 'all' }); }
      audit('demo', 'machine.update', { machine: m.name }); emit('machine', publicMachine(m)); return publicMachine(m); }],
    ['DELETE', /^\/api\/machines\/([^/]+)$/, (b, id) => { const m = machineById(id); db.machines = db.machines.filter((x) => x !== m); for (const j of db.jobs) if (j.machineId === id && (j.state === 'queued' || j.state === 'running')) cancel(j); audit('demo', 'machine.remove', { machine: m.name }); emit('machine-removed', { id }); return { ok: true }; }],
    ['POST', /^\/api\/pairing$/, (b) => { const p = { code: code(), expires: Date.now() + 10 * 60 * 1000, readOnly: !!b.readOnly, used: false }; db.pairings.push(p); audit('demo', 'pairing.create', { readOnly: p.readOnly }); notifyDemo(); return { code: p.code, expires: iso(p.expires) }; }],
    ['POST', /^\/api\/jobs$/, (b) => { if (!b.spec || typeof b.spec !== 'object') throw new HttpError(400, 'Missing command'); const jobs = []; const skipped = []; for (const id of Array.isArray(b.machineIds) ? b.machineIds : []) { const m = machineById(id); try { jobs.push(publicJob(createJob(m, b.spec, 'demo'))); } catch (e) { if (e.status === 400) throw e; skipped.push({ machine: m.name, reason: e.message }); } } return { jobs, skipped }; }],
    ['GET', /^\/api\/jobs$/, (b, q) => db.jobs.slice(-(Math.min(Number(q.get('limit')) || 200, 2000))).reverse().map(publicJob)],
    ['GET', /^\/api\/jobs\/(\d+)$/, (b, id) => { const j = db.jobs.find((x) => x.id === Number(id)); if (!j) throw new HttpError(404, 'No such job'); return { ...publicJob(j), output: j.output }; }],
    ['POST', /^\/api\/jobs\/(\d+)\/cancel$/, (b, id) => { const j = db.jobs.find((x) => x.id === Number(id)); if (!j) throw new HttpError(404, 'No such job'); cancel(j); audit('demo', 'job.cancel', { job: j.id }); return publicJob(j); }],
    ['GET', /^\/api\/schedules$/, () => db.schedules],
    ['POST', /^\/api\/schedules$/, (b) => { const s = cleanSchedule(b, { id: 's' + Date.now().toString(36), enabled: true, days: [], target: { all: true }, lastRun: null }); if (!s.spec) throw new HttpError(400, 'Missing command'); db.schedules.push(s); audit('demo', 'schedule.create', { schedule: s.name }); return s; }],
    ['PATCH', /^\/api\/schedules\/([^/]+)$/, (b, id) => { const i = db.schedules.findIndex((x) => x.id === id); if (i < 0) throw new HttpError(404, 'No such schedule'); db.schedules[i] = cleanSchedule(b, db.schedules[i]); audit('demo', 'schedule.update', { schedule: db.schedules[i].name }); return db.schedules[i]; }],
    ['DELETE', /^\/api\/schedules\/([^/]+)$/, (b, id) => { const s = db.schedules.find((x) => x.id === id); if (!s) throw new HttpError(404, 'No such schedule'); db.schedules = db.schedules.filter((x) => x !== s); audit('demo', 'schedule.delete', { schedule: s.name }); return { ok: true }; }],
    ['GET', /^\/api\/audit$/, (b, q) => db.audit.slice(0, Math.min(Number(q.get('limit')) || 500, 5000))],
    ['POST', /^\/api\/audit$/, (b) => { audit('demo', 'ui.' + String(b.action || 'note').replace(/[^\w.-]/g, '').slice(0, 40), { detail: String(b.detail || '').slice(0, 300) }); return { ok: true }; }],
    ['GET', /^\/api\/account$/, () => ({ name: 'demo', role: 'admin', totpEnabled: false, passkeys: 0, passkeysAvailable: false, desktop: false, demo: true })],
    ['POST', /^\/api\/account\/password$/, () => { throw new HttpError(400, 'The demo account has no password. ' + NOT_HERE); }],
    ['GET', /^\/api\/account\/passkeys$/, () => []],
    ['POST', /^\/api\/account\/passkeys\/(begin|finish)$/, () => { throw new HttpError(400, 'Passkeys are checked by a real hub. ' + NOT_HERE); }],
    ['GET', /^\/api\/users$/, () => db.users.map(publicUser)],
    ['POST', /^\/api\/users$/, (b) => { const name = String(b.name || '').trim(); if (!/^[\w.@-]{2,40}$/.test(name)) throw new HttpError(400, 'Names are 2 to 40 letters, digits, dot, dash, underscore or @'); if (db.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, 'That name is taken'); if (String(b.password || '').length < 10) throw new HttpError(400, 'Password must be at least 10 characters'); const role = ROLES.includes(b.role) ? b.role : 'viewer'; const u = { name, role, disabled: false, createdAt: iso(), lastLogin: null, passkeys: 0 }; db.users.push(u); audit('demo', 'user.create', { target: name, role }); return publicUser(u); }],
    ['PATCH', /^\/api\/users\/([^/]+)$/, (b, n) => { const u = userByName(n); const last = u.role === 'admin' && !u.disabled && admins().length === 1; if (b.role !== undefined && b.role !== u.role) { if (!ROLES.includes(b.role)) throw new HttpError(400, 'Unknown role'); if (last) throw new HttpError(409, 'The last enabled administrator cannot be given another role'); u.role = b.role; audit('demo', 'user.role', { target: u.name, role: u.role }); }
      if (b.disabled !== undefined && !!b.disabled !== u.disabled) { if (b.disabled && last) throw new HttpError(409, 'The last enabled administrator cannot be disabled'); u.disabled = !!b.disabled; audit('demo', u.disabled ? 'user.disable' : 'user.enable', { target: u.name }); } if (b.password !== undefined) { if (String(b.password).length < 10) throw new HttpError(400, 'Password must be at least 10 characters'); audit('demo', 'user.password', { target: u.name }); } return publicUser(u); }],
    ['DELETE', /^\/api\/users\/([^/]+)$/, (b, n) => { const u = userByName(n); if (u.role === 'admin' && !u.disabled && admins().length === 1) throw new HttpError(409, 'The last enabled administrator cannot be deleted'); db.users = db.users.filter((x) => x !== u); audit('demo', 'user.delete', { target: u.name }); return { ok: true }; }],
    ['GET', /^\/api\/webhooks$/, () => ({ events: EVENTS, formats: ['json', 'discord'], webhooks: db.webhooks })],
    ['POST', /^\/api\/webhooks$/, (b) => { if (db.webhooks.length >= 20) throw new HttpError(409, 'A hub holds up to 20 webhooks'); const w = cleanHook(b, { id: 'w' + Date.now().toString(36), createdAt: iso() }); db.webhooks.push(w); audit('demo', 'webhook.create', { webhook: w.name }); return w; }],
    ['PATCH', /^\/api\/webhooks\/([^/]+)$/, (b, id) => { const i = db.webhooks.findIndex((x) => x.id === id); if (i < 0) throw new HttpError(404, 'No such webhook'); db.webhooks[i] = cleanHook(b, db.webhooks[i]); audit('demo', 'webhook.update', { webhook: db.webhooks[i].name }); return db.webhooks[i]; }],
    ['DELETE', /^\/api\/webhooks\/([^/]+)$/, (b, id) => { const w = db.webhooks.find((x) => x.id === id); if (!w) throw new HttpError(404, 'No such webhook'); db.webhooks = db.webhooks.filter((x) => x !== w); audit('demo', 'webhook.delete', { webhook: w.name }); return { ok: true }; }],
    ['POST', /^\/api\/webhooks\/([^/]+)\/test$/, (b, id) => { const w = db.webhooks.find((x) => x.id === id); if (!w) throw new HttpError(404, 'No such webhook'); audit('demo', 'webhook.simulated', { webhook: w.name, event: 'test' }); return { ok: false, simulated: true, status: 0, attempts: 0, error: 'Simulated: the demo never sends anything, so no message left this page.' }; }],
  ];

  // ---- start: load the CLI schema (a static file of this page) and build the sample state -----------------
  const boot = async () => {
    if (!schema) { const r = await realFetch(new URL('vendor/choco-schema.json', document.baseURI)); if (!r.ok) throw new HttpError(500, 'The demo could not load its copy of the CLI option list'); schema = await r.json(); }
    db = fresh(); db.jobs = []; for (const m of db.machines) m.inventory = inventoryOf(m, m.online ? ago(4) : m.lastSeen);
    // A little believable history, written by the same code paths the page uses.
    const past = (m, spec, minutes) => { const res = runChoco(m, spec); const j = { id: db.nextJob++, machineId: m.id, spec, display: 'choco ' + display(spec), state: res.code ? 'failed' : 'succeeded', exitCode: res.code, createdAt: ago(minutes), startedAt: ago(minutes), endedAt: ago(minutes - 0.2), by: 'demo', destructive: false, mutating: true, output: 'Chocolatey v2.5.1 (simulated in this page)\n' + res.out.join('\n') + '\n' }; db.jobs.push(j); db.audit.unshift({ at: j.createdAt, user: 'demo', action: 'job.create', job: j.id, machine: m.name, command: j.display }, { at: j.endedAt, user: 'agent', action: res.code ? 'job.failed' : 'job.succeeded', job: j.id, machine: m.name, exitCode: res.code }); };
    db.audit.unshift({ at: ago(60 * 24 * 20), user: 'agent', action: 'machine.enroll', machine: 'DESK-ANNA' }, { at: ago(60 * 24 * 15), user: 'agent', action: 'machine.enroll', machine: 'LAPTOP-SAM' }, { at: ago(60 * 24 * 9), user: 'agent', action: 'machine.enroll', machine: 'KIOSK-LOBBY' });
    past(db.machines[0], { kind: 'choco', command: 'upgrade', args: ['putty'], global: { confirm: true } }, 190); past(db.machines[0], { kind: 'choco', command: 'install', args: ['winamp-classic'], global: { confirm: true } }, 75);
    const waiting = { id: db.nextJob++, machineId: 'demo-3', spec: { kind: 'choco', command: 'upgrade', args: ['all'], global: { confirm: true } }, display: 'choco upgrade all --confirm', state: 'queued', createdAt: ago(45), by: 'demo', destructive: false, mutating: true, output: '' }; db.jobs.push(waiting); db.audit.unshift({ at: waiting.createdAt, user: 'demo', action: 'job.create', job: waiting.id, machine: 'LAPTOP-SAM', command: waiting.display });
    for (const m of db.machines) m.inventory = inventoryOf(m, m.online ? ago(4) : m.lastSeen);
    db.audit.sort((a, b) => (a.at < b.at ? 1 : -1));
    db.schedules.push({ id: 's-demo', name: 'Nightly inventory', time: '03:00', days: [], spec: { kind: 'inventory' }, target: { all: true }, enabled: true, lastRun: ago(60 * 9) });
  };
  let ready = boot();

  // ---- schedules run as in the hub: checked every 20 seconds, once per day at their minute -------------
  function tickSchedules(now = new Date()) {
    if (!db) return;
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); const day = now.toDateString();
    for (const s of db.schedules) {
      if (!s.enabled || s.time !== hhmm || s.lastRunDay === day) continue;
      if (Array.isArray(s.days) && s.days.length && !s.days.includes(now.getDay())) continue;
      s.lastRunDay = day; s.lastRun = now.toISOString(); let n = 0;
      const t = s.target || { all: true };
      const machines = t.all ? db.machines : t.group ? db.machines.filter((m) => (m.groups || []).includes(t.group)) : db.machines.filter((m) => (t.machineIds || []).includes(m.id));
      for (const m of machines) { try { createJob(m, clone(s.spec), `schedule:${s.name}`); n++; } catch { /* read only machines and allow lists skip it, as in the hub */ } }
      audit('scheduler', 'schedule.run', { schedule: s.name, jobs: n });
    }
  }
  setInterval(() => tickSchedules(), 20000);

  // ---- the fetch replacement ------------------------------------------------------------------------
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  window.fetch = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url; const url = new URL(raw, location.href);
    if (!(url.origin === location.origin && url.pathname.startsWith('/api/')) && !String(raw).startsWith('/api/')) return realFetch(input, init);
    const path = String(raw).startsWith('/api/') ? String(raw).split('?')[0] : url.pathname; const method = String(init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    try { await ready; let body = {}; if (init.body) { try { body = JSON.parse(init.body); } catch { throw new HttpError(400, 'The request body is not JSON'); } }
      for (const [m, re, fn] of routes) { if (m !== method) continue; const hit = re.exec(path); if (!hit) continue; const args = hit.slice(1); return json(200, await fn(body, ...(args.length ? args : [url.searchParams]), url.searchParams)); }
      return json(404, { error: 'The demo has no answer for this request.' });
    } catch (e) { return json(e.status || 500, { error: e.message }); }
  };

  // ---- controls the banner in demo.html uses ------------------------------------------------------------
  const watchers = new Set(); const notifyDemo = () => { for (const fn of watchers) fn(); };
  window.materialChocoDemo = {
    onChange: (fn) => { watchers.add(fn); },
    openPairing: () => (db ? db.pairings.find((p) => !p.used && p.expires > Date.now()) || null : null),
    // Adds the fourth sample machine, as if an agent had used the newest pairing code.
    join: async () => { await ready; const p = window.materialChocoDemo.openPairing(); if (!p) return { error: 'Create a pairing code on the Machines page first. A machine can only join with a code.' }; if (db.machines.length >= 8) return { error: 'The demo stops at eight machines. Use Reset demo to start again.' }; p.used = true; const n = db.machines.length + 1;
      const m = { id: 'demo-' + Date.now().toString(36), name: `NEW-PC-0${n}`, hostname: `new-pc-0${n}`, os: 'Windows 11 Pro 24H2 (simulated)', groups: [], readOnly: p.readOnly, elevated: true, online: true, enrolledAt: iso(), allowedCommands: null, agentAllow: null, st: { packages: { '7zip': '24.07', firefox: '131.0.3' }, pins: {}, sources: [[...SOURCE]], config: { commandExecutionTimeoutSeconds: '2700' }, features: {} } };
      m.inventory = inventoryOf(m); db.machines.push(m); audit('agent', 'machine.enroll', { machine: m.name }); emit('machine', publicMachine(m)); notifyDemo(); return { name: m.name }; },
    reset: () => { location.reload(); },
  };
})();
