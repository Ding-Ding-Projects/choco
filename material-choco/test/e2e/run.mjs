#!/usr/bin/env node
// End to end check: starts a real hub and two real agents (with the test fixture standing in
// for choco.exe), drives the real UI in headless Chrome, asserts outcomes and saves screenshots.
// Usage: node test/e2e/run.mjs [--shots docs/screenshots]
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { launch } from './cdp.mjs';
import { installStandIn } from '../fixtures/stand-in.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = path.resolve(root, process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : 'docs/screenshots');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-e2e-')); const port = 18000 + Math.floor(Math.random() * 1000); const hubUrl = `http://127.0.0.1:${port}`;
const bundle = path.join(tmp, 'bundle'); installStandIn(bundle);
const procs = []; const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? '  ' + detail : ''}`); };
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
  // base64 tools, QR, universal context menu
  await go('base64'); await p.eval(`const t=document.querySelector('textarea[aria-label="Plain text"]'); t.value='choco ✓'; t.oninput()`);
  check('base64 encodes UTF-8 text', await p.eval(`return document.querySelector('textarea[aria-label="Base64"]').value`) === 'Y2hvY28g4pyT');
  await p.eval(`const t=document.querySelector('textarea[aria-label="Base64"]'); t.value='!!!'; t.oninput()`); check('base64 reports invalid input instead of guessing', (await text()).includes('not valid Base64'));
  await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`); await p.wait(200); await p.shot(path.join(shots, '29-base64-tools.png'));
  await go('machines'); await clickText('New pairing code'); await p.until(`document.querySelector('.code')`); await p.eval(`document.querySelector('details.fold summary svg') && [...document.querySelectorAll('details.fold')].find(d=>d.textContent.includes('QR')).setAttribute('open','')`); await p.wait(300);
  check('pairing QR code is drawn', await p.eval(`return document.querySelector('[aria-label^="QR code"] svg path').getAttribute('d').length`) > 500); await p.eval(`document.querySelector('[aria-label^="QR code"]').scrollIntoView({block:'center'})`); await p.wait(300); await p.shot(path.join(shots, '30-pairing-qr.png')); await p.eval(`scrollTo(0,0)`);
  await p.eval(`document.querySelector('main h1').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:300,clientY:200}))`); await p.wait(300);
  check('context menu opens on an element without its own', await p.eval(`return [...document.querySelectorAll('.menu .mi')].some(b=>b.textContent.includes('Copy this text'))`)); await p.key('Escape'); await p.wait(200);
  await p.eval(`const t=document.querySelector('[data-tab="jobs"]'); t.focus(); t.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true}))`); await p.wait(500);
  check('a tab can be moved with the keyboard and the order persists', await p.eval(`const ids=[...document.querySelectorAll('[data-tab]')].map(x=>x.dataset.tab); return ids.indexOf('jobs') < ids.indexOf('console') && JSON.parse(localStorage.getItem('mc.settings.v1')).tabOrder.length>0`));
  // ---- pattern builder, shortcuts, info buttons ----
  await p.send('Page.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  await p.eval(`window.__blobs=[]; const o=URL.createObjectURL.bind(URL); URL.createObjectURL=(b)=>{ window.__blobs.push(b); return o(b); }`);
  const setField = (sel, value, ev = 'input') => p.eval(`const f=document.querySelector(${JSON.stringify(sel)}); if(!f) throw new Error('missing field ${sel.replace(/['"`]/g, '')}'); f.value=${JSON.stringify(value)}; f.dispatchEvent(new Event('${ev}',{bubbles:true}))`);
  const lastBlob = () => p.eval(`const b=window.__blobs[window.__blobs.length-1]; return b ? await b.text() : ''`);
  const confirmTwoKeys = async () => { await p.until(`document.querySelector('.sheet .keys')`); await p.eval(`document.querySelectorAll('.keys button').forEach(b=>b.click()); const s=document.querySelector('.sheet md-slider'); s.value=100; s.dispatchEvent(new Event('change'))`); await p.wait(300); };
  await go('installed'); await p.wait(500); await click('#main [data-rxopen]'); await p.until(`document.querySelector('.sheet [data-rx-pattern]')`);
  await setField('.sheet [data-rx="starts"]', 'g'); await setField('.sheet [data-rx="not"]', 'zzz'); await setField('.sheet [data-rx="own"]', 'gimp\nzzz-top'); await p.wait(300); await p.shot(path.join(shots, '31-pattern-builder.png'));
  check('pattern builder composes an anchored pattern and previews matches', await p.eval(`const hits=[...document.querySelectorAll('.sheet .rxrow')]; return document.querySelector('.sheet [data-rx-pattern]').textContent==='^(?!.*zzz)g' && /compiles/.test(document.querySelector('.sheet [data-rx-status]').textContent) && hits.some(r=>r.dataset.hit==='true' && r.textContent.includes('gimp')) && hits.some(r=>r.dataset.hit==='false' && r.textContent.includes('zzz-top'))`));
  check('pattern builder escapes special characters and compiles safely', await p.eval(`const m=await import('/js/ui.js'); const pat=m.composePattern({contains:'a.b(c', anyOf:'x+y, z'}); const r=m.matcher(pat,true); return pat==='^(?=.*(?:x\\\\+y|z))(?=.*a\\\\.b\\\\(c)' && r.ok && r.test('z a.b(c') && !r.test('z aXb(c') && m.matcher('x'.repeat(201),true).ok===false`));
  await clickText('Use this pattern'); await p.wait(900);
  check('a built pattern filters the list it was opened from', await p.eval(`const names=[...document.querySelector('[data-machine]').querySelectorAll('tbody tr td:nth-child(2)')].map(x=>x.textContent.trim()); return names.length>0 && names.every(n=>n.startsWith('g')) && document.querySelector('#main details.fold md-outlined-text-field').value==='^(?!.*zzz)g'`));
  await setField('#main details.fold md-outlined-text-field', ''); await p.wait(700);
  check('every page filter has an info button that explains it in place', await p.eval(`const b=document.querySelector('#main details.fold [data-tip]'); b.click(); const ex=document.querySelector('#main .explain.tip'); return !!ex && !ex.hidden && ex.textContent.includes('regular expression') && b.getAttribute('aria-expanded')==='true'`));
  await p.key('m', { ctrl: true, shift: true }); await p.wait(500);
  check('Ctrl+Shift+M goes to Machines', await p.eval(`return location.hash==='#machines' && document.querySelector('[data-tab="machines"]').getAttribute('aria-selected')==='true'`));
  await p.eval(`document.querySelector('main h1').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:300,clientY:200}))`); await p.wait(300);
  check('menus show the shortcuts that are registered', await p.eval(`const k=await import('/js/keys.js'); const shown=[...document.querySelectorAll('.menu .mi')].map(b=>[b.querySelector('span').textContent, b.querySelector('kbd')?.textContent]); const find=(t)=>shown.find(x=>x[0]===t)?.[1]; return find('Search everything')===k.keyOf('palette') && find('Refresh inventory')===k.keyOf('refresh') && find('Settings')===k.keyOf('settings') && find('Copy this text')===undefined`)); await p.key('Escape'); await p.wait(200);
  await go('help'); await p.wait(500);
  check('help lists every keyboard shortcut', await p.eval(`const k=await import('/js/keys.js'); const d=[...document.querySelectorAll('main details.card')].find(x=>x.querySelector('summary').textContent.includes('Keyboard shortcuts')); const keys=[...d.querySelectorAll('tbody kbd')].map(x=>x.textContent); return k.KEYS.length>=15 && keys.length===k.KEYS.length && k.KEYS.every(x=>keys.includes(x.keys))`));
  check('help has offline articles for the new tools', await p.eval(`const t=[...document.querySelectorAll('main details.card summary')].map(x=>x.textContent.trim()); return ['Base64 tools','Timed settings','Filters and the pattern builder','Bulk actions and exports'].every(a=>t.includes(a))`));
  // drag and drop reorder
  check('a tab can be moved by drag and drop', await p.eval(`const src=document.querySelector('[data-tab="pins"]'); const tgt=document.querySelector('[data-tab="overview"]'); const dt=new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt,bubbles:true})); const r=tgt.getBoundingClientRect(); const o={dataTransfer:dt,bubbles:true,cancelable:true,clientX:r.left+10,clientY:r.bottom-2}; tgt.dispatchEvent(new DragEvent('dragover',o)); tgt.dispatchEvent(new DragEvent('drop',o)); await new Promise(r=>setTimeout(r,400)); const ids=[...document.querySelectorAll('[data-tab]')].map(x=>x.dataset.tab); return ids[0]==='overview' && ids[1]==='pins'`));
  // ---- bulk actions and exports ----
  await go('machines'); await p.wait(500);
  const invBefore = await p.eval(`return (await (await fetch('/api/jobs?limit=300')).json()).filter(j=>j.kind==='inventory').length`);
  for (const i of [0, 1]) { await p.eval(`document.querySelectorAll('#main tbody md-checkbox')[${i}].click()`); await p.wait(450); } await p.until(`document.querySelector('#main .bulk')`); await p.wait(300); await p.shot(path.join(shots, '32-machines-bulk-actions.png'));
  check('machines can be selected for bulk actions', (await p.eval(`return document.querySelector('#main .bulk').innerText`)).includes('2 selected'));
  await p.eval(`[...document.querySelectorAll('#main .bulk md-filled-tonal-button')].find(b=>b.textContent.includes('Refresh inventory')).click()`); await p.wait(1200);
  check('bulk refresh queues one inventory read per selected machine', await p.eval(`return (await (await fetch('/api/jobs?limit=300')).json()).filter(j=>j.kind==='inventory').length`) === invBefore + 2);
  await click('#main [data-export="material-choco-machines"]'); await p.wait(300); await p.eval(`[...document.querySelectorAll('.menu .mi')].find(b=>b.textContent.includes('CSV')).click()`); await p.wait(400);
  const csv = await lastBlob(); check('machines export as CSV holds the selected rows', csv.includes('"Machine","Host name"') && csv.includes('"BUILD-01"') && csv.includes('"LAB-PC-07"') && csv.trim().split('\r\n').length === 3, csv.slice(0, 80));
  await click('#main [data-export="material-choco-machines"]'); await p.wait(300); await p.eval(`[...document.querySelectorAll('.menu .mi')].find(b=>b.textContent.startsWith('Markdown')).click()`); await p.wait(400);
  check('machines export as Markdown is a table', /^\| Machine \| Host name \|/.test(await lastBlob()) && (await lastBlob()).includes('| BUILD-01 |'));
  await p.eval(`[...document.querySelectorAll('#main .bulk md-text-button')].find(b=>b.textContent.includes('Clear selection')).click()`); await p.wait(400);
  await go('sources'); await p.wait(600);
  const sourceBulk = async (label) => { await p.eval(`document.querySelector('[data-machine] tbody md-checkbox').click()`); await p.until(`document.querySelector('[data-machine] .bulk')`); await p.eval(`[...document.querySelectorAll('[data-machine] .bulk md-filled-tonal-button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`); };
  await sourceBulk('Disable'); await p.until(`document.querySelector('[data-machine] tbody md-switch') && document.querySelector('[data-machine] tbody md-switch').selected===false`, 15000);
  check('bulk disable changes the selected source through a real job', await p.eval(`const ms=await (await fetch('/api/machines')).json(); return ms[0].inventory.sources[0].disabled===true`));
  await sourceBulk('Enable'); await p.until(`document.querySelector('[data-machine] tbody md-switch') && document.querySelector('[data-machine] tbody md-switch').selected===true`, 15000);
  await go('jobs'); await p.wait(600); for (const i of [0, 1]) { await p.eval(`document.querySelectorAll('#main .card md-checkbox')[${i}].click()`); await p.wait(450); } await p.until(`document.querySelector('#main .bulk')`);
  await p.eval(`[...document.querySelectorAll('#main .bulk md-filled-tonal-button')].find(b=>b.textContent.includes('Cancel selected')).click()`); await p.wait(900);
  check('bulk cancel reports the jobs it skipped and why', /2 skipped because they had already ended/.test(await text()));
  await click('#main [data-export="material-choco-jobs"]'); await p.wait(300); await p.eval(`[...document.querySelectorAll('.menu .mi')].find(b=>b.textContent.includes('JSON')).click()`); await p.wait(400);
  const jj = await lastBlob(); let jrows = []; try { jrows = JSON.parse(jj); } catch { /* reported by the check */ }
  check('jobs export as JSON follows the list', Array.isArray(jrows) && jrows.length > 5 && jrows.every((r) => 'Command' in r && 'State' in r) && jrows.some((r) => String(r.Command).startsWith('choco upgrade git')), jj.slice(0, 200));
  await go('history'); await p.wait(800); await setField('#main details.fold md-outlined-text-field', 'pairing'); await p.wait(700); await click('#main [data-export="material-choco-history"]'); await p.wait(300); await p.eval(`[...document.querySelectorAll('.menu .mi')].find(b=>b.textContent.includes('CSV')).click()`); await p.wait(500);
  const hcsv = await lastBlob(); check('history export honours the active filter', hcsv.includes('pairing') && !hcsv.includes('job.create') && hcsv.trim().split('\r\n').length >= 3);
  await setField('#main details.fold md-outlined-text-field', ''); await p.wait(500);
  // ---- settings: changelog, timed settings, logo, presets ----
  await go('settings'); await p.wait(400); const settingsTab = async (label) => { await p.eval(`[...document.querySelectorAll('md-filter-chip')].find(c=>c.label.startsWith(${JSON.stringify(label)})).click()`); await p.wait(600); };
  await settingsTab('About'); await p.until(`document.querySelector('[data-changelog] details[data-version]')`);
  const clAll = await p.eval(`return document.querySelectorAll('[data-changelog] li').length`);
  check('changelog viewer shows version sections', await p.eval(`const d=document.querySelector('[data-changelog] details[data-version]'); return /^\\d+\\.\\d+\\.\\d+/.test(d.dataset.version) && d.querySelector('summary').textContent.includes('Version ' + d.dataset.version) && document.querySelectorAll('[data-changelog] li').length>=3`));
  await setField('[data-changelog] .minifilter md-outlined-text-field', 'hub'); await p.wait(400); await p.shot(path.join(shots, '35-changelog-viewer.png'));
  check('changelog filter narrows the changes and says how many', await p.eval(`const li=[...document.querySelectorAll('[data-changelog] li')]; return li.length>0 && li.length<${clAll} && li.every(x=>/hub/i.test(x.textContent)) && document.querySelector('[data-changelog]').innerText.includes(li.length + ' of ${clAll} changes shown')`));
  await settingsTab('Timed settings');
  const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; const tNow = Date.now();
  check('timed settings start with nothing in force', (await p.eval(`return document.querySelector('[data-timed-now]').innerText`)).includes('No timed setting is replacing anything'));
  await click('[data-tkey="density"]'); await p.wait(400); await click('[data-tval="compact"]'); await p.wait(400);
  await setField('[data-time="from"]', hhmm(new Date(tNow - 60000)), 'change'); await setField('[data-time="to"]', hhmm(new Date(tNow - 60000)), 'change'); await clickText('Add rule'); await p.wait(300);
  check('a timed rule with equal start and end is refused', (await text()).includes('would never run') && await p.eval(`return document.documentElement.dataset.density`) === 'comfortable');
  await setField('[data-time="to"]', hhmm(new Date(tNow + 3 * 60000)), 'change'); await clickText('Add rule'); await p.wait(700); await p.shot(path.join(shots, '36-timed-settings.png'));
  check('an active timed rule replaces the setting without changing the stored value', await p.eval(`const st=JSON.parse(localStorage.getItem('mc.settings.v1')); return document.documentElement.dataset.density==='compact' && !('density' in st) && st.schedRules.length===1 && document.querySelector('[data-timed-now]').innerText.includes('Density') && document.querySelector('#main').innerText.includes('Active now')`));
  check('timed windows handle midnight and weekdays', await p.eval(`const m=await import('/js/settings.js'); const at=(d,h,mi)=>new Date(2026,10,d,h,mi); return m.inWindow('22:00','07:00',null,at(16,23,0)) && m.inWindow('22:00','07:00',null,at(16,6,59)) && !m.inWindow('22:00','07:00',null,at(16,7,0)) && !m.inWindow('22:00','07:00',null,at(16,12,0)) && m.inWindow('22:00','07:00',[1],at(17,3,0)) && !m.inWindow('22:00','07:00',[1],at(16,3,0)) && m.inWindow('09:00','17:00',[1],at(16,10,0)) && !m.inWindow('09:00','17:00',[2],at(16,10,0)) && !m.inWindow('09:00','09:00',null,at(16,9,0))`));
  await p.eval(`document.querySelector('#main tbody md-icon-button').click()`); await p.wait(600);
  check('deleting the rule returns the stored setting', await p.eval(`return document.documentElement.dataset.density`) === 'comfortable'); await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  await settingsTab('Appearance');
  await setField('[data-time="darkFrom"]', hhmm(new Date(tNow - 60000)), 'change'); await p.wait(300); await setField('[data-time="darkTo"]', hhmm(new Date(tNow + 5 * 60000)), 'change'); await p.wait(300); await click('[data-pal="set-schedTheme"] md-switch'); await p.wait(600);
  check('theme switches by time of day and leaves the theme choice alone', await p.eval(`const st=JSON.parse(localStorage.getItem('mc.settings.v1')); return document.documentElement.dataset.theme==='dark' && !('theme' in st) && document.querySelector('#main').innerText.includes('Right now: dark until')`));
  await click('[data-pal="set-schedTheme"] md-switch'); await p.wait(600); check('turning the theme schedule off returns the chosen theme', await p.eval(`return document.documentElement.dataset.theme === (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')`));
  const logoBad = await p.eval(`const m=await import('/js/pages2.js'); try{ await m.applyLogoFile(new File([new TextEncoder().encode('this is not a picture')],'logo.png',{type:'image/png'})); return 'accepted' }catch(e){ return e.message }`);
  check('a logo file that is not a picture is refused by its content', /not a PNG, JPEG, WebP or SVG/.test(logoBad) && await p.eval(`return localStorage.getItem('mc.logo')===null`), logoBad);
  const logoBig = await p.eval(`const m=await import('/js/pages2.js'); try{ await m.applyLogoFile(new File([new Uint8Array(300*1024)],'big.png')); return 'accepted' }catch(e){ return e.message }`); check('a logo larger than 256 KB is refused', /limit is 256 KB/.test(logoBig), logoBig);
  await p.eval(`const m=await import('/js/pages2.js'); const c=document.createElement('canvas'); c.width=c.height=96; const g=c.getContext('2d'); g.fillStyle='#1b6e5a'; g.beginPath(); g.arc(48,48,44,0,7); g.fill(); g.fillStyle='#fff'; g.fillRect(28,40,40,16); const blob=await new Promise(r=>c.toBlob(r,'image/png')); await m.applyLogoFile(new File([blob],'wrong-name.txt'))`);
  await go('overview'); await p.wait(400); await go('settings'); await p.wait(600);
  check('an uploaded logo is shown in the top bar from local storage', await p.eval(`const i=document.querySelector('.topbar .mark img'); return !!i && i.src.startsWith('data:image/png;base64,') && i.naturalWidth===96 && localStorage.getItem('mc.logo')===i.src`));
  await click('[data-look="Mint"]'); await p.wait(600); await p.shot(path.join(shots, '37-settings-logo-presets-timed-theme.png'));
  check('a preset writes exactly the settings it names', await p.eval(`const st=JSON.parse(localStorage.getItem('mc.settings.v1')); return st.hue===160 && st.chroma===1.1 && !('theme' in st) && document.querySelector('[data-look="Mint"]').getAttribute('aria-pressed')==='true'`));
  await p.eval(`[...document.querySelectorAll('.toast button')].find(b=>b.textContent.trim()==='Undo').click()`); await p.wait(500);
  check('undo after a preset restores the earlier values', await p.eval(`const st=JSON.parse(localStorage.getItem('mc.settings.v1')); return !('hue' in st) && !('chroma' in st)`));
  await clickText('Reset to the built-in mark'); await p.wait(600); check('logo reset brings the built-in mark back', await p.eval(`return !document.querySelector('.topbar .mark img') && !!document.querySelector('.topbar .mark svg') && localStorage.getItem('mc.logo')===null`));
  await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`); await settingsTab('Language');
  // ---- command allow list, users and roles, webhooks (hub administration) ----
  const menuItem = (label) => p.eval(`const b=[...document.querySelectorAll('.menu .mi')].find(x=>x.textContent.trim().startsWith(${JSON.stringify(label)})); if(!b) throw new Error('no menu item ${label}'); b.click()`);
  await go('machines'); await p.wait(500); await p.eval(`document.querySelector('#main tbody tr md-icon-button').click()`); await p.wait(300); await menuItem('Rename, groups, policy'); await p.until(`document.querySelector('.sheet [data-allow-mode]')`);
  check('the machine dialog shows the agent list as read only text', await p.eval(`const a=document.querySelector('.sheet [data-agent-allow]'); return a.tagName==='P' && a.textContent.includes('no list of its own') && document.querySelector('.sheet [data-allow-chips]').hidden===true`));
  await click('.sheet [data-allow-mode="true"]'); await p.wait(300); await p.eval(`document.querySelector('.sheet [data-allow="upgrade"]').shadowRoot.querySelector('button').click()`); await p.wait(400); check('unticking a command updates the count', (await p.eval(`return document.querySelector('.sheet').innerText`)).includes('22 of 23 commands allowed')); await p.shot(path.join(shots, '40-machine-allowed-commands.png'));
  await clickText('Save'); await p.until(`!document.querySelector('.sheet')`); await p.wait(500);
  const allow = await p.eval(`const ms=await (await fetch('/api/machines')).json(); const m=ms.find(x=>x.name==='BUILD-01'); const r=await (await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({machineIds:[m.id],spec:{kind:'choco',command:'upgrade',args:['git'],global:{confirm:true}}})})).json(); const ok=await (await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({machineIds:[m.id],spec:{kind:'choco',command:'list',args:[]}})})).json(); return { list:m.allowedCommands, skipped:r.skipped, made:r.jobs.length, listMade:ok.jobs.length }`);
  check('the allow list set in the dialog stops a command outside it and lets others through', Array.isArray(allow.list) && !allow.list.includes('upgrade') && allow.list.includes('list') && allow.made === 0 && allow.skipped.length === 1 && allow.listMade === 1, JSON.stringify(allow).slice(0, 200));
  await go('installed'); await p.wait(600); await p.eval(`const card=document.querySelector('[data-machine]'); [...card.querySelectorAll('md-text-button')].find(b=>b.textContent.includes('Upgrade')).click()`); await p.wait(800);
  check('the interface reports why a machine was skipped', await p.eval(`return [...document.querySelectorAll('.toast.err')].some(t=>t.textContent.includes('BUILD-01') && /allow/i.test(t.textContent))`), (await p.eval(`return [...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')`)).slice(0, 200));
  await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  await go('machines'); await p.wait(500); await p.eval(`document.querySelector('#main tbody tr md-icon-button').click()`); await p.wait(300); await menuItem('Rename, groups, policy'); await p.until(`document.querySelector('.sheet [data-allow-mode]')`); await click('.sheet [data-allow-mode="false"]'); await p.wait(200); await clickText('Save'); await p.until(`!document.querySelector('.sheet')`); await p.wait(400);
  check('choosing every command removes the restriction', await p.eval(`const ms=await (await fetch('/api/machines')).json(); return ms.find(x=>x.name==='BUILD-01').allowedCommands`) === null);
  await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  check('an admin sees the role in the top bar and the admin pages', await p.eval(`return document.querySelector('.topbar [data-role="admin"]').textContent.includes('Admin') && !!document.querySelector('[data-tab="users"]') && !!document.querySelector('[data-tab="webhooks"]')`));
  await go('users'); await p.until(`document.querySelector('[data-user-row="admin"]')`);
  const addUser = async (name, role, password) => { await clickText('Add a user'); await p.until(`document.querySelector('.sheet [data-user="name"]')`); await setField('.sheet [data-user="name"]', name); await click(`.sheet [data-role="${role}"]`); await setField('.sheet [data-user="password"]', password); await clickText('Add user'); await p.wait(700); };
  await addUser('olive', 'operator', 'short'); check('adding a user with a short password shows the hub message and adds nothing', await p.eval(`return !!document.querySelector('.sheet [data-user="name"]') && document.querySelector('.sheet [role="alert"]').textContent.length>5 && !document.querySelector('[data-user-row="olive"]')`)); await p.key('Escape'); await p.wait(300);
  await addUser('olive', 'operator', 'olive operator 1'); await addUser('vera', 'viewer', 'vera the viewer 1'); await p.until(`document.querySelector('[data-user-row="vera"]') && document.querySelector('[data-user-row="olive"]')`);
  check('users are added with their roles through the Users page', await p.eval(`const u=await (await fetch('/api/users')).json(); const r=Object.fromEntries(u.map(x=>[x.name,x.role])); return r.olive==='operator' && r.vera==='viewer' && r.admin==='admin'`));
  await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`); await p.wait(200); await p.shot(path.join(shots, '41-users-and-roles.png'));
  await p.eval(`document.querySelector('[data-user-row="admin"]').closest('tr').querySelector('[data-role="viewer"]').click()`); await p.wait(900);
  check('the last admin is protected and the refusal is shown', await p.eval(`const u=await (await fetch('/api/users')).json(); return u.find(x=>x.name==='admin').role==='admin' && document.querySelectorAll('.toast.err').length>0 && document.querySelector('#main').innerText.includes('The last admin is protected') && document.querySelector('[data-user-row="admin"]').closest('tr').querySelector('[data-role="admin"]').getAttribute('aria-pressed')==='true'`));
  await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  const hooks = []; const receiver = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { hooks.push({ url: req.url, body: b }); res.writeHead(204); res.end(); }); }); await new Promise((r) => receiver.listen(0, '127.0.0.1', r)); const hookPort = receiver.address().port;
  await go('webhooks'); await p.wait(600); check('webhooks start empty and say so', (await text()).includes('No webhooks yet'));
  const addHook = async (name, url) => { await clickText('Add a webhook'); await p.until(`document.querySelector('.sheet [data-hook="name"]')`); await setField('.sheet [data-hook="name"]', name); await setField('.sheet [data-hook="url"]', url); await clickText('Save'); await p.wait(700); };
  await addHook('Plain', 'http://example.com/hook'); check('a plain HTTP address that is not local is refused with the hub message', await p.eval(`return !!document.querySelector('.sheet [data-hook="name"]') && document.querySelector('.sheet [role="alert"]').textContent.length>5`)); await p.key('Escape'); await p.wait(300);
  await addHook('Ops log', `http://127.0.0.1:${hookPort}/hook`); await p.until(`document.querySelector('[data-hook-row="Ops log"]')`);
  await p.eval(`[...document.querySelector('[data-hook-row="Ops log"]').closest('tr').querySelectorAll('md-text-button')].find(b=>b.textContent.includes('Send test')).click()`); await p.until(`document.querySelector('[data-hook-result]')`, 15000);
  let sent = null; try { sent = JSON.parse(hooks[0]?.body || 'null'); } catch { /* reported below */ }
  check('Send test delivers a real message and shows the receiver status', hooks.length === 1 && hooks[0].url === '/hook' && sent?.event === 'test' && await p.eval(`const r=document.querySelector('[data-hook-result]'); return r.dataset.hookResult==='ok' && r.textContent.includes('204')`), JSON.stringify(hooks).slice(0, 200));
  await new Promise((r) => receiver.close(r)); receiver.closeAllConnections?.();
  await p.eval(`[...document.querySelector('[data-hook-row="Ops log"]').closest('tr').querySelectorAll('md-text-button')].find(b=>b.textContent.includes('Send test')).click()`); await p.until(`document.querySelector('[data-hook-result="failed"]')`, 30000);
  check('a failed test delivery is shown as failed', await p.eval(`return document.querySelector('[data-hook-result="failed"]').textContent.includes('Test failed')`)); await p.wait(300); await p.shot(path.join(shots, '42-status-webhooks.png'));
  await p.eval(`document.querySelector('[data-hook-row="Ops log"]').closest('tr').querySelector('md-switch').click()`); await p.wait(600);
  check('the enable switch changes the webhook on the hub', await p.eval(`const r=await (await fetch('/api/webhooks')).json(); return r.webhooks[0].enabled===false && r.webhooks[0].name==='Ops log'`));
  // ---- personal wording reaches error surfaces, and never rewrites technical text ----
  const failInstall = () => p.eval(`const ms=await (await fetch('/api/machines')).json(); await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({machineIds:[ms.find(m=>m.name==='BUILD-01').id],spec:{kind:'choco',command:'install',args:['no-such-package'],global:{confirm:true}}})})`);
  const takeover = () => p.eval(`const d=document.querySelector('.drama.err'); return { big:d.querySelector('.big').textContent, sub:d.querySelector('.sub').textContent, what:d.querySelector('.what').textContent, out:d.querySelector('pre').textContent }`);
  await p.eval(`const m=await import('/js/pages2.js'); m.applyVocabularyFile(JSON.stringify({schemaVersion:1,name:'Test words',entries:{failed:'flumped',machine:'contraption',found:'spotted',install:'plonk',over:'sideways'}}))`); await p.wait(4200);
  await failInstall(); await p.until(`document.querySelector('.drama.err pre')`, 15000); await p.wait(1800); const tk = await takeover(); await p.shot(path.join(shots, '46-personal-wording-on-failure-takeover.png'));
  check('personal wording replaces the takeover headline and detail', tk.big.includes('flumped') && !/failed/i.test(tk.big) && tk.sub.includes('contraption') && !/\bmachine\b/.test(tk.sub) && tk.sub.includes('BUILD-01') && tk.sub.includes('exit code 1'), JSON.stringify(tk).slice(0, 300));
  check('personal wording leaves the command line and the output as they are', tk.what.startsWith('choco install no-such-package') && !tk.what.includes('plonk') && tk.out.includes('not found') && !tk.out.includes('spotted'), JSON.stringify(tk).slice(0, 300));
  await p.eval(`[...document.querySelectorAll('.drama .acts button')].pop().click()`); await p.until(`!document.querySelector('.drama')`, 4000);
  await go('console'); await p.wait(500); await p.eval(`[...document.querySelectorAll('nav .tab')].find(b=>b.textContent.trim().startsWith('uninstall')).click()`); await p.wait(500);
  await p.eval(`const f=[...document.querySelectorAll('main md-outlined-text-field')].find(x=>x.label.startsWith('Arguments')); f.value='notinstalled'; f.dispatchEvent(new Event('input'))`); await p.wait(200); await clickText('Run'); await confirmTwoKeys(); await p.until(`document.querySelector('.errpanel') && document.querySelector('.toast.err')`, 15000); await p.wait(500);
  check('personal wording reaches error notifications and error panels, with the command intact', await p.eval(`const toast=[...document.querySelectorAll('.toast.err')].map(x=>x.textContent).join(' '); const panel=document.querySelector('.errpanel').innerText; return toast.includes('fell sideways') && toast.includes('choco uninstall notinstalled') && panel.includes('flumped on BUILD-01') && document.querySelector('pre.cmd').textContent.startsWith('choco uninstall notinstalled')`), (await p.eval(`return [...document.querySelectorAll('.toast.err')].map(x=>x.textContent).join(' ') + ' // ' + document.querySelector('.errpanel').innerText`)).slice(0, 300));
  await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click()); document.querySelector('md-icon-button[data-aria-label="Notifications"], md-icon-button[aria-label="Notifications"], md-icon-button[title="Notifications"]').click()`); await p.until(`document.querySelector('.sheet')`);
  check('the notification centre shows the replaced wording', (await p.eval(`return document.querySelector('.sheet').innerText`)).includes('fell sideways')); await p.eval(`document.querySelector('.sheet md-icon-button[title="Close"]').click()`); await p.until(`!document.querySelector('.sheet')`);
  check('school mode suspends the wording file', await p.eval(`const s=await import('/js/settings.js'); const i=await import('/js/i18n.js'); s.settings.school=true; const a=i.say('The machine failed'); s.resetSetting('school'); const b=i.say('The machine failed again'); return a==='The machine failed' && b==='The contraption flumped again'`));
  await go('settings'); await p.until(`[...document.querySelectorAll('#main md-text-button')].some(b=>b.textContent.trim()==='Clear')`); await p.eval(`[...document.querySelectorAll('#main md-text-button')].find(b=>b.textContent.trim()==='Clear').click()`); await p.wait(600);
  await failInstall(); await p.until(`document.querySelector('.drama.err pre')`, 15000); await p.wait(1500); const tk2 = await takeover();
  check('clearing the wording file restores the original wording', tk2.big.includes('Install failed') && tk2.sub.includes('machine') && !tk2.sub.includes('contraption'), JSON.stringify(tk2).slice(0, 300));
  await p.eval(`[...document.querySelectorAll('.drama .acts button')].pop().click()`); await p.until(`!document.querySelector('.drama')`, 4000); await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  // ---- copy button on every code block ----
  await p.eval(`window.__copied=[]; Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async(t)=>{ window.__copied.push(t); }})`);
  await go('console'); await p.wait(600);
  check('a code block has an icon-only copy button that adds no text to the block', await p.eval(`const pre=document.querySelector('#main pre.cmd'); const b=pre.firstElementChild; return b.tagName==='BUTTON' && b.classList.contains('precopy') && b.getAttribute('aria-label')==='Copy this block' && b.textContent==='' && !!b.querySelector('svg') && b.offsetWidth>=44 && b.offsetHeight>=44 && pre.textContent.startsWith('choco ') && pre.querySelectorAll('.precopy').length===1`), await p.eval(`const pre=document.querySelector('#main pre.cmd'); const b=pre.firstElementChild; const r=b.getBoundingClientRect(); return [b.tagName,b.className,b.getAttribute('aria-label'),JSON.stringify(b.textContent),r.width,r.height,pre.textContent.slice(0,20)].join(' / ')`));
  await p.eval(`document.querySelector('#main pre.cmd .precopy').click()`); await p.wait(300);
  check('the copy button copies exactly the block text and confirms it', await p.eval(`const pre=document.querySelector('#main pre.cmd'); const b=pre.firstElementChild; const live=[...document.querySelectorAll('[aria-live="polite"]')].map(x=>x.textContent).join(' '); return window.__copied.length===1 && window.__copied[0]===pre.textContent && b.classList.contains('done') && getComputedStyle(b,'::before').content.includes('Copied') && live.includes('Copied')`));
  await go('help'); await p.wait(600); check('every code block on a page has exactly one copy button', await p.eval(`const pres=[...document.querySelectorAll('#main pre')]; return pres.length>=20 && pres.every(x=>x.querySelectorAll(':scope > .precopy').length===1 && x.firstChild.classList.contains('precopy'))`));
  await go('jobs'); await p.wait(900);
  const logKept = await p.eval(`const pre=document.querySelector('#main pre[aria-label="Job output"]'); const id=Number(/Job (\\d+)/.exec(document.querySelector('#main h2').textContent)[1]); const before=pre.textContent; document.dispatchEvent(new CustomEvent('mc-output',{detail:{id,chunk:'late line one\\n'}})); document.dispatchEvent(new CustomEvent('mc-output',{detail:{id,chunk:'late line two\\n'}})); await new Promise(r=>setTimeout(r,200)); const ok1=pre.textContent===before+'late line one\\nlate line two\\n' && pre.querySelectorAll('.precopy').length===1 && pre.firstChild.classList.contains('precopy'); pre.firstChild.click(); await new Promise(r=>setTimeout(r,200)); const ok2=window.__copied[window.__copied.length-1]===pre.textContent; pre.textContent='rewritten'; await new Promise(r=>setTimeout(r,200)); const ok3=pre.textContent==='rewritten' && pre.querySelectorAll('.precopy').length===1 && pre.firstChild.classList.contains('precopy'); return [before.length>0, ok1, ok2, ok3]`);
  check('the job log keeps its copy button after new output arrives and after it is rewritten', logKept.every(Boolean), JSON.stringify(logKept));
  // ---- translations for the new surfaces ----
  const sentences = new Set(); for (const f of fs.readdirSync(path.join(root, 'ui/js'))) { const src = fs.readFileSync(path.join(root, 'ui/js', f), 'utf8'); for (const m of src.matchAll(/\btx2?\(\s*'((?:[^'\\]|\\.)*)'/g)) sentences.add(m[1].replace(/\\'/g, "'")); }
  const untranslated = await p.eval(`const m=await import('/js/i18n.js'); return m.missingCantonese(${JSON.stringify([...sentences])})`);
  check('every sentence passed to the translation helper has a Cantonese entry', sentences.size > 250 && untranslated.length === 0, `${sentences.size} sentences, missing: ${untranslated.slice(0, 3).join(' | ')}`);
  await p.eval(`const m=await import('/js/settings.js'); m.settings.lang='yue'`); await go('base64'); await p.wait(500);
  check('Cantonese mode translates a new page', await p.eval(`const t=document.querySelector('#main').innerText; return t.includes('只會喺呢個瀏覽器入面執行') && t.includes('URL 安全字母表') && document.querySelector('textarea[aria-label="Plain text"]').placeholder==='喺呢度打字或者貼上文字'`));
  await p.shot(path.join(shots, '39-base64-cantonese.png'));
  check('playful wording changes the voice and keeps the facts', await p.eval(`const s=await import('/js/settings.js'); const i=await import('/js/i18n.js'); const out={}; for (const lang of ['en','yue']) { s.settings.lang=lang; for (const lvl of [1,5]) { s.settings.funnyEn=lvl; s.settings.funnyYue=lvl; out[lang+lvl]=i.tx('Exported {n} rows as {f}',{n:37,f:'CSV'}); } } s.resetSetting('funnyEn'); s.resetSetting('funnyYue'); s.resetSetting('lang'); return out.en1!==out.en5 && out.yue1!==out.yue5 && Object.values(out).every(v=>v.includes('37') && v.includes('CSV')) && out.en1==='Exported 37 rows as CSV'`));
  await p.wait(400);
  // palette
  await p.key('f', { ctrl: true, shift: true }); await p.until(`document.querySelector('.palette')`); await p.type('pin'); await p.wait(400); await p.shot(path.join(shots, '20-command-palette.png'));
  check('Ctrl+Shift+F opens the palette and filters', await p.eval(`return document.querySelectorAll('.palette .prow').length`) >= 2);
  await click('.palette [data-rxopen]'); await p.until(`document.querySelector('.sheet [data-rx="anyOf"]')`); await setField('.sheet [data-rx="anyOf"]', 'Pins, Updates'); await setField('.sheet [data-rx="ends"]', 'Page'); await p.wait(300); await clickText('Use this pattern'); await p.wait(500);
  check('the palette has its own pattern builder', await p.eval(`const rows=[...document.querySelectorAll('.palette .prow .t1')].map(x=>x.textContent); return document.querySelector('.palette input').value==='^(?=.*(?:Pins|Updates)).*Page$' && rows.includes('Pins') && rows.includes('Updates') && !rows.includes('Overview')`));
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
  await p.close();
  // ---- roles in their own browser sessions ----
  const signIn = async (base, name, password) => { p = await launch(); await p.goto(base); await p.until(`document.querySelector('form')`); const noKey = await p.eval(`return !document.querySelector('[data-passkey]')`); await p.eval(`const f=document.querySelectorAll('md-outlined-text-field'); f[0].value=${JSON.stringify(name)}; f[1].value=${JSON.stringify(password)}; document.querySelector('form').requestSubmit()`); await p.until(`document.querySelector('.topbar')`); await p.wait(500); await p.eval(`document.querySelector('.sheet') && [...document.querySelectorAll('md-outlined-button')].find(b=>b.textContent.includes('Skip')).click()`); await p.wait(400); return noKey; };
  const status = (method, url, body) => p.eval(`return (await fetch(${JSON.stringify(url)},{method:${JSON.stringify(method)},headers:{'content-type':'application/json'},body:${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'}})).status`);
  const noKeyOnIp = await signIn(hubUrl, 'olive', 'olive operator 1');
  check('the passkey button is hidden where passkeys cannot work', noKeyOnIp);
  check('an operator sees the role and no admin pages', await p.eval(`return document.querySelector('.topbar [data-role="operator"]').textContent.includes('Operator') && !document.querySelector('[data-tab="users"]') && !document.querySelector('[data-tab="webhooks"]')`));
  await p.eval(`document.querySelector('[data-tab="machines"]').click()`); await p.wait(700); await p.eval(`document.querySelector('#main tbody tr md-icon-button').click()`); await p.wait(300);
  check('an operator can pair and rename but is not offered removal or policy', await p.eval(`const items=[...document.querySelectorAll('.menu .mi')].map(b=>b.textContent.trim()); return !!document.querySelector('[data-pairing]') && items.includes('Rename and groups') && !items.some(x=>x.includes('Remove from hub')) && !items.some(x=>x.includes('policy'))`));
  await p.eval(`[...document.querySelectorAll('.menu .mi')].find(b=>b.textContent.trim()==='Rename and groups').click()`); await p.until(`document.querySelector('.sheet [data-allow-readonly]')`);
  check('an operator sees the allow list read only and a locked read only switch', await p.eval(`return !document.querySelector('.sheet [data-allow-mode]') && document.querySelector('.sheet md-switch').disabled===true`)); await clickText('Cancel'); await p.until(`!document.querySelector('.sheet')`); await p.wait(300);
  for (const i of [0, 1]) { await p.eval(`document.querySelectorAll('#main tbody md-checkbox')[${i}].click()`); await p.wait(450); } await p.until(`document.querySelector('#main .bulk')`);
  check('operator bulk actions leave out policy and removal', await p.eval(`const t=document.querySelector('#main .bulk').innerText; return t.includes('Refresh inventory') && t.includes('Upgrade everything') && !t.includes('Make read only') && !t.includes('Remove from hub')`));
  const mid = await p.eval(`return (await (await fetch('/api/machines')).json())[0].id`);
  check('the hub answers 403 to an operator for admin actions', (await status('DELETE', '/api/machines/' + mid)) === 403 && (await status('GET', '/api/users')) === 403 && (await status('GET', '/api/webhooks')) === 403 && (await status('PATCH', '/api/machines/' + mid, { allowedCommands: ['list'] })) === 403 && (await status('POST', '/api/pairing', {})) === 200);
  check('no browser console errors in the operator run', p.errors.length === 0, p.errors.slice(0, 3).join(' | ')); await p.close();
  await signIn(hubUrl, 'vera', 'vera the viewer 1');
  check('a viewer sees the role and no admin pages', await p.eval(`return document.querySelector('.topbar [data-role="viewer"]').textContent.includes('Viewer') && !document.querySelector('[data-tab="users"]') && !document.querySelector('[data-tab="webhooks"]')`));
  await p.eval(`document.querySelector('[data-tab="installed"]').click()`); await p.wait(900); await p.shot(path.join(shots, '43-viewer-installed.png'));
  check('a viewer is not offered upgrade, import or uninstall on Installed', await p.eval(`const m=document.querySelector('#main'); const labels=[...m.querySelectorAll('md-text-button, md-filled-button, md-filled-tonal-button, md-outlined-button')].map(b=>b.textContent.trim()); return !!m.querySelector('[data-viewer-note]') && m.querySelectorAll('tbody tr').length>0 && !labels.some(l=>/^Upgrade|Import|Uninstall|^Pin/.test(l))`));
  await p.eval(`document.querySelector('#main tbody tr md-icon-button').click()`); await p.wait(300);
  check('the viewer row menu holds only read actions', await p.eval(`const items=[...document.querySelectorAll('.menu .mi')].map(b=>b.textContent.trim()); return items.length===2 && items.includes('Package information') && items.includes('Copy package id')`)); await p.key('Escape'); await p.wait(200);
  await p.eval(`document.querySelector('[data-tab="machines"]').click()`); await p.wait(700);
  check('a viewer is not offered pairing or machine edits', await p.eval(`document.querySelector('#main tbody tr md-icon-button').click(); await new Promise(r=>setTimeout(r,300)); const items=[...document.querySelectorAll('.menu .mi')].map(b=>b.textContent.trim()); return !!document.querySelector('[data-no-pairing]') && !document.querySelector('[data-pairing]') && !items.some(x=>/Rename|Remove/.test(x)) && items.includes('Refresh inventory')`)); await p.key('Escape'); await p.wait(200);
  await p.eval(`document.querySelector('[data-tab="schedules"]').click()`); await p.wait(700);
  check('a viewer is not offered schedule edits', await p.eval(`return ![...document.querySelectorAll('#main md-filled-button')].some(b=>b.textContent.includes('New schedule')) && !document.querySelector('#main md-icon-button[aria-label^="Delete schedule"], #main md-icon-button[data-aria-label^="Delete schedule"]')`));
  await p.eval(`document.querySelector('[data-tab="console"]').click()`); await p.wait(600); await p.eval(`[...document.querySelectorAll('nav .tab')].find(b=>b.textContent.trim().startsWith('upgrade')).click()`); await p.wait(500); const jobsBefore = await p.eval(`return (await (await fetch('/api/jobs?limit=300')).json()).length`); await p.eval(`[...document.querySelectorAll('#main md-filled-button')].find(b=>b.textContent.includes('Run')).click()`); await p.wait(700);
  check('a viewer who presses Run on a changing command is told why nothing ran', (await text()).includes('Your role is Viewer') && await p.eval(`return (await (await fetch('/api/jobs?limit=300')).json()).length`) === jobsBefore && !(await p.eval(`return !!document.querySelector('.sheet .keys')`)));
  check('the hub answers 403 to a viewer for changes and accepts a plain query', (await status('POST', '/api/pairing', {})) === 403 && (await status('POST', '/api/jobs', { machineIds: [mid], spec: { kind: 'choco', command: 'upgrade', args: ['git'] } })) === 403 && (await status('POST', '/api/schedules', { name: 'x', time: '03:00', spec: { kind: 'inventory' }, target: { all: true } })) === 403 && (await status('PATCH', '/api/machines/' + mid, { name: 'x' })) === 403 && (await status('POST', '/api/jobs', { machineIds: [mid], spec: { kind: 'choco', command: 'list', args: [] } })) === 200);
  check('no browser console errors in the viewer run', p.errors.length === 0, p.errors.slice(0, 3).join(' | ')); await p.close();
  // ---- passkeys with the virtual passkey device of Chrome, on a host name ----
  let passkeyNote = '';
  try {
    const local = `http://localhost:${port}`; const keyOk = !(await signIn(local, 'admin', 'correct horse battery')); await p.eval(`await fetch('/api/logout',{method:'POST'})`); await p.goto(local); await p.until(`document.querySelector('form')`);
    check('the sign-in screen offers a passkey first on a host name, with the password below', keyOk && await p.eval(`const f=document.querySelector('form'); const k=f.querySelector('[data-passkey]'); const fields=f.querySelectorAll('md-outlined-text-field'); return !!k && k.textContent.includes('Use a passkey') && (k.compareDocumentPosition(fields[0]) & Node.DOCUMENT_POSITION_FOLLOWING)>0 && f.innerText.includes('or use your password')`)); await p.shot(path.join(shots, '44-sign-in-with-passkey.png'));
    await p.eval(`const f=document.querySelectorAll('md-outlined-text-field'); f[0].value='admin'; f[1].value='correct horse battery'; document.querySelector('form').requestSubmit()`); await p.until(`document.querySelector('.topbar')`); await p.wait(500);
    await p.send('WebAuthn.enable'); await p.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await p.eval(`document.querySelector('[data-tab="settings"]').click()`); await p.wait(500); await p.eval(`[...document.querySelectorAll('md-filter-chip')].find(c=>c.label.startsWith('Sign in')).click()`); await p.until(`document.querySelector('[data-pk="password"]')`);
    check('the account area shows the role', await p.eval(`return document.querySelector('[data-account-role="admin"]').textContent.includes('Role: Admin')`));
    await p.eval(`document.querySelector('[data-pk="password"]').value='wrong password 123'; document.querySelector('[data-pk="name"]').value='Test key'; [...document.querySelectorAll('[data-passkeys] md-filled-tonal-button')].find(b=>b.textContent.includes('Add a passkey')).click()`); await p.wait(900);
    check('adding a passkey needs the current password', await p.eval(`return document.querySelector('[data-passkeys] [role="alert"]').textContent.includes('not added') && (await (await fetch('/api/account/passkeys')).json()).length===0`));
    await p.eval(`document.querySelector('[data-pk="password"]').value='correct horse battery'; [...document.querySelectorAll('[data-passkeys] md-filled-tonal-button')].find(b=>b.textContent.includes('Add a passkey')).click()`); await p.until(`document.querySelector('[data-passkeys] tbody tr')`, 15000);
    check('a passkey is added and listed with its name', await p.eval(`const l=await (await fetch('/api/account/passkeys')).json(); return l.length===1 && l[0].name==='Test key' && document.querySelector('[data-passkeys] tbody').innerText.includes('Test key')`)); await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`); await p.wait(300); await p.shot(path.join(shots, '45-settings-passkeys.png'));
    await p.eval(`await fetch('/api/logout',{method:'POST'})`); await p.goto(local); await p.until(`document.querySelector('[data-passkey]')`); await click('[data-passkey]'); await p.until(`document.querySelector('.topbar')`, 15000);
    check('Use a passkey signs in without the password', await p.eval(`const s=await (await fetch('/api/status')).json(); return s.authenticated===true && s.user==='admin'`));
    await p.eval(`document.querySelector('[data-tab="settings"]').click()`); await p.wait(500); await p.eval(`[...document.querySelectorAll('md-filter-chip')].find(c=>c.label.startsWith('Sign in')).click()`); await p.until(`document.querySelector('[data-passkeys] tbody tr')`);
    await p.eval(`document.querySelector('[data-passkeys] tbody md-icon-button').click()`); await p.until(`document.querySelector('.sheet .keys')`); await p.eval(`document.querySelectorAll('.keys button').forEach(b=>b.click()); const sl=document.querySelector('.sheet md-slider'); sl.value=100; sl.dispatchEvent(new Event('change'))`); await p.until(`!document.querySelector('[data-passkeys] tbody tr')`, 8000);
    check('a passkey is deleted after the two key confirmation', await p.eval(`return (await (await fetch('/api/account/passkeys')).json()).length`) === 0);
    check('no browser console errors in the passkey run', p.errors.length === 0, p.errors.slice(0, 3).join(' | '));
  } catch (e) { passkeyNote = e.message; check('passkey flow ran with the virtual passkey device', false, e.message); if (p) await p.shot(path.join(shots, 'zz-failure.png')).catch(() => {}); }
  await p.close();
  // desktop bridge stand-in: only the update events and the restart call, to check the notice
  p = await launch(); await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.desktop={ isDesktop:true, win(){}, onUpdate(fn){ window.__onUpdate=fn; }, restartToUpdate(){ window.__restarted=true; }, agent:{ status: async()=>({}) } };` });
  await p.goto(hubUrl); await p.until(`document.querySelector('form')`);
  await p.eval(`const f=document.querySelectorAll('md-outlined-text-field'); f[0].value='admin'; f[1].value='correct horse battery'; document.querySelector('form').requestSubmit()`); await p.until(`document.querySelector('.topbar')`); await p.wait(500); await p.eval(`document.querySelector('.sheet') && [...document.querySelectorAll('md-outlined-button')].find(b=>b.textContent.includes('Skip')).click()`); await p.wait(400);
  await p.eval(`window.__onUpdate({ state:'ready', version:'9.9.9' })`); await p.wait(500); await p.shot(path.join(shots, '38-update-downloaded-notice.png'));
  check('a downloaded update is announced as not code signed', await p.eval(`const t=[...document.querySelectorAll('.toast')].find(x=>x.textContent.includes('9.9.9')); return !!t && t.textContent.includes('not code signed') && [...t.querySelectorAll('button')].some(b=>b.textContent.trim()==='Restart')`));
  await p.eval(`[...document.querySelectorAll('.toast button')].find(b=>b.textContent.trim()==='Restart').click()`); check('Restart asks the desktop app to restart into the update', await p.eval(`return window.__restarted===true`));
  check('no browser console errors in the desktop stand-in run', p.errors.length === 0, p.errors.slice(0, 3).join(' | '));
} catch (e) { check('run completed', false, e.message); if (p) await p.shot(path.join(shots, 'zz-failure.png')).catch(() => {}); }
finally { if (p) await p.close().catch(() => {}); for (const c of procs) c.kill(); await new Promise((r) => setTimeout(r, 300)); fs.rmSync(tmp, { recursive: true, force: true }); }
const failed = results.filter((r) => !r.ok); console.log(`\n${results.length - failed.length} of ${results.length} checks passed`); process.exit(failed.length ? 1 : 0);
