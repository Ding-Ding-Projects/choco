'use strict';
// Remote agent: enrolls with a hub using a one time pairing code, then long-polls for
// jobs, runs them through the local Chocolatey CLI and streams the output back.
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const runner = require('./runner');
const pkg = require('../package.json');

const isLocalHost = (h) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(h);

class Agent extends EventEmitter {
  constructor({ configFile, policy = {} }) { super(); this.configFile = configFile; this.policy = policy; this.config = null; this.running = false; this.abort = null; this.state = 'disconnected'; this.lastError = ''; this.load(); }
  load() { try { this.config = JSON.parse(fs.readFileSync(this.configFile, 'utf8')); } catch { this.config = null; } }
  save() { fs.mkdirSync(path.dirname(this.configFile), { recursive: true }); fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 1), { mode: 0o600 }); }
  status() { return { connected: !!this.config, hubUrl: this.config?.hubUrl || '', machineId: this.config?.machineId || '', state: this.state, lastError: this.lastError, readOnly: !!this.config?.readOnly }; }
  setState(s, err = '') { this.state = s; this.lastError = err; this.emit('state', this.status()); }

  static checkUrl(hubUrl, allowInsecure) {
    let u; try { u = new URL(hubUrl); } catch { throw new Error('The hub address is not a valid URL'); }
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('The hub address must start with http:// or https://');
    if (u.protocol === 'http:' && !isLocalHost(u.hostname) && !allowInsecure) throw new Error('Refusing plain HTTP to a remote hub. Use HTTPS, or allow insecure connections for a trusted LAN.');
    return u.origin;
  }

  async enroll({ hubUrl, code, name, allowInsecure = false, readOnly = false }) {
    const origin = Agent.checkUrl(hubUrl, allowInsecure);
    const res = await fetch(origin + '/agent/enroll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: String(code || '').trim().toUpperCase(), name, info: runner.machineInfo({ agentVersion: pkg.version }), readOnly }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Hub answered ${res.status}`);
    this.config = { hubUrl: origin, machineId: body.machineId, token: body.token, readOnly: !!(readOnly || body.readOnly), allowInsecure };
    this.save(); return this.status();
  }
  disconnect() { this.stop(); this.config = null; try { fs.rmSync(this.configFile, { force: true }); } catch { /* nothing to remove */ } this.setState('disconnected'); }

  async call(method, route, body, signal) {
    const res = await fetch(this.config.hubUrl + route, { method, signal, headers: { authorization: 'Bearer ' + this.config.token, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 401) { const e = new Error('The hub no longer accepts this agent. Enroll again.'); e.fatal = true; throw e; }
    if (!res.ok) throw new Error(`Hub answered ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  start() { if (this.running || !this.config) return; this.running = true; this.loop(); }
  stop() { this.running = false; if (this.abort) this.abort.abort(); }

  async loop() {
    let backoff = 1000;
    while (this.running && this.config) {
      try {
        this.abort = new AbortController();
        const t = setTimeout(() => this.abort.abort(), 40000);
        const reply = await this.call('POST', '/agent/poll', { info: runner.machineInfo({ agentVersion: pkg.version }) }, this.abort.signal).finally(() => clearTimeout(t));
        this.setState('online'); backoff = 1000;
        for (const job of reply.jobs || []) await this.runJob(job);
      } catch (e) {
        if (!this.running) break;
        if (e.fatal) { this.setState('rejected', e.message); this.running = false; break; }
        this.setState('retrying', e.name === 'AbortError' ? 'The hub did not answer in time' : e.message);
        await new Promise((r) => setTimeout(r, backoff)); backoff = Math.min(backoff * 2, 30000);
      }
    }
  }

  async runJob(job) {
    let buffer = ''; let flushing = Promise.resolve(); const cancel = new AbortController();
    const flush = () => { if (!buffer) return; const chunk = buffer; buffer = ''; flushing = flushing.then(() => this.call('POST', `/agent/jobs/${job.id}/output`, { chunk }).then((r) => { if (r && r.cancel) cancel.abort(); }).catch(() => {})); };
    const timer = setInterval(flush, 700);
    let result;
    try { result = await runner.execute(job.spec, { policy: { ...this.policy, readOnly: this.config.readOnly }, signal: cancel.signal, onData: (_s, t) => { buffer += t; if (buffer.length > 16384) flush(); } }); }
    catch (e) { result = { code: -1, stderr: String(e.message) }; }
    clearInterval(timer); flush(); await flushing;
    const done = { code: result.code, stderr: (result.stderr || '').slice(-8000), durationMs: result.durationMs || 0, timedOut: !!result.timedOut, cancelled: !!result.cancelled, rejected: !!result.rejected, inventory: result.inventory, files: result.files };
    if (result.mutated) done.inventory = (await runner.execute({ kind: 'inventory' }, { policy: this.policy })).inventory;
    for (let i = 0; i < 5; i++) { try { await this.call('POST', `/agent/jobs/${job.id}/done`, done); return; } catch (e) { if (e.fatal) throw e; await new Promise((r) => setTimeout(r, 2000 * (i + 1))); } }
  }
}
module.exports = { Agent };
