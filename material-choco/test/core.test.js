'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const choco = require('../core/choco');
const auth = require('../hub/auth');

test('schema matches the CLI source in this repository', () => { execFileSync('node', [path.join(__dirname, '..', 'scripts', 'gen-schema.mjs'), '--check']); });
test('schema covers every command file', () => {
  const dir = path.join(__dirname, '..', '..', 'src', 'chocolatey', 'infrastructure.app', 'commands');
  const files = fs.readdirSync(dir).filter((f) => /^Chocolatey\w+Command\.cs$/.test(f) && f !== 'ChocolateyCommandBase.cs');
  assert.strictEqual(choco.schema.commands.length, files.length);
  for (const c of choco.schema.commands) for (const o of c.options) { assert.ok(o.flag.startsWith('-')); assert.ok(o.names.length); }
  assert.ok(choco.schema.commands.find((c) => c.name === 'install').options.length >= 30);
});
test('buildArgs builds validated arguments without a shell', () => {
  const b = choco.buildArgs({ command: 'install', args: ['git'], options: { version: '2.0', 'install-arguments': '/S & calc.exe', prerelease: true }, global: { confirm: true } });
  assert.deepStrictEqual(b.argv, ['install', 'git', '--version=2.0', '--install-arguments=/S & calc.exe', '--prerelease', '--confirm']);
});
test('buildArgs rejects unknown commands, options, subcommands and option injection', () => {
  for (const bad of [{ command: 'rm' }, { command: 'install', args: ['--source=http://evil'] }, { command: 'install', options: { nope: true } }, { command: 'pin', subcommand: 'explode' }, { command: 'install', options: { version: 'a\nb' } }, { command: 'install', options: { prerelease: 'yes' } }, { command: 'install', args: [5] }])
    assert.throws(() => choco.buildArgs(bad), /Unknown|cannot start|line break|switch|must be text/);
});
test('secrets are masked in the recorded command', () => {
  const b = choco.buildArgs({ command: 'source', subcommand: 'add', options: { name: 'x', source: 'https://x', password: 'hunter2' } });
  assert.ok(b.argv.includes('--password=hunter2')); assert.ok(!b.redacted.join(' ').includes('hunter2'));
  const k = choco.buildArgs({ command: 'apikey', subcommand: 'add', options: { source: 'https://x', 'api-key': 'abc123' } }); assert.ok(!k.redacted.join(' ').includes('abc123'));
});
test('classify marks changing and destructive commands', () => {
  assert.deepStrictEqual(choco.classify({ command: 'list' }), { mutating: false, destructive: false });
  assert.strictEqual(choco.classify({ command: 'install' }).mutating, true);
  assert.strictEqual(choco.classify({ command: 'uninstall' }).destructive, true);
  assert.strictEqual(choco.classify({ command: 'source', subcommand: 'list' }).mutating, false);
  assert.strictEqual(choco.classify({ command: 'source', subcommand: 'remove' }).destructive, true);
  assert.strictEqual(choco.classify({ command: 'install', global: { 'what-if': true } }).mutating, false);
});
test('limit-output parsers', () => {
  assert.deepStrictEqual(choco.parse.list('Chocolatey v2\ngit|2.46.0\r\n7zip|24.07\n'), [{ name: 'git', version: '2.46.0' }, { name: '7zip', version: '24.07' }]);
  assert.deepStrictEqual(choco.parse.outdated('git|1|2|true'), [{ name: 'git', version: '1', available: '2', pinned: true }]);
  assert.strictEqual(choco.parse.sources('a|https://x|True|u||3|False|False|True')[0].disabled, true);
  assert.strictEqual(choco.parse.features('checksumFiles|Enabled|Checks | files')[0].description, 'Checks | files');
});
test('password hashing, TOTP (RFC 6238 vector) and pairing codes', () => {
  const rec = auth.hashPassword('correct horse'); assert.ok(auth.verifyPassword('correct horse', rec)); assert.ok(!auth.verifyPassword('wrong', rec));
  assert.strictEqual(auth.totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000), '287082');
  assert.match(auth.pairingCode(), /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const l = new auth.Limiter(); for (let i = 0; i < 5; i++) l.fail('k'); assert.ok(l.check('k') > 0); l.ok('k'); assert.strictEqual(l.check('k'), 0);
});
