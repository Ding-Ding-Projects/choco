'use strict';
// Starts a real hub and a real agent in this process, with the test fixture standing in for choco.exe.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test-'));
const bundle = path.join(tmp, 'bundle'); require('./fixtures/stand-in').installStandIn(bundle);
Object.assign(process.env, { MATERIAL_CHOCO_BUNDLE: bundle, MATERIAL_CHOCO_HOME: path.join(tmp, 'home'), FAKE_CHOCO_STATE: path.join(tmp, 'state.json') });
const { createHub } = require('../hub/server');
const { Agent } = require('../core/agent');

let hub; let base; let cookie = ''; let agent;
const call = async (route, { method = 'GET', body, headers = {}, auth = true } = {}) => { const res = await fetch(base + route, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(auth && cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); const sc = res.headers.get('set-cookie'); if (sc && sc.includes('mc_session=') && !sc.includes('Max-Age=0')) cookie = sc.split(';')[0]; return { status: res.status, data: await res.json().catch(() => ({})) }; };
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 100)); } };
const job = async (spec, ids) => { const r = await call('/api/jobs', { method: 'POST', body: { machineIds: ids, spec } }); assert.strictEqual(r.status, 200); return r.data; };
const done = (id) => until(async () => { const j = (await call('/api/jobs/' + id)).data; return ['succeeded', 'failed', 'cancelled'].includes(j.state) && j; });

test.before(async () => { hub = createHub({ dataDir: path.join(tmp, 'hub'), host: '127.0.0.1', port: 0 }); const a = await hub.listen(); base = `http://127.0.0.1:${a.port}`; });
test.after(async () => { if (agent) agent.stop(); await hub.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('nothing works before setup and sign in', async () => {
  assert.strictEqual((await call('/api/status')).data.setupNeeded, true);
  assert.strictEqual((await call('/api/machines')).status, 401);
  assert.strictEqual((await call('/api/setup', { method: 'POST', body: { name: 'admin', password: 'short' } })).status, 400);
});
test('setup creates the administrator once', async () => {
  assert.strictEqual((await call('/api/setup', { method: 'POST', body: { name: 'admin', password: 'correct horse battery' } })).status, 200);
  assert.strictEqual((await call('/api/setup', { method: 'POST', body: { name: 'eve', password: 'another long password' }, auth: false })).status, 409);
  assert.strictEqual((await call('/api/status')).data.authenticated, true);
  assert.ok(!fs.readFileSync(path.join(tmp, 'hub', 'hub.json'), 'utf8').includes('correct horse'));
});
test('wrong passwords are refused and then locked out', async () => {
  for (let i = 0; i < 5; i++) assert.strictEqual((await call('/api/login', { method: 'POST', body: { name: 'admin', password: 'nope' }, auth: false })).status, 401);
  assert.strictEqual((await call('/api/login', { method: 'POST', body: { name: 'admin', password: 'correct horse battery' }, auth: false })).status, 429);
});
test('cross-site requests are refused', async () => { assert.strictEqual((await call('/api/pairing', { method: 'POST', body: {}, headers: { origin: 'https://evil.example' } })).status, 403); });
test('static files cannot escape the UI folder', async () => { const r = await fetch(base + '/..%2f..%2fpackage.json'); assert.notStrictEqual(r.status, 200); });
test('malformed request addresses and bodies get a 400 and do not stop the hub', async () => {
  const raw = (target, body) => new Promise((resolve, reject) => { const u = new URL(base); const req = require('node:http').request({ host: u.hostname, port: u.port, path: target, method: body === undefined ? 'GET' : 'POST', headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.on('error', reject); if (body !== undefined) req.write(body); req.end(); });
  for (const target of ['//', '///', '//[']) assert.strictEqual(await raw(target), 400, target);
  assert.strictEqual(await raw('/%E0%A4%A'), 400); assert.strictEqual(await raw('/a%00b'), 400);
  for (const body of ['null', '[]', '5', '"text"', '{bad']) assert.strictEqual(await raw('/api/pairing', body), 400, body);
  assert.strictEqual((await call('/api/status')).status, 200);
});
test('agent enrolls with a one time code and reports inventory from the bundled CLI', async () => {
  const p = (await call('/api/pairing', { method: 'POST', body: {} })).data; assert.match(p.code, /^\w{4}-\w{4}$/);
  agent = new Agent({ configFile: path.join(tmp, 'agent', 'agent.json') });
  await assert.rejects(agent.enroll({ hubUrl: 'http://203.0.113.9:1', code: p.code }), /plain HTTP/);
  await assert.rejects(agent.enroll({ hubUrl: base, code: 'AAAA-AAAA' }), /wrong or has expired/);
  await agent.enroll({ hubUrl: base, code: p.code, name: 'TEST-PC' }); agent.start();
  await assert.rejects(new Agent({ configFile: path.join(tmp, 'agent2', 'agent.json') }).enroll({ hubUrl: base, code: p.code }), /wrong or has expired/);
  const m = await until(async () => (await call('/api/machines')).data.find((x) => x.inventory));
  assert.strictEqual(m.name, 'TEST-PC'); assert.strictEqual(m.inventory.bundled, true); assert.strictEqual(m.inventory.packages.length, 3); assert.strictEqual(m.inventory.outdated.length, 2); assert.strictEqual(m.online, true);
  assert.ok(!JSON.stringify(m).includes(agent.config.token));
});
test('a job runs on the agent, streams output and refreshes inventory', async () => {
  const [m] = (await call('/api/machines')).data; const r = await job({ kind: 'choco', command: 'upgrade', args: ['git'], global: { confirm: true } }, [m.id]);
  const j = await done(r.jobs[0].id); assert.strictEqual(j.state, 'succeeded'); assert.match(j.output, /upgrade of git was successful/);
  const after = await until(async () => (await call('/api/machines')).data.find((x) => x.inventory.packages.find((p) => p.name === 'git' && p.version === '2.47.1'))); assert.strictEqual(after.inventory.outdated.length, 1);
});
test('a failing command reports its exit code', async () => { const [m] = (await call('/api/machines')).data; const j = await done((await job({ kind: 'choco', command: 'uninstall', args: ['missing'] }, [m.id])).jobs[0].id); assert.strictEqual(j.state, 'failed'); assert.strictEqual(j.exitCode, 1); });
test('invalid commands never reach an agent', async () => { const [m] = (await call('/api/machines')).data; assert.strictEqual((await call('/api/jobs', { method: 'POST', body: { machineIds: [m.id], spec: { kind: 'choco', command: 'install', args: ['--source=evil'] } } })).status, 400); });
test('packages.config import writes a temp file on the agent', async () => { const [m] = (await call('/api/machines')).data; const j = await done((await job({ kind: 'choco', command: 'install', file: { name: 'packages.config', content: '<packages></packages>' } }, [m.id])).jobs[0].id); assert.match(j.command, /\[packages\.config\]/); });
test('read only machines refuse changes in the hub and in the agent', async () => {
  const [m] = (await call('/api/machines')).data; await call('/api/machines/' + m.id, { method: 'PATCH', body: { readOnly: true, groups: ['Lab'] } });
  const r = await job({ kind: 'choco', command: 'uninstall', args: ['7zip'] }, [m.id]); assert.strictEqual(r.jobs.length, 0); assert.match(r.skipped[0].reason, /read only/);
  assert.strictEqual((await job({ kind: 'choco', command: 'list', global: { 'limit-output': true } }, [m.id])).jobs.length, 1);
  const runner = require('../core/runner'); const direct = await runner.execute({ kind: 'choco', command: 'uninstall', args: ['7zip'] }, { policy: { readOnly: true } }); assert.strictEqual(direct.rejected, true);
  await call('/api/machines/' + m.id, { method: 'PATCH', body: { readOnly: false } });
});
test('schedules create jobs at their time, once per day', async () => {
  const s = (await call('/api/schedules', { method: 'POST', body: { name: 'nightly', time: '03:00', spec: { kind: 'inventory' }, target: { group: 'lab' } } })).data; assert.ok(s.id);
  assert.strictEqual((await call('/api/schedules', { method: 'POST', body: { name: 'bad', time: '25:00', spec: { kind: 'inventory' } } })).status, 400);
  const before = hub.db.jobs.length; const at = new Date(); at.setHours(3, 0, 0, 0); hub.tickSchedules(at); hub.tickSchedules(at); assert.strictEqual(hub.db.jobs.length, before + 1);
});
test('history is recorded and secrets stay out of it', async () => {
  const [m] = (await call('/api/machines')).data; await done((await job({ kind: 'choco', command: 'source', subcommand: 'add', options: { name: 'int', source: 'https://x.example/', password: 'hunter2hunter2' } }, [m.id])).jobs[0].id);
  const audit = (await call('/api/audit')).data; assert.ok(audit.some((a) => a.action === 'job.create')); assert.ok(audit.some((a) => a.action === 'login.failed'));
  assert.ok(!JSON.stringify(audit).includes('hunter2')); assert.ok(!fs.readFileSync(path.join(tmp, 'hub', 'audit.jsonl'), 'utf8').includes('hunter2'));
  assert.ok(!JSON.stringify((await call('/api/jobs')).data).includes('hunter2'));
});
test('removing a machine revokes its agent', async () => {
  const [m] = (await call('/api/machines')).data; assert.strictEqual((await call('/api/machines/' + m.id, { method: 'DELETE' })).status, 200);
  const r = await fetch(base + '/agent/poll', { method: 'POST', headers: { authorization: 'Bearer ' + agent.config.token, 'content-type': 'application/json' }, body: '{}' }); assert.strictEqual(r.status, 401);
});
