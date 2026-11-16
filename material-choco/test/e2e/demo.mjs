#!/usr/bin/env node
// Check of the in-browser demo (ui/demo.html). No hub and no agent are started: the ui folder is
// served as static files under a sub-path, the way the public site serves it, and the demo is
// driven in headless Chrome. Usage: node test/e2e/demo.mjs [--shots docs/screenshots]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); const ui = path.join(root, 'ui');
const shots = path.resolve(root, process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : 'docs/screenshots');
const PREFIX = '/choco/demo/'; const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const results = []; const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? '  ' + detail : ''}`); };
const outside = []; // requests the static server received that are not files of the demo
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); const rel = url.pathname.startsWith(PREFIX) ? decodeURIComponent(url.pathname.slice(PREFIX.length)) : null; const file = rel === null ? null : path.join(ui, rel);
  if (!file || !file.startsWith(ui + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { outside.push(`${req.method} ${req.url}`); res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}${PREFIX}`;
let p; const requested = [];
const open = async (opts) => { p = await launch(opts); await p.send('Network.enable'); p.on((m) => { if (m.method === 'Network.requestWillBeSent') requested.push(m.params.request.url); if (m.method === 'Network.webSocketCreated') requested.push(m.params.url); }); await p.goto(base + 'demo.html'); await p.until(`document.querySelector('.topbar')`, 15000); await p.wait(500); await p.eval(`document.querySelector('.sheet') && [...document.querySelectorAll('md-outlined-button')].find(b=>b.textContent.includes('Skip')).click()`); await p.wait(500); };
try {
  await open();
  const text = () => p.eval('return document.body.innerText'); const go = (page) => p.eval(`document.querySelector('[data-tab="${page}"]').click()`).then(() => p.wait(600));
  const clickText = (label, tag = 'md-filled-button,md-filled-tonal-button,md-outlined-button,md-text-button,button') => p.eval(`const e=[...document.querySelectorAll(${JSON.stringify(tag)})].filter(x=>x.offsetParent!==null).find(x=>x.textContent.trim().includes(${JSON.stringify(label)})); if(!e) throw new Error('no button: ${label}'); e.click()`);
  check('the demo opens signed in, with no sign-in screen', await p.eval(`return !document.querySelector('form') && !!document.querySelector('.topbar [data-role="admin"]')`));
  check('the banner says it is a demo, that nothing is installed and nothing leaves the browser, and links back', await p.eval(`const b=document.querySelector('.demobanner'); const t=b.innerText; const r=b.getBoundingClientRect(); const links=[...b.querySelectorAll('a')].map(a=>a.getAttribute('href')); return /demo/i.test(t) && t.includes('simulated') && t.includes('Nothing is installed anywhere') && t.includes('nothing leaves this browser') && links.includes('../') && links.some(h=>h.includes('/releases')) && r.top===0 && r.height>20 && getComputedStyle(b).position==='sticky'`));
  check('the version line says demo', (await p.eval(`return document.querySelector('.brand .prov').textContent`)).includes('Version demo'));
  await p.wait(400); await p.shot(path.join(shots, '47-demo-overview.png'));
  await go('machines'); await p.until(`document.querySelectorAll('#main tbody tr').length>=3`);
  check('three sample machines are listed: one with updates, one read only, one offline', await p.eval(`const rows=[...document.querySelectorAll('#main tbody tr')].map(r=>r.innerText); return rows.length===3 && rows.some(r=>r.includes('DESK-ANNA') && r.includes('Online')) && rows.some(r=>r.includes('KIOSK-LOBBY') && r.includes('Read only')) && rows.some(r=>r.includes('LAPTOP-SAM') && r.includes('Offline'))`));
  check('the banner stays visible above the page after scrolling', await p.eval(`scrollTo(0, 600); await new Promise(r=>setTimeout(r,200)); const r=document.querySelector('.demobanner').getBoundingClientRect(); const t=document.querySelector('.topbar').getBoundingClientRect(); scrollTo(0,0); return r.top===0 && t.top>=r.height-1`));
  await go('installed'); await p.wait(500);
  await p.eval(`const card=[...document.querySelectorAll('[data-machine]')].find(c=>c.innerText.includes('DESK-ANNA')); [...card.querySelectorAll('md-text-button')].find(b=>b.textContent.trim()==='Upgrade').click()`);
  await p.until(`document.querySelector('.drama.ok')`, 15000); check('an upgrade runs and ends in the success takeover', (await text()).includes('Upgrade complete')); await p.wait(1500); await p.shot(path.join(shots, '48-demo-upgrade-success.png'));
  check('the banner is still visible over the takeover', await p.eval(`const b=document.querySelector('.demobanner'); const r=b.getBoundingClientRect(); const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return b.contains(top)`));
  await p.key('Escape'); await p.until(`!document.querySelector('.drama')`, 5000);
  await p.until(`[...document.querySelectorAll('[data-machine]')].find(c=>c.innerText.includes('DESK-ANNA')).innerText.includes('2.47.1')`, 8000); check('the inventory refreshes after the upgrade', true);
  await go('jobs'); await p.wait(700); check('the job shows streamed output and exit code 0', await p.eval(`const t=document.querySelector('#main').innerText; return t.includes('Finished with exit code 0') && document.querySelector('pre.log:not(.cmd)').textContent.includes('The upgrade of git was successful')`));
  await go('discover'); await clickText('Install by id'); await p.until(`document.querySelector('.sheet md-outlined-text-field')`);
  await p.eval(`const f=[...document.querySelectorAll('.sheet md-outlined-text-field')].find(x=>x.label.startsWith('Arguments')); f.value='no-such-package'; f.dispatchEvent(new Event('input')); for (const c of document.querySelectorAll('.sheet md-checkbox')) { if (!c.getAttribute('data-aria-label')?.includes('DESK-ANNA') && !(c.ariaLabel||'').includes('DESK-ANNA') && c.checked) c.click(); await new Promise(r=>setTimeout(r,60)); }`);
  await p.eval(`[...document.querySelectorAll('.sheet md-filled-button')].find(b=>b.textContent.trim().includes('Run')).click()`); await p.until(`document.querySelector('.drama.err pre')`, 15000); await p.wait(1500); await p.shot(path.join(shots, '49-demo-install-failure.png'));
  check('installing an unknown package ends in the failure takeover with exit code 1', await p.eval(`const d=document.querySelector('.drama.err'); return d.innerText.includes('Install failed') && d.querySelector('.sub').textContent.includes('exit code 1') && d.querySelector('pre').textContent.includes('no-such-package not found')`), (await text()).slice(0, 200));
  await p.eval(`[...document.querySelectorAll('.drama .acts button')].pop().click()`); await p.until(`!document.querySelector('.drama')`, 5000); await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  await go('installed'); await p.wait(500); await p.eval(`const card=[...document.querySelectorAll('[data-machine]')].find(c=>c.innerText.includes('KIOSK-LOBBY')); [...card.querySelectorAll('md-text-button')].find(b=>b.textContent.trim()==='Upgrade').click()`); await p.wait(700);
  check('a read only machine refuses a change and says why', await p.eval(`return [...document.querySelectorAll('.toast.err')].some(t=>t.textContent.includes('KIOSK-LOBBY') && t.textContent.includes('read only'))`) && !(await p.eval(`return !!document.querySelector('.drama')`))); await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  check('a job for the offline machine waits in the queue', await p.eval(`const ms=await (await fetch('/api/machines')).json(); const off=ms.find(m=>!m.online); const r=await (await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({machineIds:[off.id],spec:{kind:'choco',command:'upgrade',args:['git'],global:{confirm:true}}})})).json(); await new Promise(r=>setTimeout(r,1500)); const j=await (await fetch('/api/jobs/'+r.jobs[0].id)).json(); return j.state==='queued'`));
  await go('machines'); await p.wait(400);
  await p.eval(`document.getElementById('demo-join').click()`); await p.wait(400); check('a machine cannot join before a pairing code exists, and the demo says so', (await p.eval(`return document.getElementById('demo-status').textContent`)).includes('Create a pairing code'));
  await clickText('New pairing code'); await p.until(`document.querySelector('.code')`); await p.eval(`document.getElementById('demo-join').click()`); await p.until(`document.querySelectorAll('#main tbody tr').length===4`, 5000); await p.wait(400); await p.shot(path.join(shots, '50-demo-machine-joined.png'));
  check('a pairing code is shown and the join control adds a fourth machine', await p.eval(`return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(document.querySelector('.code').textContent) && document.querySelector('#main').innerText.includes('NEW-PC-04') && document.getElementById('demo-status').textContent.includes('simulated')`));
  await go('webhooks'); await p.wait(400); await clickText('Add a webhook'); await p.until(`document.querySelector('.sheet [data-hook="name"]')`); await p.eval(`const n=document.querySelector('.sheet [data-hook="name"]'); n.value='Team chat'; const u=document.querySelector('.sheet [data-hook="url"]'); u.value='https://chat.example.test/hook'`); await clickText('Save'); await p.until(`document.querySelector('[data-hook-row="Team chat"]')`);
  await p.eval(`[...document.querySelector('[data-hook-row="Team chat"]').closest('tr').querySelectorAll('md-text-button')].find(b=>b.textContent.includes('Send test')).click()`); await p.until(`document.querySelector('[data-hook-result]')`, 5000);
  check('a webhook test reports a simulated result and says nothing was sent', await p.eval(`const r=document.querySelector('[data-hook-result]'); return r.dataset.hookResult==='simulated' && r.innerText.includes('Simulated: nothing was sent') && r.innerText.includes('never sends anything')`));
  await go('users'); await p.until(`document.querySelector('[data-user-row="demo"]')`); await p.eval(`document.querySelector('[data-user-row="demo"]').closest('tr').querySelector('[data-role="viewer"]').click()`); await p.wait(700);
  check('users respond like the hub: the last admin is protected', await p.eval(`const u=await (await fetch('/api/users')).json(); return u.find(x=>x.name==='demo').role==='admin' && [...document.querySelectorAll('.toast.err')].some(t=>t.textContent.includes('last enabled administrator'))`)); await p.eval(`document.querySelectorAll('.toast button:last-child').forEach(b=>b.click())`);
  await go('settings'); await p.wait(400); await p.eval(`[...document.querySelectorAll('md-filter-chip')].find(c=>c.label.startsWith('Sign in')).click()`); await p.until(`document.querySelector('[data-pk-unavailable]')`);
  check('passkeys are shown as unavailable in the demo, not faked', await p.eval(`return document.querySelector('[data-pk-unavailable]').textContent.includes('switched off in this demo') && ![...document.querySelectorAll('[data-passkeys] md-filled-tonal-button')].length && !document.querySelector('.topbar md-icon-button[title="Sign out"]')`));
  await p.eval(`document.getElementById('demo-reset').click()`); await p.wait(1500); await p.until(`document.querySelector('.topbar')`, 15000); await p.wait(600);
  check('Reset demo puts the sample state back', await p.eval(`const ms=await (await fetch('/api/machines')).json(); const hooks=await (await fetch('/api/webhooks')).json(); return ms.length===3 && hooks.webhooks.length===0 && ms.find(m=>m.name==='DESK-ANNA').inventory.packages.find(p=>p.name==='git').version==='2.46.0'`));
  check('no browser console errors on the desktop width', p.errors.length === 0, p.errors.slice(0, 3).join(' | ')); await p.close();
  await open({ width: 390, height: 844, mobile: true });
  check('at phone width the demo has no horizontal overflow', await p.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1`)); await p.shot(path.join(shots, '51-demo-phone.png'));
  check('at phone width the banner and the three machines are present', await p.eval(`const ms=await (await fetch('/api/machines')).json(); const b=document.querySelector('.demobanner'); return ms.length===3 && b.getBoundingClientRect().top===0 && b.getBoundingClientRect().width<=window.innerWidth && !!document.querySelector('.bottomnav')`));
  await p.eval(`[...document.querySelectorAll('.bottomnav button')].find(b=>b.textContent.includes('Installed')).click()`); await p.wait(900);
  check('at phone width the Installed page has no horizontal overflow', await p.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelectorAll('[data-machine]').length===3`));
  check('no browser console errors at phone width', p.errors.length === 0, p.errors.slice(0, 3).join(' | '));
  const foreign = requested.filter((u) => !u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('about:'));
  check('no request left the page other than for its own static files', requested.length > 10 && foreign.length === 0 && outside.length === 0 && !requested.some((u) => u.includes('/api/')), `foreign: ${foreign.slice(0, 3).join(' | ')} outside: ${outside.slice(0, 3).join(' | ')}`);
} catch (e) { check('run completed', false, e.message); if (p) await p.shot(path.join(shots, 'zz-demo-failure.png')).catch(() => {}); }
finally { if (p) await p.close().catch(() => {}); server.close(); server.closeAllConnections?.(); }
const failed = results.filter((r) => !r.ok); console.log(`\n${results.length - failed.length} of ${results.length} checks passed`); process.exit(failed.length ? 1 : 0);
