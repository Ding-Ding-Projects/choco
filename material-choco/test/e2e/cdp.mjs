// Minimal Chrome DevTools Protocol driver for the end to end checks (no dependencies).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function launch({ width = 1360, height = 900, mobile = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-chrome-'));
  const bin = process.env.CHROME_BIN || 'google-chrome';
  const proc = spawn(bin, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${dir}`, `--window-size=${width},${height}`, '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) resolve(m[1]); }); setTimeout(() => reject(new Error('Chrome did not start: ' + buf.slice(0, 300))), 15000); });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' ')); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  if (mobile) await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
  const page = {
    errors, send,
    goto: async (url) => { await send('Page.navigate', { url }); await page.wait(600); },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    eval: async (expr) => { const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r.result.value; },
    until: async (expr, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.eval(`return !!(${expr})`)) return true; await page.wait(150); } throw new Error('Timed out waiting for: ' + expr); },
    shot: async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    key: async (key, { ctrl, shift } = {}) => { const mods = (ctrl ? 2 : 0) | (shift ? 8 : 0); const code = key.length === 1 ? 'Key' + key.toUpperCase() : key; const vk = key.length === 1 ? key.toUpperCase().charCodeAt(0) : { Escape: 27, Enter: 13 }[key]; await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers: mods, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers: mods, windowsVirtualKeyCode: vk }); },
    type: async (text) => { await send('Input.insertText', { text }); },
    close: async () => { try { ws.close(); } catch { /* closing */ } proc.kill(); await new Promise((r) => setTimeout(r, 200)); fs.rmSync(dir, { recursive: true, force: true }); },
  };
  return page;
}
