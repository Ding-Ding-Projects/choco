'use strict';
// Outbound status webhooks. Each delivery is one JSON POST with a timeout; redirects are
// never followed; failures are retried a few times with growing delays; the outcome goes
// to the audit log. Payloads carry the redacted command line and the exit code only,
// never option values marked secret and never job output.
const EVENTS = ['job.failed', 'job.succeeded', 'machine.offline', 'login.lockout'];
const FORMATS = ['json', 'discord'];
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

// Returns the normalised URL or throws an Error with a message for the user.
function checkUrl(value) {
  let u; try { u = new URL(String(value || '')); } catch { throw new Error('The webhook address is not a valid URL'); }
  if (String(value).length > 2000) throw new Error('The webhook address is too long');
  if (u.username || u.password) throw new Error('Do not put a user name or password in the webhook address');
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOCAL.has(u.hostname))) throw new Error('Webhook addresses must use HTTPS (plain HTTP is accepted for localhost only)');
  return u.href;
}
const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };

function body(format, event, payload, hub) {
  if (format === 'discord') return { content: String(payload.text).slice(0, 1900), allowed_mentions: { parse: [] } }; // names from machines must never ping anyone
  return { event, at: new Date().toISOString(), hub, ...payload };
}

// deps: { hooks: () => [{ id, name, url, format, events, enabled }], openUrl(hook) => string,
//         audit(action, detail), hubName, backoffMs: number[], timeoutMs }
function createWebhooks({ hooks, openUrl, audit, hubName, backoffMs = [1000, 5000, 15000], timeoutMs = 8000 }) {
  const timers = new Set(); const inFlight = new Set(); let closed = false;
  const sleep = (ms) => new Promise((resolve) => { const t = setTimeout(() => { timers.delete(t); resolve(); }, ms); timers.add(t); t.resolve = resolve; });

  async function attempt(url, json) {
    const ctl = new AbortController(); inFlight.add(ctl); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', redirect: 'manual', signal: ctl.signal, headers: { 'content-type': 'application/json', 'user-agent': 'material-choco-hub' }, body: json });
      try { await res.body?.cancel(); } catch { /* the answer body is never read */ }
      if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
      if (res.status >= 300 && res.status < 400) return { ok: false, status: res.status, error: 'The receiver answered with a redirect, which is not followed', retry: false };
      return { ok: false, status: res.status, error: `The receiver answered ${res.status}`, retry: res.status >= 500 || res.status === 429 || res.status === 408 };
    } catch (e) {
      return { ok: false, status: 0, error: ctl.signal.aborted ? 'The receiver did not answer in time' : 'The receiver could not be reached', retry: true };
    } finally { clearTimeout(t); inFlight.delete(ctl); }
  }

  // One delivery with up to `retries` retries. Resolves with { ok, status, attempts, error? }; never rejects.
  async function deliver(hook, event, payload, { retries = Math.min(3, backoffMs.length) } = {}) {
    let result = { ok: false, status: 0, error: 'Not sent' }; let attempts = 0;
    try {
      const url = checkUrl(openUrl(hook)); const json = JSON.stringify(body(hook.format, event, payload, hubName));
      for (;;) {
        attempts += 1; result = await attempt(url, json);
        if (result.ok || !result.retry || attempts > retries || closed) break;
        await sleep(backoffMs[attempts - 1]); if (closed) break;
      }
    } catch (e) { result = { ok: false, status: 0, error: String(e.message) }; }
    const out = { ok: result.ok, status: result.status, attempts, ...(result.ok ? {} : { error: result.error }) };
    if (!closed) audit(result.ok ? 'webhook.delivered' : 'webhook.failed', { webhook: hook.name, event, host: hostOf(safeUrl(hook)), status: out.status, attempts, ...(out.error ? { error: out.error } : {}) });
    return out;
  }
  function safeUrl(hook) { try { return openUrl(hook); } catch { return ''; } }

  // Sends an event to every enabled webhook subscribed to it. Does not wait for delivery.
  function fire(event, payload, filter = () => true) {
    if (closed) return [];
    return hooks().filter((h) => h.enabled && Array.isArray(h.events) && h.events.includes(event) && filter(h)).map((h) => deliver(h, event, payload));
  }
  function close() { closed = true; for (const t of timers) { clearTimeout(t); t.resolve(); } timers.clear(); for (const c of inFlight) c.abort(); }
  return { fire, deliver, close };
}

module.exports = { createWebhooks, checkUrl, EVENTS, FORMATS };
