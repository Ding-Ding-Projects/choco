'use strict';
// Encryption of secret values at rest (AES-256-GCM, Node built-ins only).
//
// What this protects: a copy of hub.json on its own (a backup, a support bundle, a
// mis-sent file) does not reveal queued source passwords, API keys, authenticator
// secrets or webhook addresses.
// What this does NOT protect: anyone who can read the whole data directory also reads
// the key file next to hub.json and can decrypt everything. Set MATERIAL_CHOCO_KEY_FILE
// to keep the key on a different volume if that matters to you.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const choco = require('../core/choco');

const PREFIX = 'mcenc:v1:';
const MASK = '********';

function loadKey(file) {
  let text = null;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (text === null) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const key = crypto.randomBytes(32);
    // "wx" fails if another process created the file in the meantime, so a key is never overwritten.
    try { fs.writeFileSync(file, key.toString('hex') + '\n', { mode: 0o600, flag: 'wx' }); return key; } catch (e) { if (e.code !== 'EEXIST') throw e; text = fs.readFileSync(file, 'utf8'); }
  }
  const hex = text.trim();
  // A damaged key is never replaced silently: that would make stored secrets unreadable for good.
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`The secrets key file ${file} is damaged. Restore it from a backup, or delete it together with hub.json to start over.`);
  if (process.platform !== 'win32') { try { if (fs.statSync(file).mode & 0o077) fs.chmodSync(file, 0o600); } catch { /* best effort */ } }
  return Buffer.from(hex, 'hex');
}

class Vault {
  constructor(keyFile) { this.keyFile = keyFile; this.key = loadKey(keyFile); }
  isSealed(v) { return typeof v === 'string' && v.startsWith(PREFIX); }
  // purpose is bound into the ciphertext, so a value sealed for one use cannot be moved to another.
  seal(plain, purpose = '') {
    const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', this.key, iv); c.setAAD(Buffer.from(String(purpose)));
    const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    return PREFIX + [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
  }
  // Values that are not sealed are returned as they are (records written before encryption existed).
  open(value, purpose = '') {
    if (!this.isSealed(value)) return value;
    const parts = value.slice(PREFIX.length).split('.'); if (parts.length !== 3) throw new Error('Stored secret is damaged');
    const [iv, tag, ct] = parts.map((p) => Buffer.from(p, 'base64url')); if (iv.length !== 12 || tag.length !== 16) throw new Error('Stored secret is damaged');
    const d = crypto.createDecipheriv('aes-256-gcm', this.key, iv); d.setAAD(Buffer.from(String(purpose))); d.setAuthTag(tag);
    try { return Buffer.concat([d.update(ct), d.final()]).toString('utf8'); } catch { throw new Error('Stored secret could not be decrypted. The key file does not match this data.'); }
  }
  mac(text) { return crypto.createHmac('sha256', this.key).update(String(text)).digest(); }

  // The three spec helpers return a copy and never change their argument.
  // sealSpec: plaintext secret option values become ciphertext. Already sealed values stay.
  sealSpec(spec) { return this.mapSecrets(spec, (v) => (this.isSealed(v) ? v : this.seal(v, 'spec'))); }
  // openSpec: the spec exactly as the agent needs it.
  openSpec(spec) { return this.mapSecrets(spec, (v) => this.open(v, 'spec')); }
  // wipeSpec: removes secret option values altogether (finished jobs).
  wipeSpec(spec) { return this.mapSecrets(spec, () => undefined); }
  // maskSpec: for API responses.
  maskSpec(spec) { return this.mapSecrets(spec, () => MASK); }
  hasSecrets(spec) { return choco.secretOptions(spec).some(([section, id]) => { const v = spec[section][id]; return !(v === false || v === null || v === undefined || v === ''); }); }
  mapSecrets(spec, fn) {
    const found = choco.secretOptions(spec); if (!found.length) return spec;
    const out = { ...spec };
    for (const [section, id] of found) {
      if (out[section] === spec[section]) out[section] = { ...spec[section] };
      const raw = spec[section][id]; if (raw === false || raw === null || raw === undefined || raw === '') continue;
      const next = fn(String(raw)); if (next === undefined) delete out[section][id]; else out[section][id] = next;
    }
    return out;
  }
}

module.exports = { Vault, PREFIX, MASK };
