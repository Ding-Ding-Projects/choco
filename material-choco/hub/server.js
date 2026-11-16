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
const { Vault, MASK } = require('./secrets');
const webauthn = require('./webauthn');
const webhooksLib = require('./webhooks');

const UI_DIR = path.join(__dirname, '..', 'ui');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };
const JOB_TTL_MS = 7 * 24 * 3600 * 1000;
const ONLINE_MS = 75 * 1000;
const SESSION_MS = 12 * 3600 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;
// Roles, lowest first. admin: everything. operator: runs commands, pairs machines and edits
// schedules, but cannot manage users, webhooks or machine policy and cannot remove machines.
// viewer: reads, and may only queue the read only queries listed below.
const RANK = { viewer: 0, operator: 1, admin: 2 };
const isRole = (r) => typeof r === 'string' && Object.hasOwn(RANK, r);
const NAME_RE = /^[\w.@-]{2,40}$/;
// What a viewer may queue: an inventory refresh, or one of these queries with harmless options
// only. Options that take a path, a source address or a credential are deliberately absent.
const VIEWER_COMMANDS = new Set(['list', 'outdated', 'search', 'info']);
const VIEWER_LIST_COMMANDS = new Set(['pin', 'source', 'config', 'feature']);
const VIEWER_OPTIONS = new Set(['limit-output', 'no-color', 'no-progress', 'exact', 'prerelease', 'id-only', 'by-id-only', 'by-tag-only', 'id-starts-with', 'order-by-popularity', 'approved-only', 'all-versions', 'page', 'page-size', 'include-programs', 'ignore-pinned', 'ignore-unfound', 'version', 'name']);
function viewerMayRun(spec) {
  if (!spec || typeof spec !== 'object') return false; if (spec.kind === 'inventory') return true; if (spec.kind !== 'choco' || spec.file || spec.collect) return false;
  const cmd = choco.canonicalCommand(spec.command); const sub = spec.subcommand || 'list';
  if (!(VIEWER_COMMANDS.has(cmd) && !spec.subcommand) && !(VIEWER_LIST_COMMANDS.has(cmd) && (sub === 'list' || (cmd === 'config' && sub === 'get')))) return false;
  for (const section of ['options', 'global']) for (const id of Object.keys(spec[section] && typeof spec[section] === 'object' ? spec[section] : {})) if (!VIEWER_OPTIONS.has(id)) return false;
  return true;
}

function provenance() {
  // Version and build time bound to the running artifact (written by the build), never launch time.
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'build-info.json'), 'utf8')); } catch { return { version: pkg.version, builtAt: null, commit: null }; }
}

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

// origin: public address of the hub (for passkeys) when it cannot be derived from the request,
// for example behind a reverse proxy that rewrites Host. keyFile: where the secrets key lives.
function createHub({ dataDir, desktop = false, host = '0.0.0.0', port = 8080, tls = null, localPolicy = {}, origin = process.env.MATERIAL_CHOCO_ORIGIN || '', keyFile = process.env.MATERIAL_CHOCO_KEY_FILE || '', webhookBackoffMs = [1000, 5000, 15000], webhookTimeoutMs = 8000, passkeyBudget = 60 } = {}) {
  const store = new Store(dataDir);
  const db = store.data;
  const vault = new Vault(keyFile || path.join(dataDir, 'secret.key'));
  const startedAt = Date.now();
  if (!Array.isArray(db.webhooks)) db.webhooks = [];
  const sessions = new Map(); // token hash -> { user, expires }
  const limiter = new auth.Limiter();
  const sse = new Set();
  const waiters = new Map(); // machineId -> resolve()
  const running = new Map(); // jobId -> AbortController (local) | { cancel: true } flag holder
  const launchToken = desktop ? auth.token(24) : null;
  const build = provenance();

  const emit = (type, payload) => { const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; for (const res of sse) res.write(msg); };
  const publicMachine = (m) => ({ allowedCommands: Array.isArray(m.allowedCommands) ? m.allowedCommands : null, agentAllowedCommands: Array.isArray(m.agentAllow) ? m.agentAllow : null, id: m.id, name: m.name, hostname: m.hostname, os: m.os, arch: m.arch, groups: m.groups || [], readOnly: !!m.readOnly, local: !!m.local, elevated: !!m.elevated, agentVersion: m.agentVersion || '', enrolledAt: m.enrolledAt, lastSeen: m.lastSeen, online: m.local || (Date.now() - Date.parse(m.lastSeen || 0) < ONLINE_MS), inventory: m.inventory || null });
  const publicJob = (j) => ({ id: j.id, machineId: j.machineId, kind: j.spec.kind, command: j.display, state: j.state, createdAt: j.createdAt, startedAt: j.startedAt || null, endedAt: j.endedAt || null, exitCode: j.exitCode ?? null, by: j.by, note: j.note || '', files: j.files || undefined, destructive: !!j.destructive });
  const audit = (user, action, detail = {}) => { const row = store.audit({ user, action, ...detail }); emit('audit', row); };

  // Desktop mode: this computer is always machine "local".
  if (desktop && !db.machines.find((m) => m.local)) {
    db.machines.unshift({ id: 'local', local: true, name: 'This PC', groups: [], enrolledAt: new Date().toISOString(), ...runner.machineInfo({ agentVersion: pkg.version }) });
    store.save();
  }
  // Jobs that were running when the hub stopped cannot be trusted.
  for (const j of db.jobs) if (j.state === 'running') { j.state = 'failed'; j.note = 'The hub restarted while this job was running. Its result is unknown.'; j.endedAt = new Date().toISOString(); }
  // Accounts from before roles existed belonged to the single administrator.
  for (const u of db.users) if (u.role === undefined) u.role = 'admin'; else if (!isRole(u.role)) u.role = 'viewer';
  // Secrets at rest: queued jobs and schedules keep their secret option values encrypted,
  // finished jobs keep none, authenticator secrets are encrypted. This also upgrades data
  // written by versions that stored these values as plain text.
  for (const j of db.jobs) j.spec = j.state === 'queued' ? vault.sealSpec(j.spec) : vault.wipeSpec(j.spec);
  for (const sch of db.schedules) sch.spec = vault.sealSpec(sch.spec);
  for (const u of db.users) if (u.totp && u.totp.secret && !vault.isSealed(u.totp.secret)) u.totp.secret = vault.seal(u.totp.secret, 'totp');
  store.flush();

  // ---- webhooks -------------------------------------------------------------------
  const hooks = webhooksLib.createWebhooks({ hooks: () => db.webhooks, openUrl: (h) => vault.open(h.url, 'webhook'), audit: (action, detail) => audit('webhook', action, detail), hubName: os.hostname(), backoffMs: webhookBackoffMs, timeoutMs: webhookTimeoutMs });
  const offlineSent = new Map(); // "webhookId|machineId" -> the lastSeen value that was reported
  function checkOffline(now = Date.now()) {
    for (const m of db.machines) {
      if (m.local) continue; const seen = Date.parse(m.lastSeen || m.enrolledAt || 0) || 0;
      // Time the hub itself was stopped does not count, so a restart does not report every machine.
      const minutes = (now - Math.max(seen, startedAt)) / 60000; if (minutes < 1) continue;
      hooks.fire('machine.offline', { text: `${m.name} has been offline for ${Math.floor((now - seen) / 60000)} minutes (last seen ${m.lastSeen || 'never'}).`, machine: { id: m.id, name: m.name, lastSeen: m.lastSeen || null, offlineMinutes: Math.floor((now - seen) / 60000) } },
        (h) => { const key = h.id + '|' + m.id; if (minutes < (h.offlineMinutes || 10) || offlineSent.get(key) === (m.lastSeen || '')) return false; offlineSent.set(key, m.lastSeen || ''); return true; });
    }
  }

  // ---- jobs -----------------------------------------------------------------------
  function createJob(machine, spec, by) {
    let display = 'inventory refresh'; let cls = { mutating: false, destructive: false };
    if (spec.kind === 'choco') { const built = choco.buildArgs(spec); display = 'choco ' + built.redacted.join(' ') + (spec.file ? ` [${spec.file.name}]` : ''); cls = choco.classify(spec); }
    else if (spec.kind !== 'inventory') throw new HttpError(400, 'Unknown job kind');
    if (machine.readOnly && cls.mutating) throw new HttpError(409, `${machine.name} is read only and will refuse this command`);
    for (const list of [machine.allowedCommands, machine.agentAllow]) if (!choco.allowedBy(list, spec)) throw new HttpError(409, `${machine.name} only allows these commands: ${list.join(', ') || '(none)'}`);
    // Secret option values are encrypted before the job is stored. See hub/secrets.js.
    const job = { id: db.nextJob++, machineId: machine.id, spec: vault.sealSpec(spec), display, state: 'queued', createdAt: new Date().toISOString(), by, destructive: cls.destructive, mutating: cls.mutating };
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
    job.spec = vault.wipeSpec(job.spec); // a finished job keeps no secret values at all
    if (result.files) job.files = result.files;
    if (result.stderr && (result.rejected || result.spawnError)) store.appendJobLog(job.id, result.stderr + '\n');
    const m = db.machines.find((x) => x.id === job.machineId);
    if (m && result.inventory) { m.inventory = result.inventory; emit('machine', publicMachine(m)); }
    running.delete(job.id); store.save(); emit('job', publicJob(job));
    if (job.spec.kind === 'choco') {
      audit('agent', 'job.' + job.state, { job: job.id, machine: m ? m.name : job.machineId, exitCode: job.exitCode });
      // Webhooks get the redacted command line and the exit code. Never output, never secrets.
      if (job.state === 'failed' || job.state === 'succeeded') hooks.fire('job.' + job.state, { text: `Job #${job.id} ${job.state} on ${m ? m.name : job.machineId} (exit code ${job.exitCode}): ${job.display}`, job: { id: job.id, machine: m ? m.name : job.machineId, machineId: job.machineId, command: job.display, state: job.state, exitCode: job.exitCode, by: job.by } });
    }
  }
  // A queued job that will never run (cancelled, expired, machine removed) drops its secrets too.
  const endQueued = (j, state, note) => { j.state = state; j.endedAt = new Date().toISOString(); if (note) j.note = note; j.spec = vault.wipeSpec(j.spec); };
  let localBusy = false;
  async function pumpLocal() {
    if (localBusy) return; const job = db.jobs.find((j) => j.state === 'queued' && j.machineId === 'local'); if (!job) return;
    localBusy = true; job.state = 'running'; job.startedAt = new Date().toISOString(); emit('job', publicJob(job));
    const ctl = new AbortController(); running.set(job.id, ctl);
    let result;
    try {
      result = await runner.execute(vault.openSpec(job.spec), { policy: localPolicy, signal: ctl.signal, onData: (_s, t) => { store.appendJobLog(job.id, t); emit('job-output', { id: job.id, chunk: t }); } });
      if (result.mutated) result.inventory = (await runner.execute({ kind: 'inventory' }, { policy: localPolicy })).inventory;
    } catch (e) { result = { code: -1, stderr: String(e.message), rejected: true }; }
    const m = db.machines.find((x) => x.local); if (m) Object.assign(m, runner.machineInfo({ agentVersion: pkg.version }));
    finishJob(job, result); localBusy = false; setImmediate(pumpLocal);
  }
  function expireJobs() {
    for (const j of db.jobs) if (j.state === 'queued' && Date.now() - Date.parse(j.createdAt) > JOB_TTL_MS) { endQueued(j, 'expired', 'The machine did not come online within 7 days.'); store.save(); emit('job', publicJob(j)); }
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
      let spec; try { spec = vault.openSpec(s.spec); } catch (e) { audit('scheduler', 'schedule.error', { schedule: s.name, error: e.message }); store.save(); continue; }
      for (const m of targets(s.target)) { try { createJob(m, spec, `schedule:${s.name}`); n++; } catch { /* read only machines and machines whose allow list excludes the command are skipped */ } }
      audit('scheduler', 'schedule.run', { schedule: s.name, jobs: n }); store.save();
    }
  }
  const pruneSessions = () => { const now = Date.now(); for (const [k, v] of sessions) if (v.expires < now) sessions.delete(k); };
  const timers = [setInterval(() => { tickSchedules(); expireJobs(); checkOffline(); pruneSessions(); }, 20000)];

  // ---- http helpers -------------------------------------------------------------------
  const send = (res, status, body, headers = {}) => { const data = body === undefined ? '' : JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(data); };
  function readBody(req, limit = 1.5 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Request is too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (!chunks.length) return resolve({}); let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reject(new HttpError(400, 'Body is not valid JSON')); }
        // Every route reads fields of an object; null, a list or a bare value is a client error, not a crash.
        if (!body || typeof body !== 'object' || Array.isArray(body)) return reject(new HttpError(400, 'Body must be a JSON object')); resolve(body);
      });
      req.on('error', reject);
    });
  }
  const cookie = (req, name) => { const m = new RegExp('(?:^|; )' + name + '=([^;]+)').exec(req.headers.cookie || ''); return m ? m[1] : null; };
  // The role is read from the account on every request, so a role change, a disabled account
  // or a deleted account takes effect at once. The desktop app has one local user: the administrator.
  function sessionOf(req) {
    const t = cookie(req, 'mc_session'); if (!t) return null; const key = auth.sha256(t); const s = sessions.get(key); if (!s || s.expires < Date.now()) return null;
    if (desktop) s.role = 'admin'; else { const u = db.users.find((x) => x.name === s.user); if (!u || u.disabled) { sessions.delete(key); return null; } s.role = isRole(u.role) ? u.role : 'viewer'; }
    s.expires = Date.now() + SESSION_MS; return s;
  }
  // Ends every session of a user (except one to keep, if given) and their open event streams.
  const dropSessions = (name, keep = null) => { for (const [k, v] of sessions) if (v.user === name && v !== keep) sessions.delete(k); for (const r of sse) if (r.mcSession && r.mcSession.user === name && r.mcSession !== keep) r.end(); };
  function startSession(res, user, req) {
    const t = auth.token(); sessions.set(auth.sha256(t), { user, expires: Date.now() + SESSION_MS });
    const secure = tls || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.setHeader('set-cookie', `mc_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
  }
  function sameOrigin(req) { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch { return false; } }
  function agentOf(req) {
    const h = req.headers.authorization || ''; if (!h.startsWith('Bearer ')) return null; const hash = auth.sha256(h.slice(7));
    return db.machines.find((m) => m.tokenHash && auth.safeEqual(m.tokenHash, hash)) || null;
  }
  const ip = (req) => req.socket.remoteAddress || '';
  const userByName = (name) => db.users.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
  const activeAdmins = () => db.users.filter((u) => u.role === 'admin' && !u.disabled);
  // Counts a failed sign-in. When that locks the key out, the lockout is audited and reported.
  function loginFailed(key, name, req, method = 'password') {
    const seconds = limiter.fail(key); if (!seconds) return;
    audit(name || '(none)', 'login.lockout', { ip: ip(req), seconds, method });
    hooks.fire('login.lockout', { text: `Sign-in for "${name || '(none)'}" from ${ip(req)} is locked for ${seconds} seconds after repeated failures.`, login: { name: name || '', ip: ip(req), seconds, method } });
  }

  // ---- passkeys (WebAuthn) ------------------------------------------------------------------
  // The relying party id and origin come from MATERIAL_CHOCO_ORIGIN when set, otherwise from
  // the request Host. Browsers only offer passkeys on HTTPS or on localhost, and never for an
  // IP address, so `available` is false elsewhere.
  const rpFrom = (value) => { const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol)) throw new Error('MATERIAL_CHOCO_ORIGIN must start with http:// or https://'); const rpId = u.hostname; const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(rpId) || rpId.startsWith('['); const local = rpId === 'localhost' || rpId.endsWith('.localhost'); return { origin: u.origin, rpId, available: !desktop && !isIp && (u.protocol === 'https:' || local) }; };
  const fixedRp = origin ? rpFrom(origin) : null;
  function rpInfo(req) {
    if (fixedRp) return fixedRp; const hostHeader = String(req.headers.host || '');
    if (!/^[A-Za-z0-9.-]{1,253}(:\d{1,5})?$/.test(hostHeader)) return { available: false };
    try { return rpFrom(`${tls || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${hostHeader}`); } catch { return { available: false }; }
  }
  const needRp = (req) => { const rp = rpInfo(req); if (!rp.available) throw new HttpError(409, 'Passkeys need HTTPS (or localhost) and a host name. Set MATERIAL_CHOCO_ORIGIN if the hub is behind a proxy.'); return rp; };
  const challenges = new Map(); // challenge -> { type, user, origin, rpId, expires }; each is used once
  function newChallenge(entry) {
    const now = Date.now(); for (const [k, v] of challenges) if (v.expires < now) challenges.delete(k);
    if (challenges.size >= 2000) throw new HttpError(429, 'Too many passkey requests are pending. Try again in a few minutes.');
    const c = auth.token(32); challenges.set(c, { ...entry, expires: now + CHALLENGE_MS }); return c;
  }
  // Removes the challenge whatever happens next, so a response can never be replayed.
  function takeChallenge(value, type) { const e = challenges.get(value); if (!e) return null; challenges.delete(value); return e.type === type && e.expires >= Date.now() ? e : null; }
  const windows = new Map(); // simple per-key request budget for the open passkey routes
  function throttle(key, max = passkeyBudget) { // requests per minute and address
    const now = Date.now(); const r = windows.get(key);
    if (!r || r.reset < now) { if (windows.size > 5000) for (const [k, v] of windows) if (v.reset < now) windows.delete(k); windows.set(key, { n: 1, reset: now + 60000 }); return; }
    if (++r.n > max) throw new HttpError(429, 'Too many requests. Try again in a minute.');
  }
  const publicPasskey = (k) => ({ id: k.id, name: k.name, alg: k.alg, createdAt: k.createdAt, lastUsed: k.lastUsed || null, transports: k.transports || [], backedUp: !!k.backedUp });
  const credentialDescriptor = (k) => ({ type: 'public-key', id: k.id, ...(k.transports && k.transports.length ? { transports: k.transports } : {}) });

  // ---- routes ----------------------------------------------------------------------------
  const routes = []; // [method, regex, handler, options]
  const route = (method, pattern, handler, opts = {}) => routes.push([method, new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, opts]);
  const machineById = (id) => { const m = db.machines.find((x) => x.id === id); if (!m) throw new HttpError(404, 'No such machine'); return m; };
  const jobById = (id) => { const j = db.jobs.find((x) => x.id === Number(id)); if (!j) throw new HttpError(404, 'No such job'); return j; };

  route('GET', '/api/status', (req, res) => {
    const s = sessionOf(req);
    send(res, 200, { product: 'Material Choco', version: build.version, builtAt: build.builtAt, commit: build.commit, desktop, setupNeeded: !desktop && db.users.length === 0, authenticated: !!s, user: s ? s.user : null, role: s ? s.role : null, passkeysAvailable: !!rpInfo(req).available, roles: Object.keys(RANK), hubTime: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, tls: !!tls, hostname: os.hostname() });
  }, { open: true });
  route('POST', '/api/setup', async (req, res) => {
    if (desktop || db.users.length) throw new HttpError(409, 'Setup is already complete');
    const b = await readBody(req); const name = String(b.name || '').trim();
    if (!NAME_RE.test(name)) throw new HttpError(400, 'Name must be 2 to 40 letters, digits, dot, dash, underscore or @');
    if (String(b.password || '').length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
    db.users.push({ name, role: 'admin', pass: auth.hashPassword(b.password), createdAt: new Date().toISOString() }); store.flush();
    startSession(res, name, req); audit(name, 'setup.complete'); send(res, 200, { ok: true });
  }, { open: true });
  route('POST', '/api/login', async (req, res) => {
    const b = await readBody(req);
    if (desktop) { if (!b.launch || !auth.safeEqual(b.launch, launchToken)) throw new HttpError(401, 'Open this page from the Material Choco window'); startSession(res, os.userInfo().username, req); return send(res, 200, { ok: true }); }
    const name = String(b.name || '').trim().slice(0, 80); const key = ip(req) + '|' + name.toLowerCase(); const wait = limiter.check(key);
    if (wait) throw new HttpError(429, `Too many failed attempts. Try again in ${wait} seconds.`);
    const u = db.users.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const okPass = auth.verifyPassword(String(b.password || ''), u ? u.pass : auth.hashPassword('x', '00'));
    if (!u || !okPass) { audit(name || '(none)', 'login.failed', { ip: ip(req) }); loginFailed(key, name, req); throw new HttpError(401, 'Wrong name or password'); }
    // Only someone who knows the password learns that the account is disabled.
    if (u.disabled) { audit(u.name, 'login.refused', { ip: ip(req), reason: 'disabled' }); throw new HttpError(403, 'This account is disabled. Ask an administrator.'); }
    if (u.totp && u.totp.enabled) { if (!b.totp) return send(res, 401, { error: 'Enter the 6 digit code from your authenticator', totpRequired: true }); if (!auth.totpVerify(vault.open(u.totp.secret, 'totp'), b.totp)) { loginFailed(key, name, req); throw new HttpError(401, 'Wrong authenticator code'); } }
    limiter.ok(key); u.lastLogin = new Date().toISOString(); store.save(); startSession(res, u.name, req); audit(u.name, 'login.ok', { ip: ip(req) }); send(res, 200, { ok: true });
  }, { open: true });
  route('POST', '/api/logout', (req, res) => { const t = cookie(req, 'mc_session'); if (t) sessions.delete(auth.sha256(t)); res.setHeader('set-cookie', 'mc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); send(res, 200, { ok: true }); }, { open: true });

  route('GET', '/api/schema', (req, res) => send(res, 200, choco.schema, { 'cache-control': 'private, max-age=300' }));
  route('GET', '/api/machines', (req, res) => send(res, 200, db.machines.map(publicMachine)));
  route('PATCH', '/api/machines/:id', async (req, res, p, s) => {
    const m = machineById(p.id); const b = await readBody(req);
    // Machine policy (read only, command allow list) is the administrator's to set.
    const policy = (typeof b.readOnly === 'boolean' && !m.local && b.readOnly !== !!m.readOnly) || b.allowedCommands !== undefined;
    if (policy && s.role !== 'admin') throw new HttpError(403, 'Only an administrator can change the read only setting or the allowed commands of a machine');
    if (b.allowedCommands !== undefined) {
      // null or "all" removes the restriction; an empty list allows inventory refreshes only.
      let list = null; if (b.allowedCommands !== null && b.allowedCommands !== 'all') { if (!Array.isArray(b.allowedCommands)) throw new HttpError(400, 'allowedCommands must be a list of choco command names, or null'); try { list = choco.parseAllowList(b.allowedCommands); } catch (e) { throw new HttpError(400, e.message); } }
      if (list) m.allowedCommands = list; else delete m.allowedCommands;
      audit(s.user, 'machine.allow', { machine: m.name, allowed: list ? list.join(',') || '(none)' : 'all' });
    }
    if (typeof b.name === 'string' && b.name.trim()) m.name = b.name.trim().slice(0, 60);
    if (Array.isArray(b.groups)) m.groups = [...new Set(b.groups.map((g) => String(g).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 12);
    if (typeof b.readOnly === 'boolean' && !m.local) m.readOnly = b.readOnly;
    store.save(); audit(s.user, 'machine.update', { machine: m.name }); emit('machine', publicMachine(m)); send(res, 200, publicMachine(m));
  }, { role: 'operator' });
  route('DELETE', '/api/machines/:id', (req, res, p, s) => {
    const m = machineById(p.id); if (m.local) throw new HttpError(409, 'This PC cannot be removed');
    db.machines.splice(db.machines.indexOf(m), 1); for (const j of db.jobs) if (j.machineId === m.id && j.state === 'queued') endQueued(j, 'cancelled');
    store.save(); audit(s.user, 'machine.remove', { machine: m.name }); emit('machine-removed', { id: m.id }); send(res, 200, { ok: true });
  }, { role: 'admin' });
  route('POST', '/api/pairing', async (req, res, p, s) => {
    const b = await readBody(req); const code = auth.pairingCode(); const expires = Date.now() + 10 * 60 * 1000;
    db.pairings = db.pairings.filter((x) => x.expires > Date.now()); db.pairings.push({ hash: auth.sha256(code), expires, readOnly: !!b.readOnly, groups: Array.isArray(b.groups) ? b.groups.slice(0, 12).map(String) : [] });
    store.save(); audit(s.user, 'pairing.create', { readOnly: !!b.readOnly }); send(res, 200, { code, expires: new Date(expires).toISOString() });
  }, { role: 'operator' });
  route('POST', '/api/jobs', async (req, res, p, s) => {
    const b = await readBody(req); const ids = Array.isArray(b.machineIds) ? b.machineIds : []; if (!ids.length) throw new HttpError(400, 'Choose at least one machine');
    if (!b.spec || typeof b.spec !== 'object') throw new HttpError(400, 'Missing command');
    if (ids.length > 500) throw new HttpError(400, 'Too many machines in one request');
    try { if (b.spec.kind === 'choco') choco.buildArgs(b.spec); } catch (e) { throw new HttpError(400, e.message); }
    if (s.role === 'viewer' && !viewerMayRun(b.spec)) throw new HttpError(403, 'Your role (viewer) can only refresh the inventory and run read only queries');
    const made = []; const skipped = [];
    for (const id of ids) { const m = machineById(id); try { made.push(publicJob(createJob(m, b.spec, s.user))); } catch (e) { skipped.push({ machine: m.name, reason: e.message }); } }
    send(res, 200, { jobs: made, skipped });
  }, { role: 'viewer' });
  route('GET', '/api/jobs', (req, res) => { const u = new URL(req.url, 'http://x'); const limit = Math.min(Number(u.searchParams.get('limit')) || 200, 2000); send(res, 200, db.jobs.slice(-limit).reverse().map(publicJob)); });
  route('GET', '/api/jobs/:id', (req, res, p) => { const j = jobById(p.id); send(res, 200, { ...publicJob(j), output: store.readJobLog(j.id) }); });
  route('POST', '/api/jobs/:id/cancel', (req, res, p, s) => {
    const j = jobById(p.id);
    if (j.state === 'queued') { endQueued(j, 'cancelled'); emit('job', publicJob(j)); }
    else if (j.state === 'running') { const c = running.get(j.id); if (c && c.abort) c.abort(); else running.set(j.id, { cancelRequested: true }); }
    else throw new HttpError(409, 'This job already finished');
    store.save(); audit(s.user, 'job.cancel', { job: j.id }); send(res, 200, publicJob(j));
  }, { role: 'operator' });
  // Schedules keep their secret option values encrypted; responses show ******** in their place.
  const publicSchedule = (sch) => ({ ...sch, spec: vault.maskSpec(sch.spec) });
  route('GET', '/api/schedules', (req, res) => send(res, 200, db.schedules.map(publicSchedule)));
  const cleanSchedule = (b, prev = {}) => {
    const s = { ...prev }; if (b.name !== undefined) s.name = String(b.name).trim().slice(0, 60); if (!s.name) throw new HttpError(400, 'Name the schedule');
    if (b.time !== undefined) s.time = String(b.time); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time || '')) throw new HttpError(400, 'Time must be HH:MM in 24 hour form');
    if (b.days !== undefined) s.days = (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 0 && d <= 6);
    if (b.target !== undefined) s.target = b.target; if (b.enabled !== undefined) s.enabled = !!b.enabled;
    if (b.spec !== undefined) {
      if (!b.spec || typeof b.spec !== 'object') throw new HttpError(400, 'Missing command');
      try { if (b.spec.kind === 'choco') choco.buildArgs(b.spec); else if (b.spec.kind !== 'inventory') throw new Error('Unknown job kind'); } catch (e) { throw new HttpError(400, e.message); }
      // A spec sent back with the ******** placeholder keeps the secret that is already stored.
      const next = { ...b.spec }; for (const [section, id] of choco.secretOptions(next)) if (next[section][id] === MASK) { const kept = prev.spec && prev.spec[section] ? prev.spec[section][id] : undefined; if (!vault.isSealed(kept)) throw new HttpError(400, `Enter the value for ${id} again`); next[section] = { ...next[section], [id]: kept }; }
      s.spec = vault.sealSpec(next);
    }
    if (!s.spec) throw new HttpError(400, 'Missing command'); return s;
  };
  route('POST', '/api/schedules', async (req, res, p, s) => { const sch = cleanSchedule(await readBody(req), { id: crypto.randomUUID(), enabled: true, days: [], target: { all: true } }); db.schedules.push(sch); store.save(); audit(s.user, 'schedule.create', { schedule: sch.name }); send(res, 200, publicSchedule(sch)); }, { role: 'operator' });
  route('PATCH', '/api/schedules/:id', async (req, res, p, s) => { const i = db.schedules.findIndex((x) => x.id === p.id); if (i < 0) throw new HttpError(404, 'No such schedule'); db.schedules[i] = cleanSchedule(await readBody(req), db.schedules[i]); store.save(); audit(s.user, 'schedule.update', { schedule: db.schedules[i].name }); send(res, 200, publicSchedule(db.schedules[i])); }, { role: 'operator' });
  route('DELETE', '/api/schedules/:id', (req, res, p, s) => { const i = db.schedules.findIndex((x) => x.id === p.id); if (i < 0) throw new HttpError(404, 'No such schedule'); const [gone] = db.schedules.splice(i, 1); store.save(); audit(s.user, 'schedule.remove', { schedule: gone.name }); send(res, 200, { ok: true }); }, { role: 'operator' });
  route('GET', '/api/audit', (req, res) => { const u = new URL(req.url, 'http://x'); send(res, 200, store.readAudit(Math.min(Number(u.searchParams.get('limit')) || 500, 5000))); });
  route('POST', '/api/audit', async (req, res, p, s) => { const b = await readBody(req); audit(s.user, 'ui.' + String(b.action || 'note').replace(/[^\w.-]/g, '').slice(0, 40), { detail: String(b.detail || '').slice(0, 300) }); send(res, 200, { ok: true }); }, { role: 'viewer' });
  route('GET', '/api/account', (req, res, p, s) => { const u = db.users.find((x) => x.name === s.user); send(res, 200, { name: s.user, role: s.role, totpEnabled: !!(u && u.totp && u.totp.enabled), passkeys: u && u.passkeys ? u.passkeys.length : 0, passkeysAvailable: !!rpInfo(req).available, desktop }); });
  route('POST', '/api/account/password', async (req, res, p, s) => {
    const u = db.users.find((x) => x.name === s.user); if (!u) throw new HttpError(409, 'The desktop app has no password');
    const b = await readBody(req); if (!auth.verifyPassword(String(b.current || ''), u.pass)) throw new HttpError(401, 'Current password is wrong');
    if (String(b.next || '').length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
    u.pass = auth.hashPassword(b.next); store.flush(); dropSessions(u.name, s); audit(s.user, 'account.password'); send(res, 200, { ok: true }); // other devices are signed out
  }, { role: 'viewer' });
  route('POST', '/api/account/totp', async (req, res, p, s) => {
    const u = db.users.find((x) => x.name === s.user); if (!u) throw new HttpError(409, 'The desktop app has no sign in');
    const b = await readBody(req);
    // The authenticator secret is stored encrypted (see hub/secrets.js) and shown once, here.
    if (b.action === 'begin') { if (u.totp && u.totp.enabled) throw new HttpError(409, 'Turn the authenticator off before setting up a new one'); const secret = auth.totpSecret(); u.totp = { secret: vault.seal(secret, 'totp'), enabled: false }; store.flush(); return send(res, 200, { secret, uri: `otpauth://totp/Material%20Choco:${encodeURIComponent(u.name)}?secret=${secret}&issuer=Material%20Choco` }); }
    if (b.action === 'enable') { if (!u.totp || !auth.totpVerify(vault.open(u.totp.secret, 'totp'), b.code)) throw new HttpError(400, 'That code does not match'); u.totp.enabled = true; store.flush(); audit(s.user, 'account.totp.enable'); return send(res, 200, { ok: true }); }
    if (b.action === 'disable') { if (!auth.verifyPassword(String(b.password || ''), u.pass)) throw new HttpError(401, 'Password is wrong'); delete u.totp; store.flush(); audit(s.user, 'account.totp.disable'); return send(res, 200, { ok: true }); }
    throw new HttpError(400, 'Unknown action');
  }, { role: 'viewer' });

  // ---- passkeys: the signed-in user's own credentials ------------------------------------------
  const accountUser = (s) => { const u = db.users.find((x) => x.name === s.user); if (!u) throw new HttpError(409, 'The desktop app has no sign in'); return u; };
  route('GET', '/api/account/passkeys', (req, res, p, s) => { const u = db.users.find((x) => x.name === s.user); send(res, 200, u && u.passkeys ? u.passkeys.map(publicPasskey) : []); });
  // Adding a passkey adds a way to sign in, so it asks for the current password like a password change does.
  route('POST', '/api/account/passkeys/begin', async (req, res, p, s) => {
    const u = accountUser(s); const rp = needRp(req); const b = await readBody(req, 16384);
    if (!auth.verifyPassword(String(b.password || ''), u.pass)) throw new HttpError(401, 'Current password is wrong');
    if ((u.passkeys || []).length >= 20) throw new HttpError(409, 'This account already has 20 passkeys. Remove one first.');
    if (!u.handle) { u.handle = auth.token(16); store.save(); } // opaque user handle, never the name
    const challenge = newChallenge({ type: 'register', user: u.name, origin: rp.origin, rpId: rp.rpId });
    send(res, 200, { publicKey: { challenge, rp: { id: rp.rpId, name: 'Material Choco' }, user: { id: u.handle, name: u.name, displayName: u.name }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], timeout: CHALLENGE_MS, attestation: 'none', excludeCredentials: (u.passkeys || []).map(credentialDescriptor), authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' } } });
  }, { role: 'viewer' });
  route('POST', '/api/account/passkeys/finish', async (req, res, p, s) => {
    const u = accountUser(s); const b = await readBody(req, 65536); const r = b.response && typeof b.response === 'object' ? b.response : {};
    let made;
    try {
      const clientData = webauthn.parseClientData(r.clientDataJSON); const pending = takeChallenge(clientData.data.challenge, 'register');
      if (!pending || pending.user !== u.name) throw new webauthn.WebAuthnError('This passkey request expired or was already used. Start again.');
      made = webauthn.verifyRegistration({ clientData, attestationObject: r.attestationObject, expected: { challenge: clientData.data.challenge, origin: pending.origin, rpId: pending.rpId } }); made.rpId = pending.rpId;
    } catch (e) { if (!(e instanceof webauthn.WebAuthnError)) throw e; audit(s.user, 'account.passkey.rejected', { reason: e.message }); throw new HttpError(400, e.message); }
    if (db.users.some((x) => (x.passkeys || []).some((k) => k.id === made.credentialId))) throw new HttpError(409, 'This passkey is already registered');
    const transports = (Array.isArray(r.transports) ? r.transports : []).filter((t) => typeof t === 'string' && /^[a-z-]{1,20}$/.test(t)).slice(0, 6);
    const key = { id: made.credentialId, name: String(b.name || '').trim().slice(0, 60) || 'Passkey', jwk: made.jwk, alg: made.alg, counter: made.counter, rpId: made.rpId, transports, backedUp: made.backedUp, createdAt: new Date().toISOString(), lastUsed: null };
    u.passkeys = [...(u.passkeys || []), key]; store.flush(); audit(s.user, 'account.passkey.add', { passkey: key.name, alg: key.alg }); send(res, 200, { ok: true, passkey: publicPasskey(key) });
  }, { role: 'viewer' });
  route('DELETE', '/api/account/passkeys/:id', (req, res, p, s) => {
    const u = accountUser(s); const i = (u.passkeys || []).findIndex((k) => k.id === p.id); if (i < 0) throw new HttpError(404, 'No such passkey');
    const [gone] = u.passkeys.splice(i, 1); store.flush(); audit(s.user, 'account.passkey.remove', { passkey: gone.name }); send(res, 200, { ok: true });
  }, { role: 'viewer' });

  // ---- passkeys: sign in ------------------------------------------------------------------------
  route('POST', '/api/login/passkey/begin', async (req, res) => {
    if (desktop) throw new HttpError(409, 'The desktop app has no sign in'); throttle('pk|' + ip(req));
    const wait = limiter.check(ip(req) + '|passkey'); if (wait) throw new HttpError(429, `Too many failed attempts. Try again in ${wait} seconds.`);
    const rp = needRp(req); const b = await readBody(req, 4096); const name = String(b.name || '').trim().slice(0, 80);
    // With a name the answer lists that account's credentials, for security keys that cannot be
    // discovered. An unknown name gets a stable made-up credential so the answer does not show
    // whether the account exists. Without a name the browser offers its discoverable passkeys.
    let allowCredentials = [];
    if (name) { const u = userByName(name); allowCredentials = u && u.passkeys && u.passkeys.length ? u.passkeys.map(credentialDescriptor) : [{ type: 'public-key', id: vault.mac('no-such-credential|' + name.toLowerCase()).toString('base64url') }]; }
    const challenge = newChallenge({ type: 'login', origin: rp.origin, rpId: rp.rpId });
    send(res, 200, { publicKey: { challenge, rpId: rp.rpId, timeout: CHALLENGE_MS, userVerification: 'preferred', allowCredentials } });
  }, { open: true });
  route('POST', '/api/login/passkey/finish', async (req, res) => {
    if (desktop) throw new HttpError(409, 'The desktop app has no sign in'); throttle('pk|' + ip(req));
    const key = ip(req) + '|passkey'; const wait = limiter.check(key); if (wait) throw new HttpError(429, `Too many failed attempts. Try again in ${wait} seconds.`);
    const b = await readBody(req, 65536); const r = b.response && typeof b.response === 'object' ? b.response : {};
    let u = null; let cred = null;
    const refuse = (reason, status = 401, message = 'Passkey sign-in failed') => { audit(u ? u.name : '(passkey)', 'login.failed', { ip: ip(req), method: 'passkey', reason }); loginFailed(key, u ? u.name : '(passkey)', req, 'passkey'); throw new HttpError(status, message); };
    let checked;
    try {
      const clientData = webauthn.parseClientData(r.clientDataJSON); const pending = takeChallenge(clientData.data.challenge, 'login');
      if (!pending) refuse('The challenge is unknown, expired or already used');
      for (const x of db.users) { const k = (x.passkeys || []).find((c) => c.id === b.id); if (k) { u = x; cred = k; break; } }
      if (!cred) refuse('Unknown credential');
      if (cred.rpId !== pending.rpId) refuse('The credential belongs to a different site address');
      if (typeof r.userHandle === 'string' && r.userHandle && r.userHandle !== u.handle) refuse('The user handle does not match the credential');
      checked = webauthn.verifyAssertion({ clientData, authenticatorData: r.authenticatorData, signature: r.signature, expected: { challenge: clientData.data.challenge, origin: pending.origin, rpId: pending.rpId }, credential: cred });
    } catch (e) {
      if (!(e instanceof webauthn.WebAuthnError)) throw e;
      if (e.counterRegression) audit(u.name, 'account.passkey.counter', { passkey: cred.name, ip: ip(req) });
      refuse(e.message);
    }
    if (u.disabled) { audit(u.name, 'login.refused', { ip: ip(req), reason: 'disabled', method: 'passkey' }); throw new HttpError(403, 'This account is disabled. Ask an administrator.'); }
    // An account with an authenticator code has two factors. A passkey may only replace both
    // when the authenticator itself verified the person (PIN or biometrics).
    if (u.totp && u.totp.enabled && !checked.userVerified) refuse('User verification is required for this account', 401, 'This account needs a passkey that verifies you with a PIN or biometrics. Sign in with your password and code instead.');
    cred.counter = checked.counter; cred.lastUsed = new Date().toISOString(); cred.backedUp = checked.backedUp; u.lastLogin = cred.lastUsed; store.flush();
    limiter.ok(key); startSession(res, u.name, req); audit(u.name, 'login.ok', { ip: ip(req), method: 'passkey', passkey: cred.name }); send(res, 200, { ok: true });
  }, { open: true });

  // ---- users (administrators only) ---------------------------------------------------------------
  const publicUser = (u) => ({ name: u.name, role: u.role, disabled: !!u.disabled, createdAt: u.createdAt || null, lastLogin: u.lastLogin || null, totpEnabled: !!(u.totp && u.totp.enabled), passkeys: (u.passkeys || []).length });
  const targetUser = (p) => { let name; try { name = decodeURIComponent(p.name); } catch { throw new HttpError(400, 'Bad user name'); } const u = userByName(name); if (!u) throw new HttpError(404, 'No such user'); return u; };
  const noDesktopUsers = () => { if (desktop) throw new HttpError(409, 'The desktop app has no user accounts'); };
  route('GET', '/api/users', (req, res) => send(res, 200, db.users.map(publicUser)), { role: 'admin' });
  route('POST', '/api/users', async (req, res, p, s) => {
    noDesktopUsers(); const b = await readBody(req, 16384); const name = String(b.name || '').trim(); const role = b.role === undefined ? 'viewer' : b.role;
    if (!NAME_RE.test(name)) throw new HttpError(400, 'Name must be 2 to 40 letters, digits, dot, dash, underscore or @');
    if (!isRole(role)) throw new HttpError(400, 'Role must be admin, operator or viewer');
    if (typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 1024) throw new HttpError(400, 'Password must be at least 10 characters');
    if (userByName(name)) throw new HttpError(409, 'That name is already taken');
    if (db.users.length >= 200) throw new HttpError(409, 'This hub already has 200 users');
    const u = { name, role, pass: auth.hashPassword(b.password), createdAt: new Date().toISOString() }; db.users.push(u); store.flush();
    audit(s.user, 'user.create', { target: u.name, role }); send(res, 200, publicUser(u));
  }, { role: 'admin' });
  route('PATCH', '/api/users/:name', async (req, res, p, s) => {
    noDesktopUsers(); const u = targetUser(p); const b = await readBody(req, 16384);
    const role = b.role === undefined ? u.role : b.role; const disabled = b.disabled === undefined ? !!u.disabled : b.disabled;
    if (!isRole(role)) throw new HttpError(400, 'Role must be admin, operator or viewer');
    if (typeof disabled !== 'boolean') throw new HttpError(400, 'disabled must be true or false');
    if (b.password !== undefined && (typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 1024)) throw new HttpError(400, 'Password must be at least 10 characters');
    // The hub must always keep one administrator who can sign in.
    if (u.role === 'admin' && !u.disabled && (role !== 'admin' || disabled) && activeAdmins().length <= 1) throw new HttpError(409, 'The last administrator cannot be demoted or disabled');
    if (role !== u.role) { audit(s.user, 'user.role', { target: u.name, from: u.role, to: role }); u.role = role; }
    if (disabled !== !!u.disabled) { if (disabled) u.disabled = true; else delete u.disabled; audit(s.user, disabled ? 'user.disable' : 'user.enable', { target: u.name }); if (disabled) dropSessions(u.name); }
    // An administrator resetting a password signs that user out everywhere.
    if (b.password !== undefined) { u.pass = auth.hashPassword(b.password); audit(s.user, 'user.password', { target: u.name }); if (u.name !== s.user) dropSessions(u.name); }
    store.flush(); send(res, 200, publicUser(u));
  }, { role: 'admin' });
  route('DELETE', '/api/users/:name', (req, res, p, s) => {
    noDesktopUsers(); const u = targetUser(p);
    if (u.role === 'admin' && !u.disabled && activeAdmins().length <= 1) throw new HttpError(409, 'The last administrator cannot be removed');
    db.users.splice(db.users.indexOf(u), 1); dropSessions(u.name); store.flush(); audit(s.user, 'user.delete', { target: u.name, role: u.role }); send(res, 200, { ok: true });
  }, { role: 'admin' });

  // ---- webhooks (administrators only) ---------------------------------------------------------------
  // The address is a credential for many receivers, so it is stored encrypted, shown to
  // administrators only, and only its host name reaches the audit log.
  const hookUrl = (h) => { try { return vault.open(h.url, 'webhook'); } catch { return ''; } };
  const hookHost = (h) => { try { return new URL(hookUrl(h)).host; } catch { return ''; } };
  const publicHook = (h) => ({ id: h.id, name: h.name, url: hookUrl(h), format: h.format, events: h.events, offlineMinutes: h.offlineMinutes, enabled: !!h.enabled, createdAt: h.createdAt });
  const hookById = (id) => { const h = db.webhooks.find((x) => x.id === id); if (!h) throw new HttpError(404, 'No such webhook'); return h; };
  function cleanHook(b, prev) {
    const h = { ...prev };
    if (b.name !== undefined) h.name = String(b.name).trim().slice(0, 60); if (!h.name) throw new HttpError(400, 'Name the webhook');
    if (b.url !== undefined) { let url; try { url = webhooksLib.checkUrl(b.url); } catch (e) { throw new HttpError(400, e.message); } h.url = vault.seal(url, 'webhook'); } if (!h.url) throw new HttpError(400, 'Enter the webhook address');
    if (b.format !== undefined) h.format = b.format; if (!webhooksLib.FORMATS.includes(h.format)) throw new HttpError(400, 'Format must be json or discord');
    if (b.events !== undefined) { if (!Array.isArray(b.events) || b.events.some((e) => !webhooksLib.EVENTS.includes(e))) throw new HttpError(400, 'Events must be chosen from: ' + webhooksLib.EVENTS.join(', ')); h.events = webhooksLib.EVENTS.filter((e) => b.events.includes(e)); }
    if (b.offlineMinutes !== undefined) h.offlineMinutes = Number(b.offlineMinutes); if (!Number.isInteger(h.offlineMinutes) || h.offlineMinutes < 2 || h.offlineMinutes > 10080) throw new HttpError(400, 'offlineMinutes must be a whole number from 2 to 10080');
    if (b.enabled !== undefined) h.enabled = !!b.enabled;
    return h;
  }
  route('GET', '/api/webhooks', (req, res) => send(res, 200, { events: webhooksLib.EVENTS, formats: webhooksLib.FORMATS, webhooks: db.webhooks.map(publicHook) }), { role: 'admin' });
  route('POST', '/api/webhooks', async (req, res, p, s) => {
    if (db.webhooks.length >= 20) throw new HttpError(409, 'This hub already has 20 webhooks');
    const h = cleanHook(await readBody(req, 16384), { id: crypto.randomUUID(), format: 'json', events: ['job.failed'], offlineMinutes: 10, enabled: true, createdAt: new Date().toISOString() });
    db.webhooks.push(h); store.flush(); audit(s.user, 'webhook.create', { webhook: h.name, host: hookHost(h), events: h.events.join(',') }); send(res, 200, publicHook(h));
  }, { role: 'admin' });
  route('PATCH', '/api/webhooks/:id', async (req, res, p, s) => {
    const prev = hookById(p.id); const h = cleanHook(await readBody(req, 16384), prev); db.webhooks[db.webhooks.indexOf(prev)] = h;
    store.flush(); audit(s.user, 'webhook.update', { webhook: h.name, host: hookHost(h), events: h.events.join(','), enabled: h.enabled }); send(res, 200, publicHook(h));
  }, { role: 'admin' });
  route('DELETE', '/api/webhooks/:id', (req, res, p, s) => {
    const h = hookById(p.id); db.webhooks.splice(db.webhooks.indexOf(h), 1); store.flush(); audit(s.user, 'webhook.remove', { webhook: h.name, host: hookHost(h) }); send(res, 200, { ok: true });
  }, { role: 'admin' });
  // Sends one test message now (no retries) and answers with the result. Works for a disabled webhook too.
  route('POST', '/api/webhooks/:id/test', async (req, res, p, s) => {
    const h = hookById(p.id); audit(s.user, 'webhook.test', { webhook: h.name, host: hookHost(h) });
    send(res, 200, await hooks.deliver(h, 'test', { text: `Test message from the Material Choco hub on ${os.hostname()}. Webhook "${h.name}" works.`, test: true }, { retries: 0 }));
  }, { role: 'admin' });

  route('GET', '/api/events', (req, res, p, s) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' }); res.write('retry: 3000\n\n'); res.mcSession = s; sse.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000); req.on('close', () => { clearInterval(ping); sse.delete(res); });
  });

  // ---- agent endpoints -------------------------------------------------------------------
  // The allow list an agent reports is its own local policy. The hub records it so that it can
  // refuse such jobs early; the agent enforces it regardless of what the hub thinks.
  const agentAllowOf = (info) => { if (!info || !Array.isArray(info.allow)) return null; try { return choco.parseAllowList(info.allow); } catch { return []; } };
  route('POST', '/agent/enroll', async (req, res) => {
    const key = 'enroll|' + ip(req); const wait = limiter.check(key); if (wait) throw new HttpError(429, `Too many attempts. Try again in ${wait} seconds.`);
    const b = await readBody(req); const hash = auth.sha256(String(b.code || '').trim().toUpperCase());
    const i = db.pairings.findIndex((x) => x.expires > Date.now() && auth.safeEqual(x.hash, hash));
    if (i < 0) { limiter.fail(key); throw new HttpError(401, 'That pairing code is wrong or has expired'); }
    const [pairing] = db.pairings.splice(i, 1); const token = auth.token(); const info = b.info || {};
    const m = { id: crypto.randomUUID(), name: String(b.name || info.hostname || 'machine').slice(0, 60), hostname: String(info.hostname || '').slice(0, 80), os: String(info.os || '').slice(0, 80), arch: String(info.arch || '').slice(0, 20), elevated: !!info.elevated, agentVersion: String(info.agentVersion || '').slice(0, 20), groups: pairing.groups, readOnly: !!(pairing.readOnly || b.readOnly), ...(agentAllowOf(info) ? { agentAllow: agentAllowOf(info) } : {}), tokenHash: auth.sha256(token), enrolledAt: new Date().toISOString(), lastSeen: new Date().toISOString() };
    db.machines.push(m); store.flush(); audit('agent', 'machine.enroll', { machine: m.name, ip: ip(req) }); emit('machine', publicMachine(m));
    createJob(m, { kind: 'inventory' }, 'enrollment');
    send(res, 200, { machineId: m.id, token, readOnly: m.readOnly });
  }, { open: true });
  route('POST', '/agent/poll', async (req, res, p, s, m) => {
    const b = await readBody(req); const info = b.info || {}; const wasOnline = Date.now() - Date.parse(m.lastSeen || 0) < ONLINE_MS;
    Object.assign(m, { lastSeen: new Date().toISOString(), hostname: String(info.hostname || m.hostname || '').slice(0, 80), os: String(info.os || m.os || '').slice(0, 80), elevated: !!info.elevated, agentVersion: String(info.agentVersion || '').slice(0, 20) });
    const reported = agentAllowOf(info); const allowChanged = JSON.stringify(reported) !== JSON.stringify(m.agentAllow || null); if (reported) m.agentAllow = reported; else delete m.agentAllow;
    if (!wasOnline || allowChanged) emit('machine', publicMachine(m));
    // Secret option values are decrypted here, at the moment the job is handed to its agent.
    const take = () => {
      for (;;) {
        const j = db.jobs.find((x) => x.state === 'queued' && x.machineId === m.id); if (!j) return null; j.state = 'running'; j.startedAt = new Date().toISOString();
        let spec; try { spec = vault.openSpec(j.spec); } catch (e) { finishJob(j, { code: -1, stderr: 'The hub could not decrypt the secret values of this job. ' + e.message, rejected: true }); continue; }
        store.save(); emit('job', publicJob(j)); return { id: j.id, spec };
      }
    };
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
    let rel; try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, { error: 'Bad request address' }); } if (rel === '/') rel = '/index.html';
    if (rel.includes('\0')) return send(res, 400, { error: 'Bad request address' });
    const file = path.normalize(path.join(UI_DIR, rel)); if (!file.startsWith(UI_DIR + path.sep)) return send(res, 403, { error: 'Forbidden' });
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': rel.startsWith('/vendor/') ? 'public, max-age=86400' : 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
        'content-security-policy': "default-src 'self'; img-src 'self' data: blob: https://github.com https://*.githubusercontent.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://raw.githubusercontent.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
      res.end(data);
    });
  }

  async function handle(req, res) {
    try {
      // Inside the try: an address such as "//" does not parse, and that must be a 400, not an unhandled rejection that stops the hub.
      let pathname; try { pathname = new URL(req.url, 'http://x').pathname; } catch { throw new HttpError(400, 'Bad request address'); }
      if (!pathname.startsWith('/api/') && !pathname.startsWith('/agent/')) { if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed'); return serveStatic(req, res, pathname); }
      for (const [method, re, handler, opts] of routes) {
        if (method !== req.method) continue; const m = re.exec(pathname); if (!m) continue;
        let session = null; let machine = null;
        if (opts.agent) { machine = agentOf(req); if (!machine) throw new HttpError(401, 'Unknown agent'); }
        else {
          if (req.method !== 'GET' && !pathname.startsWith('/agent/') && !sameOrigin(req)) throw new HttpError(403, 'Cross-site request refused');
          if (!opts.open) {
            session = sessionOf(req); if (!session) throw new HttpError(401, 'Sign in first');
            // Reading needs any role. Changing something needs the role named on the route, and
            // a route that names none is for administrators only.
            const need = opts.role || (req.method === 'GET' ? 'viewer' : 'admin');
            if (RANK[session.role] < RANK[need]) throw new HttpError(403, `Your role (${session.role}) does not allow this. It needs ${need}.`);
          }
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
    server, store, launchToken, createJob, tickSchedules, checkOffline, db,
    listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address())); }),
    close: () => new Promise((resolve) => { timers.forEach(clearInterval); hooks.close(); for (const r of sse) r.end(); for (const w of waiters.values()) w(); store.flush(); server.close(() => resolve()); server.closeAllConnections && server.closeAllConnections(); }),
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
