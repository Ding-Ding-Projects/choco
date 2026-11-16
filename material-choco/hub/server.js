#!/usr/bin/env node
'use strict';
// Material Choco hub: web UI + JSON API + agent endpoints. No runtime dependencies.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Store } = require('./store');
const auth = require('./auth');
const choco = require('../core/choco');
const runner = require('../core/runner');
const pkg = require('../package.json');

const UI_DIR = path.join(__dirname, '..', 'ui');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };
const JOB_TTL_MS = 7 * 24 * 3600 * 1000;
const ONLINE_MS = 75 * 1000;

function provenance() {
  // Version and build time bound to the running artifact (written by the build), never launch time.
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'build-info.json'), 'utf8')); } catch { return { version: pkg.version, builtAt: null, commit: null }; }
}

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function createHub({ dataDir, desktop = false, host = '0.0.0.0', port = 8080, tls = null, localPolicy = {} } = {}) {
  const store = new Store(dataDir);
  const db = store.data;
  const sessions = new Map(); // token hash -> { user, expires }
  const limiter = new auth.Limiter();
  const sse = new Set();
  const waiters = new Map(); // machineId -> resolve()
  const running = new Map(); // jobId -> AbortController (local) | { cancel: true } flag holder
  const launchToken = desktop ? auth.token(24) : null;
  const build = provenance();

  const emit = (type, payload) => { const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; for (const res of sse) res.write(msg); };
  const publicMachine = (m) => ({ id: m.id, name: m.name, hostname: m.hostname, os: m.os, arch: m.arch, groups: m.groups || [], readOnly: !!m.readOnly, local: !!m.local, elevated: !!m.elevated, agentVersion: m.agentVersion || '', enrolledAt: m.enrolledAt, lastSeen: m.lastSeen, online: m.local || (Date.now() - Date.parse(m.lastSeen || 0) < ONLINE_MS), inventory: m.inventory || null });
  const publicJob = (j) => ({ id: j.id, machineId: j.machineId, kind: j.spec.kind, command: j.display, state: j.state, createdAt: j.createdAt, startedAt: j.startedAt || null, endedAt: j.endedAt || null, exitCode: j.exitCode ?? null, by: j.by, note: j.note || '', files: j.files || undefined, destructive: !!j.destructive });
  const audit = (user, action, detail = {}) => { const row = store.audit({ user, action, ...detail }); emit('audit', row); };

  // Desktop mode: this computer is always machine "local".
  if (desktop && !db.machines.find((m) => m.local)) {
    db.machines.unshift({ id: 'local', local: true, name: 'This PC', groups: [], enrolledAt: new Date().toISOString(), ...runner.machineInfo({ agentVersion: pkg.version }) });
    store.save();
  }
  // Jobs that were running when the hub stopped cannot be trusted.
  for (const j of db.jobs) if (j.state === 'running') { j.state = 'failed'; j.note = 'The hub restarted while this job was running. Its result is unknown.'; j.endedAt = new Date().toISOString(); }

  // ---- jobs -----------------------------------------------------------------------
  function createJob(machine, spec, by) {
    let display = 'inventory refresh'; let cls = { mutating: false, destructive: false };
    if (spec.kind === 'choco') { const built = choco.buildArgs(spec); display = 'choco ' + built.redacted.join(' ') + (spec.file ? ` [${spec.file.name}]` : ''); cls = choco.classify(spec); }
    else if (spec.kind !== 'inventory') throw new HttpError(400, 'Unknown job kind');
    if (machine.readOnly && cls.mutating) throw new HttpError(409, `${machine.name} is read only and will refuse this command`);
    const job = { id: db.nextJob++, machineId: machine.id, spec, display, state: 'queued', createdAt: new Date().toISOString(), by, destructive: cls.destructive, mutating: cls.mutating };
    db.jobs.push(job); if (db.jobs.length > 2000) db.jobs.splice(0, db.jobs.length - 2000);
    store.save(); emit('job', publicJob(job));
    if (spec.kind === 'choco') audit(by, 'job.create', { job: job.id, machine: machine.name, command: display });
    if (machine.local) setImmediate(pumpLocal); else { const w = waiters.get(machine.id); if (w) w(); }
    return job;
  }
  function finishJob(job, result) {
    job.endedAt = new Date().toISOString(); job.exitCode = result.code;
    job.state = result.cancelled ? 'cancelled' : result.code === 0 ? 'succeeded' : 'failed';
    job.note = result.timedOut ? 'Timed out' : result.rejected ? (result.stderr || 'Rejected') : '';
    if (result.files) job.files = result.files;
    if (result.stderr && (result.rejected || result.spawnError)) store.appendJobLog(job.id, result.stderr + '\n');
    const m = db.machines.find((x) => x.id === job.machineId);
    if (m && result.inventory) { m.inventory = result.inventory; emit('machine', publicMachine(m)); }
    running.delete(job.id); store.save(); emit('job', publicJob(job));
    if (job.spec.kind === 'choco') audit('agent', 'job.' + job.state, { job: job.id, machine: m ? m.name : job.machineId, exitCode: job.exitCode });
  }
  let localBusy = false;
  async function pumpLocal() {
    if (localBusy) return; const job = db.jobs.find((j) => j.state === 'queued' && j.machineId === 'local'); if (!job) return;
    localBusy = true; job.state = 'running'; job.startedAt = new Date().toISOString(); emit('job', publicJob(job));
    const ctl = new AbortController(); running.set(job.id, ctl);
    let result;
    try {
      result = await runner.execute(job.spec, { policy: localPolicy, signal: ctl.signal, onData: (_s, t) => { store.appendJobLog(job.id, t); emit('job-output', { id: job.id, chunk: t }); } });
      if (result.mutated) result.inventory = (await runner.execute({ kind: 'inventory' }, { policy: localPolicy })).inventory;
    } catch (e) { result = { code: -1, stderr: String(e.message), rejected: true }; }
    const m = db.machines.find((x) => x.local); if (m) Object.assign(m, runner.machineInfo({ agentVersion: pkg.version }));
    finishJob(job, result); localBusy = false; setImmediate(pumpLocal);
  }
  function expireJobs() {
    for (const j of db.jobs) if (j.state === 'queued' && Date.now() - Date.parse(j.createdAt) > JOB_TTL_MS) { j.state = 'expired'; j.endedAt = new Date().toISOString(); j.note = 'The machine did not come online within 7 days.'; emit('job', publicJob(j)); }
  }

  // ---- schedules --------------------------------------------------------------------
  function targets(target) {
    if (!target || target.all) return db.machines;
    if (target.group) return db.machines.filter((m) => (m.groups || []).includes(target.group));
    return db.machines.filter((m) => (target.machineIds || []).includes(m.id));
  }
  function tickSchedules(now = new Date()) {
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); const day = now.toDateString();
    for (const s of db.schedules) {
      if (!s.enabled || s.time !== hhmm || s.lastRunDay === day) continue;
      if (Array.isArray(s.days) && s.days.length && !s.days.includes(now.getDay())) continue;
      s.lastRunDay = day; s.lastRun = now.toISOString(); let n = 0;
      for (const m of targets(s.target)) { try { createJob(m, s.spec, `schedule:${s.name}`); n++; } catch { /* read only machines are skipped */ } }
      audit('scheduler', 'schedule.run', { schedule: s.name, jobs: n }); store.save();
    }
  }
  const timers = [setInterval(() => { tickSchedules(); expireJobs(); }, 20000)];

  // ---- http helpers -------------------------------------------------------------------
  const send = (res, status, body, headers = {}) => { const data = body === undefined ? '' : JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(data); };
  function readBody(req, limit = 1.5 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Request is too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Body is not valid JSON')); } });
      req.on('error', reject);
    });
  }
  const cookie = (req, name) => { const m = new RegExp('(?:^|; )' + name + '=([^;]+)').exec(req.headers.cookie || ''); return m ? m[1] : null; };
  function sessionOf(req) { const t = cookie(req, 'mc_session'); if (!t) return null; const s = sessions.get(auth.sha256(t)); if (!s || s.expires < Date.now()) return null; s.expires = Date.now() + 12 * 3600 * 1000; return s; }
  function startSession(res, user, req) {
    const t = auth.token(); sessions.set(auth.sha256(t), { user, expires: Date.now() + 12 * 3600 * 1000 });
    const secure = tls || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.setHeader('set-cookie', `mc_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
  }
  function sameOrigin(req) { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch { return false; } }
  function agentOf(req) {
    const h = req.headers.authorization || ''; if (!h.startsWith('Bearer ')) return null; const hash = auth.sha256(h.slice(7));
    return db.machines.find((m) => m.tokenHash && auth.safeEqual(m.tokenHash, hash)) || null;
  }
  const ip = (req) => req.socket.remoteAddress || '';

  // ---- routes ----------------------------------------------------------------------------
  const routes = []; // [method, regex, handler, options]
  const route = (method, pattern, handler, opts = {}) => routes.push([method, new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, opts]);
  const machineById = (id) => { const m = db.machines.find((x) => x.id === id); if (!m) throw new HttpError(404, 'No such machine'); return m; };
  const jobById = (id) => { const j = db.jobs.find((x) => x.id === Number(id)); if (!j) throw new HttpError(404, 'No such job'); return j; };

  route('GET', '/api/status', (req, res) => {
    const s = sessionOf(req);
    send(res, 200, { product: 'Material Choco', version: build.version, builtAt: build.builtAt, commit: build.commit, desktop, setupNeeded: !desktop && db.users.length === 0, authenticated: !!s, user: s ? s.user : null, hubTime: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, tls: !!tls, hostname: os.hostname() });
  }, { open: true });
  route('POST', '/api/setup', async (req, res) => {
    if (desktop || db.users.length) throw new HttpError(409, 'Setup is already complete');
    const b = await readBody(req); const name = String(b.name || '').trim();
    if (!/^[\w.@-]{2,40}$/.test(name)) throw new HttpError(400, 'Name must be 2 to 40 letters, digits, dot, dash, underscore or @');
    if (String(b.password || '').length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
    db.users.push({ name, pass: auth.hashPassword(b.password), createdAt: new Date().toISOString() }); store.flush();
    startSession(res, name, req); audit(name, 'setup.complete'); send(res, 200, { ok: true });
  }, { open: true });
  route('POST', '/api/login', async (req, res) => {
    const b = await readBody(req);
    if (desktop) { if (!b.launch || !auth.safeEqual(b.launch, launchToken)) throw new HttpError(401, 'Open this page from the Material Choco window'); startSession(res, os.userInfo().username, req); return send(res, 200, { ok: true }); }
    const name = String(b.name || '').trim(); const key = ip(req) + '|' + name.toLowerCase(); const wait = limiter.check(key);
    if (wait) throw new HttpError(429, `Too many failed attempts. Try again in ${wait} seconds.`);
    const u = db.users.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const okPass = auth.verifyPassword(String(b.password || ''), u ? u.pass : auth.hashPassword('x', '00'));
    if (!u || !okPass) { limiter.fail(key); audit(name || '(none)', 'login.failed', { ip: ip(req) }); throw new HttpError(401, 'Wrong name or password'); }
    if (u.totp && u.totp.enabled) { if (!b.totp) return send(res, 401, { error: 'Enter the 6 digit code from your authenticator', totpRequired: true }); if (!auth.totpVerify(u.totp.secret, b.totp)) { limiter.fail(key); throw new HttpError(401, 'Wrong authenticator code'); } }
    limiter.ok(key); startSession(res, u.name, req); audit(u.name, 'login.ok', { ip: ip(req) }); send(res, 200, { ok: true });
  }, { open: true });
  route('POST', '/api/logout', (req, res) => { const t = cookie(req, 'mc_session'); if (t) sessions.delete(auth.sha256(t)); res.setHeader('set-cookie', 'mc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); send(res, 200, { ok: true }); }, { open: true });

  route('GET', '/api/schema', (req, res) => send(res, 200, choco.schema, { 'cache-control': 'private, max-age=300' }));
  route('GET', '/api/machines', (req, res) => send(res, 200, db.machines.map(publicMachine)));
  route('PATCH', '/api/machines/:id', async (req, res, p, s) => {
    const m = machineById(p.id); const b = await readBody(req);
    if (typeof b.name === 'string' && b.name.trim()) m.name = b.name.trim().slice(0, 60);
    if (Array.isArray(b.groups)) m.groups = [...new Set(b.groups.map((g) => String(g).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 12);
    if (typeof b.readOnly === 'boolean' && !m.local) m.readOnly = b.readOnly;
    store.save(); audit(s.user, 'machine.update', { machine: m.name }); emit('machine', publicMachine(m)); send(res, 200, publicMachine(m));
  });
  route('DELETE', '/api/machines/:id', (req, res, p, s) => {
    const m = machineById(p.id); if (m.local) throw new HttpError(409, 'This PC cannot be removed');
    db.machines.splice(db.machines.indexOf(m), 1); for (const j of db.jobs) if (j.machineId === m.id && j.state === 'queued') { j.state = 'cancelled'; j.endedAt = new Date().toISOString(); }
    store.save(); audit(s.user, 'machine.remove', { machine: m.name }); emit('machine-removed', { id: m.id }); send(res, 200, { ok: true });
  });
  route('POST', '/api/pairing', async (req, res, p, s) => {
    const b = await readBody(req); const code = auth.pairingCode(); const expires = Date.now() + 10 * 60 * 1000;
    db.pairings = db.pairings.filter((x) => x.expires > Date.now()); db.pairings.push({ hash: auth.sha256(code), expires, readOnly: !!b.readOnly, groups: Array.isArray(b.groups) ? b.groups.slice(0, 12).map(String) : [] });
    store.save(); audit(s.user, 'pairing.create', { readOnly: !!b.readOnly }); send(res, 200, { code, expires: new Date(expires).toISOString() });
  });
  route('POST', '/api/jobs', async (req, res, p, s) => {
    const b = await readBody(req); const ids = Array.isArray(b.machineIds) ? b.machineIds : []; if (!ids.length) throw new HttpError(400, 'Choose at least one machine');
    if (!b.spec || typeof b.spec !== 'object') throw new HttpError(400, 'Missing command');
    try { if (b.spec.kind === 'choco') choco.buildArgs(b.spec); } catch (e) { throw new HttpError(400, e.message); }
    const made = []; const skipped = [];
    for (const id of ids) { const m = machineById(id); try { made.push(publicJob(createJob(m, b.spec, s.user))); } catch (e) { skipped.push({ machine: m.name, reason: e.message }); } }
    send(res, 200, { jobs: made, skipped });
  });
  route('GET', '/api/jobs', (req, res) => { const u = new URL(req.url, 'http://x'); const limit = Math.min(Number(u.searchParams.get('limit')) || 200, 2000); send(res, 200, db.jobs.slice(-limit).reverse().map(publicJob)); });
  route('GET', '/api/jobs/:id', (req, res, p) => { const j = jobById(p.id); send(res, 200, { ...publicJob(j), output: store.readJobLog(j.id) }); });
  route('POST', '/api/jobs/:id/cancel', (req, res, p, s) => {
    const j = jobById(p.id);
    if (j.state === 'queued') { j.state = 'cancelled'; j.endedAt = new Date().toISOString(); emit('job', publicJob(j)); }
    else if (j.state === 'running') { const c = running.get(j.id); if (c && c.abort) c.abort(); else running.set(j.id, { cancelRequested: true }); }
    else throw new HttpError(409, 'This job already finished');
    store.save(); audit(s.user, 'job.cancel', { job: j.id }); send(res, 200, publicJob(j));
  });
  route('GET', '/api/schedules', (req, res) => send(res, 200, db.schedules));
  const cleanSchedule = (b, prev = {}) => {
    const s = { ...prev }; if (b.name !== undefined) s.name = String(b.name).trim().slice(0, 60); if (!s.name) throw new HttpError(400, 'Name the schedule');
    if (b.time !== undefined) s.time = String(b.time); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time || '')) throw new HttpError(400, 'Time must be HH:MM in 24 hour form');
    if (b.days !== undefined) s.days = (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 0 && d <= 6);
    if (b.target !== undefined) s.target = b.target; if (b.enabled !== undefined) s.enabled = !!b.enabled;
    if (b.spec !== undefined) { try { if (b.spec.kind === 'choco') choco.buildArgs(b.spec); else if (b.spec.kind !== 'inventory') throw new Error('Unknown job kind'); } catch (e) { throw new HttpError(400, e.message); } s.spec = b.spec; }
    if (!s.spec) throw new HttpError(400, 'Missing command'); return s;
  };
  route('POST', '/api/schedules', async (req, res, p, s) => { const sch = cleanSchedule(await readBody(req), { id: crypto.randomUUID(), enabled: true, days: [], target: { all: true } }); db.schedules.push(sch); store.save(); audit(s.user, 'schedule.create', { schedule: sch.name }); send(res, 200, sch); });
  route('PATCH', '/api/schedules/:id', async (req, res, p, s) => { const i = db.schedules.findIndex((x) => x.id === p.id); if (i < 0) throw new HttpError(404, 'No such schedule'); db.schedules[i] = cleanSchedule(await readBody(req), db.schedules[i]); store.save(); audit(s.user, 'schedule.update', { schedule: db.schedules[i].name }); send(res, 200, db.schedules[i]); });
  route('DELETE', '/api/schedules/:id', (req, res, p, s) => { const i = db.schedules.findIndex((x) => x.id === p.id); if (i < 0) throw new HttpError(404, 'No such schedule'); const [gone] = db.schedules.splice(i, 1); store.save(); audit(s.user, 'schedule.remove', { schedule: gone.name }); send(res, 200, { ok: true }); });
  route('GET', '/api/audit', (req, res) => { const u = new URL(req.url, 'http://x'); send(res, 200, store.readAudit(Math.min(Number(u.searchParams.get('limit')) || 500, 5000))); });
  route('POST', '/api/audit', async (req, res, p, s) => { const b = await readBody(req); audit(s.user, 'ui.' + String(b.action || 'note').replace(/[^\w.-]/g, '').slice(0, 40), { detail: String(b.detail || '').slice(0, 300) }); send(res, 200, { ok: true }); });
  route('GET', '/api/account', (req, res, p, s) => { const u = db.users.find((x) => x.name === s.user); send(res, 200, { name: s.user, totpEnabled: !!(u && u.totp && u.totp.enabled), desktop }); });
  route('POST', '/api/account/password', async (req, res, p, s) => {
    const u = db.users.find((x) => x.name === s.user); if (!u) throw new HttpError(409, 'The desktop app has no password');
    const b = await readBody(req); if (!auth.verifyPassword(String(b.current || ''), u.pass)) throw new HttpError(401, 'Current password is wrong');
    if (String(b.next || '').length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
    u.pass = auth.hashPassword(b.next); store.flush(); audit(s.user, 'account.password'); send(res, 200, { ok: true });
  });
  route('POST', '/api/account/totp', async (req, res, p, s) => {
    const u = db.users.find((x) => x.name === s.user); if (!u) throw new HttpError(409, 'The desktop app has no sign in');
    const b = await readBody(req);
    if (b.action === 'begin') { u.totp = { secret: auth.totpSecret(), enabled: false }; store.flush(); return send(res, 200, { secret: u.totp.secret, uri: `otpauth://totp/Material%20Choco:${encodeURIComponent(u.name)}?secret=${u.totp.secret}&issuer=Material%20Choco` }); }
    if (b.action === 'enable') { if (!u.totp || !auth.totpVerify(u.totp.secret, b.code)) throw new HttpError(400, 'That code does not match'); u.totp.enabled = true; store.flush(); audit(s.user, 'account.totp.enable'); return send(res, 200, { ok: true }); }
    if (b.action === 'disable') { if (!auth.verifyPassword(String(b.password || ''), u.pass)) throw new HttpError(401, 'Password is wrong'); delete u.totp; store.flush(); audit(s.user, 'account.totp.disable'); return send(res, 200, { ok: true }); }
    throw new HttpError(400, 'Unknown action');
  });
  route('GET', '/api/events', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' }); res.write('retry: 3000\n\n'); sse.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000); req.on('close', () => { clearInterval(ping); sse.delete(res); });
  });

  // ---- agent endpoints -------------------------------------------------------------------
  route('POST', '/agent/enroll', async (req, res) => {
    const key = 'enroll|' + ip(req); const wait = limiter.check(key); if (wait) throw new HttpError(429, `Too many attempts. Try again in ${wait} seconds.`);
    const b = await readBody(req); const hash = auth.sha256(String(b.code || '').trim().toUpperCase());
    const i = db.pairings.findIndex((x) => x.expires > Date.now() && auth.safeEqual(x.hash, hash));
    if (i < 0) { limiter.fail(key); throw new HttpError(401, 'That pairing code is wrong or has expired'); }
    const [pairing] = db.pairings.splice(i, 1); const token = auth.token(); const info = b.info || {};
    const m = { id: crypto.randomUUID(), name: String(b.name || info.hostname || 'machine').slice(0, 60), hostname: String(info.hostname || '').slice(0, 80), os: String(info.os || '').slice(0, 80), arch: String(info.arch || '').slice(0, 20), elevated: !!info.elevated, agentVersion: String(info.agentVersion || '').slice(0, 20), groups: pairing.groups, readOnly: !!(pairing.readOnly || b.readOnly), tokenHash: auth.sha256(token), enrolledAt: new Date().toISOString(), lastSeen: new Date().toISOString() };
    db.machines.push(m); store.flush(); audit('agent', 'machine.enroll', { machine: m.name, ip: ip(req) }); emit('machine', publicMachine(m));
    createJob(m, { kind: 'inventory' }, 'enrollment');
    send(res, 200, { machineId: m.id, token, readOnly: m.readOnly });
  }, { open: true });
  route('POST', '/agent/poll', async (req, res, p, s, m) => {
    const b = await readBody(req); const info = b.info || {}; const wasOnline = Date.now() - Date.parse(m.lastSeen || 0) < ONLINE_MS;
    Object.assign(m, { lastSeen: new Date().toISOString(), hostname: String(info.hostname || m.hostname || '').slice(0, 80), os: String(info.os || m.os || '').slice(0, 80), elevated: !!info.elevated, agentVersion: String(info.agentVersion || '').slice(0, 20) });
    if (!wasOnline) emit('machine', publicMachine(m));
    const take = () => { const j = db.jobs.find((x) => x.state === 'queued' && x.machineId === m.id); if (!j) return null; j.state = 'running'; j.startedAt = new Date().toISOString(); store.save(); emit('job', publicJob(j)); return { id: j.id, spec: j.spec }; };
    let job = take();
    if (!job) { await new Promise((resolve) => { const t = setTimeout(resolve, 25000); waiters.set(m.id, () => { clearTimeout(t); resolve(); }); req.on('close', () => { clearTimeout(t); resolve(); }); }); waiters.delete(m.id); m.lastSeen = new Date().toISOString(); job = take(); }
    send(res, 200, { jobs: job ? [job] : [] });
  }, { agent: true });
  route('POST', '/agent/jobs/:id/output', async (req, res, p, s, m) => {
    const j = jobById(p.id); if (j.machineId !== m.id || j.state !== 'running') throw new HttpError(409, 'Job is not running on this machine');
    const b = await readBody(req); const chunk = String(b.chunk || '').slice(0, 256 * 1024); store.appendJobLog(j.id, chunk); emit('job-output', { id: j.id, chunk }); m.lastSeen = new Date().toISOString();
    send(res, 200, { cancel: !!(running.get(j.id) && running.get(j.id).cancelRequested) });
  }, { agent: true });
  route('POST', '/agent/jobs/:id/done', async (req, res, p, s, m) => {
    const j = jobById(p.id); if (j.machineId !== m.id || j.state !== 'running') throw new HttpError(409, 'Job is not running on this machine');
    const b = await readBody(req, 6 * 1024 * 1024); m.lastSeen = new Date().toISOString();
    finishJob(j, { code: Number.isInteger(b.code) ? b.code : -1, stderr: String(b.stderr || ''), timedOut: !!b.timedOut, cancelled: !!b.cancelled, rejected: !!b.rejected, inventory: b.inventory && typeof b.inventory === 'object' ? b.inventory : undefined, files: Array.isArray(b.files) ? b.files.slice(0, 5) : undefined });
    send(res, 200, { ok: true });
  }, { agent: true });

  // ---- static files ------------------------------------------------------------------------
  function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname); if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(UI_DIR, rel)); if (!file.startsWith(UI_DIR + path.sep)) return send(res, 403, { error: 'Forbidden' });
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': rel.startsWith('/vendor/') ? 'public, max-age=86400' : 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
        'content-security-policy': "default-src 'self'; img-src 'self' data: blob: https://github.com https://*.githubusercontent.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://raw.githubusercontent.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
      res.end(data);
    });
  }

  async function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://x');
    try {
      if (!pathname.startsWith('/api/') && !pathname.startsWith('/agent/')) { if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed'); return serveStatic(req, res, pathname); }
      for (const [method, re, handler, opts] of routes) {
        if (method !== req.method) continue; const m = re.exec(pathname); if (!m) continue;
        let session = null; let machine = null;
        if (opts.agent) { machine = agentOf(req); if (!machine) throw new HttpError(401, 'Unknown agent'); }
        else {
          if (req.method !== 'GET' && !pathname.startsWith('/agent/') && !sameOrigin(req)) throw new HttpError(403, 'Cross-site request refused');
          if (!opts.open) { session = sessionOf(req); if (!session) throw new HttpError(401, 'Sign in first'); }
        }
        return await handler(req, res, m.groups || {}, session, machine);
      }
      throw new HttpError(404, 'Not found');
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Internal error' });
      if (!e.status) console.error(e);
    }
  }

  const server = tls ? https.createServer(tls, handle) : http.createServer(handle);
  server.requestTimeout = 0; server.headersTimeout = 60000;
  return {
    server, store, launchToken, createJob, tickSchedules, db,
    listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address())); }),
    close: () => new Promise((resolve) => { timers.forEach(clearInterval); for (const r of sse) r.end(); for (const w of waiters.values()) w(); store.flush(); server.close(() => resolve()); server.closeAllConnections && server.closeAllConnections(); }),
  };
}

module.exports = { createHub };

if (require.main === module) {
  const env = process.env; const dataDir = env.MATERIAL_CHOCO_DATA || path.join(process.cwd(), 'data');
  let tls = null; if (env.MATERIAL_CHOCO_TLS_CERT && env.MATERIAL_CHOCO_TLS_KEY) tls = { cert: fs.readFileSync(env.MATERIAL_CHOCO_TLS_CERT), key: fs.readFileSync(env.MATERIAL_CHOCO_TLS_KEY) };
  const hub = createHub({ dataDir, host: env.MATERIAL_CHOCO_HOST || '0.0.0.0', port: Number(env.MATERIAL_CHOCO_PORT) || 8080, tls });
  hub.listen().then((a) => console.log(`Material Choco hub ${pkg.version} listening on ${tls ? 'https' : 'http'}://${a.address}:${a.port} (data: ${dataDir})${tls ? '' : '\nNo TLS configured. Put the hub behind an HTTPS reverse proxy before exposing it beyond a trusted LAN.'}`));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => hub.close().then(() => process.exit(0)));
}
