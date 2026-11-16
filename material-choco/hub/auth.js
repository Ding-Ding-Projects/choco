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
module.exports = { hashPassword, verifyPassword, sha256, token, safeEqual, pairingCode, Limiter };
