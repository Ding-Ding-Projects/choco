#!/usr/bin/env node
// Fetches and prepares everything Material Choco needs after a fresh checkout, with only
// Node.js (and the npm that ships with it) present:
//   1. installs the npm packages exactly as package-lock.json records them (npm ci),
//   2. rebuilds the vendored UI bundle in ui/vendor, when scripts/build-vendor.mjs exists,
//   3. verifies shared/choco-schema.json against the CLI source (gen-schema.mjs --check).
// Every step runs even when an earlier one failed, except that the bundle is skipped when the
// packages could not be installed. The exit code is 0 only when no step failed.
//
// Usage: node scripts/fetch-deps.mjs
// It does not build the Chocolatey CLI itself; build.bat does that on Windows.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (...p) => fs.existsSync(path.join(root, ...p));
const results = [];

// Runs one command in the project folder. Returns { ok, detail }.
function run(command, args, { shell = false } = {}) {
  const r = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell });
  if (r.error) return { ok: false, detail: r.error.message };
  if (r.status !== 0) return { ok: false, detail: r.signal ? `stopped by ${r.signal}` : `exit code ${r.status}` };
  return { ok: true, detail: '' };
}

function step(name, fn) {
  console.log(`\n== ${name}`);
  const started = Date.now();
  let outcome;
  try { outcome = fn(); } catch (e) { outcome = { ok: false, detail: e.message }; }
  const state = outcome.skipped ? 'SKIPPED' : outcome.ok ? 'OK' : 'FAILED';
  results.push({ name, state, detail: outcome.detail || '', seconds: ((Date.now() - started) / 1000).toFixed(1) });
  return outcome;
}

step('Node.js', () => {
  const major = Number(process.versions.node.split('.')[0]);
  console.log(`node ${process.version}`);
  // The release workflow builds with Node.js 22, and the end to end checks use its built-in WebSocket.
  if (major < 22) return { ok: false, detail: `found ${process.version}, Node.js 22 or newer is needed` };
  return { ok: true, detail: process.version };
});

const install = step('npm packages from package-lock.json', () => {
  if (!has('package-lock.json')) return { ok: false, detail: 'package-lock.json is missing, so the install would not be reproducible' };
  // On Windows npm is a .cmd file, which Node.js only starts through a shell.
  return run('npm', ['ci'], { shell: process.platform === 'win32' });
});

step('Vendored UI bundle (ui/vendor)', () => {
  if (!has('scripts', 'build-vendor.mjs')) return { ok: true, skipped: true, detail: 'scripts/build-vendor.mjs does not exist' };
  if (!install.ok) return { ok: true, skipped: true, detail: 'the npm packages were not installed' };
  return run(process.execPath, [path.join('scripts', 'build-vendor.mjs')]);
});

step('CLI schema matches the CLI source', () => {
  if (!has('scripts', 'gen-schema.mjs')) return { ok: false, detail: 'scripts/gen-schema.mjs is missing' };
  const r = run(process.execPath, [path.join('scripts', 'gen-schema.mjs'), '--check']);
  if (!r.ok) r.detail += '; to regenerate run: node scripts/gen-schema.mjs';
  return r;
});

console.log('\nSummary');
const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`  ${r.state.padEnd(7)}  ${r.name.padEnd(width)}  ${r.seconds} s${r.detail ? '  ' + r.detail : ''}`);
const failed = results.filter((r) => r.state === 'FAILED');
console.log(failed.length ? `\n${failed.length} of ${results.length} steps failed.` : `\nAll dependencies are in place (${results.filter((r) => r.state === 'OK').length} steps passed, ${results.filter((r) => r.state === 'SKIPPED').length} skipped).`);
process.exit(failed.length ? 1 : 0);
