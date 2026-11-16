'use strict';
// Shared setup for the hub hardening tests: a temporary data area, the fixture standing in
// for choco.exe, and a small HTTP client that keeps one session cookie per instance and can
// send any Host header (the built-in fetch cannot, and passkeys depend on the host name).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-hard-'));
if (!process.env.MATERIAL_CHOCO_BUNDLE) {
  const bundle = path.join(tmp, 'bundle'); require('./fixtures/stand-in').installStandIn(bundle);
  Object.assign(process.env, { MATERIAL_CHOCO_BUNDLE: bundle, MATERIAL_CHOCO_HOME: path.join(tmp, 'home'), FAKE_CHOCO_STATE: path.join(tmp, 'state.json') });
}
delete process.env.MATERIAL_CHOCO_ORIGIN; delete process.env.MATERIAL_CHOCO_KEY_FILE;
const { createHub } = require('../hub/server');

const hubs = [];
async function startHub(name, options = {}) {
  const dataDir = path.join(tmp, name); const hub = createHub({ dataDir, host: '127.0.0.1', port: 0, ...options });
  const a = await hub.listen(); hubs.push(hub); return { hub, port: a.port, base: `http://127.0.0.1:${a.port}`, dataDir, file: path.join(dataDir, 'hub.json') };
}
async function cleanup() { for (const h of hubs.splice(0)) await h.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

// client(port, { host }) -> call(route, { method, body, headers, token }) -> { status, data }
function client(port, { host } = {}) {
  let cookie = '';
  const call = (route, { method = 'GET', body, headers = {}, token, auth = true } = {}) => new Promise((resolve, reject) => {
    const text = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers: { host: host || `127.0.0.1:${port}`, ...(text ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) } : {}), ...(auth && cookie ? { cookie } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => {
        for (const sc of res.headers['set-cookie'] || []) if (sc.startsWith('mc_session=')) cookie = sc.includes('Max-Age=0') ? '' : sc.split(';')[0];
        let data = {}; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject); if (text) req.write(text); req.end();
  });
  call.cookie = () => cookie; call.forget = () => { cookie = ''; };
  return call;
}
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 50)); } };
const PASSWORD = 'correct horse battery';
async function setupAdmin(call, name = 'admin') { const r = await call('/api/setup', { method: 'POST', body: { name, password: PASSWORD } }); if (r.status !== 200) throw new Error('setup failed: ' + JSON.stringify(r)); }
// A machine driven by hand over the agent protocol, so tests see exactly what an agent receives.
async function enrollManual(admin, anon, name = 'MANUAL-PC', info = {}) {
  const p = (await admin('/api/pairing', { method: 'POST', body: {} })).data;
  const e = (await anon('/agent/enroll', { method: 'POST', body: { code: p.code, name, info: { hostname: name, ...info } } })).data;
  const taken = await until(async () => { const r = await anon('/agent/poll', { method: 'POST', body: { info }, token: e.token }); return r.data.jobs && r.data.jobs[0]; }); // the enrollment inventory job
  await anon(`/agent/jobs/${taken.id}/done`, { method: 'POST', body: { code: 0 }, token: e.token });
  return { id: e.machineId, token: e.token };
}
module.exports = { tmp, startHub, cleanup, client, until, setupAdmin, enrollManual, PASSWORD };
