#!/usr/bin/env node
// TEST FIXTURE ONLY. A tiny stand-in for choco used by the automated tests on machines
// without Chocolatey. It keeps state in a JSON file and prints --limit-output rows.
const fs = require('fs'); const path = require('path');
const stateFile = process.env.FAKE_CHOCO_STATE || path.join(__dirname, 'fake-state.json');
const def = { packages: { git: '2.46.0', '7zip': '24.07', putty: '0.80.0' }, latest: { git: '2.47.1', '7zip': '24.08', putty: '0.80.0', vscode: '1.95.3' }, pins: {}, sources: [['chocolatey', 'https://community.chocolatey.org/api/v2/', 'False', '', '', '0', 'False', 'False', 'False']], config: { cacheLocation: '', commandExecutionTimeoutSeconds: '2700' }, features: { checksumFiles: true, allowGlobalConfirmation: false } };
let st; try { st = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { st = def; }
const save = () => fs.writeFileSync(stateFile, JSON.stringify(st));
const a = process.argv.slice(2); const cmd = a[0]; const pos = a.slice(1).filter((x) => !x.startsWith('-')); const opt = (n) => { const h = a.find((x) => x.startsWith('--' + n + '=')); return h ? h.split('=').slice(1).join('=') : a.includes('--' + n); };
const out = (s) => process.stdout.write(s + '\n');
if (cmd === '--version') out('2.5.1');
else if (cmd === 'list') for (const [n, v] of Object.entries(st.packages)) out(`${n}|${v}`);
else if (cmd === 'outdated') { let any = false; for (const [n, v] of Object.entries(st.packages)) if (st.latest[n] && st.latest[n] !== v) { any = true; out(`${n}|${v}|${st.latest[n]}|${st.pins[n] ? 'true' : 'false'}`); } process.exitCode = 0; }
else if (cmd === 'search') for (const [n, v] of Object.entries(st.latest)) { if (!pos[0] || n.includes(pos[0])) out(`${n}|${v}`); }
else if (cmd === 'info') { const n = pos[0]; if (!st.latest[n]) { out('0 packages found.'); process.exitCode = 0; } else out(`${n} ${st.latest[n]}\n Title: ${n} | Published: 2026-01-01\n Summary: fixture package`); }
else if (cmd === 'install' || cmd === 'upgrade') { const names = pos[0] === 'all' ? Object.keys(st.packages) : pos; for (const n of names) { if (!st.latest[n]) { process.stderr.write(`${n} not found\n`); process.exitCode = 1; continue; } if (cmd === 'upgrade' && st.pins[n]) { out(`${n} is pinned, skipping`); continue; } out(`Installing ${n} ${opt('version') || st.latest[n]}...`); st.packages[n] = opt('version') || st.latest[n]; out(` The ${cmd} of ${n} was successful.`); } save(); }
else if (cmd === 'uninstall') { for (const n of pos) { if (!st.packages[n]) { process.stderr.write(`${n} is not installed\n`); process.exitCode = 1; } else { delete st.packages[n]; out(`${n} has been uninstalled.`); } } save(); }
else if (cmd === 'pin') { const sub = pos[0] || 'list'; const n = opt('name'); if (sub === 'list') for (const k of Object.keys(st.pins)) out(`${k}|${st.packages[k]}`); else if (sub === 'add') { st.pins[n] = true; out(`Created a pin for ${n}`); } else { delete st.pins[n]; out(`Removed pin for ${n}`); } save(); }
else if (cmd === 'source') { const sub = pos[0] || 'list'; const n = opt('name'); if (sub === 'list') for (const s of st.sources) out(s.join('|')); else if (sub === 'add') { st.sources = st.sources.filter((s) => s[0] !== n); st.sources.push([n, opt('source'), 'False', opt('user') || '', '', String(opt('priority') || 0), 'False', 'False', 'False']); out(`Added ${n}`); } else if (sub === 'remove') { st.sources = st.sources.filter((s) => s[0] !== n); out(`Removed ${n}`); } else { for (const s of st.sources) if (s[0] === n) s[2] = sub === 'disable' ? 'True' : 'False'; out(`${sub}d ${n}`); } save(); }
else if (cmd === 'config') { const sub = pos[0] || 'list'; const n = opt('name'); if (sub === 'list') for (const [k, v] of Object.entries(st.config)) out(`${k}|${v}|fixture description`); else if (sub === 'get') out(st.config[n] || ''); else if (sub === 'set') { st.config[n] = String(opt('value')); out(`Updated ${n}`); } else { st.config[n] = ''; out(`Unset ${n}`); } save(); }
else if (cmd === 'feature') { const sub = pos[0] || 'list'; const n = opt('name'); if (sub === 'list') for (const [k, v] of Object.entries(st.features)) out(`${k}|${v ? 'Enabled' : 'Disabled'}|fixture description`); else { st.features[n] = sub === 'enable'; out(`${sub}d ${n}`); } save(); }
else if (cmd === 'export') { const f = opt('output-file-path') || 'packages.config'; fs.writeFileSync(f, '<?xml version="1.0" encoding="utf-8"?>\n<packages>\n' + Object.entries(st.packages).map(([n, v]) => `  <package id="${n}" version="${v}" />`).join('\n') + '\n</packages>\n'); out('Exported'); }
else if (cmd === 'slow') { let i = 0; const t = setInterval(() => { out('tick ' + ++i); if (i >= 50) clearInterval(t); }, 100); }
else { out(`fixture: ${a.join(' ')}`); }
