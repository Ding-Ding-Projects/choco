'use strict';
// Outbound webhooks, delivered to a real local HTTP receiver.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startHub, cleanup, client, until, setupAdmin, enrollManual } = require('./helpers');
const { checkUrl } = require('../hub/webhooks');

const SECRET = 'webhook-test-secret-pass';
let h; let admin; let anon; let machine; let receiver; let rbase; const got = []; let behave = () => 200;
const post = (route, body) => admin(route, { method: 'POST', body });
const hook = async (body) => { const r = await post('/api/webhooks', body); assert.strictEqual(r.status, 200, JSON.stringify(r.data)); return r.data; };
const clear = async () => { for (const w of (await admin('/api/webhooks')).data.webhooks) await admin('/api/webhooks/' + w.id, { method: 'DELETE' }); got.length = 0; behave = () => 200; };
const audits = async (action) => (await admin('/api/audit?limit=5000')).data.filter((a) => a.action === action);
const runJob = async (spec, code) => {
  const r = await post('/api/jobs', { machineIds: [machine.id], spec }); const id = r.data.jobs[0].id;
  const t = await until(async () => { const p = await anon('/agent/poll', { method: 'POST', body: {}, token: machine.token }); return p.data.jobs && p.data.jobs[0]; });
  await anon(`/agent/jobs/${t.id}/output`, { method: 'POST', body: { chunk: 'OUTPUT-LINE-THAT-MUST-NOT-LEAVE\n' }, token: machine.token });
  await anon(`/agent/jobs/${t.id}/done`, { method: 'POST', body: { code, stderr: 'STDERR-THAT-MUST-NOT-LEAVE' }, token: machine.token }); return id;
};

test.before(async () => {
  receiver = http.createServer((req, res) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    const entry = { path: req.url, method: req.method, type: req.headers['content-type'], raw: Buffer.concat(chunks).toString('utf8') }; try { entry.body = JSON.parse(entry.raw); } catch { entry.body = null; } got.push(entry);
    const status = behave(entry, got.length); if (status === 'hang') return; if (status === 302) { res.writeHead(302, { location: rbase + '/redirected' }); return res.end(); } res.writeHead(status); res.end('ok');
  }); });
  await new Promise((r) => receiver.listen(0, '127.0.0.1', r)); rbase = `http://127.0.0.1:${receiver.address().port}`;
  h = await startHub('webhooks', { webhookBackoffMs: [15, 30, 45], webhookTimeoutMs: 400 }); admin = client(h.port); anon = client(h.port); await setupAdmin(admin); machine = await enrollManual(admin, anon, 'HOOK-PC');
});
test.after(async () => { await cleanup(); receiver.closeAllConnections(); await new Promise((r) => receiver.close(r)); });

test('only HTTPS addresses are accepted, except localhost', async () => {
  for (const url of ['http://example.com/hook', 'http://192.168.1.10/hook', 'ftp://example.com/x', 'file:///etc/passwd', 'not a url', '', 'https://user:pass@example.com/hook', 'http://localhost.evil.example/hook', 'http://127.0.0.1.evil.example/x'])
    assert.strictEqual((await post('/api/webhooks', { name: 'bad', url })).status, 400, url);
  assert.strictEqual(checkUrl('https://discord.com/api/webhooks/1/abc'), 'https://discord.com/api/webhooks/1/abc'); assert.ok(checkUrl('http://localhost:9/x')); assert.ok(checkUrl('http://[::1]:9/x'));
  for (const bad of [{ name: '', url: rbase }, { name: 'x', url: rbase, format: 'xml' }, { name: 'x', url: rbase, events: ['job.exploded'] }, { name: 'x', url: rbase, events: 'job.failed' }, { name: 'x', url: rbase, offlineMinutes: 0 }, { name: 'x', url: rbase, offlineMinutes: 1.5 }])
    assert.strictEqual((await post('/api/webhooks', bad)).status, 400, JSON.stringify(bad));
  assert.strictEqual((await admin('/api/webhooks')).data.webhooks.length, 0);
});
test('create, list, change and remove; the address is encrypted in hub.json and absent from the audit log', async () => {
  const w = await hook({ name: 'ops', url: rbase + '/hook?token=URL-TOKEN-123', events: ['job.failed', 'machine.offline'] });
  assert.deepStrictEqual([w.name, w.format, w.enabled, w.offlineMinutes], ['ops', 'json', true, 10]); assert.deepStrictEqual(w.events, ['job.failed', 'machine.offline']); assert.strictEqual(w.url, rbase + '/hook?token=URL-TOKEN-123');
  const list = (await admin('/api/webhooks')).data; assert.deepStrictEqual(list.events, ['job.failed', 'job.succeeded', 'machine.offline', 'login.lockout']); assert.deepStrictEqual(list.formats, ['json', 'discord']); assert.strictEqual(list.webhooks.length, 1);
  const p = await admin('/api/webhooks/' + w.id, { method: 'PATCH', body: { format: 'discord', enabled: false, offlineMinutes: 30 } }); assert.deepStrictEqual([p.data.format, p.data.enabled, p.data.offlineMinutes, p.data.url], ['discord', false, 30, w.url]);
  h.hub.store.flush(); assert.ok(!fs.readFileSync(h.file, 'utf8').includes('URL-TOKEN-123')); assert.ok(!fs.readFileSync(path.join(h.dataDir, 'audit.jsonl'), 'utf8').includes('URL-TOKEN-123'));
  assert.strictEqual((await audits('webhook.create')).length, 1); assert.strictEqual((await audits('webhook.update')).length, 1);
  assert.strictEqual((await admin('/api/webhooks/nope', { method: 'PATCH', body: {} })).status, 404); assert.strictEqual((await admin('/api/webhooks/' + w.id, { method: 'DELETE' })).status, 200); assert.strictEqual((await audits('webhook.remove')).length, 1);
});
test('a failed job is reported with the redacted command and exit code only', async () => {
  await clear(); await hook({ name: 'generic', url: rbase + '/generic', events: ['job.failed'] });
  const id = await runJob({ kind: 'choco', command: 'source', subcommand: 'add', options: { name: 'int', source: 'https://x.example/', password: SECRET } }, 1603);
  const d = await until(() => got.find((g) => g.path === '/generic')); assert.strictEqual(d.method, 'POST'); assert.match(d.type, /application\/json/);
  assert.strictEqual(d.body.event, 'job.failed'); assert.deepStrictEqual(d.body.job, { id, machine: 'HOOK-PC', machineId: machine.id, command: 'choco source add --name=int --source=https://x.example/ --password=********', state: 'failed', exitCode: 1603, by: 'admin' });
  assert.match(d.body.text, /Job #\d+ failed on HOOK-PC \(exit code 1603\)/); assert.ok(d.body.at && d.body.hub);
  for (const leak of [SECRET, 'OUTPUT-LINE', 'STDERR-THAT']) assert.ok(!d.raw.includes(leak), leak);
  const a = await until(async () => (await audits('webhook.delivered')).find((x) => x.event === 'job.failed')); assert.deepStrictEqual([a.webhook, a.status, a.attempts, a.host], ['generic', 200, 1, new URL(rbase).host]);
});
test('a succeeded job is reported only to webhooks that asked for it', async () => {
  await clear(); await hook({ name: 'failures', url: rbase + '/failures', events: ['job.failed'] }); await hook({ name: 'all', url: rbase + '/all', events: ['job.failed', 'job.succeeded'] }); await hook({ name: 'off', url: rbase + '/off', events: ['job.succeeded'], enabled: false });
  await runJob({ kind: 'choco', command: 'upgrade', args: ['git'] }, 0);
  const d = await until(() => got.find((g) => g.path === '/all')); assert.strictEqual(d.body.event, 'job.succeeded'); assert.strictEqual(d.body.job.exitCode, 0);
  await new Promise((r) => setTimeout(r, 150)); assert.deepStrictEqual(got.map((g) => g.path), ['/all']);
});
test('the Discord format sends content and never pings anyone', async () => {
  await clear(); await hook({ name: 'discord', url: rbase + '/discord', format: 'discord', events: ['job.failed'] });
  await runJob({ kind: 'choco', command: 'uninstall', args: ['@everyone'] }, 1);
  const d = await until(() => got.find((g) => g.path === '/discord')); assert.deepStrictEqual(Object.keys(d.body).sort(), ['allowed_mentions', 'content']);
  assert.match(d.body.content, /failed on HOOK-PC \(exit code 1\): choco uninstall @everyone/); assert.deepStrictEqual(d.body.allowed_mentions, { parse: [] });
});
test('delivery is retried with backoff, at most three times', async () => {
  await clear(); behave = (e, n) => (n < 3 ? 500 : 200); const w = await hook({ name: 'flaky', url: rbase + '/flaky', events: ['job.failed'] });
  await runJob({ kind: 'choco', command: 'uninstall', args: ['x'] }, 1);
  const ok = await until(async () => (await audits('webhook.delivered')).find((x) => x.webhook === 'flaky')); assert.strictEqual(ok.attempts, 3); assert.strictEqual(got.length, 3);
  got.length = 0; behave = () => 503; await admin('/api/webhooks/' + w.id, { method: 'PATCH', body: { name: 'down' } }); await runJob({ kind: 'choco', command: 'uninstall', args: ['x'] }, 1);
  const bad = await until(async () => (await audits('webhook.failed')).find((x) => x.webhook === 'down')); assert.deepStrictEqual([bad.attempts, bad.status], [4, 503]); assert.match(bad.error, /503/);
  await new Promise((r) => setTimeout(r, 150)); assert.strictEqual(got.length, 4); // one try and three retries, then it stops
});
test('a client error is not retried, a redirect is not followed, and a silent receiver times out', async () => {
  await clear(); behave = () => 404; const w = await hook({ name: 'gone', url: rbase + '/gone', events: ['job.failed'] });
  let r = await post(`/api/webhooks/${w.id}/test`, {}); assert.deepStrictEqual(r.data, { ok: false, status: 404, attempts: 1, error: 'The receiver answered 404' });
  await runJob({ kind: 'choco', command: 'uninstall', args: ['x'] }, 1); const a = await until(async () => (await audits('webhook.failed')).find((x) => x.webhook === 'gone' && x.event === 'job.failed')); assert.strictEqual(a.attempts, 1);
  got.length = 0; behave = () => 302; r = await post(`/api/webhooks/${w.id}/test`, {}); assert.strictEqual(r.data.ok, false); assert.strictEqual(r.data.status, 302); assert.match(r.data.error, /redirect/);
  await new Promise((x) => setTimeout(x, 100)); assert.deepStrictEqual(got.map((g) => g.path), ['/gone']); // /redirected was never requested
  got.length = 0; behave = () => 'hang'; const t0 = Date.now(); r = await post(`/api/webhooks/${w.id}/test`, {}); assert.strictEqual(r.data.ok, false); assert.match(r.data.error, /did not answer in time/); assert.ok(Date.now() - t0 < 3000);
});
test('the send test route reports the result and works for a disabled webhook', async () => {
  await clear(); const w = await hook({ name: 'tester', url: rbase + '/test', events: [], enabled: false });
  const r = await post(`/api/webhooks/${w.id}/test`, {}); assert.deepStrictEqual(r.data, { ok: true, status: 200, attempts: 1 });
  assert.strictEqual(got[0].body.event, 'test'); assert.strictEqual(got[0].body.test, true); assert.match(got[0].body.text, /Test message/);
  assert.strictEqual((await post('/api/webhooks/nope/test', {})).status, 404); assert.ok((await audits('webhook.test')).length >= 1);
});
test('a machine that stays offline is reported once per outage', async () => {
  await clear(); await hook({ name: 'offline', url: rbase + '/offline', events: ['machine.offline'], offlineMinutes: 10 });
  h.hub.checkOffline(Date.now() + 9 * 60000); await new Promise((r) => setTimeout(r, 100)); assert.strictEqual(got.length, 0);
  h.hub.checkOffline(Date.now() + 11 * 60000); const d = await until(() => got[0]); assert.strictEqual(d.body.event, 'machine.offline'); assert.strictEqual(d.body.machine.name, 'HOOK-PC'); assert.ok(d.body.machine.offlineMinutes >= 10); assert.match(d.body.text, /HOOK-PC has been offline for 1\d minutes/);
  h.hub.checkOffline(Date.now() + 30 * 60000); await new Promise((r) => setTimeout(r, 100)); assert.strictEqual(got.length, 1);
  // The machine comes back, then goes away again: that is a new outage.
  const p = anon('/agent/poll', { method: 'POST', body: {}, token: machine.token }); await post('/api/jobs', { machineIds: [machine.id], spec: { kind: 'inventory' } }); const job = (await p).data.jobs[0]; await anon(`/agent/jobs/${job.id}/done`, { method: 'POST', body: { code: 0 }, token: machine.token });
  h.hub.checkOffline(Date.now() + 5 * 60000); await new Promise((r) => setTimeout(r, 100)); assert.strictEqual(got.length, 1);
  h.hub.checkOffline(Date.now() + 12 * 60000); await until(() => got.length === 2);
});
test('a sign-in lockout is reported', async () => {
  await clear(); await hook({ name: 'security', url: rbase + '/lockout', events: ['login.lockout'] }); const c = client(h.port);
  for (let i = 0; i < 4; i++) await c('/api/login', { method: 'POST', body: { name: 'admin', password: 'wrong password ' + i } });
  await new Promise((r) => setTimeout(r, 100)); assert.strictEqual(got.length, 0);
  await c('/api/login', { method: 'POST', body: { name: 'admin', password: 'wrong password 5' } });
  const d = await until(() => got[0]); assert.strictEqual(d.body.event, 'login.lockout'); assert.strictEqual(d.body.login.name, 'admin'); assert.strictEqual(d.body.login.seconds, 30); assert.ok(!d.raw.includes('wrong password'));
  assert.strictEqual((await audits('login.lockout')).length, 1);
});
