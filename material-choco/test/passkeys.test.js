'use strict';
// Passkeys: every test builds genuine WebAuthn bytes (clientDataJSON, authenticatorData,
// attestationObject) and signs with a real key pair made by node:crypto, the way an
// authenticator would. Nothing in the hub is stubbed.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { startHub, cleanup, client, setupAdmin, PASSWORD } = require('./helpers');
const webauthn = require('../hub/webauthn');
const auth = require('../hub/auth');

const sha256 = (b) => crypto.createHash('sha256').update(b).digest();
const b64u = (b) => Buffer.from(b).toString('base64url');
// Minimal CBOR encoder for the test authenticator.
function cbor(v) {
  const head = (major, n) => (n < 24 ? Buffer.from([(major << 5) | n]) : n < 256 ? Buffer.from([(major << 5) | 24, n]) : Buffer.from([(major << 5) | 25, n >> 8, n & 255]));
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  if (typeof v === 'string') return Buffer.concat([head(3, Buffer.byteLength(v)), Buffer.from(v)]);
  if (v instanceof Map) return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  throw new Error('unsupported');
}
// A software authenticator. flags: UP 0x01, UV 0x04, AT 0x40.
class Authenticator {
  constructor(alg = 'ES256') {
    this.alg = alg; this.counter = 0; this.credId = crypto.randomBytes(24);
    const pair = alg === 'ES256' ? crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }) : crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = pair.privateKey; const jwk = pair.publicKey.export({ format: 'jwk' });
    this.cose = alg === 'ES256' ? new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]) : new Map([[1, 3], [3, -257], [-1, Buffer.from(jwk.n, 'base64url')], [-2, Buffer.from(jwk.e, 'base64url')]]);
  }
  authData(rpId, flags, withKey) {
    const count = Buffer.alloc(4); count.writeUInt32BE(this.counter);
    const parts = [sha256(Buffer.from(rpId)), Buffer.from([flags]), count];
    if (withKey) { const len = Buffer.alloc(2); len.writeUInt16BE(this.credId.length); parts.push(Buffer.alloc(16), len, this.credId, cbor(this.cose)); }
    return Buffer.concat(parts);
  }
  create(options, { origin, rpId = options.rp.id, flags = 0x45, type = 'webauthn.create' } = {}) {
    const clientDataJSON = Buffer.from(JSON.stringify({ type, challenge: options.challenge, origin, crossOrigin: false }));
    const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', this.authData(rpId, flags, true)]]));
    return { id: b64u(this.credId), rawId: b64u(this.credId), type: 'public-key', response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ['internal'] } };
  }
  get(options, { origin, rpId = options.rpId, flags = 0x05, bump = 1, type = 'webauthn.get', tamper = null } = {}) {
    this.counter += bump;
    const clientDataJSON = Buffer.from(JSON.stringify({ type, challenge: options.challenge, origin, crossOrigin: false }));
    const authenticatorData = this.authData(rpId, flags, false);
    let signature = crypto.sign('sha256', Buffer.concat([authenticatorData, sha256(clientDataJSON)]), this.privateKey);
    if (tamper === 'signature') { signature = Buffer.from(signature); signature[signature.length - 3] ^= 0xff; }
    return { id: b64u(this.credId), rawId: b64u(this.credId), type: 'public-key', response: { clientDataJSON: b64u(clientDataJSON), authenticatorData: b64u(authenticatorData), signature: b64u(signature) } };
  }
}

let h; let admin; let anon; let origin; let key; const HOST = () => `localhost:${h.port}`;
const regOptions = async (c = admin) => (await c('/api/account/passkeys/begin', { method: 'POST', body: { password: PASSWORD } })).data.publicKey;
const loginOptions = async (body = {}) => (await anon('/api/login/passkey/begin', { method: 'POST', body })).data.publicKey;
const finishLogin = (cred) => anon('/api/login/passkey/finish', { method: 'POST', body: cred });
// Five failures in a row lock passkey sign-in for this address, so tests that fail on purpose
// start from a clean count: a good sign-in resets it.
const reset = async () => { const r = await finishLogin(key.get(await loginOptions(), { origin })); assert.strictEqual(r.status, 200); await anon('/api/logout', { method: 'POST' }); };
const auditHas = async (action) => (await admin('/api/audit')).data.some((a) => a.action === action);

test.before(async () => {
  h = await startHub('passkeys', { passkeyBudget: 100000 }); origin = `http://localhost:${h.port}`;
  admin = client(h.port, { host: HOST() }); anon = client(h.port, { host: HOST() }); await setupAdmin(admin);
});
test.after(cleanup);

test('status says where passkeys can work', async () => {
  assert.strictEqual((await anon('/api/status')).data.passkeysAvailable, true); // localhost
  const byIp = client(h.port); assert.strictEqual((await byIp('/api/status')).data.passkeysAvailable, false); // an IP address is never a valid relying party id
  assert.strictEqual((await byIp('/api/login/passkey/begin', { method: 'POST', body: {} })).status, 409);
});
test('registering a passkey needs a session and the current password', async () => {
  assert.strictEqual((await anon('/api/account/passkeys/begin', { method: 'POST', body: { password: PASSWORD } })).status, 401);
  assert.strictEqual((await admin('/api/account/passkeys/begin', { method: 'POST', body: { password: 'not the password' } })).status, 401);
  assert.strictEqual((await anon('/api/account/passkeys')).status, 401);
});
test('register an ES256 passkey and list it', async () => {
  const options = await regOptions(); assert.strictEqual(options.rp.id, 'localhost'); assert.strictEqual(options.attestation, 'none'); assert.deepStrictEqual(options.pubKeyCredParams.map((x) => x.alg), [-7, -257]);
  assert.ok(options.challenge.length >= 43); assert.notStrictEqual(options.user.id, 'admin');
  key = new Authenticator('ES256');
  const r = await admin('/api/account/passkeys/finish', { method: 'POST', body: { ...key.create(options, { origin }), name: 'Laptop' } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.data.passkey.name, 'Laptop'); assert.strictEqual(r.data.passkey.alg, 'ES256');
  const list = (await admin('/api/account/passkeys')).data; assert.strictEqual(list.length, 1); assert.strictEqual(list[0].id, b64u(key.credId)); assert.ok(!('jwk' in list[0]));
  assert.strictEqual((await admin('/api/account')).data.passkeys, 1); assert.ok(await auditHas('account.passkey.add'));
  const stored = JSON.parse(fs.readFileSync(h.file, 'utf8')).users[0].passkeys[0]; assert.strictEqual(stored.jwk.kty, 'EC'); assert.ok(!('d' in stored.jwk)); assert.strictEqual(stored.counter, 0);
  assert.strictEqual((await regOptions()).excludeCredentials[0].id, b64u(key.credId));
});
test('a registration challenge works once, and the same credential cannot be added twice', async () => {
  const options = await regOptions(); const other = new Authenticator(); const body = other.create(options, { origin });
  assert.strictEqual((await admin('/api/account/passkeys/finish', { method: 'POST', body })).status, 200);
  const replay = await admin('/api/account/passkeys/finish', { method: 'POST', body }); assert.strictEqual(replay.status, 400); assert.match(replay.data.error, /expired or was already used/);
  const again = await admin('/api/account/passkeys/finish', { method: 'POST', body: other.create(await regOptions(), { origin }) }); assert.strictEqual(again.status, 409);
  assert.strictEqual((await admin('/api/account/passkeys/' + b64u(other.credId), { method: 'DELETE' })).status, 200);
  assert.strictEqual((await admin('/api/account/passkeys/' + b64u(other.credId), { method: 'DELETE' })).status, 404);
});
test('registration is refused for a wrong origin, site, operation type or missing user presence', async () => {
  const bad = async (how, expected) => { const a = new Authenticator(); const r = await admin('/api/account/passkeys/finish', { method: 'POST', body: a.create(await regOptions(), { origin, ...how }) }); assert.strictEqual(r.status, 400, JSON.stringify(how)); assert.match(r.data.error, expected); };
  await bad({ origin: 'https://evil.example' }, /different origin/);
  await bad({ origin: origin + '.evil.example' }, /different origin/);
  await bad({ rpId: 'evil.example' }, /different site/);
  await bad({ type: 'webauthn.get' }, /different WebAuthn operation/);
  await bad({ flags: 0x44 }, /person was present/);
  await bad({ flags: 0x05 }, /no credential/);
  assert.strictEqual((await admin('/api/account/passkeys')).data.length, 1);
});
test('sign in with a passkey, without typing a name', async () => {
  const options = await loginOptions(); assert.strictEqual(options.rpId, 'localhost'); assert.deepStrictEqual(options.allowCredentials, []);
  const r = await finishLogin(key.get(options, { origin })); assert.strictEqual(r.status, 200);
  const st = (await anon('/api/status')).data; assert.strictEqual(st.authenticated, true); assert.strictEqual(st.user, 'admin'); assert.strictEqual(st.role, 'admin');
  assert.strictEqual((await anon('/api/machines')).status, 200);
  assert.strictEqual(JSON.parse(fs.readFileSync(h.file, 'utf8')).users[0].passkeys[0].counter, 1);
  assert.ok((await admin('/api/audit')).data.some((a) => a.action === 'login.ok' && a.method === 'passkey'));
  await anon('/api/logout', { method: 'POST' }); assert.strictEqual((await anon('/api/machines')).status, 401);
});
test('sign-in options for a name list its credentials and do not reveal unknown names', async () => {
  assert.strictEqual((await loginOptions({ name: 'ADMIN' })).allowCredentials[0].id, b64u(key.credId));
  const a = (await loginOptions({ name: 'nobody' })).allowCredentials; const b = (await loginOptions({ name: 'nobody' })).allowCredentials; const c = (await loginOptions({ name: 'somebody' })).allowCredentials;
  assert.strictEqual(a.length, 1); assert.strictEqual(a[0].id, b[0].id); assert.notStrictEqual(a[0].id, c[0].id);
});
test('a replayed assertion is refused: each challenge works once', async () => {
  const cred = key.get(await loginOptions(), { origin });
  assert.strictEqual((await finishLogin(cred)).status, 200); await anon('/api/logout', { method: 'POST' });
  const replay = await finishLogin(cred); assert.strictEqual(replay.status, 401); assert.strictEqual((await anon('/api/status')).data.authenticated, false);
});
test('an assertion for a wrong origin or site is refused', async () => {
  await reset();
  assert.strictEqual((await finishLogin(key.get(await loginOptions(), { origin: 'https://evil.example' }))).status, 401);
  assert.strictEqual((await finishLogin(key.get(await loginOptions(), { origin, rpId: 'evil.example' }))).status, 401);
  assert.strictEqual((await finishLogin(key.get(await loginOptions(), { origin, type: 'webauthn.create' }))).status, 401);
  assert.strictEqual((await finishLogin(key.get(await loginOptions(), { origin, flags: 0x04 }))).status, 401); // user not present
  assert.strictEqual((await anon('/api/status')).data.authenticated, false);
});
test('a bad signature is refused', async () => {
  await reset();
  assert.strictEqual((await finishLogin(key.get(await loginOptions(), { origin, tamper: 'signature' }))).status, 401);
  // A valid signature from a different key under the registered credential id.
  const thief = new Authenticator(); thief.credId = key.credId; thief.counter = key.counter + 10;
  assert.strictEqual((await finishLogin(thief.get(await loginOptions(), { origin }))).status, 401);
  // Signed data changed after signing: the counter bytes inside authenticatorData.
  const cred = key.get(await loginOptions(), { origin }); const ad = Buffer.from(cred.response.authenticatorData, 'base64url'); ad.writeUInt32BE(ad.readUInt32BE(33) + 1, 33); cred.response.authenticatorData = b64u(ad);
  assert.strictEqual((await finishLogin(cred)).status, 401);
  assert.strictEqual((await anon('/api/status')).data.authenticated, false);
  assert.ok((await admin('/api/audit')).data.some((a) => a.action === 'login.failed' && a.method === 'passkey' && /Signature/.test(a.reason)));
});
test('a sign counter that does not move forward is refused and recorded', async () => {
  await reset(); const before = key.counter;
  const same = await finishLogin(key.get(await loginOptions(), { origin, bump: 0 })); assert.strictEqual(same.status, 401);
  key.counter = before - 1; const lower = await finishLogin(key.get(await loginOptions(), { origin, bump: 0 })); assert.strictEqual(lower.status, 401);
  assert.ok(await auditHas('account.passkey.counter'));
  assert.strictEqual(JSON.parse(fs.readFileSync(h.file, 'utf8')).users[0].passkeys[0].counter, before); // the stored counter did not move
  key.counter = before; await reset();
});
test('an unknown credential and malformed input are refused', async () => {
  await reset(); const stranger = new Authenticator();
  assert.strictEqual((await finishLogin(stranger.get(await loginOptions(), { origin }))).status, 401);
  assert.strictEqual((await finishLogin({ id: b64u(key.credId), response: { clientDataJSON: '!!', authenticatorData: 'AA', signature: 'AA' } })).status, 401);
  assert.strictEqual((await finishLogin({})).status, 401);
  await reset();
  const cred = key.get(await loginOptions(), { origin }); cred.response.authenticatorData = b64u(Buffer.alloc(10)); assert.strictEqual((await finishLogin(cred)).status, 401);
  await reset();
});
test('a challenge expires after five minutes', async (t) => {
  await reset(); const options = await loginOptions(); const cred = key.get(options, { origin });
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 5 * 60 * 1000 + 1000 });
  const r = await finishLogin(cred); t.mock.timers.reset();
  assert.strictEqual(r.status, 401); await reset();
});
test('RS256 passkeys register and sign in', async () => {
  const rsa = new Authenticator('RS256');
  const r = await admin('/api/account/passkeys/finish', { method: 'POST', body: { ...rsa.create(await regOptions(), { origin }), name: 'RSA key' } }); assert.strictEqual(r.status, 200); assert.strictEqual(r.data.passkey.alg, 'RS256');
  assert.strictEqual((await finishLogin(rsa.get(await loginOptions(), { origin }))).status, 200); assert.strictEqual((await anon('/api/status')).data.user, 'admin'); await anon('/api/logout', { method: 'POST' });
  assert.strictEqual((await finishLogin(rsa.get(await loginOptions(), { origin, tamper: 'signature' }))).status, 401);
  assert.strictEqual((await admin('/api/account/passkeys/' + b64u(rsa.credId), { method: 'DELETE' })).status, 200);
  assert.strictEqual((await finishLogin(rsa.get(await loginOptions(), { origin }))).status, 401); // a removed passkey no longer signs in
  await reset();
});
test('an account with an authenticator code needs a passkey that verifies the user', async () => {
  const begin = (await admin('/api/account/totp', { method: 'POST', body: { action: 'begin' } })).data;
  assert.strictEqual((await admin('/api/account/totp', { method: 'POST', body: { action: 'enable', code: auth.totp(begin.secret) } })).status, 200);
  const noUv = await finishLogin(key.get(await loginOptions(), { origin, flags: 0x01 })); assert.strictEqual(noUv.status, 401); assert.match(noUv.data.error, /PIN or biometrics/);
  assert.strictEqual((await finishLogin(key.get(await loginOptions(), { origin, flags: 0x05 }))).status, 200); await anon('/api/logout', { method: 'POST' });
  assert.strictEqual((await admin('/api/account/totp', { method: 'POST', body: { action: 'disable', password: PASSWORD } })).status, 200);
  assert.strictEqual((await finishLogin(key.get(await loginOptions(), { origin, flags: 0x01 }))).status, 200); await anon('/api/logout', { method: 'POST' });
});
test('password sign-in still works next to passkeys', async () => {
  const c = client(h.port, { host: HOST() }); assert.strictEqual((await c('/api/login', { method: 'POST', body: { name: 'admin', password: PASSWORD } })).status, 200); assert.strictEqual((await c('/api/status')).data.authenticated, true);
});
test('a disabled account cannot sign in with its passkey', async () => {
  assert.strictEqual((await admin('/api/users', { method: 'POST', body: { name: 'olga', role: 'operator', password: 'olga long password' } })).status, 200);
  const olga = client(h.port, { host: HOST() }); await olga('/api/login', { method: 'POST', body: { name: 'olga', password: 'olga long password' } });
  const k2 = new Authenticator(); const options = (await olga('/api/account/passkeys/begin', { method: 'POST', body: { password: 'olga long password' } })).data.publicKey;
  assert.strictEqual((await olga('/api/account/passkeys/finish', { method: 'POST', body: k2.create(options, { origin }) })).status, 200);
  assert.strictEqual((await finishLogin(k2.get(await loginOptions(), { origin }))).status, 200); assert.strictEqual((await anon('/api/status')).data.role, 'operator'); await anon('/api/logout', { method: 'POST' });
  // One user's registration challenge cannot be finished by another user.
  const stolen = (await olga('/api/account/passkeys/begin', { method: 'POST', body: { password: 'olga long password' } })).data.publicKey;
  assert.strictEqual((await admin('/api/account/passkeys/finish', { method: 'POST', body: new Authenticator().create(stolen, { origin }) })).status, 400);
  assert.strictEqual((await admin('/api/users/olga', { method: 'PATCH', body: { disabled: true } })).status, 200);
  assert.strictEqual((await finishLogin(k2.get(await loginOptions(), { origin }))).status, 403); assert.strictEqual((await anon('/api/status')).data.authenticated, false);
});
test('repeated passkey failures lock sign-in out for a while', async () => {
  const x = await startHub('passkeys-lock'); const a = client(x.port, { host: `localhost:${x.port}` }); const o = `http://localhost:${x.port}`; const stranger = new Authenticator();
  for (let i = 0; i < 5; i++) { const options = (await a('/api/login/passkey/begin', { method: 'POST', body: {} })).data.publicKey; assert.strictEqual((await a('/api/login/passkey/finish', { method: 'POST', body: stranger.get(options, { origin: o }) })).status, 401); }
  assert.strictEqual((await a('/api/login/passkey/begin', { method: 'POST', body: {} })).status, 429);
  assert.strictEqual((await a('/api/login/passkey/finish', { method: 'POST', body: {} })).status, 429);
});
test('the open passkey routes have a request budget', async () => {
  const x = await startHub('passkeys-budget'); const a = client(x.port, { host: `localhost:${x.port}` }); let last = 200;
  for (let i = 0; i < 61; i++) last = (await a('/api/login/passkey/begin', { method: 'POST', body: {} })).status;
  assert.strictEqual(last, 429);
});
test('MATERIAL_CHOCO_ORIGIN fixes the relying party when the Host header cannot be used', async () => {
  const x = await startHub('passkeys-origin', { origin: 'https://hub.example:8443/' }); const a = client(x.port); const b = client(x.port); await setupAdmin(a);
  assert.strictEqual((await b('/api/status')).data.passkeysAvailable, true);
  const options = (await a('/api/account/passkeys/begin', { method: 'POST', body: { password: PASSWORD } })).data.publicKey; assert.strictEqual(options.rp.id, 'hub.example');
  const k = new Authenticator();
  assert.strictEqual((await a('/api/account/passkeys/finish', { method: 'POST', body: k.create(options, { origin: `http://127.0.0.1:${x.port}` }) })).status, 400); // what the Host header would have given
  assert.strictEqual((await a('/api/account/passkeys/finish', { method: 'POST', body: k.create((await a('/api/account/passkeys/begin', { method: 'POST', body: { password: PASSWORD } })).data.publicKey, { origin: 'https://hub.example:8443' }) })).status, 200);
  const lo = (await b('/api/login/passkey/begin', { method: 'POST', body: {} })).data.publicKey; assert.strictEqual(lo.rpId, 'hub.example');
  assert.strictEqual((await b('/api/login/passkey/finish', { method: 'POST', body: k.get(lo, { origin: 'https://hub.example:8443' }) })).status, 200);
});
test('the CBOR and COSE readers reject what they do not support', () => {
  const dec = (hex) => webauthn.cborDecode(Buffer.from(hex, 'hex'));
  assert.deepStrictEqual(dec('a201020326').value, new Map([[1, 2], [3, -7]])); assert.strictEqual(dec('1903e8').value, 1000); assert.strictEqual(dec('63616263').value, 'abc');
  for (const bad of ['', '5f', '9f', 'bf', 'fb3ff0000000000000', 'a2010201', 'a201020103', '59ffff00', '1bffffffffffffffff', '8181818181818181818100'])
    assert.throws(() => dec(bad), webauthn.WebAuthnError, bad);
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' }); const x = Buffer.from(ec.x, 'base64url'); const y = Buffer.from(ec.y, 'base64url');
  assert.strictEqual(webauthn.coseToJwk(new Map([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, y]])).alg, 'ES256');
  assert.throws(() => webauthn.coseToJwk(new Map([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, Buffer.alloc(32, 1)]])), /not valid/); // not a point on the curve
  assert.throws(() => webauthn.coseToJwk(new Map([[1, 2], [3, -7], [-1, 2], [-2, x], [-3, y]])), /P-256/);
  assert.throws(() => webauthn.coseToJwk(new Map([[1, 2], [3, -8], [-1, 6], [-2, x]])), /Unsupported/);
  const weak = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey.export({ format: 'jwk' });
  assert.throws(() => webauthn.coseToJwk(new Map([[1, 3], [3, -257], [-1, Buffer.from(weak.n, 'base64url')], [-2, Buffer.from(weak.e, 'base64url')]])), /2048/);
  assert.throws(() => webauthn.coseToJwk({ 1: 2 }), /COSE/);
});
