'use strict';
// Small JSON file store with atomic writes and an append-only audit log.
const fs = require('node:fs');
const path = require('node:path');

class Store {
  constructor(dir) {
    this.dir = dir; fs.mkdirSync(path.join(dir, 'jobs'), { recursive: true });
    this.file = path.join(dir, 'hub.json'); this.auditFile = path.join(dir, 'audit.jsonl');
    this.data = { version: 1, users: [], machines: [], pairings: [], jobs: [], schedules: [], settings: {}, nextJob: 1 };
    try { Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch { /* first run */ }
    this.timer = null;
  }
  save() { if (this.timer) return; this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 150); }
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); fs.renameSync(tmp, this.file);
  }
  audit(entry) { const row = { at: new Date().toISOString(), ...entry }; fs.appendFileSync(this.auditFile, JSON.stringify(row) + '\n'); return row; }
  readAudit(limit = 500) {
    let text = ''; try { text = fs.readFileSync(this.auditFile, 'utf8'); } catch { return []; }
    const lines = text.trim().split('\n').filter(Boolean); return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  }
  jobLog(id) { return path.join(this.dir, 'jobs', `${id}.log`); }
  appendJobLog(id, chunk) { const f = this.jobLog(id); let size = 0; try { size = fs.statSync(f).size; } catch { /* new */ } if (size < 2 * 1024 * 1024) fs.appendFileSync(f, chunk); }
  readJobLog(id) { try { return fs.readFileSync(this.jobLog(id), 'utf8'); } catch { return ''; } }
}
module.exports = { Store };
