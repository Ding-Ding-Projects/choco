'use strict';
const crypto = require('node:crypto');

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex') });
function verifyPassword(password, rec) {
  if (!rec) return false; const h = hashPassword(password, rec.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(rec.hash, 'hex'));
}
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const token = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// Pairing codes: 8 characters from an alphabet without look-alikes, shown as XXXX-XXXX.
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function pairingCode() { let s = ''; for (const b of crypto.randomBytes(8)) s += ALPHA[b % ALPHA.length]; return s.slice(0, 4) + '-' + s.slice(4); }

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits) with base32 secrets.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) { let bits = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); let out = ''; for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; }
function base32Decode(s) { let bits = ''; for (const c of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); }
function totp(secret, time = Date.now(), step = 30) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest(); const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
const totpVerify = (secret, code) => [-1, 0, 1].some((d) => safeEqual(totp(secret, Date.now() + d * 30000), String(code || '').replace(/\s/g, '')));
const totpSecret = () => base32Encode(crypto.randomBytes(20));

// Failed sign-in limiter with exponential lockout, per key.
class Limiter {
  constructor() { this.map = new Map(); }
  check(key) { const r = this.map.get(key); return r && r.until > Date.now() ? Math.ceil((r.until - Date.now()) / 1000) : 0; }
  // Returns the lockout in seconds when this failure locks the key, otherwise 0.
  fail(key) {
    if (this.map.size > 20000) { const now = Date.now(); for (const [k, v] of this.map) if (v.until < now) this.map.delete(k); } // forget old entries instead of growing without bound
    const r = this.map.get(key) || { n: 0, until: 0 }; r.n += 1; let seconds = 0;
    if (r.n >= 5) { seconds = Math.min(15 * 60, 2 ** (r.n - 5) * 30); r.until = Date.now() + seconds * 1000; }
    this.map.set(key, r); return seconds;
  }
  ok(key) { this.map.delete(key); }
}
module.exports = { hashPassword, verifyPassword, sha256, token, safeEqual, pairingCode, totp, totpVerify, totpSecret, base32Encode, base32Decode, Limiter };
