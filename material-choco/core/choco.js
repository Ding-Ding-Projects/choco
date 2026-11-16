'use strict';
// Wrapper around the Chocolatey CLI. Every argument is validated against the schema
// generated from the CLI source, and the process is spawned without a shell.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const schema = require('../shared/choco-schema.json');

const commandByName = new Map();
for (const c of schema.commands) { commandByName.set(c.name, c); for (const a of c.aliases) commandByName.set(a, c); }
const globalById = new Map(schema.globalOptions.map((o) => [o.id, o]));
const MAX_ARG = 4096;

class SpecError extends Error { constructor(m) { super(m); this.name = 'SpecError'; this.status = 400; } }

function findChoco(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.MATERIAL_CHOCO_CLI) candidates.push(process.env.MATERIAL_CHOCO_CLI);
  if (process.platform === 'win32') {
    const root = process.env.ChocolateyInstall || path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey');
    candidates.push(path.join(root, 'bin', 'choco.exe'), path.join(root, 'choco.exe'));
  }
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of process.platform === 'win32' ? ['choco.exe'] : ['choco']) candidates.push(path.join(dir, name));
  }
  for (const c of candidates) { try { if (fs.statSync(c).isFile()) return c; } catch { /* keep looking */ } }
  return null;
}

function checkValue(label, v) {
  if (typeof v !== 'string') throw new SpecError(`${label} must be text`);
  if (v.length > MAX_ARG) throw new SpecError(`${label} is too long`);
  if (/[\0\r\n]/.test(v)) throw new SpecError(`${label} contains a line break or NUL`);
  return v;
}

// spec: { command, subcommand?, args?: string[], options?: {id: true|string}, global?: {id: true|string} }
function buildArgs(spec) {
  if (!spec || typeof spec !== 'object') throw new SpecError('Missing command');
  const cmd = commandByName.get(String(spec.command || ''));
  if (!cmd) throw new SpecError(`Unknown choco command: ${spec.command}`);
  const argv = [cmd.name]; const redacted = [cmd.name];
  if (spec.subcommand) {
    if (!cmd.subcommands.includes(spec.subcommand)) throw new SpecError(`Unknown subcommand for ${cmd.name}: ${spec.subcommand}`);
    argv.push(spec.subcommand); redacted.push(spec.subcommand);
  }
  for (const a of spec.args || []) {
    checkValue('Argument', a);
    if (!a.length) continue;
    if (a.startsWith('-')) throw new SpecError(`Arguments cannot start with "-": ${a}`);
    argv.push(a); redacted.push(a);
  }
  const optionById = new Map(cmd.options.map((o) => [o.id, o]));
  const add = (map, values, kind) => {
    for (const [id, raw] of Object.entries(values || {})) {
      const opt = map.get(id);
      if (!opt) throw new SpecError(`Unknown ${kind} option for ${cmd.name}: ${id}`);
      if (raw === false || raw === null || raw === undefined || raw === '') continue;
      if (opt.takesValue) {
        const v = checkValue(opt.flag, String(raw));
        argv.push(`${opt.flag}=${v}`); redacted.push(`${opt.flag}=${opt.secret ? '********' : v}`);
      } else {
        if (raw !== true) throw new SpecError(`${opt.flag} is a switch and takes no value`);
        argv.push(opt.flag); redacted.push(opt.flag);
      }
    }
  };
  add(optionById, spec.options, 'command');
  add(globalById, spec.global, 'global');
  return { argv, redacted, command: cmd };
}

function run(chocoPath, argv, { onData, timeoutMs = 4 * 60 * 60 * 1000, signal, cwd, env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now(); let out = ''; let err = ''; let done = false; let timer;
    let child;
    try { child = spawn(chocoPath, argv, { windowsHide: true, shell: false, cwd: cwd || os.tmpdir(), env: env ? { ...process.env, ...env } : process.env }); }
    catch (e) { return resolve({ code: -1, stdout: '', stderr: String(e.message), durationMs: 0, spawnError: true }); }
    const finish = (code, extra = {}) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, stdout: out, stderr: err, durationMs: Date.now() - started, ...extra }); };
    const cap = (s, chunk) => (s.length < 4 * 1024 * 1024 ? s + chunk : s);
    child.stdout.on('data', (d) => { const t = d.toString('utf8'); out = cap(out, t); onData && onData('stdout', t); });
    child.stderr.on('data', (d) => { const t = d.toString('utf8'); err = cap(err, t); onData && onData('stderr', t); });
    child.on('error', (e) => finish(-1, { stderr: err + String(e.message), spawnError: true }));
    child.on('close', (code, sig) => finish(code === null ? -1 : code, sig ? { signal: sig } : {}));
    timer = setTimeout(() => { try { child.kill(); } catch { /* gone */ } finish(-1, { timedOut: true }); }, timeoutMs);
    if (signal) signal.addEventListener('abort', () => { try { child.kill(); } catch { /* gone */ } finish(-1, { cancelled: true }); }, { once: true });
  });
}

// --- parsers for --limit-output ---------------------------------------------------
const rows = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l.includes('|')).map((l) => l.split('|'));
const bool = (s) => /^true$/i.test(String(s || '').trim());
const parse = {
  list: (t) => rows(t).filter((r) => r.length === 2).map(([name, version]) => ({ name, version })),
  outdated: (t) => rows(t).filter((r) => r.length >= 4).map(([name, version, available, pinned]) => ({ name, version, available, pinned: bool(pinned) })),
  sources: (t) => rows(t).map(([name, url, disabled, user, certificate, priority, bypassProxy, selfService, adminOnly]) => ({ name, url, disabled: bool(disabled), user: user || '', certificate: certificate || '', priority: Number(priority) || 0, bypassProxy: bool(bypassProxy), selfService: bool(selfService), adminOnly: bool(adminOnly) })),
  config: (t) => rows(t).map(([name, value, ...d]) => ({ name, value: value || '', description: d.join('|') })),
  features: (t) => rows(t).map(([name, state, ...d]) => ({ name, enabled: /^enabled$/i.test(state), description: d.join('|') })),
  pins: (t) => rows(t).filter((r) => r.length >= 2).map(([name, version]) => ({ name, version })),
  apikeys: (t) => rows(t).map(([source, key]) => ({ source, key: key || '' })),
  templates: (t) => rows(t).map(([name, version]) => ({ name, version: version || '' })),
};

const READ = { 'limit-output': true, 'no-color': true };
async function inventory(chocoPath, { env, global = {} } = {}) {
  if (!chocoPath) return { available: false, reason: 'The bundled Chocolatey CLI is missing from this build', at: new Date().toISOString() };
  const q = async (spec) => run(chocoPath, buildArgs({ ...spec, global: { ...spec.global, ...global } }).argv, { timeoutMs: 5 * 60 * 1000, env });
  const ver = await run(chocoPath, ['--version'], { timeoutMs: 60 * 1000, env });
  if (ver.spawnError) return { available: false, reason: ver.stderr || 'choco could not be started', at: new Date().toISOString() };
  const [list, outdated, sources, config, features, pins] = [
    await q({ command: 'list', global: READ }), await q({ command: 'outdated', global: READ }),
    await q({ command: 'source', subcommand: 'list', global: READ }), await q({ command: 'config', subcommand: 'list', global: READ }),
    await q({ command: 'feature', subcommand: 'list', global: READ }), await q({ command: 'pin', subcommand: 'list', global: READ }),
  ];
  const errors = [];
  for (const [n, r] of Object.entries({ list, outdated, sources, config, features, pins })) if (r.code !== 0 && !(n === 'outdated' && r.code === 2)) errors.push(`${n}: exit code ${r.code}`);
  return {
    available: true, at: new Date().toISOString(), chocoVersion: ver.stdout.trim().split(/\r?\n/).pop() || '', errors,
    packages: parse.list(list.stdout), outdated: parse.outdated(outdated.stdout), sources: parse.sources(sources.stdout),
    config: parse.config(config.stdout), features: parse.features(features.stdout), pins: parse.pins(pins.stdout),
  };
}

// Does this spec change the machine (or publish something)? Used for read only agents,
// confirmations and the inventory refresh after a job.
const ALWAYS = new Set(['install', 'upgrade', 'uninstall', 'unpackself', 'push']);
const BY_SUB = new Set(['pin', 'source', 'config', 'feature', 'apikey', 'cache']);
const DESTRUCTIVE = new Set(['uninstall', 'unpackself']);
function classify(spec) {
  const cmd = commandByName.get(String(spec.command || '')); if (!cmd) return { mutating: false, destructive: false };
  if (spec.global && spec.global['what-if']) return { mutating: false, destructive: false };
  const sub = spec.subcommand || 'list';
  const mutating = ALWAYS.has(cmd.name) || (BY_SUB.has(cmd.name) && !['list', 'get', 'info'].includes(sub));
  const destructive = DESTRUCTIVE.has(cmd.name) || (BY_SUB.has(cmd.name) && ['remove', 'unset'].includes(sub)) || (cmd.name === 'feature' && sub === 'disable' ? false : false);
  return { mutating, destructive };
}

function isElevated() {
  if (process.platform !== 'win32') return typeof process.getuid === 'function' && process.getuid() === 0;
  try { require('node:child_process').execFileSync('fltmc', { stdio: 'ignore', windowsHide: true }); return true; } catch { return false; }
}

module.exports = { schema, findChoco, buildArgs, run, parse, inventory, isElevated, classify, SpecError, commandByName };
