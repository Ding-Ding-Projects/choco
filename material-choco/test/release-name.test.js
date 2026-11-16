'use strict';
// Release code names: every release number maps to one dim sum dish and one public photo reference.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const script = path.join(__dirname, '..', 'scripts', 'release-name.mjs');
const load = () => import(pathToFileURL(script).href);

test('the list holds at least 60 dishes, each named once in English and once in Cantonese', async () => {
  const { DISHES } = await load();
  assert.ok(DISHES.length >= 60, `only ${DISHES.length} dishes`);
  for (const key of ['english', 'cantonese', 'search']) {
    const seen = new Set(DISHES.map((d) => d[key].toLowerCase()));
    assert.strictEqual(seen.size, DISHES.length, `a ${key} value appears twice`);
    for (const d of DISHES) assert.ok(d[key].trim().length > 1, `empty ${key}`);
  }
});

test('the same release always gets the same name, whatever form the release is given in', async () => {
  const { releaseName } = await load();
  for (const n of [0, 1, 57, 63, 64, 999, 123456789]) {
    const first = releaseName(n);
    assert.deepStrictEqual(releaseName(n), first);
    assert.deepStrictEqual(releaseName(String(n)), first);
    assert.deepStrictEqual(releaseName('0.1.' + n), first);
    assert.deepStrictEqual(releaseName('material-choco-v0.1.' + n), first);
    assert.strictEqual(first.number, n);
  }
});

test('every release number lands inside the list', async () => {
  const { releaseName, DISHES } = await load();
  for (let n = 0; n < 5000; n++) {
    const r = releaseName(n);
    assert.ok(Number.isInteger(r.index) && r.index >= 0 && r.index < DISHES.length, `release ${n} gave index ${r.index}`);
    assert.strictEqual(r.codeName, DISHES[r.index].cantonese);
    assert.strictEqual(r.english, DISHES[r.index].english);
  }
  for (const n of [Number.MAX_SAFE_INTEGER, 2 ** 40 + 7]) { const r = releaseName(n); assert.ok(r.index >= 0 && r.index < DISHES.length); }
});

test('no code name repeats within any 60 consecutive releases', async () => {
  const { releaseName, DISHES } = await load();
  for (let start = 0; start < DISHES.length * 3; start++) {
    const names = new Set();
    for (let n = start; n < start + 60; n++) names.add(releaseName(n).codeName);
    assert.strictEqual(names.size, 60, `a name repeats in releases ${start} to ${start + 59}`);
  }
  // Every dish is used once in one full cycle.
  const cycle = new Set(); for (let n = 0; n < DISHES.length; n++) cycle.add(releaseName(n).index);
  assert.strictEqual(cycle.size, DISHES.length);
});

test('the photo reference is a Wikimedia Commons search link, never an image or a file page', async () => {
  const { DISHES, releaseName } = await load();
  for (const d of DISHES) {
    const u = new URL(d.photoUrl);
    assert.strictEqual(u.origin + u.pathname, 'https://commons.wikimedia.org/wiki/Special:MediaSearch');
    assert.deepStrictEqual([...u.searchParams.keys()], ['search']);
    assert.strictEqual(u.searchParams.get('search'), d.search);
    assert.ok(!/upload\.wikimedia\.org|File:|\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(d.photoUrl), d.photoUrl);
    assert.ok(!/\s/.test(d.photoUrl), 'the link must be encoded');
  }
  assert.strictEqual(releaseName(0).photoUrl, DISHES[releaseName(0).index].photoUrl);
});

test('release numbers that are not whole numbers are refused', async () => {
  const { releaseName } = await load();
  for (const bad of [-1, 1.5, NaN, '', 'latest', null, undefined, '0.1.x']) assert.throws(() => releaseName(bad), Error, String(bad));
});

test('the command line prints the title part, the notes header and JSON', async () => {
  const { releaseName } = await load();
  const run = (...a) => execFileSync(process.execPath, [script, ...a], { encoding: 'utf8' }).trim();
  const r = releaseName(57);
  assert.strictEqual(run('0.1.57', '--format', 'title'), `"${r.codeName}" (${r.english})`);
  assert.strictEqual(run('--format', 'title', '0.1.57'), `"${r.codeName}" (${r.english})`);
  assert.deepStrictEqual(JSON.parse(run('57', '--format', 'json')), r);
  const md = run('material-choco-v0.1.57', '--format', 'markdown');
  assert.ok(md.startsWith(`Code name: **${r.codeName}** (${r.english}).`));
  assert.ok(md.includes(`](${r.photoUrl})`));
  assert.ok(!md.includes('!['), 'the notes must not embed an image');
  assert.ok(run('57').includes(r.photoUrl));
  assert.notStrictEqual(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 0);
  assert.notStrictEqual(spawnSync(process.execPath, [script, 'latest'], { encoding: 'utf8' }).status, 0);
});
