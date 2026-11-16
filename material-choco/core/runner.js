'use strict';
// Executes one job on the machine this process runs on. Shared by the desktop app
// (local machine) and by remote agents.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const choco = require('./choco');
const bundle = require('./bundle');

function machineInfo(extra = {}) {
  return { hostname: os.hostname(), platform: process.platform, os: `${os.type()} ${os.release()}`, arch: os.arch(), elevated: choco.isElevated(), ...extra };
}

// policy: { readOnly: boolean, chocoPath?: string }
async function execute(spec, { policy = {}, onData, signal } = {}) {
  const cli = bundle.resolve(policy);
  const chocoPath = cli.exe;
  const extra = cli.unofficial ? { 'allow-unofficial-build': true } : {};
  if (spec.kind === 'inventory') {
    const inv = await choco.inventory(chocoPath, { env: cli.env, global: extra });
    inv.bundled = cli.bundled; inv.cliPath = chocoPath || '';
    return { code: inv.available ? 0 : 1, inventory: inv, stderr: inv.available ? '' : inv.reason };
  }
  if (spec.kind !== 'choco') return { code: -1, stderr: `Unknown job kind: ${spec.kind}` };
  let built;
  try { built = choco.buildArgs({ ...spec, global: { ...spec.global, ...extra } }); } catch (e) { return { code: -1, stderr: e.message, rejected: true }; }
  const mutates = choco.classify(spec).mutating;
  if (policy.readOnly && mutates) return { code: -1, stderr: 'This agent is read only and refused a command that changes the machine.', rejected: true };
  if (!chocoPath) return { code: -1, stderr: 'The bundled Chocolatey CLI is missing from this build.', rejected: true };
  let tmpDir = null; const argv = built.argv.slice();
  try {
    if (spec.file) { // e.g. packages.config for `choco install packages.config`
      const name = path.basename(String(spec.file.name || 'packages.config'));
      if (!/^[\w.-]{1,80}$/.test(name)) return { code: -1, stderr: 'Invalid file name', rejected: true };
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'material-choco-'));
      const p = path.join(tmpDir, name); fs.writeFileSync(p, String(spec.file.content || '').slice(0, 1024 * 1024));
      argv.splice(built.command.subcommands.length && spec.subcommand ? 2 : 1, 0, p);
    }
    const res = await choco.run(chocoPath, argv, { onData, signal, env: cli.env, cwd: tmpDir || undefined, timeoutMs: (Number(spec.timeoutMinutes) || 240) * 60 * 1000 });
    if (spec.collect && tmpDir) { // return generated files (export, new, pack)
      res.files = fs.readdirSync(tmpDir).filter((f) => fs.statSync(path.join(tmpDir, f)).isFile()).slice(0, 5)
        .map((f) => ({ name: f, content: fs.readFileSync(path.join(tmpDir, f)).subarray(0, 512 * 1024).toString('utf8') }));
    }
    return { ...res, mutated: mutates };
  } finally { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); }
}

module.exports = { execute, machineInfo };
