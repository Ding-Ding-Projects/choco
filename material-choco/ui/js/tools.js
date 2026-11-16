// Built-in tools that run only in this browser: Base64.
import { h, btn, download, copy, tip } from './ui.js';
import { tx } from './i18n.js';
import { title } from './pages.js';

// ---- Base64 ------------------------------------------------------------------------------------
const MAX_FILE = 5 * 1024 * 1024;
export function b64encode(bytes, urlSafe = false) {
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const s = btoa(bin); return urlSafe ? s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : s;
}
// Strict: anything that is not exactly Base64 in the chosen alphabet throws, with the reason.
export function b64decode(text, urlSafe = false) {
  const s = String(text).replace(/\s+/g, ''); if (!s) return new Uint8Array();
  const bad = (urlSafe ? /[^A-Za-z0-9_=-]/ : /[^A-Za-z0-9+/=]/).exec(s);
  if (bad) { const other = urlSafe ? '+/' : '-_'; throw new Error(tx('character "{c}" at position {n} does not belong', { c: bad[0], n: bad.index + 1 }) + (other.includes(bad[0]) ? '. ' + (urlSafe ? tx('It belongs to the standard alphabet; turn the URL-safe switch off.') : tx('It belongs to the URL-safe alphabet; turn the URL-safe switch on.')) : '')); }
  const body = s.replace(/=+$/, ''); const pad = s.length - body.length;
  if (body.includes('=')) throw new Error(tx('padding appears before the end'));
  if (body.length % 4 === 1) throw new Error(tx('the length is impossible, so a character is missing or extra'));
  if (pad && (pad > 2 || (body.length + pad) % 4 !== 0)) throw new Error(tx('the padding at the end is wrong'));
  const std = body.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (b64encode(bytes).replace(/=+$/, '') !== std) throw new Error(tx('the last character carries bits that no encoder writes'));
  return bytes;
}
const B = { plain: '', b64: '', url: false, file: null, note: '', bad: false };
function base64(root) {
  const plain = h('textarea', { class: 'ta', 'aria-label': 'Plain text', rows: 9, spellcheck: false, placeholder: tx('Type or paste text here'), value: B.plain });
  const out = h('textarea', { class: 'ta mono', 'aria-label': 'Base64', rows: 9, spellcheck: false, placeholder: tx('Type or paste Base64 here'), value: B.b64 });
  const status = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  const say = (text, bad = false) => { B.note = text; B.bad = bad; status.textContent = text; status.className = 'small' + (bad ? ' bad' : ''); };
  const fromPlain = () => { B.plain = plain.value; B.file = null; const bytes = new TextEncoder().encode(B.plain); B.b64 = out.value = b64encode(bytes, B.url); say(B.plain ? tx('{a} bytes of UTF-8 text became {b} Base64 characters.', { a: bytes.length, b: B.b64.length }) : ''); };
  const fromB64 = () => { B.b64 = out.value; B.file = null; let bytes; try { bytes = b64decode(B.b64, B.url); } catch (e) { return say(tx('This is not valid Base64') + ': ' + e.message + '. ' + tx('Nothing was decoded.'), true); }
    try { B.plain = plain.value = new TextDecoder('utf-8', { fatal: true }).decode(bytes); say(bytes.length ? tx('Valid Base64. {a} bytes decoded as UTF-8 text.', { a: bytes.length }) : ''); } catch { B.plain = plain.value = ''; say(tx('Valid Base64, {a} bytes. They are not UTF-8 text, so they are not shown as text. Use Save decoded bytes.', { a: bytes.length })); } };
  plain.oninput = fromPlain; out.oninput = fromB64;
  const pickFile = () => { const i = h('input', { type: 'file', onchange: async () => { const f = i.files[0]; if (!f) return; if (f.size > MAX_FILE) return say(tx('{n} is larger than 5 MB, so it was not read.', { n: f.name }), true); const bytes = new Uint8Array(await f.arrayBuffer()); B.b64 = out.value = b64encode(bytes, B.url); B.plain = plain.value = ''; B.file = { name: f.name, size: f.size }; say(tx('Encoded the file {n}: {a} bytes became {b} Base64 characters. The file stayed on this device.', { n: f.name, a: bytes.length, b: B.b64.length })); } }); i.click(); };
  const saveBytes = () => { let bytes; try { bytes = b64decode(out.value, B.url); } catch (e) { return say(tx('This is not valid Base64') + ': ' + e.message + '. ' + tx('Nothing was saved.'), true); } if (!bytes.length) return say(tx('There is nothing to save yet.'), true); const name = B.file ? B.file.name : 'decoded.bin'; download(name, bytes, 'application/octet-stream'); say(tx('Saved {a} bytes as {n}.', { a: bytes.length, n: name })); };
  const clear = () => { B.plain = plain.value = ''; B.b64 = out.value = ''; B.file = null; say(''); plain.focus(); };
  const url = h('md-switch', { selected: B.url, 'aria-label': tx('URL-safe alphabet'), dataset: { b64url: '1' }, onchange: (e) => { B.url = e.target.selected; if (B.file || (!B.plain && B.b64)) { try { const bytes = b64decode(B.b64, !B.url); B.b64 = out.value = b64encode(bytes, B.url); say(tx('Rewrote the same {a} bytes in the other alphabet.', { a: bytes.length })); } catch { fromB64(); } } else fromPlain(); } });
  root.append(title('base64', tx('Runs only in this browser. Nothing on this page is sent to the hub or anywhere else.')),
    h('div', { class: 'row' }, h('label', { class: 'row nowrap' }, url, h('span', {}, tx('URL-safe alphabet'))), tip(tx('URL-safe alphabet'), tx('Standard Base64 uses + and / and pads the end with =. The URL-safe form uses - and _ and leaves the padding off, so the result can sit in a web address or a file name. Decoding accepts only the alphabet that is switched on.')), h('span', { class: 'grow' }), btn(tx('Clear both'), { kind: 'text', ic: 'undo', onclick: clear })),
    h('div', { class: 'row top stretch gap18' },
      h('section', { class: 'card rise', style: 'flex:1 1 340px' }, h('div', { class: 'row' }, h('h2', { class: 'h2 grow' }, tx('Plain text')), tip(tx('Plain text'), tx('Text is turned into bytes as UTF-8 before it is encoded, so accents, Chinese characters and symbols survive the round trip. Typing here rewrites the Base64 side at once.'))), plain,
        h('div', { class: 'row' }, btn(tx('Copy text'), { kind: 'tonal', ic: 'content_copy', onclick: () => copy(plain.value) }), btn(tx('Encode a file'), { kind: 'outlined', ic: 'upload_file', onclick: pickFile }), tip(tx('Encode a file'), tx('Reads one file of up to 5 MB from this device and writes its bytes as Base64 on the other side. The file is not uploaded. Save decoded bytes gives the same file back.')))),
      h('section', { class: 'card rise', style: 'flex:1 1 340px;--i:1' }, h('div', { class: 'row' }, h('h2', { class: 'h2 grow' }, 'Base64'), tip('Base64', tx('Typing or pasting here decodes at once. Spaces and line breaks are ignored. Anything else that is not Base64 is reported with its position and nothing is decoded: the tool never guesses.'))), out,
        h('div', { class: 'row' }, btn(tx('Copy Base64'), { kind: 'tonal', ic: 'content_copy', onclick: () => copy(out.value) }), btn(tx('Save decoded bytes'), { kind: 'outlined', ic: 'download', onclick: saveBytes }), btn(tx('Save Base64 as text'), { kind: 'text', ic: 'download', onclick: () => (out.value ? download((B.file ? B.file.name : 'text') + '.base64.txt', out.value) : say(tx('There is nothing to save yet.'), true)) })))),
    status);
  say(B.note, B.bad);
}

export const PAGES3 = [{ id: 'base64', icon: 'swap_horiz', render: base64 }];
