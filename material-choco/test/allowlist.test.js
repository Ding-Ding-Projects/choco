'use strict';
// Per-machine command allow list: enforced by the hub when a job is created and, separately,
// by the agent from its own local policy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
// The hub runs in this process, so child processes that talk to it must not block the event loop.
const run = (args, env) => new Promise((resolve) => execFile('node', args, { env, encoding: 'utf8' }, (err, stdout, stderr) => resolve({ status: err ? err.code : 0, stdout, stderr })));
const { tmp, startHub, cleanup, client, until, setupAdmin } = require('./helpers');
const { Agent } = require('../core/agent');
const runner = require('../core/runner');
const choco = require('../core/choco');

let h; let admin; let agent; let id;
const patch = (body) => admin('/api/machines/' + id, { method: 'PATCH', body });
const jobs = (spec) => admin('/api/jobs', { method: 'POST', body: { machineIds: [id], spec } });
const done = (jobId) => until(async () => { const j = (await admin('/api/jobs/' + jobId)).data; return ['succeeded', 'failed', 'cancelled'].includes(j.state) && j; });
const machine = async () => (await admin('/api/machines')).data.find((m) => m.id === id);

test.before(async () => {
  h = await startHub('allow'); admin = client(h.port); await setupAdmin(admin);
  const p = (await admin('/api/pairing', { method: 'POST', body: {} })).data; agent = new Agent({ configFile: path.join(tmp, 'agent-allow', 'agent.json') });
  await agent.enroll({ hubUrl: h.base, code: p.code, name: 'ALLOW-PC' }); agent.start(); id = agent.config.machineId; await until(async () => (await machine()).inventory);
});
// An agent finishes reporting a job it already started, so wait for those before stopping.
test.after(async () => { await until(() => h.hub.db.jobs.every((j) => j.machineId !== id || !['queued', 'running'].includes(j.state))); agent.stop(); await cleanup(); });

test('allow lists are canonical command names', () => {
  assert.deepStrictEqual(choco.parseAllowList('upgrade, list ,find'), ['list', 'search', 'upgrade']); assert.deepStrictEqual(choco.parseAllowList(['list', 'list']), ['list']); assert.strictEqual(choco.parseAllowList(null), null); assert.deepStrictEqual(choco.parseAllowList([]), []);
  assert.throws(() => choco.parseAllowList('list,format-c'), /Unknown choco command/); assert.throws(() => choco.parseAllowList(['__proto__']), /Unknown choco command/);
  assert.strictEqual(choco.allowedBy(['search'], { kind: 'choco', command: 'find' }), true); assert.strictEqual(choco.allowedBy(['list'], { kind: 'choco', command: 'install' }), false); assert.strictEqual(choco.allowedBy([], { kind: 'inventory' }), true); assert.strictEqual(choco.allowedBy(null, { kind: 'choco', command: 'install' }), true);
});
test('the runner refuses commands outside the local allow list', async () => {
  const refused = await runner.execute({ kind: 'choco', command: 'uninstall', args: ['7zip'] }, { policy: { allow: ['list', 'upgrade'] } }); assert.strictEqual(refused.rejected, true); assert.strictEqual(refused.code, -1); assert.match(refused.stderr, /only allows these choco commands: list, upgrade/);
  assert.strictEqual((await runner.execute({ kind: 'choco', command: 'list', global: { 'limit-output': true } }, { policy: { allow: ['list'] } })).code, 0);
  assert.strictEqual((await runner.execute({ kind: 'choco', command: 'list' }, { policy: { allow: [] } })).rejected, true);
  assert.strictEqual((await runner.execute({ kind: 'inventory' }, { policy: { allow: [] } })).code, 0);
});
test('the hub refuses jobs outside a machine allow list', async () => {
  assert.strictEqual((await machine()).allowedCommands, null);
  const set = await patch({ allowedCommands: ['upgrade', 'list', 'find'] }); assert.strictEqual(set.status, 200); assert.deepStrictEqual(set.data.allowedCommands, ['list', 'search', 'upgrade']);
  const no = await jobs({ kind: 'choco', command: 'uninstall', args: ['7zip'] }); assert.strictEqual(no.status, 200); assert.strictEqual(no.data.jobs.length, 0); assert.match(no.data.skipped[0].reason, /only allows these commands: list, search, upgrade/);
  assert.strictEqual((await jobs({ kind: 'choco', command: 'install', args: ['vscode'] })).data.jobs.length, 0);
  const yes = await jobs({ kind: 'choco', command: 'upgrade', args: ['git'] }); assert.strictEqual(yes.data.jobs.length, 1); assert.strictEqual((await done(yes.data.jobs[0].id)).state, 'succeeded');
  assert.strictEqual((await jobs({ kind: 'choco', command: 'search', args: ['git'] })).data.jobs.length, 1); assert.strictEqual((await jobs({ kind: 'inventory' })).data.jobs.length, 1);
  assert.ok((await admin('/api/audit')).data.some((a) => a.action === 'machine.allow' && a.allowed === 'list,search,upgrade'));
  for (const bad of [['nope'], 'list', [5], ['list', '--force']]) assert.strictEqual((await patch({ allowedCommands: bad })).status, 400, JSON.stringify(bad));
  assert.deepStrictEqual((await machine()).allowedCommands, ['list', 'search', 'upgrade']);
});
test('schedules skip machines whose allow list excludes the command', async () => {
  const s = (await admin('/api/schedules', { method: 'POST', body: { name: 'remove', time: '02:00', spec: { kind: 'choco', command: 'uninstall', args: ['putty'] } } })).data;
  const before = h.hub.db.jobs.length; const at = new Date(); at.setHours(2, 0, 0, 0); h.hub.tickSchedules(at); assert.strictEqual(h.hub.db.jobs.length, before); await admin('/api/schedules/' + s.id, { method: 'DELETE' });
});
test('an empty list allows inventory only, and null removes the restriction', async () => {
  assert.deepStrictEqual((await patch({ allowedCommands: [] })).data.allowedCommands, []); assert.strictEqual((await jobs({ kind: 'choco', command: 'list' })).data.jobs.length, 0); assert.strictEqual((await jobs({ kind: 'inventory' })).data.jobs.length, 1);
  assert.strictEqual((await patch({ allowedCommands: null })).data.allowedCommands, null); assert.strictEqual((await jobs({ kind: 'choco', command: 'list' })).data.jobs.length, 1);
});
test('the agent enforces its own allow list even when the hub does not know about it', async () => {
  const p = (await admin('/api/pairing', { method: 'POST', body: {} })).data; const strict = new Agent({ configFile: path.join(tmp, 'agent-strict', 'agent.json'), policy: { allow: ['list', 'outdated'] } });
  await strict.enroll({ hubUrl: h.base, code: p.code, name: 'STRICT-PC' }); const sid = strict.config.machineId; const m = h.hub.db.machines.find((x) => x.id === sid);
  // Queue the job straight into the hub, as a hub that ignores the policy would.
  const forced = h.hub.createJob(m, { kind: 'choco', command: 'uninstall', args: ['7zip'] }, 'test'); const fine = h.hub.createJob(m, { kind: 'choco', command: 'list', global: { 'limit-output': true } }, 'test');
  strict.start();
  try {
    const j = await done(forced.id); assert.strictEqual(j.state, 'failed'); assert.strictEqual(j.exitCode, -1); assert.match(j.note, /only allows these choco commands: list, outdated/);
    assert.strictEqual((await done(fine.id)).state, 'succeeded');
    assert.ok(JSON.parse(fs.readFileSync(process.env.FAKE_CHOCO_STATE, 'utf8')).packages['7zip'], 'the package is still installed');
    // The agent reports its list, the hub shows it and then refuses such jobs itself. The hub cannot widen it.
    const seen = await until(async () => { const x = (await admin('/api/machines')).data.find((y) => y.id === sid); return x.agentAllowedCommands && x; }); assert.deepStrictEqual(seen.agentAllowedCommands, ['list', 'outdated']);
    const r = await admin('/api/jobs', { method: 'POST', body: { machineIds: [sid], spec: { kind: 'choco', command: 'uninstall', args: ['7zip'] } } }); assert.strictEqual(r.data.jobs.length, 0); assert.match(r.data.skipped[0].reason, /only allows/);
    await admin('/api/machines/' + sid, { method: 'PATCH', body: { allowedCommands: null } }); assert.strictEqual((await admin('/api/jobs', { method: 'POST', body: { machineIds: [sid], spec: { kind: 'choco', command: 'uninstall', args: ['7zip'] } } })).data.jobs.length, 0);
  } finally { strict.stop(); }
});
test('the agent command line takes --allow and keeps it in its own config', async () => {
  const cli = path.join(__dirname, '..', 'core', 'agent-cli.js'); const dataDir = path.join(tmp, 'cli-agent'); const env = { ...process.env, MATERIAL_CHOCO_DATA: dataDir };
  const p = (await admin('/api/pairing', { method: 'POST', body: {} })).data;
  const bad = await run([cli, 'enroll', '--hub', h.base, '--code', p.code, '--allow', 'list,format-c'], env); assert.strictEqual(bad.status, 1); assert.match(bad.stderr, /Unknown choco command/); assert.ok(!fs.existsSync(path.join(dataDir, 'agent.json')));
  const out = await run([cli, 'enroll', '--hub', h.base, '--code', p.code, '--name', 'CLI-PC', '--allow', 'outdated,list'], env); assert.strictEqual(out.status, 0, out.stderr); assert.match(out.stdout, /only runs: list, outdated/);
  assert.deepStrictEqual(JSON.parse((await run([cli, 'status'], env)).stdout).allow, ['list', 'outdated']);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'agent.json'), 'utf8')).allow, ['list', 'outdated']);
  assert.deepStrictEqual((await admin('/api/machines')).data.find((m) => m.name === 'CLI-PC').agentAllowedCommands, ['list', 'outdated']);
  // A saved list is used by an agent started without the flag; a flag given to the process wins.
  const saved = new Agent({ configFile: path.join(dataDir, 'agent.json') }); assert.deepStrictEqual(saved.allowList(), ['list', 'outdated']);
  assert.deepStrictEqual(new Agent({ configFile: path.join(dataDir, 'agent.json'), policy: { allow: ['list'] } }).allowList(), ['list']);
  saved.setAllowList(null); assert.strictEqual(new Agent({ configFile: path.join(dataDir, 'agent.json') }).allowList(), null);
});
