'use strict';
// WebAuthn (passkeys) relying-party checks with Node built-ins only.
// Scope: attestation conveyance "none" (the attestation statement is ignored whatever its
// format, so no claim about the authenticator model is ever trusted), ES256 and RS256 keys.
const crypto = require('node:crypto');

class WebAuthnError extends Error { constructor(m) { super(m); this.name = 'WebAuthnError'; this.status = 400; } }
const fail = (m) => { throw new WebAuthnError(m); };

const b64u = (buf) => Buffer.from(buf).toString('base64url');
function fromB64u(value, label = 'value', max = 16384) {
  if (typeof value !== 'string' || !value.length || value.length > max || !/^[A-Za-z0-9_-]+$/.test(value)) fail(`${label} is not valid base64url`);
  return Buffer.from(value, 'base64url');
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest();
const equal = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

// ---- minimal CBOR (RFC 8949) -----------------------------------------------------------
// Definite lengths only; unsigned and negative integers, byte and text strings, arrays,
// maps (returned as Map, so keys can never touch an object prototype), false, true, null.
// Returns { value, offset } where offset is the first byte after the item.
function cborDecode(buf, offset = 0, depth = 0) {
  if (depth > 8) fail('CBOR is nested too deeply');
  if (offset >= buf.length) fail('CBOR ends early');
  const first = buf[offset++]; const major = first >> 5; const info = first & 31;
  let n;
  if (info < 24) n = info;
  else if (info === 24) { if (offset + 1 > buf.length) fail('CBOR ends early'); n = buf[offset]; offset += 1; }
  else if (info === 25) { if (offset + 2 > buf.length) fail('CBOR ends early'); n = buf.readUInt16BE(offset); offset += 2; }
  else if (info === 26) { if (offset + 4 > buf.length) fail('CBOR ends early'); n = buf.readUInt32BE(offset); offset += 4; }
  else if (info === 27) { if (offset + 8 > buf.length) fail('CBOR ends early'); const big = buf.readBigUInt64BE(offset); if (big > BigInt(Number.MAX_SAFE_INTEGER)) fail('CBOR integer is too large'); n = Number(big); offset += 8; }
  else fail('Unsupported CBOR encoding');
  switch (major) {
    case 0: return { value: n, offset };
    case 1: return { value: -1 - n, offset };
    case 2: case 3: {
      if (n > buf.length - offset) fail('CBOR ends early');
      const bytes = buf.subarray(offset, offset + n);
      return { value: major === 2 ? Buffer.from(bytes) : bytes.toString('utf8'), offset: offset + n };
    }
    case 4: {
      if (n > 64) fail('CBOR array is too long');
      const arr = []; for (let i = 0; i < n; i++) { const r = cborDecode(buf, offset, depth + 1); arr.push(r.value); offset = r.offset; }
      return { value: arr, offset };
    }
    case 5: {
      if (n > 64) fail('CBOR map is too long');
      const map = new Map();
      for (let i = 0; i < n; i++) {
        const k = cborDecode(buf, offset, depth + 1); if (typeof k.value !== 'number' && typeof k.value !== 'string') fail('Unsupported CBOR map key');
        if (map.has(k.value)) fail('Duplicate CBOR map key');
        const v = cborDecode(buf, k.offset, depth + 1); map.set(k.value, v.value); offset = v.offset;
      }
      return { value: map, offset };
    }
    case 7: if (first === 0xf4) return { value: false, offset }; if (first === 0xf5) return { value: true, offset }; if (first === 0xf6) return { value: null, offset }; return fail('Unsupported CBOR value');
    default: return fail('Unsupported CBOR type');
  }
}

// ---- COSE public key to JWK -----------------------------------------------------------------
const ALGS = { '-7': 'ES256', '-257': 'RS256' };
function coseToJwk(cose) {
  if (!(cose instanceof Map)) fail('Credential public key is not a COSE key');
  const kty = cose.get(1); const alg = cose.get(3); const bytes = (k, label) => { const v = cose.get(k); if (!Buffer.isBuffer(v)) fail(`Credential public key has no ${label}`); return v; };
  let jwk;
  if (kty === 2 && alg === -7) {
    if (cose.get(-1) !== 1) fail('Only the P-256 curve is supported for ES256');
    const x = bytes(-2, 'x'); const y = bytes(-3, 'y'); if (x.length !== 32 || y.length !== 32) fail('Credential public key has the wrong size');
    jwk = { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) };
  } else if (kty === 3 && alg === -257) {
    let n = bytes(-1, 'modulus'); const e = bytes(-2, 'exponent'); while (n.length > 1 && n[0] === 0) n = n.subarray(1);
    if (n.length < 256 || n.length > 1024) fail('RSA keys must be between 2048 and 8192 bits'); if (!e.length || e.length > 8) fail('Credential public key has a bad exponent');
    jwk = { kty: 'RSA', n: b64u(n), e: b64u(e) };
  } else fail('Unsupported credential algorithm. Use ES256 or RS256.');
  try { crypto.createPublicKey({ key: jwk, format: 'jwk' }); } catch { fail('Credential public key is not valid'); } // also rejects points that are not on the curve
  return { jwk, alg: ALGS[String(alg)] };
}

// ---- authenticator data ------------------------------------------------------------------------
const FLAG = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40, ED: 0x80 };
function parseAuthData(buf, { withCredential = false } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 37) fail('Authenticator data is too short');
  const out = { rpIdHash: buf.subarray(0, 32), flags: buf[32], counter: buf.readUInt32BE(33) };
  out.userPresent = !!(out.flags & FLAG.UP); out.userVerified = !!(out.flags & FLAG.UV); out.backupEligible = !!(out.flags & FLAG.BE); out.backedUp = !!(out.flags & FLAG.BS);
  let offset = 37;
  if (out.flags & FLAG.AT) {
    if (buf.length < offset + 18) fail('Authenticator data is too short');
    out.aaguid = buf.subarray(offset, offset + 16); offset += 16; const len = buf.readUInt16BE(offset); offset += 2;
    if (len < 1 || len > 1023 || buf.length < offset + len) fail('Credential id has a bad length');
    out.credentialId = Buffer.from(buf.subarray(offset, offset + len)); offset += len;
    const key = cborDecode(buf, offset); out.cose = key.value; offset = key.offset;
  } else if (withCredential) fail('Authenticator data carries no credential');
  if (out.flags & FLAG.ED) { const ext = cborDecode(buf, offset); if (!(ext.value instanceof Map)) fail('Authenticator extensions are malformed'); offset = ext.offset; }
  if (offset !== buf.length) fail('Authenticator data has trailing bytes');
  return out;
}

// ---- client data ------------------------------------------------------------------------------------
// Returns { raw, data }. The caller reads data.challenge to find (and consume) its pending
// challenge, then passes both to a verify function.
function parseClientData(value) {
  const raw = fromB64u(value, 'clientDataJSON', 8192); let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch { fail('clientDataJSON is not valid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.challenge !== 'string' || typeof data.type !== 'string' || typeof data.origin !== 'string') fail('clientDataJSON is incomplete');
  return { raw, data };
}
function checkClientData(data, type, expected) {
  if (data.type !== type) fail('This response is for a different WebAuthn operation');
  if (!equal(Buffer.from(data.challenge), Buffer.from(String(expected.challenge)))) fail('Challenge does not match');
  if (data.origin !== expected.origin) fail('This response was made for a different origin');
  if (data.crossOrigin === true) fail('Cross-origin WebAuthn responses are refused');
}
function checkAuthData(auth, expected) {
  if (!equal(auth.rpIdHash, sha256(Buffer.from(String(expected.rpId), 'utf8')))) fail('This response was made for a different site');
  if (!auth.userPresent) fail('The authenticator did not confirm that a person was present');
  if (expected.requireUserVerification && !auth.userVerified) fail('The authenticator did not verify the user');
}

// expected: { challenge (base64url text), origin, rpId, requireUserVerification? }
function verifyRegistration({ clientData, attestationObject, expected }) {
  checkClientData(clientData.data, 'webauthn.create', expected);
  const buf = fromB64u(attestationObject, 'attestationObject', 16384); const att = cborDecode(buf);
  if (att.offset !== buf.length) fail('Attestation object has trailing bytes');
  if (!(att.value instanceof Map) || typeof att.value.get('fmt') !== 'string' || !Buffer.isBuffer(att.value.get('authData'))) fail('Attestation object is malformed');
  const auth = parseAuthData(att.value.get('authData'), { withCredential: true }); checkAuthData(auth, expected);
  const { jwk, alg } = coseToJwk(auth.cose);
  return { credentialId: b64u(auth.credentialId), jwk, alg, counter: auth.counter, userVerified: auth.userVerified, backupEligible: auth.backupEligible, backedUp: auth.backedUp, aaguid: auth.aaguid.toString('hex'), fmt: att.value.get('fmt') };
}

// credential: { jwk, alg, counter }. Returns the new counter and flags; the caller stores the counter.
function verifyAssertion({ clientData, authenticatorData, signature, expected, credential }) {
  checkClientData(clientData.data, 'webauthn.get', expected);
  const authBuf = fromB64u(authenticatorData, 'authenticatorData', 4096); const auth = parseAuthData(authBuf); checkAuthData(auth, expected);
  const sig = fromB64u(signature, 'signature', 2048); const signed = Buffer.concat([authBuf, sha256(clientData.raw)]);
  let key; try { key = crypto.createPublicKey({ key: credential.jwk, format: 'jwk' }); } catch { fail('Stored credential key is not valid'); }
  let ok = false;
  try {
    if (credential.alg === 'ES256' && key.asymmetricKeyType === 'ec') ok = crypto.verify('sha256', signed, { key, dsaEncoding: 'der' }, sig);
    else if (credential.alg === 'RS256' && key.asymmetricKeyType === 'rsa') ok = crypto.verify('sha256', signed, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, sig);
  } catch { ok = false; }
  if (!ok) fail('Signature is not valid');
  // A counter that does not move forward means the credential may have been copied.
  // Authenticators without a counter always send 0, which is accepted while the stored value is 0 too.
  const stored = Number(credential.counter) || 0;
  if ((auth.counter !== 0 || stored !== 0) && auth.counter <= stored) { const e = new WebAuthnError('Sign counter went backwards. This passkey may have been copied.'); e.counterRegression = true; throw e; }
  return { counter: auth.counter, userVerified: auth.userVerified, backedUp: auth.backedUp };
}

module.exports = { WebAuthnError, cborDecode, coseToJwk, parseAuthData, parseClientData, verifyRegistration, verifyAssertion, b64u, fromB64u, FLAG };
