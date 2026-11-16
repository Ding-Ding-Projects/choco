'use strict';
// Secrets at rest. The machine in these tests is driven by hand over the agent protocol, so
// the assertions see exactly what an agent receives, and hub.json is read from disk each time.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { tmp, startHub, cleanup, client, until, setupAdmin, enrollManual, PASSWORD } = require('./helpers');
const { createHub } = require('../hub/server');
const { Vault, PREFIX } = require('../hub/secrets');
const { Agent } = require('../core/agent');

const SECRET = 'S3cret-source-pass!'; const APIKEY = 'api-key-0123456789abcdef'; const PROXY = 'proxy-pass-zzz';
let h; let admin; let anon; let machine;
const disk = () => { h.hub.store.flush(); return fs.readFileSync(h.file, 'utf8'); };
const noPlain = (text = disk()) => { for (const s of [SECRET, APIKEY, PROXY]) assert.ok(!text.includes(s), 'hub.json contains ' + s); return text; };
const queue = async (spec) => { const r = await admin('/api/jobs', { method: 'POST', body: { machineIds: [machine.id], spec } }); assert.strictEqual(r.status, 200); assert.strictEqual(r.data.jobs.length, 1, JSON.stringify(r.data)); return r.data.jobs[0]; };
const poll = async () => (await until(async () => { const r = await anon('/agent/poll', { method: 'POST', body: {}, token: machine.token }); return r.data.jobs && r.data.jobs[0]; }));
const finish = (id, body = { code: 0 }) => anon(`/agent/jobs/${id}/done`, { method: 'POST', body, token: machine.token });
const stored = (id) => JSON.parse(disk()).jobs.find((j) => j.id === id);
const sourceAdd = { kind: 'choco', command: 'source', subcommand: 'add', options: { name: 'int', source: 'https://x.example/', user: 'svc', password: SECRET }, global: { 'proxy-password': PROXY, confirm: true } };

test.before(async () => { h = await startHub('secrets'); admin = client(h.port); anon = client(h.port); await setupAdmin(admin); machine = await enrollManual(admin, anon, 'SECRET-PC'); });
test.after(cleanup);

test('the key file is created on first run, readable by its owner only', () => {
  const file = path.join(h.dataDir, 'secret.key'); assert.match(fs.readFileSync(file, 'utf8').trim(), /^[0-9a-f]{64}$/);
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  assert.ok(!disk().includes(fs.readFileSync(file, 'utf8').trim()));
});
test('hub.json never holds a secret option value while the job is queued, running or finished, and the agent gets the real value', async () => {
  const job = await queue(sourceAdd); assert.ok(!job.command.includes(SECRET)); assert.match(job.command, /--password=\*{8}/);
  // queued
  let rec = stored(job.id); noPlain(); assert.strictEqual(rec.state, 'queued'); assert.ok(rec.spec.options.password.startsWith(PREFIX)); assert.ok(rec.spec.global['proxy-password'].startsWith(PREFIX)); assert.strictEqual(rec.spec.options.user, 'svc');
  // handed to the agent: plaintext, exactly as sent
  const taken = await poll(); assert.strictEqual(taken.id, job.id); assert.deepStrictEqual(taken.spec, sourceAdd);
  // running
  rec = stored(job.id); noPlain(); assert.strictEqual(rec.state, 'running'); assert.ok(rec.spec.options.password.startsWith(PREFIX));
  // finished: not even the ciphertext is kept
  assert.strictEqual((await finish(job.id)).status, 200); rec = stored(job.id); const text = noPlain();
  assert.strictEqual(rec.state, 'succeeded'); assert.ok(!('password' in rec.spec.options)); assert.ok(!('proxy-password' in rec.spec.global)); assert.strictEqual(rec.spec.options.user, 'svc'); assert.ok(!text.includes(PREFIX));
  for (const route of ['/api/jobs', '/api/jobs/' + job.id, '/api/audit']) assert.ok(!JSON.stringify((await admin(route)).data).includes(SECRET), route);
  assert.ok(!fs.readFileSync(path.join(h.dataDir, 'audit.jsonl'), 'utf8').includes(SECRET));
});
test('the same value encrypts differently each time', async () => {
  const a = await queue(sourceAdd); const b = await queue(sourceAdd); assert.notStrictEqual(stored(a.id).spec.options.password, stored(b.id).spec.options.password);
  for (const j of [a, b]) { const t = await poll(); assert.strictEqual(t.spec.options.password, SECRET); await finish(t.id, { code: 1 }); assert.ok(!('password' in stored(t.id).spec.options)); } // failed jobs are wiped too
});
test('a cancelled queued job loses its secrets', async () => {
  const job = await queue({ kind: 'choco', command: 'apikey', subcommand: 'add', options: { source: 'https://push.example/', 'api-key': APIKEY } });
  assert.ok(stored(job.id).spec.options['api-key'].startsWith(PREFIX)); assert.strictEqual((await admin(`/api/jobs/${job.id}/cancel`, { method: 'POST', body: {} })).status, 200);
  const rec = stored(job.id); assert.strictEqual(rec.state, 'cancelled'); assert.ok(!('api-key' in rec.spec.options)); assert.ok(!noPlain().includes(PREFIX));
});
test('queued secrets survive a hub restart and are still delivered', async () => {
  const dir = path.join(tmp, 'restart'); const first = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); let a = await first.listen(); let c = client(a.port); let open = client(a.port); await setupAdmin(c);
  const m = await enrollManual(c, open, 'RESTART-PC'); await c('/api/jobs', { method: 'POST', body: { machineIds: [m.id], spec: sourceAdd } }); await first.close();
  noPlain(fs.readFileSync(path.join(dir, 'hub.json'), 'utf8'));
  const second = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); a = await second.listen(); open = client(a.port);
  try { const r = await open('/agent/poll', { method: 'POST', body: {}, token: m.token }); assert.deepStrictEqual(r.data.jobs[0].spec, sourceAdd); } finally { await second.close(); }
});
test('a schedule keeps its secrets encrypted, shows a placeholder, and still runs with the real value', async () => {
  const made = await admin('/api/schedules', { method: 'POST', body: { name: 'add source', time: '04:00', spec: sourceAdd, target: { machineIds: [machine.id] } } }); assert.strictEqual(made.status, 200);
  assert.strictEqual(made.data.spec.options.password, '********'); assert.strictEqual(made.data.spec.options.user, 'svc'); noPlain();
  const listed = (await admin('/api/schedules')).data.find((s) => s.id === made.data.id); assert.strictEqual(listed.spec.options.password, '********'); assert.strictEqual(listed.spec.global['proxy-password'], '********');
  // Sending the placeholder back keeps the stored secret; a new value replaces it.
  assert.strictEqual((await admin('/api/schedules/' + made.data.id, { method: 'PATCH', body: { spec: listed.spec } })).status, 200); noPlain();
  const at = new Date(); at.setHours(4, 0, 0, 0); h.hub.tickSchedules(at); let t = await poll(); assert.deepStrictEqual(t.spec, sourceAdd); await finish(t.id); noPlain();
  const changed = { ...sourceAdd, options: { ...sourceAdd.options, password: APIKEY } }; assert.strictEqual((await admin('/api/schedules/' + made.data.id, { method: 'PATCH', body: { spec: changed } })).status, 200); noPlain();
  JSON.parse(disk()).schedules.forEach((s) => assert.ok(s.spec.options.password.startsWith(PREFIX)));
  h.hub.db.schedules.find((s) => s.id === made.data.id).lastRunDay = ''; h.hub.tickSchedules(at); t = await poll(); assert.strictEqual(t.spec.options.password, APIKEY); await finish(t.id);
  assert.strictEqual((await admin('/api/schedules', { method: 'POST', body: { name: 'placeholder', time: '05:00', spec: { ...sourceAdd, options: { ...sourceAdd.options, password: '********' } } } })).status, 400); // nothing stored to keep
  await admin('/api/schedules/' + made.data.id, { method: 'DELETE' });
});
test('there is no authenticator code step: the route is gone and sign-in ignores a totp field', async () => {
  for (const body of [{ action: 'begin' }, { action: 'enable', code: '123456' }, { action: 'disable', password: PASSWORD }]) assert.strictEqual((await admin('/api/account/totp', { method: 'POST', body })).status, 404);
  assert.strictEqual((await admin('/api/account/totp')).status, 404);
  for (const totp of [undefined, '000000', '', 'not a code', 123456, { a: 1 }]) { const c = client(h.port); const r = await c('/api/login', { method: 'POST', body: { name: 'admin', password: PASSWORD, totp } }); assert.strictEqual(r.status, 200, JSON.stringify(totp)); assert.ok(!('totpRequired' in r.data)); assert.strictEqual((await c('/api/status')).data.authenticated, true); }
  const wrong = await client(h.port)('/api/login', { method: 'POST', body: { name: 'admin', password: 'wrong password!', totp: '000000' } }); assert.strictEqual(wrong.status, 401); assert.ok(!('totpRequired' in wrong.data));
  // Kept for older interfaces, always false.
  assert.strictEqual((await admin('/api/account')).data.totpEnabled, false); assert.strictEqual((await admin('/api/users')).data[0].totpEnabled, false);
  assert.ok(!disk().includes('totp'));
});
test('authenticator records from older versions are deleted on start, with one history entry per user', async () => {
  const dir = path.join(tmp, 'legacy-totp'); const first = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); let a = await first.listen(); const c = client(a.port); await setupAdmin(c);
  for (const name of ['olga', 'vera', 'paul']) assert.strictEqual((await c('/api/users', { method: 'POST', body: { name, role: 'operator', password: name + ' long password' } })).status, 200);
  await first.close();
  // What the old code wrote: 0.1 kept the base32 secret as plain text, the version after it
  // kept it encrypted, and a setup that was started but never confirmed has enabled: false.
  const file = path.join(dir, 'hub.json'); const data = JSON.parse(fs.readFileSync(file, 'utf8')); const PLAIN = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'; const PENDING = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const sealed = new Vault(path.join(dir, 'secret.key')).seal('KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU', 'totp'); assert.ok(sealed.startsWith(PREFIX));
  data.users.find((u) => u.name === 'admin').totp = { secret: PLAIN, enabled: true }; data.users.find((u) => u.name === 'olga').totp = { secret: sealed, enabled: true }; data.users.find((u) => u.name === 'vera').totp = { secret: PENDING, enabled: false };
  fs.writeFileSync(file, JSON.stringify(data)); const auditFile = path.join(dir, 'audit.jsonl'); const before = fs.readFileSync(auditFile, 'utf8');
  const second = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); a = await second.listen();
  try {
    // Before any request: the file on disk holds no record and no secret, in either form.
    const text = fs.readFileSync(file, 'utf8'); for (const gone of [PLAIN, PENDING, sealed, 'totp']) assert.ok(!text.includes(gone), gone);
    for (const u of JSON.parse(text).users) assert.ok(!('totp' in u), u.name);
    const added = fs.readFileSync(auditFile, 'utf8').slice(before.length); const rows = added.trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.action === 'account.totp.removed');
    assert.deepStrictEqual(rows.map((r) => [r.user, r.target, r.wasEnabled]), [['hub', 'admin', true], ['hub', 'olga', true], ['hub', 'vera', false]]); // paul had none: no entry
    for (const gone of [PLAIN, PENDING, sealed, 'KRSXG5CT']) assert.ok(!added.includes(gone), gone);
    // Nobody is locked out: the password alone signs in, with or without a code field.
    const c2 = client(a.port); assert.strictEqual((await c2('/api/login', { method: 'POST', body: { name: 'admin', password: PASSWORD } })).status, 200);
    assert.strictEqual((await client(a.port)('/api/login', { method: 'POST', body: { name: 'olga', password: 'olga long password', totp: '000000' } })).status, 200);
    assert.deepStrictEqual((await c2('/api/users')).data.map((u) => u.totpEnabled), [false, false, false, false]); assert.ok((await c2('/api/audit')).data.some((r) => r.action === 'account.totp.removed' && r.target === 'olga'));
  } finally { await second.close(); }
  // A later start has nothing left to remove and writes no further entries.
  const third = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); await third.listen(); await third.close();
  assert.strictEqual(fs.readFileSync(auditFile, 'utf8').split('\n').filter((l) => l.includes('account.totp.removed')).length, 3);
});
test('data written before encryption existed is encrypted on the next start', async () => {
  const dir = path.join(tmp, 'legacy-secrets'); const first = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); let a = await first.listen(); const c = client(a.port); await setupAdmin(c); const m = await enrollManual(c, client(a.port), 'OLD-PC'); await first.close();
  const file = path.join(dir, 'hub.json'); const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.jobs.push({ id: data.nextJob++, machineId: m.id, spec: sourceAdd, display: 'choco source add', state: 'queued', createdAt: new Date().toISOString(), by: 'admin' });
  data.jobs.push({ id: data.nextJob++, machineId: m.id, spec: sourceAdd, display: 'choco source add', state: 'succeeded', createdAt: new Date().toISOString(), endedAt: new Date().toISOString(), by: 'admin' });
  data.jobs.push({ id: data.nextJob++, machineId: m.id, spec: sourceAdd, display: 'choco source add', state: 'running', createdAt: new Date().toISOString(), by: 'admin' });
  data.schedules.push({ id: 'old', name: 'old', time: '01:00', enabled: true, days: [], target: { all: true }, spec: sourceAdd });
  fs.writeFileSync(file, JSON.stringify(data)); assert.ok(fs.readFileSync(file, 'utf8').includes(SECRET));
  const second = createHub({ dataDir: dir, host: '127.0.0.1', port: 0 }); a = await second.listen();
  try {
    const text = fs.readFileSync(file, 'utf8'); noPlain(text); // rewritten during start, before any request
    const open = client(a.port); const r = await open('/agent/poll', { method: 'POST', body: {}, token: m.token }); assert.deepStrictEqual(r.data.jobs[0].spec, sourceAdd);
  } finally { await second.close(); }
});
test('the vault refuses tampered values, the wrong purpose and a damaged key file', () => {
  const dir = path.join(tmp, 'vault'); const v = new Vault(path.join(dir, 'k')); const sealed = v.seal('value', 'spec');
  assert.strictEqual(v.open(sealed, 'spec'), 'value'); assert.strictEqual(v.open('plain legacy value', 'spec'), 'plain legacy value');
  assert.throws(() => v.open(sealed, 'webhook'), /could not be decrypted/);
  const parts = sealed.split('.'); const ct = Buffer.from(parts[2], 'base64url'); ct[0] ^= 1; assert.throws(() => v.open([parts[0], parts[1], ct.toString('base64url')].join('.'), 'spec'), /could not be decrypted/);
  assert.throws(() => v.open(PREFIX + 'garbage', 'spec'), /damaged/);
  assert.strictEqual(new Vault(path.join(dir, 'k')).open(sealed, 'spec'), 'value'); // the same key is loaded again, not replaced
  assert.throws(() => new Vault(path.join(dir, 'other')).open(sealed, 'spec'), /could not be decrypted/);
  fs.writeFileSync(path.join(dir, 'bad'), 'not a key'); assert.throws(() => new Vault(path.join(dir, 'bad')), /damaged/); assert.strictEqual(fs.readFileSync(path.join(dir, 'bad'), 'utf8'), 'not a key');
  const spec = { kind: 'choco', command: 'push', options: { 'api-key': 'k1', source: 'https://x' } }; const s = v.sealSpec(spec);
  assert.strictEqual(spec.options['api-key'], 'k1'); assert.ok(s.options['api-key'].startsWith(PREFIX)); assert.strictEqual(s.options.source, 'https://x'); assert.deepStrictEqual(v.openSpec(s), spec); assert.deepStrictEqual(v.wipeSpec(s), { kind: 'choco', command: 'push', options: { source: 'https://x' } });
  assert.strictEqual(v.sealSpec(s).options['api-key'], s.options['api-key']); // sealing twice changes nothing
});
test('MATERIAL_CHOCO_KEY_FILE style option keeps the key outside the data directory', async () => {
  const keyFile = path.join(tmp, 'elsewhere', 'hub.key'); const x = await startHub('keyfile', { keyFile });
  assert.ok(fs.existsSync(keyFile)); assert.ok(!fs.existsSync(path.join(x.dataDir, 'secret.key')));
});
test('a real agent receives the real value end to end', async () => {
  const p = (await admin('/api/pairing', { method: 'POST', body: {} })).data; const agent = new Agent({ configFile: path.join(tmp, 'agent-secrets', 'agent.json') });
  await agent.enroll({ hubUrl: h.base, code: p.code, name: 'REAL-PC' }); agent.start();
  try {
    // The fixture echoes the arguments of commands it does not model, which shows what the CLI was started with.
    const r = await admin('/api/jobs', { method: 'POST', body: { machineIds: [agent.config.machineId], spec: { kind: 'choco', command: 'apikey', subcommand: 'add', options: { source: 'https://push.example/', 'api-key': APIKEY } } } });
    const id = r.data.jobs[0].id; assert.ok(!r.data.jobs[0].command.includes(APIKEY)); noPlain();
    const done = await until(async () => { const j = (await admin('/api/jobs/' + id)).data; return j.state === 'succeeded' && j; });
    assert.match(done.output, new RegExp('--api-key=' + APIKEY)); noPlain(); assert.ok(!('api-key' in stored(id).spec.options));
  } finally { agent.stop(); }
});
