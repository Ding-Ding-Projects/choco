'use strict';
// The Chocolatey CLI built from this repository ships inside the app. Nothing has to be
// installed by the user: on first use the bundled CLI is copied to an app-owned folder and
// every choco process runs with ChocolateyInstall pointing there.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const choco = require('./choco');

const EXE = process.platform === 'win32' ? 'choco.exe' : 'choco';
function locateBundle() {
  const dirs = [process.env.MATERIAL_CHOCO_BUNDLE, process.resourcesPath && path.join(process.resourcesPath, 'choco'), path.join(__dirname, '..', 'choco-bundle')].filter(Boolean);
  for (const d of dirs) { try { if (fs.statSync(path.join(d, EXE)).isFile()) return d; } catch { /* next */ } }
  return null;
}
function writable(dir) { try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; } }
function dataRoot() {
  if (process.env.MATERIAL_CHOCO_HOME) return process.env.MATERIAL_CHOCO_HOME;
  if (process.platform === 'win32') {
    const shared = path.join(process.env.ProgramData || 'C:\\ProgramData', 'MaterialChoco');
    if (fs.existsSync(path.join(shared, 'chocolatey')) || (choco.isElevated() && writable(shared))) return shared;
    return path.join(process.env.LOCALAPPDATA || os.homedir(), 'MaterialChoco');
  }
  return path.join(os.homedir(), '.material-choco');
}
function copyDir(from, to) { fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name); const b = path.join(to, e.name); if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b); } }

let cached = null;
// Returns { exe, env, bundled, unofficial, home, error? }.
function resolve(policy = {}) {
  if (policy.chocoPath) return { exe: choco.findChoco(policy.chocoPath), env: policy.env || {}, bundled: false, unofficial: !!policy.unofficial };
  if (cached) return cached;
  const src = locateBundle();
  if (!src) {
    // Development checkout without a built CLI: fall back to a choco on PATH so the UI can still be exercised.
    const exe = process.env.MATERIAL_CHOCO_ALLOW_SYSTEM === '1' ? choco.findChoco() : null;
    return { exe, env: {}, bundled: false, unofficial: false, error: exe ? '' : 'bundle-missing' };
  }
  const home = path.join(dataRoot(), 'chocolatey'); const exe = path.join(home, EXE);
  try {
    const stamp = (f) => { const st = fs.statSync(f); return st.size + ':' + Math.floor(st.mtimeMs); };
    const marker = path.join(home, '.material-choco-bundle'); const want = stamp(path.join(src, EXE));
    let have = ''; try { have = fs.readFileSync(marker, 'utf8'); } catch { /* first run */ }
    if (have !== want || !fs.existsSync(exe)) { copyDir(src, home); fs.writeFileSync(marker, want); }
  } catch (e) { return { exe: null, env: {}, bundled: true, unofficial: true, error: 'Could not prepare the bundled CLI: ' + e.message }; }
  cached = { exe, env: { ChocolateyInstall: home }, bundled: true, unofficial: true, home };
  return cached;
}
module.exports = { resolve, locateBundle, dataRoot };
