'use strict';
// Users and roles: admin, operator, viewer. Each boundary is exercised over HTTP against a real hub.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { tmp, startHub, cleanup, client, setupAdmin, enrollManual, PASSWORD } = require('./helpers');
const { createHub } = require('../hub/server');

let h; let admin; let operator; let viewer; let anon; let machine; let spare;
const post = (c, route, body) => c(route, { method: 'POST', body });
const patch = (c, route, body) => c(route, { method: 'PATCH', body });
const del = (c, route) => c(route, { method: 'DELETE' });
const login = async (name, password) => { const c = client(h.port); const r = await post(c, '/api/login', { name, password }); assert.strictEqual(r.status, 200, name); return c; };
const jobs = (c, spec, ids = [machine.id]) => post(c, '/api/jobs', { machineIds: ids, spec });

test.before(async () => {
  h = await startHub('roles'); admin = client(h.port); anon = client(h.port); await setupAdmin(admin);
  machine = await enrollManual(admin, anon, 'ROLE-PC'); spare = await enrollManual(admin, anon, 'SPARE-PC');
});
test.after(cleanup);

test('the first account is an administrator and status and account report the role', async () => {
  const st = (await admin('/api/status')).data; assert.strictEqual(st.role, 'admin'); assert.deepStrictEqual(st.roles, ['viewer', 'operator', 'admin']);
  assert.strictEqual((await admin('/api/account')).data.role, 'admin'); assert.strictEqual((await anon('/api/status')).data.role, null);
  assert.deepStrictEqual((await admin('/api/users')).data.map((u) => [u.name, u.role, u.disabled]), [['admin', 'admin', false]]);
});
test('an administrator creates users with a role and an initial password', async () => {
  const o = await post(admin, '/api/users', { name: 'olga', role: 'operator', password: 'olga long password' }); assert.strictEqual(o.status, 200); assert.deepStrictEqual([o.data.name, o.data.role, o.data.disabled], ['olga', 'operator', false]); assert.ok(!('pass' in o.data));
  assert.strictEqual((await post(admin, '/api/users', { name: 'vera', role: 'viewer', password: 'vera long password' })).status, 200);
  assert.strictEqual((await post(admin, '/api/users', { name: 'OLGA', role: 'viewer', password: 'another long password' })).status, 409); // names are unique whatever the case
  for (const bad of [{ name: 'x', role: 'viewer', password: 'long enough password' }, { name: 'bad name', role: 'viewer', password: 'long enough password' }, { name: 'shorty', role: 'viewer', password: 'short' }, { name: 'rooty', role: 'root', password: 'long enough password' }, { name: 'proto', role: '__proto__', password: 'long enough password' }, { name: 'ctor', role: 'constructor', password: 'long enough password' }, { name: 'numpw', role: 'viewer', password: 1234567890123 }])
    assert.strictEqual((await post(admin, '/api/users', bad)).status, 400, JSON.stringify(bad));
  operator = await login('olga', 'olga long password'); viewer = await login('vera', 'vera long password');
  assert.strictEqual((await operator('/api/status')).data.role, 'operator'); assert.strictEqual((await viewer('/api/account')).data.role, 'viewer');
  const text = fs.readFileSync(h.file, 'utf8'); assert.ok(!text.includes('olga long password')); assert.ok(!text.includes('vera long password'));
});
test('a viewer can read', async () => {
  for (const route of ['/api/machines', '/api/jobs', '/api/schedules', '/api/audit', '/api/schema', '/api/account', '/api/account/passkeys']) assert.strictEqual((await viewer(route)).status, 200, route);
});
test('a viewer cannot change anything', async () => {
  assert.strictEqual((await post(viewer, '/api/pairing', {})).status, 403);
  assert.strictEqual((await patch(viewer, '/api/machines/' + machine.id, { name: 'renamed' })).status, 403);
  assert.strictEqual((await del(viewer, '/api/machines/' + machine.id)).status, 403);
  assert.strictEqual((await post(viewer, '/api/schedules', { name: 'n', time: '03:00', spec: { kind: 'inventory' } })).status, 403);
  assert.strictEqual((await post(viewer, '/api/jobs/1/cancel', {})).status, 403);
  for (const spec of [{ kind: 'choco', command: 'install', args: ['git'] }, { kind: 'choco', command: 'upgrade', args: ['all'] }, { kind: 'choco', command: 'uninstall', args: ['git'] }, { kind: 'choco', command: 'source', subcommand: 'add', options: { name: 'x', source: 'https://x.example/' } }, { kind: 'choco', command: 'config', subcommand: 'set', options: { name: 'a', value: 'b' } },
    { kind: 'choco', command: 'export', options: { 'output-file-path': 'C:\\Windows\\x.config' } }, // not "mutating" for choco, but it writes a file
    { kind: 'choco', command: 'search', args: ['git'], options: { source: 'https://internal.example/' } }, { kind: 'choco', command: 'list', global: { 'log-file': 'C:\\x.log' } }, { kind: 'choco', command: 'install', args: ['git'], global: { 'what-if': true } }, { kind: 'choco', command: 'list', file: { name: 'a.config', content: 'x' } }])
    assert.strictEqual((await jobs(viewer, spec)).status, 403, JSON.stringify(spec));
  assert.strictEqual((await viewer('/api/machines')).data.find((m) => m.id === machine.id).name, 'ROLE-PC');
});
test('a viewer may refresh the inventory and run plain read only queries', async () => {
  for (const spec of [{ kind: 'inventory' }, { kind: 'choco', command: 'list', global: { 'limit-output': true } }, { kind: 'choco', command: 'outdated' }, { kind: 'choco', command: 'find', args: ['git'], options: { exact: true } }, { kind: 'choco', command: 'source', subcommand: 'list' }, { kind: 'choco', command: 'config', subcommand: 'get', options: { name: 'cacheLocation' } }]) {
    const r = await jobs(viewer, spec); assert.strictEqual(r.status, 200, JSON.stringify(spec)); assert.strictEqual(r.data.jobs.length, 1);
  }
});
test('user management and webhooks are for administrators only', async () => {
  for (const c of [viewer, operator]) {
    assert.strictEqual((await c('/api/users')).status, 403);
    assert.strictEqual((await post(c, '/api/users', { name: 'mallory', role: 'admin', password: 'mallory long password' })).status, 403);
    assert.strictEqual((await patch(c, '/api/users/vera', { role: 'admin' })).status, 403);
    assert.strictEqual((await patch(c, '/api/users/admin', { password: 'taken over password' })).status, 403);
    assert.strictEqual((await del(c, '/api/users/admin')).status, 403);
    assert.strictEqual((await c('/api/webhooks')).status, 403);
    assert.strictEqual((await post(c, '/api/webhooks', { name: 'w', url: 'https://example.com/hook' })).status, 403);
  }
  assert.strictEqual((await anon('/api/users')).status, 401); assert.strictEqual((await post(anon, '/api/users', { name: 'mallory', role: 'admin', password: 'mallory long password' })).status, 401);
  assert.strictEqual((await admin('/api/users')).data.length, 3);
});
test('an operator runs commands, pairs machines and edits schedules', async () => {
  assert.strictEqual((await post(operator, '/api/pairing', {})).status, 200);
  const j = await jobs(operator, { kind: 'choco', command: 'upgrade', args: ['git'] }); assert.strictEqual(j.status, 200); assert.strictEqual(j.data.jobs.length, 1); assert.strictEqual(j.data.jobs[0].by, 'olga');
  assert.strictEqual((await post(operator, `/api/jobs/${j.data.jobs[0].id}/cancel`, {})).status, 200);
  const s = await post(operator, '/api/schedules', { name: 'nightly', time: '03:00', spec: { kind: 'inventory' } }); assert.strictEqual(s.status, 200);
  assert.strictEqual((await patch(operator, '/api/schedules/' + s.data.id, { enabled: false })).status, 200); assert.strictEqual((await del(operator, '/api/schedules/' + s.data.id)).status, 200);
  const m = await patch(operator, '/api/machines/' + machine.id, { name: 'ROLE-PC-2', groups: ['Lab'] }); assert.strictEqual(m.status, 200); assert.strictEqual(m.data.name, 'ROLE-PC-2');
});
test('an operator cannot remove machines or change machine policy', async () => {
  assert.strictEqual((await del(operator, '/api/machines/' + spare.id)).status, 403);
  assert.strictEqual((await patch(operator, '/api/machines/' + machine.id, { readOnly: true })).status, 403);
  assert.strictEqual((await patch(operator, '/api/machines/' + machine.id, { allowedCommands: ['list'] })).status, 403);
  const m = (await admin('/api/machines')).data.find((x) => x.id === machine.id); assert.strictEqual(m.readOnly, false); assert.strictEqual(m.allowedCommands, null);
  assert.strictEqual((await patch(admin, '/api/machines/' + machine.id, { readOnly: true })).status, 200);
  assert.strictEqual((await patch(operator, '/api/machines/' + machine.id, { readOnly: false })).status, 403); // nor loosen what the administrator set
  assert.strictEqual((await patch(operator, '/api/machines/' + machine.id, { readOnly: true, name: 'ROLE-PC' })).status, 200); // unchanged policy is not a policy change
  assert.strictEqual((await patch(admin, '/api/machines/' + machine.id, { readOnly: false })).status, 200);
  assert.strictEqual((await del(admin, '/api/machines/' + spare.id)).status, 200);
});
test('the last administrator cannot be removed, demoted or disabled', async () => {
  assert.strictEqual((await del(admin, '/api/users/admin')).status, 409);
  assert.strictEqual((await patch(admin, '/api/users/admin', { role: 'operator' })).status, 409);
  assert.strictEqual((await patch(admin, '/api/users/admin', { disabled: true })).status, 409);
  assert.strictEqual((await admin('/api/status')).data.role, 'admin');
  // A disabled second administrator does not count as one that is left.
  assert.strictEqual((await post(admin, '/api/users', { name: 'anna', role: 'admin', password: 'anna long password' })).status, 200);
  assert.strictEqual((await patch(admin, '/api/users/anna', { disabled: true })).status, 200);
  assert.strictEqual((await del(admin, '/api/users/admin')).status, 409); assert.strictEqual((await patch(admin, '/api/users/admin', { role: 'viewer' })).status, 409);
  // With a second working administrator the first one can be demoted, and promoted back by the other.
  assert.strictEqual((await patch(admin, '/api/users/anna', { disabled: false })).status, 200); const anna = await login('anna', 'anna long password');
  assert.strictEqual((await patch(admin, '/api/users/admin', { role: 'operator' })).status, 200); assert.strictEqual((await admin('/api/users')).status, 403);
  assert.strictEqual((await del(anna, '/api/users/anna')).status, 409); // anna is now the last one
  assert.strictEqual((await patch(anna, '/api/users/admin', { role: 'admin' })).status, 200); assert.strictEqual((await del(admin, '/api/users/anna')).status, 200);
  assert.strictEqual((await anna('/api/machines')).status, 401); // a deleted account's session ends at once
});
test('a role change, a disabled account and a reset password take effect on live sessions', async () => {
  assert.strictEqual((await post(viewer, '/api/pairing', {})).status, 403);
  assert.strictEqual((await patch(admin, '/api/users/vera', { role: 'operator' })).status, 200); assert.strictEqual((await post(viewer, '/api/pairing', {})).status, 200); assert.strictEqual((await viewer('/api/status')).data.role, 'operator');
  assert.strictEqual((await patch(admin, '/api/users/vera', { role: 'viewer' })).status, 200); assert.strictEqual((await post(viewer, '/api/pairing', {})).status, 403);
  assert.strictEqual((await patch(admin, '/api/users/vera', { disabled: true })).status, 200); assert.strictEqual((await viewer('/api/machines')).status, 401);
  const refused = await post(client(h.port), '/api/login', { name: 'vera', password: 'vera long password' }); assert.strictEqual(refused.status, 403);
  assert.strictEqual((await post(client(h.port), '/api/login', { name: 'vera', password: 'wrong password!' })).status, 401); // a wrong password never reveals the disabled state
  assert.strictEqual((await patch(admin, '/api/users/vera', { disabled: false, password: 'vera second password' })).status, 200);
  assert.strictEqual((await post(client(h.port), '/api/login', { name: 'vera', password: 'vera long password' })).status, 401);
  viewer = await login('vera', 'vera second password'); assert.strictEqual((await viewer('/api/status')).data.role, 'viewer');
  assert.strictEqual((await patch(admin, '/api/users/olga', { password: 'olga second password' })).status, 200); assert.strictEqual((await operator('/api/machines')).status, 401);
  for (const bad of [{ role: 'root' }, { disabled: 'yes' }, { password: 'short' }]) assert.strictEqual((await patch(admin, '/api/users/vera', bad)).status, 400);
  assert.strictEqual((await patch(admin, '/api/users/nobody', { role: 'viewer' })).status, 404); assert.strictEqual((await del(admin, '/api/users/%E0%A4%A')).status, 400);
});
test('changing your own password signs your other sessions out', async () => {
  const one = await login('vera', 'vera second password'); const two = await login('vera', 'vera second password');
  assert.strictEqual((await post(one, '/api/account/password', { current: 'vera second password', next: 'vera third password' })).status, 200);
  assert.strictEqual((await one('/api/account')).status, 200); assert.strictEqual((await two('/api/account')).status, 401); viewer = one;
});
test('every user-management action is in the audit log, without passwords', async () => {
  const rows = (await admin('/api/audit?limit=5000')).data; const has = (action, target) => rows.some((r) => r.action === action && r.target === target && r.user);
  assert.ok(has('user.create', 'olga')); assert.ok(has('user.role', 'vera')); assert.ok(has('user.disable', 'vera')); assert.ok(has('user.enable', 'vera')); assert.ok(has('user.password', 'vera')); assert.ok(has('user.delete', 'anna'));
  assert.ok(rows.some((r) => r.action === 'user.role' && r.target === 'admin' && r.from === 'admin' && r.to === 'operator' && r.user === 'admin')); assert.ok(rows.some((r) => r.action === 'login.refused'));
  const text = fs.readFileSync(path.join(h.dataDir, 'audit.jsonl'), 'utf8'); for (const secret of ['long password', 'second password', 'third password', PASSWORD]) assert.ok(!text.includes(secret), secret);
});
test('deleting a user removes the account', async () => {
  assert.strictEqual((await del(admin, '/api/users/olga')).status, 200); assert.strictEqual((await post(client(h.port), '/api/login', { name: 'olga', password: 'olga second password' })).status, 401);
  assert.deepStrictEqual((await admin('/api/users')).data.map((u) => u.name), ['admin', 'vera']);
});
test('an account stored before roles existed is the administrator', async () => {
  const dir = path.join(tmp, 'legacy-roles'); const first = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); const a = await first.listen(); await setupAdmin(client(a.port)); await first.close();
  const file = path.join(dir, 'hub.json'); const data = JSON.parse(fs.readFileSync(file, 'utf8')); delete data.users[0].role; fs.writeFileSync(file, JSON.stringify(data));
  const x = await startHub('legacy-roles'); const c = client(x.port); assert.strictEqual((await post(c, '/api/login', { name: 'admin', password: PASSWORD })).status, 200); assert.strictEqual((await c('/api/status')).data.role, 'admin'); assert.strictEqual((await c('/api/users')).status, 200);
});
