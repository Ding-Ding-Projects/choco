// Accounts and hub administration: passkeys, users and roles, status webhooks.
import { h, frag, icon, btn, ibtn, badge, fmtTime, toast, sheet, menu, superConfirm, skeleton, errorPanel, emptyState, tip, exportBtn, matcher, rxError, builderBtn } from './ui.js';
import { S, api, role } from './state.js';
import { t, tx } from './i18n.js';
import { title, table, filterBar, keptFilter } from './pages.js';

// ---- passkeys (WebAuthn). Binary values travel as base64url text. -------------------------------
const enc = (buf) => { const u = new Uint8Array(buf); let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const dec = (s) => { const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
export const webauthnHere = () => !!(globalThis.PublicKeyCredential && navigator.credentials);
// The browser reports a dismissed or timed out prompt as NotAllowedError; say that in plain words.
const passkeyError = (e) => (e?.name === 'NotAllowedError' ? new Error(tx('The passkey prompt was closed or timed out. Nothing changed.')) : e?.name === 'InvalidStateError' ? new Error(tx('This device already holds a passkey for this account.')) : e);
export async function passkeySignIn(name) {
  const { publicKey } = await api('/api/login/passkey/begin', { method: 'POST', body: name ? { name } : {} });
  let cred; try { cred = await navigator.credentials.get({ publicKey: { ...publicKey, challenge: dec(publicKey.challenge), allowCredentials: (publicKey.allowCredentials || []).map((c) => ({ ...c, id: dec(c.id) })) } }); } catch (e) { throw passkeyError(e); }
  const r = cred.response;
  await api('/api/login/passkey/finish', { method: 'POST', body: { id: cred.id, response: { clientDataJSON: enc(r.clientDataJSON), authenticatorData: enc(r.authenticatorData), signature: enc(r.signature), userHandle: r.userHandle && r.userHandle.byteLength ? enc(r.userHandle) : null } } });
}
export async function passkeyAdd(password, name) {
  const { publicKey } = await api('/api/account/passkeys/begin', { method: 'POST', body: { password } });
  let cred; try { cred = await navigator.credentials.create({ publicKey: { ...publicKey, challenge: dec(publicKey.challenge), user: { ...publicKey.user, id: dec(publicKey.user.id) }, excludeCredentials: (publicKey.excludeCredentials || []).map((c) => ({ ...c, id: dec(c.id) })) } }); } catch (e) { throw passkeyError(e); }
  const r = cred.response;
  return api('/api/account/passkeys/finish', { method: 'POST', body: { id: cred.id, response: { clientDataJSON: enc(r.clientDataJSON), attestationObject: enc(r.attestationObject), transports: r.getTransports ? r.getTransports() : [] }, name } });
}
// The passkey part of Settings, sign-in tab.
const pkWords = (k) => [k.name || tx('Passkey'), fmtTime(k.createdAt), k.lastUsed ? fmtTime(k.lastUsed) : tx('never'), ...(k.transports || []), k.backedUp ? tx('Synced') : ''].join(' ');
export function passkeyBlock(account) {
  const host = h('div', { class: 'col', dataset: { passkeys: '1' } }, skeleton(1));
  // The passkey list has its own filter. It keeps its query while the block is drawn again, and
  // typing in it redraws only the table, so a password or name typed below is kept.
  let all = [];
  const listHost = h('div', { class: 'col' }); const count = h('p', { class: 'muted small', role: 'status', hidden: true, dataset: { pkCount: '1' } });
  const pf = keptFilter('passkeys', () => paint(), { label: tx('Filter passkeys'), sample: () => all.map(pkWords) });
  const paint = () => { const list = all.filter((k) => pf.test(pkWords(k)));
    count.textContent = pf.st.q ? tx('{a} of {b} passkeys shown.', { a: list.length, b: all.length }) : ''; count.hidden = !pf.st.q;
    listHost.replaceChildren(list.length ? table([tx('Name'), tx('Added'), tx('Last used'), tx('Details'), ''], list.map((k) => ({ cells: [h('b', {}, k.name || tx('Passkey')), fmtTime(k.createdAt), k.lastUsed ? fmtTime(k.lastUsed) : tx('never'), h('div', { class: 'row gap6' }, (k.transports || []).map((x) => badge(x)), k.backedUp && badge(tx('Synced'), 'info')), ibtn('delete', tx('Delete the passkey {n}', { n: k.name || '' }), async () => { if (!(await superConfirm({ title: tx('Delete the passkey {n}', { n: k.name || '' }), detail: tx('This passkey can no longer sign in to this hub. The key stays on the device until you remove it there. The password still works.'), action: 'delete' }))) return; try { await api('/api/account/passkeys/' + encodeURIComponent(k.id), { method: 'DELETE' }); toast(tx('The passkey was deleted.'), { kind: 'ok' }); load(); } catch (e) { toast(e.message, { kind: 'err' }); } })] })), { label: tx('Passkeys') })
      : h('p', { class: 'muted', dataset: { pkEmpty: '1' } }, tx('No passkeys match the filter.'))); };
  const draw = (list) => { all = list; if (list.length) paint();
    const pw = h('md-outlined-text-field', { label: tx('Current password'), type: 'password', autocomplete: 'current-password', style: 'flex:1 1 200px', dataset: { pk: 'password' } }); const nm = h('md-outlined-text-field', { label: tx('Name for this passkey'), value: '', placeholder: tx('For example: office laptop'), style: 'flex:1 1 200px', dataset: { pk: 'name' } }); const err = h('p', { class: 'small bad', role: 'alert' });
    const add = async () => { err.textContent = ''; if (!pw.value) return (err.textContent = tx('Enter the current password first. It is needed to add a passkey.')); try { await passkeyAdd(pw.value, nm.value.trim() || tx('Passkey')); toast(tx('The passkey was added. It can be used to sign in from now on.'), { kind: 'ok' }); load(); } catch (e) { err.textContent = tx('The passkey was not added.') + ' ' + e.message; } };
    const can = account.passkeysAvailable && webauthnHere();
    host.replaceChildren(h('div', { class: 'row nowrap' }, h('h3', { class: 'h2 grow', style: 'font-size:1.15rem' }, tx('Passkeys')), tip(tx('Passkeys'), tx('A passkey signs you in with the fingerprint, face or PIN of a device, or with a security key. Nothing secret leaves the device. The password stays as the fallback. A passkey works only on the address it was added on. Passkeys cannot be renamed after they are added; delete one and add it again to change its name.'))),
      // The filter is in the page only while there is a passkey to filter.
      list.length ? frag(pf.el, count, listHost) : h('p', { class: 'muted' }, tx('This account has no passkeys.')),
      can ? frag(h('div', { class: 'row top' }, pw, nm, btn(tx('Add a passkey'), { kind: 'tonal', ic: 'passkey', onclick: add })), err)
        : h('p', { class: 'muted small', dataset: { pkUnavailable: '1' } }, S.status.demo ? tx('Passkeys are checked by a real hub, so they are switched off in this demo.') : !account.passkeysAvailable ? tx('Passkeys cannot be added on this address. They need HTTPS or localhost, and a host name instead of an IP address.') : tx('This browser has no passkey support.')));
  };
  const load = () => api('/api/account/passkeys').then(draw).catch((e) => host.replaceChildren(h('p', { class: 'muted' }, tx('Passkeys could not be loaded') + ': ' + e.message)));
  load(); return host;
}

// ---- users and roles ------------------------------------------------------------------------------
// The filter bar draws its field, regex chip, error line and summary badge from its state only when
// the whole page is drawn. These pages redraw only their list, so the state is copied back here,
// also right after the bar is made, so a kept pattern that cannot be compiled still says why.
const syncFilter = (fb) => {
  const f = fb.el.querySelector('md-outlined-text-field'); if (f && f.value !== fb.st.q) f.value = fb.st.q;
  const c = [...fb.el.querySelectorAll('md-filter-chip')].find((x) => x.label === t('regex')); if (c && c.selected !== fb.st.regex) c.selected = fb.st.regex;
  const err = fb.el.querySelector('[data-filter-error]'); if (err) err.textContent = rxError(matcher(fb.st.q, fb.st.regex));
  const n = (fb.st.q ? 1 : 0) + Object.values(fb.st.flags).filter(Boolean).length; const sum = fb.el.querySelector('summary'); const old = sum && sum.querySelector('.badge');
  if (sum) { if (n) { const b = badge(tx('{n} active', { n }), 'info'); if (old) old.replaceWith(b); else sum.append(b); } else if (old) old.remove(); }
};
// The pattern builder of these filters previews the words the filter searches in every loaded row,
// not the text of the drawn rows, so what it reports matches what the filter then keeps.
// The new button carries the same data-fpart as the one it replaces, so the filter bar records when it
// has keyboard focus. The filter bar puts focus back after a redraw by looking up its own button, which
// is replaced here, so this button takes focus back itself, once it has rendered.
const ownBuilder = (fb, sample, apply) => {
  const old = fb.el.querySelector('[data-rxopen]'); if (!old) return;
  const b = builderBtn(sample, (pat) => { fb.st.q = pat; fb.st.regex = true; apply(); }, tx('The preview uses the words the filter searches in every row of this list.'));
  b.dataset.fpart = 'build'; old.replaceWith(b);
  if (fb.st.focus !== 'build') return;
  (async () => {
    await b.updateComplete; if (!b.isConnected || fb.st.focus !== 'build') return;
    const a = document.activeElement; if (a && a !== document.body) { if (!fb.el.contains(a)) fb.st.focus = null; return; }
    b.focus();
  })();
};
const ROLE_TEXT = { admin: 'Admin', operator: 'Operator', viewer: 'Viewer' }; const ROLE_KIND = { admin: 'warn', operator: 'info', viewer: '' };
export const roleName = (r) => tx(ROLE_TEXT[r] || r);
function users(root) {
  const host = h('div', { class: 'col' }, skeleton(3)); const roles = S.status.roles || ['viewer', 'operator', 'admin']; let all = null;
  // Filtering redraws the loaded list in place; it does not ask the hub again.
  const changed = () => { syncFilter(fb); if (all) paint(); };
  const fb = filterBar('users', changed, { chips: [['disabled', tx('Disabled')]], placeholder: tx('Filter users') });
  // Every value a row shows, in the words it shows them; the role is the one that is selected.
  const words = (u) => [u.name, u.role, roleName(u.role), u.disabled ? tx('Disabled') : '', u.passkeys ? tx('{n} passkey(s)', { n: u.passkeys }) : '', tx('Password'), u.lastLogin ? fmtTime(u.lastLogin) : tx('never'), u.name === S.status.user ? tx('You') : ''].join(' ');
  syncFilter(fb); ownBuilder(fb, () => (all || []).map(words), changed);
  const filtering = () => !!fb.st.q || Object.values(fb.st.flags).some(Boolean);
  const fail = (e) => { toast(e.message, { kind: 'err' }); load(); };
  const patch = (u, body, done) => api('/api/users/' + encodeURIComponent(u.name), { method: 'PATCH', body }).then(() => { toast(done, { kind: 'ok' }); load(); }).catch(fail);
  const roleSeg = (get, set) => h('div', { class: 'seg', role: 'group', 'aria-label': tx('Role') }, roles.map((r) => h('button', { type: 'button', 'aria-pressed': String(get() === r), dataset: { role: r }, onclick: (e) => { set(r); for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } }, roleName(r))));
  const addUser = () => { let r = 'viewer'; const name = h('md-outlined-text-field', { label: t('name'), 'supporting-text': tx('2 to 40 letters, digits, dot, dash, underscore or @'), dataset: { user: 'name' } }); const pass = h('md-outlined-text-field', { label: tx('First password, at least 10 characters'), type: 'password', autocomplete: 'new-password', dataset: { user: 'password' } }); const err = h('p', { class: 'small bad', role: 'alert' });
    const close = sheet(frag(h('h2', { class: 'h2' }, tx('Add a user')), name, h('div', { class: 'col gap6' }, h('span', { class: 'small muted' }, tx('Role')), roleSeg(() => r, (v) => { r = v; })), pass, h('p', { class: 'muted small' }, tx('Tell the person this password yourself. They can change it under Settings after signing in.')), err,
      h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn(tx('Add user'), { ic: 'add', onclick: async () => { err.textContent = ''; try { await api('/api/users', { method: 'POST', body: { name: name.value.trim(), role: r, password: pass.value } }); close(); toast(tx('Added the user {n} as {r}.', { n: name.value.trim(), r: roleName(r) }), { kind: 'ok' }); load(); } catch (e) { err.textContent = e.message; } } }))), { label: tx('Add a user') }); };
  const resetPw = (u) => { const pass = h('md-outlined-text-field', { label: tx('New password, at least 10 characters'), type: 'password', autocomplete: 'new-password' }); const err = h('p', { class: 'small bad', role: 'alert' });
    const close = sheet(frag(h('h2', { class: 'h2' }, tx('Reset the password of {n}', { n: u.name })), h('p', { class: 'muted' }, tx('Their open sessions are signed out. Tell them the new password yourself.')), pass, err, h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn(tx('Set password'), { onclick: async () => { try { await api('/api/users/' + encodeURIComponent(u.name), { method: 'PATCH', body: { password: pass.value } }); close(); toast(tx('The password of {n} was reset.', { n: u.name }), { kind: 'ok' }); } catch (e) { err.textContent = e.message; } } }))), { label: tx('Reset password') }); };
  const del = async (u) => { if (!(await superConfirm({ title: tx('Delete the user {n}', { n: u.name }), detail: tx('The account and its passkeys are removed and its sessions end. History lines it wrote stay. This cannot be undone.'), action: 'delete' }))) return; api('/api/users/' + encodeURIComponent(u.name), { method: 'DELETE' }).then(() => { toast(tx('Deleted the user {n}.', { n: u.name }), { kind: 'ok' }); load(); }).catch(fail); };
  // A paragraph, so the row gives the count a readable width and moves the export button below it when space is short.
  let shown = []; const count = h('p', { class: 'muted small grow', role: 'status', dataset: { userCount: '1' } });
  const foot = h('div', { class: 'row', style: 'display:none' }, count, exportBtn('material-choco-users', ['Name', 'Role', 'Disabled', 'Created', 'Last sign in', 'Passkeys'], () => shown.map((u) => [u.name, u.role, u.disabled ? 'yes' : 'no', u.createdAt || '', u.lastLogin || '', u.passkeys || 0]), { label: tx('Export this list') }));
  const draw = (list) => { all = list; fb.el.hidden = false; foot.style.display = ''; paint(); };
  const paint = () => { const list = shown = all.filter((u) => fb.test(words(u)) && (!fb.st.flags.disabled || u.disabled));
    count.textContent = filtering() ? tx('{a} of {b} accounts shown.', { a: list.length, b: all.length }) : tx('{n} account(s).', { n: all.length });
    host.replaceChildren(list.length ? table([t('name'), tx('Role'), tx('Sign in'), tx('Last sign in'), tx('Enabled'), ''], list.map((u) => { const acts = () => [{ label: tx('Reset password'), icon: 'password', run: () => resetPw(u) }, { label: tx('Delete user'), icon: 'delete', danger: true, run: () => del(u) }];
      return { menu: acts, cells: [h('div', { class: 'row gap6', dataset: { userRow: u.name } }, h('b', {}, u.name), u.name === S.status.user && badge(tx('You'), 'ok'), u.disabled && badge(tx('Disabled'), 'err')), roleSeg(() => u.role, (v) => { if (v !== u.role) patch(u, { role: v }, tx('{n} is now {r}.', { n: u.name, r: roleName(v) })); }), h('div', { class: 'row gap6' }, u.passkeys ? badge(tx('{n} passkey(s)', { n: u.passkeys }), 'ok') : null, badge(tx('Password'))), u.lastLogin ? fmtTime(u.lastLogin) : tx('never'),
        h('md-switch', { selected: !u.disabled, 'aria-label': tx('Account {n} enabled', { n: u.name }), onchange: (e) => patch(u, { disabled: !e.target.selected }, e.target.selected ? tx('{n} can sign in again.', { n: u.name }) : tx('{n} is disabled and signed out.', { n: u.name })) }), ibtn('more_vert', tx('Actions for {n}', { n: u.name }), (e) => menu(e.currentTarget, acts()))] }; }), { label: tx('Users') })
      : emptyState('filter_list', t('no_results'), tx('No users match the filter.'))); };
  // A failed load drops the list it had: the rows may be out of date, so the filter has nothing to
  // redraw and the error stays on screen. The filter is hidden until a load works again, as on the
  // webhooks page; when it had keyboard focus, focus moves to the error.
  const load = () => api('/api/users').then(draw).catch((e) => {
    all = null; shown = []; const hadFocus = fb.el.contains(document.activeElement); fb.el.hidden = true; foot.style.display = 'none';
    const panel = errorPanel(tx('Users could not be loaded'), e.message); host.replaceChildren(panel); if (hadFocus) { panel.tabIndex = -1; panel.focus(); }
  });
  root.append(title('users'), h('div', { class: 'row' }, btn(tx('Add a user'), { ic: 'add', onclick: addUser }), h('p', { class: 'muted grow' }, tx('Admins manage everything. Operators run commands, pair machines and edit schedules. Viewers can look, refresh inventories and run read only queries.')), tip(tx('Roles'), tx('Admin: everything, including users, webhooks, removing machines and machine policy. Operator: run any command, cancel jobs, pair machines, rename and group machines, edit schedules. Viewer: read everything, refresh inventories and run list, outdated, search and info. Every role can read job output and the history. A change of role, disabling and deleting take effect on that person\'s next request.'))), fb.el, host, foot,
    h('div', { class: 'card s3' }, h('div', { class: 'row nowrap' }, icon('shield'), h('h2', { class: 'h2' }, tx('The last admin is protected'))), h('p', {}, tx('The only enabled admin cannot be deleted, disabled or given another role. The hub refuses it and says so.'))));
  load();
}

// ---- status webhooks ------------------------------------------------------------------------------
const EVENT_TEXT = { 'job.failed': 'Job failed', 'job.succeeded': 'Job succeeded', 'machine.offline': 'Machine offline', 'login.lockout': 'Sign in locked', test: 'Test' };
const LAST = new Map(); // webhook id -> result of the last test sent from this page
const SENDING = new Set(); // webhook ids with a test on its way
const CELLS = new Map(); // webhook id -> its "Last test" cell in the table that is shown now
// The copy of the page that was drawn last. A test, a switch change or a delete can finish after the
// page was drawn again (another page and back, or a redraw on live data). Its list update goes to this
// copy, so the copy on screen stays true and an old copy never touches CELLS.
const WH = { page: { refilter: () => {}, load: () => {} } };
// The text of one event badge of a webhook row.
const eventText = (w) => (e) => tx(EVENT_TEXT[e] || e) + (e === 'machine.offline' ? ` ${w.offlineMinutes} min` : '');
// The "Last test" cell as text: state, the badge or plain line, and the detail line under it.
// settled: leave out a test that is on its way and give the last result instead. The filter uses
// this, so a row does not drop out of the list while its test is being sent.
function outcome(w, settled = false) {
  if (!settled && SENDING.has(w.id)) return { state: 'sending', head: tx('Sending') }; const r = LAST.get(w.id); if (!r) return { state: 'none', head: tx('No test sent from this page yet') };
  if (r.simulated) return { state: 'simulated', kind: 'info', head: tx('Simulated: nothing was sent'), line: [r.error || '', fmtTime(r.at)].filter(Boolean).join(' · ') };
  return { state: r.ok ? 'ok' : 'failed', kind: r.ok ? 'ok' : 'err', head: r.ok ? tx('Test delivered, status {s}', { s: r.status }) : tx('Test failed') + (r.status ? `, ${tx('status')} ${r.status}` : ''), line: [r.attempts ? tx('{n} attempt(s)', { n: r.attempts }) : '', r.error || '', fmtTime(r.at)].filter(Boolean).join(' · ') };
}
function webhooks(root) {
  const host = h('div', { class: 'col' }, skeleton(2)); let meta = { events: [], formats: [] }; let all = null; let shown = [];
  // Filtering redraws the loaded list in place; it does not ask the hub again.
  const changed = () => { syncFilter(fb); if (all) paint(); };
  const fb = filterBar('webhooks', changed, { placeholder: tx('Filter webhooks') }); fb.el.hidden = true; // shown once there is a webhook to filter
  // Every value a row shows, in the words it shows them, including the result of the last test.
  const words = (w) => { const o = outcome(w, true); return [w.name, w.format === 'discord' ? 'Discord' : 'JSON', w.url, ...w.events.map(eventText(w)), ...w.events, w.enabled ? '' : tx('Disabled'), o.head, o.line || ''].join(' '); };
  syncFilter(fb); ownBuilder(fb, () => (all || []).map(words), changed);
  // tabindex -1: focus moves here when the row that had it leaves the list, so it is not lost.
  const count = h('p', { class: 'muted small grow', role: 'status', tabindex: '-1', dataset: { hookCount: '1' } });
  // A test result and the enable switch change the words a row is filtered by. The list is drawn again
  // only when that changes whether the row matches, so the count and the export stay true and focus
  // stays where it is otherwise. Focus on a control of a row comes back to the same control of the
  // same row; when that row is no longer listed, it goes to the count line.
  const refilter = (id) => {
    const w = all && all.find((x) => x.id === id); if (!w || fb.test(words(w)) === shown.some((x) => x.id === id)) return;
    const a = document.activeElement; const tr = a && host.contains(a) ? a.closest('tr') : null; const td = a && a.closest('td');
    const rowId = tr?.querySelector('[data-hook-id]')?.dataset.hookId; const col = tr && td ? [...tr.children].indexOf(td) : -1; const tag = a?.tagName;
    paint(); if (!tr) return;
    const row = rowId ? host.querySelector(`[data-hook-id="${CSS.escape(rowId)}"]`)?.closest('tr') : null; const back = row && col >= 0 ? row.children[col]?.querySelector(tag.toLowerCase()) : null;
    if (!back) return count.focus();
    (async () => { await back.updateComplete; const now = document.activeElement; if (back.isConnected && (!now || now === document.body)) back.focus(); })();
  };
  const foot = h('div', { class: 'row', style: 'display:none' }, count, exportBtn('material-choco-webhooks', ['Name', 'Format', 'Events', 'Offline minutes', 'Enabled'], () => shown.map((w) => [w.name, w.format, w.events.join(' '), w.offlineMinutes, w.enabled ? 'yes' : 'no']), { label: tx('Export list, no addresses') }));
  const edit = (w) => { const picked = new Set(w ? w.events : ['job.failed']); let format = w ? w.format : 'json';
    const name = h('md-outlined-text-field', { label: t('name'), value: w ? w.name : '', dataset: { hook: 'name' } }); const url = h('md-outlined-text-field', { label: tx('Address that receives the messages'), value: w ? w.url : 'https://', 'supporting-text': tx('HTTPS. Plain HTTP only for localhost.'), dataset: { hook: 'url' } }); const mins = h('md-outlined-text-field', { label: tx('Minutes before a machine counts as offline'), type: 'number', min: '2', max: '10080', value: String(w ? w.offlineMinutes : 10), dataset: { hook: 'minutes' } }); const err = h('p', { class: 'small bad', role: 'alert' });
    const save = async () => { err.textContent = ''; const body = { name: name.value.trim(), url: url.value.trim(), format, events: [...picked], offlineMinutes: Number(mins.value) }; try { await api(w ? '/api/webhooks/' + w.id : '/api/webhooks', { method: w ? 'PATCH' : 'POST', body }); close(); toast(w ? tx('Webhook saved.') : tx('Webhook added.'), { kind: 'ok' }); WH.page.load(); } catch (e) { err.textContent = e.message; } };
    const close = sheet(frag(h('h2', { class: 'h2' }, w ? tx('Edit the webhook {n}', { n: w.name }) : tx('Add a webhook')), name, url,
      h('div', { class: 'col gap6' }, h('span', { class: 'small muted' }, tx('Message format')), h('div', { class: 'seg', role: 'group', 'aria-label': tx('Message format') }, meta.formats.map((f) => h('button', { type: 'button', 'aria-pressed': String(format === f), dataset: { format: f }, onclick: (e) => { format = f; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } }, f === 'json' ? 'JSON' : f === 'discord' ? 'Discord' : f))), h('span', { class: 'small muted' }, tx('JSON carries the event name, the time, the hub name, a short text and the details. Discord carries the short text as a chat message that cannot ping anyone.'))),
      h('div', { class: 'col gap6' }, h('span', { class: 'small muted' }, tx('Send a message when')), h('div', { class: 'row gap6' }, meta.events.filter((e) => e !== 'test').map((e) => h('md-filter-chip', { label: tx(EVENT_TEXT[e] || e), selected: picked.has(e), dataset: { event: e }, onclick: (ev) => setTimeout(() => (ev.target.selected ? picked.add(e) : picked.delete(e))) })))), mins, err,
      h('div', { class: 'row' }, btn(t('cancel'), { kind: 'text', onclick: () => close() }), h('span', { class: 'grow' }), btn(t('save'), { ic: 'save', onclick: save }))), { label: w ? tx('Edit webhook') : tx('Add a webhook') }); };
  // The result goes to the cell that is shown when it arrives, so a redraw by the filter while it is on its way loses nothing.
  // The list is checked again by the copy of the page that is shown then, not the one the test started from.
  const test = async (w) => { if (SENDING.has(w.id)) return; SENDING.add(w.id); CELLS.get(w.id)?.replaceChildren(result(w)); try { const r = await api(`/api/webhooks/${w.id}/test`, { method: 'POST' }); LAST.set(w.id, { ...r, at: new Date().toISOString() }); } catch (e) { LAST.set(w.id, { ok: false, error: e.message, at: new Date().toISOString() }); } SENDING.delete(w.id); CELLS.get(w.id)?.replaceChildren(result(w)); WH.page.refilter(w.id); };
  const result = (w) => { const o = outcome(w); if (o.state === 'sending') return h('span', { class: 'row nowrap gap6' }, h('span', { class: 'live' }), o.head); if (o.state === 'none') return h('span', { class: 'muted small' }, o.head); return h('div', { class: 'col gap0', dataset: { hookResult: o.state } }, badge(o.head, o.kind), h('span', { class: 'muted small' }, o.line)); };
  const draw = (list) => { all = list; fb.el.hidden = !list.length; foot.style.display = list.length ? '' : 'none'; paint(); };
  // A copy of the page that is no longer in the document draws nothing: CELLS belongs to the copy on screen.
  const paint = () => { if (!host.isConnected) return; CELLS.clear(); if (!all.length) { shown = []; return host.replaceChildren(emptyState('notifications', tx('No webhooks yet'), tx('The hub sends nothing anywhere until you add one.'), btn(tx('Add a webhook'), { ic: 'add', onclick: () => edit(null) }))); }
    const list = shown = all.filter((w) => fb.test(words(w)));
    count.textContent = fb.st.q ? tx('{a} of {b} webhooks shown.', { a: list.length, b: all.length }) : tx('{n} of 20 webhooks.', { n: all.length });
    host.replaceChildren(list.length ? table([t('name'), tx('Sends to'), tx('When'), tx('Last test'), tx('On'), ''], list.map((w) => { const cellHost = h('div', {}, result(w)); CELLS.set(w.id, cellHost); const acts = () => [{ label: tx('Send test'), icon: 'play_arrow', run: () => test(w) }, { label: tx('Edit'), icon: 'edit', run: () => edit(w) }, { label: t('remove'), icon: 'delete', danger: true, run: async () => { if (!(await superConfirm({ title: tx('Delete the webhook {n}', { n: w.name }), detail: tx('The hub stops sending messages to this address. Messages already sent are not affected.'), action: 'delete' }))) return; api('/api/webhooks/' + w.id, { method: 'DELETE' }).then(() => { toast(tx('Webhook deleted.'), { kind: 'ok' }); LAST.delete(w.id); WH.page.load(); }).catch((e) => toast(e.message, { kind: 'err' })); } }];
      return { menu: acts, cells: [h('div', { dataset: { hookRow: w.name, hookId: String(w.id) } }, h('b', {}, w.name), h('div', { class: 'small muted' }, w.format === 'discord' ? 'Discord' : 'JSON')), h('span', { class: 'mono', style: 'display:inline-block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle', title: w.url }, w.url), h('div', { class: 'row gap6' }, w.events.map((e) => badge(eventText(w)(e), e === 'job.succeeded' ? 'ok' : e === 'job.failed' ? 'err' : 'warn'))), cellHost,
        h('md-switch', { selected: w.enabled, 'aria-label': tx('Webhook {n} enabled', { n: w.name }), onchange: (e) => { const on = e.target.selected; api('/api/webhooks/' + w.id, { method: 'PATCH', body: { enabled: on } }).then(() => { w.enabled = on; const cur = all && all.find((x) => x.id === w.id); if (cur) cur.enabled = on; if (WH.page.refilter === refilter) refilter(w.id); else WH.page.load(); }).catch((er) => { toast(er.message, { kind: 'err' }); WH.page.load(); }); } }), h('div', { class: 'row nowrap gap6' }, btn(tx('Send test'), { kind: 'text', onclick: () => test(w) }), ibtn('more_vert', tx('Actions for {n}', { n: w.name }), (e) => menu(e.currentTarget, acts())))] }; }), { label: tx('Status webhooks') })
      : emptyState('filter_list', t('no_results'), tx('No webhooks match the filter.'))); };
  const load = () => api('/api/webhooks').then((r) => { meta = r; draw(r.webhooks); }).catch((e) => { fb.el.hidden = true; foot.style.display = 'none'; host.replaceChildren(errorPanel(tx('Webhooks could not be loaded'), e.message)); });
  root.append(title('webhooks'), h('div', { class: 'row' }, btn(tx('Add a webhook'), { ic: 'add', onclick: () => edit(null) }), h('p', { class: 'muted grow' }, tx('The hub posts a short message when something needs attention. Secrets and job output are never included.')), tip(tx('Status webhooks'), tx('A webhook is an address that receives one message per event: a failed or finished job, a machine that went offline, or a locked sign in. Send test posts one test message now and shows what the receiver answered. A failed delivery is retried up to 3 times. The address is treated like a password: it is stored encrypted and never written to the history or to exports.'))), fb.el, host, foot,
    h('div', { class: 'card' }, h('h2', { class: 'h2' }, tx('What a message holds')), h('p', { class: 'muted' }, tx('The event, the time, the hub name and one line of text. For a job: its number, machine, state, exit code and the command line with secret values shown as ********. Job output is never sent.'))));
  WH.page = { refilter, load }; load();
}

export const ADMIN_PAGES = [{ id: 'users', icon: 'group', render: users, admin: true, hubOnly: true }, { id: 'webhooks', icon: 'webhook', render: webhooks, admin: true }];
export const roleBadge = () => { const r = role(); return r ? h('span', { class: 'badge ' + ROLE_KIND[r], dataset: { role: r }, title: tx('Signed in as {n}. Role: {r}.', { n: S.status.user || '', r: roleName(r) }) }, icon(r === 'admin' ? 'admin_panel_settings' : r === 'operator' ? 'construction' : 'visibility', 'sm'), `${S.status.user || ''} · ${roleName(r)}`) : null; };
