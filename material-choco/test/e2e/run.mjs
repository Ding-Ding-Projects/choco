#!/usr/bin/env node
// End to end check: starts a real hub and two real agents (with the test fixture standing in
// for choco.exe), drives the real UI in headless Chrome, asserts outcomes and saves screenshots.
// Usage: node test/e2e/run.mjs [--shots docs/screenshots]
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = path.resolve(root, process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : 'docs/screenshots');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-e2e-')); const port = 18000 + Math.floor(Math.random() * 1000); const hubUrl = `http://127.0.0.1:${port}`;
const bundle = path.join(tmp, 'bundle'); fs.mkdirSync(bundle); fs.copyFileSync(path.join(root, 'test/fixtures/fake-choco.js'), path.join(bundle, 'choco')); fs.chmodSync(path.join(bundle, 'choco'), 0o755);
const procs = []; const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const agentEnv = (n) => ({ ...process.env, MATERIAL_CHOCO_DATA: path.join(tmp, 'agent' + n), MATERIAL_CHOCO_BUNDLE: bundle, MATERIAL_CHOCO_HOME: path.join(tmp, 'home' + n), FAKE_CHOCO_STATE: path.join(tmp, `state${n}.json`) });
const agent = (n, args) => execFileSync('node', [path.join(root, 'core/agent-cli.js'), ...args], { env: agentEnv(n), encoding: 'utf8' });
let p;
try {
  procs.push(spawn('node', [path.join(root, 'hub/server.js')], { env: { ...process.env, MATERIAL_CHOCO_DATA: path.join(tmp, 'hub'), MATERIAL_CHOCO_PORT: String(port), MATERIAL_CHOCO_HOST: '127.0.0.1' }, stdio: 'ignore' }));
  await new Promise((r) => setTimeout(r, 900));
  p = await launch();
  const click = (sel) => p.eval(`const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('missing ${sel.replace(/'/g, '')}'); e.click()`);
  const clickText = (text, tag = 'md-filled-button,md-filled-tonal-button,md-outlined-button,md-text-button,button') => p.eval(`const e=[...document.querySelectorAll(${JSON.stringify(tag)})].filter(x=>x.offsetParent!==null).find(x=>x.textContent.trim().includes(${JSON.stringify(text)})); if(!e) throw new Error('no button: ${text}'); e.click()`);
  const text = () => p.eval('return document.body.innerText');
  const go = (page) => p.eval(`document.querySelector('[data-tab="${page}"]').click()`).then(() => p.wait(500));

  await p.goto(hubUrl); await p.until(`document.querySelector('form')`); await p.shot(path.join(shots, '01-first-run-create-administrator.png'));
  await p.eval(`const f=document.querySelectorAll('md-outlined-text-field'); f[0].value='admin'; f[1].value='short'; document.querySelector('form').requestSubmit()`); await p.wait(500);
  check('setup refuses a short password', (await text()).includes('at least 10 characters'));
  await p.eval(`const f=document.querySelectorAll('md-outlined-text-field'); f[1].value='correct horse battery'; document.querySelector('form').requestSubmit()`);
  await p.until(`document.querySelector('.sheet')`); await p.wait(700); await p.shot(path.join(shots, '02-first-run-wizard.png'));
  check('first run wizard opens after setup', (await text()).includes('Nothing to install'));
  await clickText('Skip for now'); await p.wait(300);
  check('empty state is truthful before any machine', (await text()).includes('No machines yet')); await p.shot(path.join(shots, '03-empty-overview.png'));

  await go('machines'); await clickText('New pairing code'); await p.until(`document.querySelector('.code')`);
  const code1 = await p.eval(`return document.querySelector('.code').textContent`); await p.wait(400); await p.shot(path.join(shots, '04-machines-pairing-code.png'));
  agent(1, ['enroll', '--hub', hubUrl, '--code', code1, '--name', 'BUILD-01']);
  let reused = false; try { agent(3, ['enroll', '--hub', hubUrl, '--code', code1, '--name', 'EVIL']); } catch { reused = true; } check('a pairing code works only once', reused);
  await p.eval(`document.querySelector('md-switch[data-ro]').click()`); await p.wait(300); await clickText('New pairing code'); await p.until(`document.querySelector('.code') && document.querySelector('.code').textContent!==${JSON.stringify(code1)}`);
  const code2 = await p.eval(`return document.querySelector('.code').textContent`);
  agent(2, ['enroll', '--hub', hubUrl, '--code', code2, '--name', 'LAB-PC-07', '--read-only']);
  for (const n of [1, 2]) procs.push(spawn('node', [path.join(root, 'core/agent-cli.js'), 'run'], { env: agentEnv(n), stdio: 'ignore' }));
  await p.until(`[...document.querySelectorAll('td')].filter(x=>x.textContent.trim()==='2.5.1').length===2`, 15000);
  check('two agents enrolled and reported inventory through the bundled CLI', true); await p.shot(path.join(shots, '05-machines.png'));

  await go('overview'); await p.wait(900); check('overview counts real updates', /4 updates are ready/.test(await text()), ''); await p.shot(path.join(shots, '06-overview.png'));
  await go('installed'); await p.wait(700); await p.shot(path.join(shots, '07-installed.png'));
  // upgrade one package on BUILD-01
  await p.eval(`const card=document.querySelector('[data-machine]'); [...card.querySelectorAll('md-text-button')].find(b=>b.textContent.includes('Upgrade')).click()`);
  await p.until(`document.querySelector('.drama.ok')`, 15000); check('upgrade success takes over the screen', (await text()).includes('Upgrade complete')); await p.wait(1700); await p.shot(path.join(shots, '27-install-success-takeover.png'));
  await p.key('Escape'); await p.until(`!document.querySelector('.drama')`, 4000); check('success takeover closes with Escape', true);
  await p.eval(`const ms=await (await fetch('/api/machines')).json(); await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({machineIds:[ms[0].id],spec:{kind:'choco',command:'install',args:['no-such-package'],global:{confirm:true}}})})`);
  await p.until(`document.querySelector('.drama.err')`, 15000); await p.wait(1800); await p.shot(path.join(shots, '28-install-failure-takeover.png'));
  check('install failure takes over with exit code and output', /Install failed/.test(await text()) && /exit code 1/.test(await text()) && /not found/.test(await text()));
  await p.wait(6000); check('failure takeover stays until dismissed', await p.eval(`return !!document.querySelector('.drama.err')`));
  await p.eval(`[...document.querySelectorAll('.drama .acts button')].find(b=>b.textContent==='Close').click()`); await p.until(`!document.querySelector('.drama')`, 4000);
  await p.eval(`const ms=await (await fetch('/api/machines')).json(); await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({machineIds:[ms[0].id],spec:{kind:'choco',command:'upgrade',args:['git'],global:{confirm:true}}})})`); await p.until(`document.querySelector('.drama.ok')`, 15000); check('an install started elsewhere also gets the takeover', true); await p.key('Escape'); await p.until(`!document.querySelector('.drama')`, 4000);
  await p.until(`document.querySelector('[data-machine]').innerText.includes('2.47.1')`, 8000); check('inventory refreshes after a change', true);
  await go('jobs'); await p.eval(`[...document.querySelectorAll('.prow')].find(b=>b.textContent.includes('choco upgrade git')).click()`);
  await p.wait(900); await p.shot(path.join(shots, '08-job-success.png'));
  check('job page shows the success state with exit code', (await text()).includes('Finished with exit code 0'));
  // destructive: uninstall needs both keys and the slider
  await go('installed'); await p.wait(500);
  await p.eval(`const row=[...document.querySelectorAll('[data-machine]')][0].querySelectorAll('tbody tr')[2]; row.querySelector('md-icon-button').click()`); await p.wait(300); await p.shot(path.join(shots, '09-context-menu-with-filter.png'));
  check('row menu opens with a filter field focused', await p.eval(`return document.activeElement?.closest('.menu')!==null && document.activeElement.type==='search'`));
  await p.eval(`[...document.querySelectorAll('.menu .mi')].find(b=>b.textContent.trim()==='Uninstall').click()`); await p.wait(400);
  check('slider is locked before both keys', await p.eval(`return document.querySelector('.sheet md-slider').disabled===true`));
  await p.eval(`document.querySelectorAll('.keys button')[0].click()`); await p.wait(100); await p.shot(path.join(shots, '10-two-key-confirmation.png'));
  await p.eval(`const s=document.querySelector('.sheet md-slider'); s.value=100; s.dispatchEvent(new Event('change'))`); await p.wait(300);
  check('one key and a full slider does not confirm', await p.eval(`return !!document.querySelector('.sheet .keys')`));
  await p.eval(`document.querySelectorAll('.keys button')[1].click()`); await p.wait(100);
  await p.eval(`const s=document.querySelector('.sheet md-slider'); s.value=100; s.dispatchEvent(new Event('change'))`);
  await p.until(`document.querySelector('.toast.ok') && !document.querySelector('[data-machine]').innerText.includes('putty')`, 15000); check('uninstall runs only after both keys and the slider', true);
  // read only agent refuses
  await p.eval(`const card=[...document.querySelectorAll('[data-machine]')][1]; [...card.querySelectorAll('md-text-button')].find(b=>b.textContent.includes('Upgrade')).click()`); await p.wait(700);
  check('read only machine refuses a change', (await text()).includes('read only')); await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  // failure state
  await go('console'); await p.eval(`[...document.querySelectorAll('nav .tab')].find(b=>b.textContent.trim().startsWith('uninstall')).click()`); await p.wait(500);
  await p.eval(`const f=[...document.querySelectorAll('main md-outlined-text-field')].find(x=>x.label.startsWith('Arguments')); f.value='notinstalled'; f.dispatchEvent(new Event('input'))`); await p.wait(200);
  check('console preview shows the exact command', (await p.eval(`return document.querySelector('pre.cmd').textContent`)).startsWith('choco uninstall notinstalled'));
  await p.eval(`const boxes=document.querySelectorAll('main .card md-checkbox'); boxes[1].click()`); await p.shot(path.join(shots, '11-console-every-option.png'));
  await clickText('Run'); await p.wait(400); await p.eval(`document.querySelectorAll('.keys button').forEach(b=>b.click()); const s=document.querySelector('.sheet md-slider'); s.value=100; s.dispatchEvent(new Event('change'))`);
  await p.until(`document.querySelector('.errpanel')`, 15000); await p.wait(700); await p.shot(path.join(shots, '12-job-failed.png'));
  check('failed job shows exit code and output', /Exit code 1/.test(await text()) && /is not installed/.test(await text()));
  for (const [page, file] of [['updates', '13-updates'], ['sources', '14-sources'], ['config', '15-config-and-features'], ['pins', '16-pins'], ['help', '17-help'], ['history', '18-history'], ['schedules', '19-schedules-empty']]) { await go(page); await p.wait(800); await p.shot(path.join(shots, file + '.png')); }
  await go('config'); await p.wait(600);
  check('config page lists every CLI feature', await p.eval(`return document.querySelectorAll('[data-machine]')[0].querySelectorAll('label.opt').length`) >= 30);
  check('history records actions', /job\.create/.test(await text().then(async () => { await go('history'); await p.wait(700); return text(); })));
  // palette
  await p.key('f', { ctrl: true, shift: true }); await p.until(`document.querySelector('.palette')`); await p.type('pin'); await p.wait(400); await p.shot(path.join(shots, '20-command-palette.png'));
  check('Ctrl+Shift+F opens the palette and filters', await p.eval(`return document.querySelectorAll('.palette .prow').length`) >= 2);
  await p.key('Escape'); await p.wait(300);
  // settings, language, theme
  await go('settings'); await p.wait(500); await p.shot(path.join(shots, '21-settings-language.png'));
  await p.eval(`[...document.querySelectorAll('.seg button')].find(b=>b.textContent.trim()==='Bilingual').click()`); await p.wait(500);
  check('bilingual mode shows the Cantonese line', (await text()).includes('設定'));
  await p.eval(`[...document.querySelectorAll('md-filter-chip')].find(c=>c.label.startsWith('Appearance')).click()`); await p.wait(500);
  await p.eval(`[...document.querySelectorAll('.seg button')].find(b=>b.textContent.trim()==='Dark').click()`); await p.wait(500); await p.shot(path.join(shots, '22-settings-appearance-dark-bilingual.png'));
  check('dark theme applies', await p.eval(`return document.documentElement.dataset.theme`) === 'dark');
  await go('overview'); await p.wait(900); await p.shot(path.join(shots, '23-overview-dark-bilingual.png'));
  // personal wording validation
  const bad = await p.eval(`const m=await import('/js/pages2.js'); try{ m.validateVocabulary(JSON.stringify({schemaVersion:1,entries:{a:5}})); return 'accepted' }catch(e){ return 'refused' }`); check('invalid personal wording file is refused whole', bad === 'refused');
  // sign-in protection
  const unauth = await fetch(hubUrl + '/api/machines'); check('API refuses requests without a session', unauth.status === 401);
  const cross = await p.eval(`const r=await fetch('/api/pairing',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); return r.status`); check('same origin request with session is accepted', cross === 200);
  const forged = await fetch(hubUrl + '/agent/poll', { method: 'POST', headers: { authorization: 'Bearer nope' }, body: '{}' }); check('unknown agent token is refused', forged.status === 401);
  check('no browser console errors during the run', p.errors.length === 0, p.errors.slice(0, 3).join(' | '));
  await p.close();
  p = await launch({ width: 390, height: 844, mobile: true });
  await p.goto(hubUrl); await p.until(`document.querySelector('form')`);
  await p.eval(`const f=document.querySelectorAll('md-outlined-text-field'); f[0].value='admin'; f[1].value='correct horse battery'; document.querySelector('form').requestSubmit()`);
  await p.until(`document.querySelector('.bottomnav')`); await p.wait(400); await p.eval(`document.querySelector('.sheet') && [...document.querySelectorAll('md-outlined-button')].find(b=>b.textContent.includes('Skip')).click()`); await p.wait(1200); await p.shot(path.join(shots, '24-phone-overview.png'));
  check('phone layout has no horizontal overflow', await p.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1`));
  await p.eval(`[...document.querySelectorAll('.bottomnav button')].find(b=>b.textContent.includes('Installed')).click()`); await p.wait(900); await p.shot(path.join(shots, '25-phone-installed.png'));
} catch (e) { check('run completed', false, e.message); if (p) await p.shot(path.join(shots, 'zz-failure.png')).catch(() => {}); }
finally { if (p) await p.close().catch(() => {}); for (const c of procs) c.kill(); await new Promise((r) => setTimeout(r, 300)); fs.rmSync(tmp, { recursive: true, force: true }); }
const failed = results.filter((r) => !r.ok); console.log(`\n${results.length - failed.length} of ${results.length} checks passed`); process.exit(failed.length ? 1 : 0);
