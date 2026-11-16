#!/usr/bin/env node
// Builds the static pages of the Material Choco site. No dependencies.
//
//   node material-choco/site/tools/generate.mjs           write the pages
//   node material-choco/site/tools/generate.mjs --check   fail if the committed pages are stale
//
// Sources:  docs/articles/*.md   guides          -> site/articles/*.html
//           docs/features/*.md   feature pages   -> site/features/*.html
//           site/tools/home.html home page body  -> site/index.html
// Also writes site/404.html and site/search.json (the index used by the command palette).
// Every page shares one header, footer, stylesheet and script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash as __hash } from 'node:crypto';
import { readFileSync as __read } from 'node:fs';
// Version on the stylesheet and script links, so browsers fetch a changed file at once instead of waiting for the cache to expire.
const ASSET_V = __hash('sha1').update(__read(new URL('../site.css', import.meta.url))).update(__read(new URL('../site.js', import.meta.url))).digest('hex').slice(0, 8);

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(TOOLS, '..');
const APP = path.resolve(SITE, '..');
const ORIGIN = 'https://ding-ding-projects.github.io/choco/';
const REPO = 'https://github.com/Ding-Ding-Projects/choco';
const BLOB = `${REPO}/blob/main/`;
const check = process.argv.includes('--check');

// ---- order of guides, grouping of features, captions of screenshots -------------------------------
const GUIDES = ['getting-started', 'hub-in-a-container', 'pairing-and-remote-agents', 'security-model', 'commands-and-options', 'jobs-schedules-and-history', 'confirming-destructive-actions', 'install-result-takeovers', 'languages-and-accessibility', 'finding-your-way-around', 'build-and-test'];
const GROUPS = [
  ['Packages', ['bundled-cli', 'command-schema', 'console', 'command-preview-and-dry-run', 'installed-packages', 'discover-and-install', 'updates', 'sources', 'config-and-features', 'pins', 'api-keys', 'cache-templates-and-info', 'package-builder', 'bulk-actions-and-exports']],
  ['Remote management', ['hub', 'hub-container', 'sign-in', 'passkeys', 'users-and-roles', 'pairing', 'remote-agent', 'read-only-agents', 'command-allow-lists', 'machine-scope-and-groups', 'jobs-and-live-output', 'offline-job-queue', 'schedules', 'history', 'status-webhooks', 'secret-masking', 'secrets-at-rest', 'hub-http-api']],
  ['Safety and feedback', ['two-key-confirmation', 'install-result-takeovers', 'notifications', 'truthful-states']],
  ['Interface', ['overview', 'first-run-wizard', 'command-palette', 'keyboard-shortcuts', 'tabs', 'context-menus', 'filters-and-regex', 'pattern-builder', 'settings', 'changelog-viewer', 'help-page', 'phone-layout']],
  ['Built-in tools', ['base64-tools']],
  ['Language, look and comfort', ['language-modes', 'personal-wording-file', 'school-mode', 'theme-and-seed-colour', 'custom-logo-and-presets', 'timed-settings', 'accessibility-tools', 'sound-and-narration', 'focus-modes']],
  ['Desktop app and delivery', ['desktop-app', 'windows-installer', 'version-and-build-time']],
];
// [file, short title, caption that is also the alternative text, group]
const SHOTS = [
  ['01-first-run-create-administrator.png', 'Creating the administrator', 'First start of a hub: a form asks for the administrator name and a password of at least 10 characters. There is no default account.', 'Setting up'],
  ['02-first-run-wizard.png', 'First-run wizard', 'First-run wizard on the hub, step 1 of 4, titled Nothing to install. It explains that each Windows machine carries its own Chocolatey CLI.', 'Setting up'],
  ['03-empty-overview.png', 'Overview before any machine', 'Overview page with no machines paired. It says No machines yet and offers an Enroll a machine button, with no sample data.', 'Setting up'],
  ['04-machines-pairing-code.png', 'A pairing code', 'Machines page with a freshly created pairing code, its expiry time and the enroll command to run on the Windows machine. The test hub ran on plain HTTP on the same computer, so the command shows the opt-in flag for that.', 'Setting up'],
  ['05-machines.png', 'Two paired machines', 'Machines table with BUILD-01 and LAB-PC-07 online. LAB-PC-07 is marked read only. In this capture the agents ran on Linux with the test stand-in.', 'Setting up'],
  ['06-overview.png', 'Overview', 'Overview page: a banner says 4 updates are ready with an Upgrade everything button, then counts of machines, packages, updates and running jobs, and a needs attention list.', 'Daily work', 'wide'],
  ['07-installed.png', 'Installed packages', 'Installed page: packages of BUILD-01 with installed version, available update, an Upgrade button per row, and Export all and Import packages.config.', 'Daily work'],
  ['13-updates.png', 'Updates', 'Updates page: outdated packages per machine with Upgrade everything, Check again and Upgrade all with options.', 'Daily work'],
  ['14-sources.png', 'Sources', 'Sources page: the package sources of each machine with location, priority and an enabled switch.', 'Daily work'],
  ['15-config-and-features.png', 'Config and features', 'Config and features page for one machine: 11 config settings on the left and 30 feature switches on the right.', 'Daily work'],
  ['16-pins.png', 'Pins', 'Pins page: nothing is pinned on either machine, and each machine has a Package to pin selector.', 'Daily work'],
  ['11-console-every-option.png', 'Console', 'Lower half of the Console page: the exact command that will run, the machines to run it on, and Copy, Schedule and Run buttons.', 'Daily work'],
  ['08-job-success.png', 'A job that succeeded', 'Jobs page: job 5, choco upgrade git, with a green panel reading Finished with exit code 0 and the output below it.', 'Jobs and history'],
  ['12-job-failed.png', 'A job that failed', 'Jobs page: job 7 failed with exit code 1. A red panel offers Run again and Copy output, and the output reads notinstalled is not installed.', 'Jobs and history'],
  ['18-history.png', 'History', 'History page: a table of when, who, action and details, with a filter and export.', 'Jobs and history'],
  ['19-schedules-empty.png', 'Schedules, empty', 'Schedules page with no schedules yet and a New schedule button.', 'Jobs and history'],
  ['17-help.png', 'Help', 'Help page: a search field, Open all and Close all, and folded articles beginning with Getting started, Remote agents and pairing, and Security.', 'Interface and settings'],
  ['09-context-menu-with-filter.png', 'Row menu with a filter', 'Menu of the package putty, opened with its filter field focused: Upgrade with options, Pin, Package information, Reinstall with --force, Copy package id, Uninstall with options, Uninstall.', 'Safety'],
  ['10-two-key-confirmation.png', 'Two keys and a slider', 'Confirmation before uninstalling putty from BUILD-01. Key A is held, key B is not, and the slider is still locked.', 'Safety'],
  ['27-install-success-takeover.png', 'An upgrade succeeds', 'Full-screen celebration reading Upgrade complete, with the command choco upgrade git and exit code 0.', 'Safety'],
  ['28-install-failure-takeover.png', 'An install fails', 'Full-screen red alarm reading Install failed, with the command, exit code 1, the output no-such-package not found, and Open the full log and Close buttons.', 'Safety'],
  ['46-personal-wording-on-failure-takeover.png', 'Personal wording on a failure screen', 'The failure takeover with a personal wording file loaded: the test file replaced Install failed with made-up words, while the command, exit code 1 and the output are unchanged.', 'Safety'],
  ['20-command-palette.png', 'Command palette', 'Command palette filtered with the word pin: the Pins page and the choco pin command.', 'Interface and settings'],
  ['21-settings-language.png', 'Settings: language', 'Settings, Language tab: language mode, two funny level sliders, the emoji switch and the personal wording file.', 'Interface and settings'],
  ['22-settings-appearance-dark-bilingual.png', 'Settings: appearance, dark, bilingual', 'Settings, Appearance tab in the dark theme with bilingual labels: theme, density, motion, full-screen install results and the seed colour.', 'Interface and settings'],
  ['23-overview-dark-bilingual.png', 'Overview, dark and bilingual', 'Overview page in the dark theme with English labels and a Cantonese line beneath each.', 'Interface and settings'],
  ['29-base64-tools.png', 'Base64 tools', 'Base64 tools page: a plain text field and a Base64 field side by side, with a message that the Base64 input is not valid and nothing was decoded.', 'Built-in tools'],
  ['39-base64-cantonese.png', 'Base64 tools in Cantonese', 'The Base64 tools page with the interface in Hong Kong Cantonese.', 'Built-in tools'],
  ['31-pattern-builder.png', 'Pattern builder', 'Pattern builder dialog: Starts with g, Does not contain zzz, the pattern it wrote, and a live preview in which gimp matches and zzz-top does not.', 'Interface and settings'],
  ['35-changelog-viewer.png', 'Changelog viewer', 'Settings, About and changelog: version and build line, and the changelog filtered with the word hub. The capture was taken with an earlier, shorter changelog.', 'Interface and settings'],
  ['36-timed-settings.png', 'Timed settings', 'Settings, Timed settings: a rule that makes density compact between two times is in force, with the form for adding a rule below.', 'Interface and settings'],
  ['37-settings-logo-presets-timed-theme.png', 'Theme by time of day, presets and logo', 'Settings, Appearance after applying a preset: the switch for changing the theme by time of day with its start and end times, a custom logo in the top bar, and a notification with Undo.', 'Interface and settings'],
  ['30-pairing-qr.png', 'A pairing code for a read only agent', 'Machines page with two machines in a table with tick boxes, and a new pairing code created with the Read only agent switch on.', 'Setting up'],
  ['44-sign-in-with-passkey.png', 'Sign in with a passkey', 'Sign in screen of a hub: a Use a passkey button first, then name and password fields under the words or use your password.', 'Users and policy'],
  ['45-settings-passkeys.png', 'Passkeys in Settings', 'Settings, Sign in and locks: change password and a Passkeys list with one passkey named Test key and the fields for adding another. The passkey came from the virtual passkey device of the test browser.', 'Users and policy'],
  ['40-machine-allowed-commands.png', 'Allowed commands for a machine', 'Edit dialog of the machine BUILD-01: display name, groups, the read only switch, and Allowed commands set to Only the ticked commands with all 23 commands ticked.', 'Users and policy'],
  ['41-users-and-roles.png', 'Users and roles', 'Users and roles page: three accounts with Viewer, Operator and Admin buttons, an enabled switch each, and a note that the last admin is protected.', 'Users and policy'],
  ['42-status-webhooks.png', 'Status webhooks', 'Status webhooks page: one webhook for failed jobs whose test delivery failed because the receiver could not be reached, a Send test button, and a note on what a message holds.', 'Users and policy'],
  ['43-viewer-installed.png', 'Installed, as a viewer', 'Installed page for a user with the Viewer role: a line says controls that change machines are not shown, and the rows have no Upgrade buttons.', 'Users and policy'],
  ['32-machines-bulk-actions.png', 'Bulk actions on machines', 'Machines page with both machines ticked: a bar offers Refresh inventory, Upgrade everything, Act on these only, Make read only, Allow changes and Remove from hub.', 'Daily work'],
  ['38-update-downloaded-notice.png', 'Update notice', 'Desktop layout with a notification that an update has been downloaded, that the build is not code signed, and a Restart button. The capture uses a stand-in for the desktop shell and a made-up version number.', 'Desktop and phone'],
  ['26-desktop-app-on-linux-virtual-display.png', 'Desktop window', 'The desktop app window started on Linux under a virtual display, showing the first-run check of the bundled CLI. The app has not yet been started on Windows.', 'Desktop and phone'],
  ['24-phone-overview.png', 'Overview on a phone', 'Overview page at phone width with a bottom navigation bar.', 'Desktop and phone', 'phone'],
  ['25-phone-installed.png', 'Installed on a phone', 'Installed packages page at phone width.', 'Desktop and phone', 'phone'],
];
// Captures that exist but are held back, with the reason. Checked by hand before each change.
const HELD = {};
try { Object.assign(HELD, JSON.parse(fs.readFileSync(path.join(TOOLS, 'held-shots.json'), 'utf8'))); } catch { /* no extra list */ }

// ---- small helpers ------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plain = (s) => s.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const png = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const shotDir = path.join(APP, 'docs', 'screenshots');
const shotFiles = fs.existsSync(shotDir) ? fs.readdirSync(shotDir).filter((f) => f.endsWith('.png')).sort() : [];

// A link written in a Markdown file under docs/<dir>/ becomes a link that works on the site.
function href(link, dir) {
  if (/^(https?:|mailto:|#)/.test(link)) return link;
  const [p, hash = ''] = link.split('#'); const h = hash ? '#' + hash : '';
  const rel = path.posix.normalize(path.posix.join('docs', dir, p));
  let m = /^docs\/(articles|features)\/([\w-]+)\.md$/.exec(rel);
  if (m) return `../${m[1]}/${m[2] === 'README' ? 'index' : m[2]}.html${h}`;
  m = /^docs\/screenshots\/([\w.-]+\.png)$/.exec(rel);
  if (m) return `../shots/${m[1]}`;
  return BLOB + path.posix.normalize('material-choco/' + rel) + h;
}
function inline(text, dir) {
  const keep = []; const hold = (html) => `\u0000${keep.push(html) - 1}\u0000`;
  let s = text.replace(/`([^`]+)`/g, (_m, c) => hold(`<code>${esc(c)}</code>`));
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => hold(`<a href="${esc(href(url.replace(/&amp;/g, '&'), dir))}">${label.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')}</a>`));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => keep[Number(i)]).replace(/\u0000(\d+)\u0000/g, (_m, i) => keep[Number(i)]);
}
// Markdown subset used by the documents: headings, paragraphs, lists, tables, fenced code,
// block quotes (rendered as notes), and images on their own line.
function render(md, dir) {
  const lines = md.replace(/\r/g, '').split('\n'); const out = []; const toc = []; let i = 0;
  const para = []; const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '), dir)}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { flush(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre tabindex="0"><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    let m = /^(#{2,3}) (.+)$/.exec(l);
    if (m) { flush(); const id = slug(m[2]); if (m[1].length === 2) toc.push([id, plain(m[2])]); out.push(`<h${m[1].length} id="${id}">${inline(m[2], dir)}</h${m[1].length}>`); i++; continue; }
    if (/^\|/.test(l) && /^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) {
      flush(); const row = (x) => x.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
      const head = row(l); i += 2; const body = []; while (i < lines.length && /^\|/.test(lines[i])) body.push(row(lines[i++]));
      out.push(`<div class="tablewrap" tabindex="0" role="region" aria-label="Table"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c, dir)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c, dir)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      flush(); const ordered = /^\d/.test(l); const items = [];
      while (i < lines.length && (/^(- |\d+\. )/.test(lines[i]) || /^ {2,}\S/.test(lines[i]))) { if (/^ {2,}\S/.test(lines[i])) items[items.length - 1] += ' ' + lines[i].trim(); else items.push(lines[i].replace(/^(- |\d+\. )/, '')); i++; }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x, dir)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    if (/^> ?/.test(l)) { flush(); const buf = []; while (i < lines.length && /^> ?/.test(lines[i])) buf.push(lines[i++].replace(/^> ?/, '')); out.push(`<blockquote>${render(buf.join('\n'), dir).html}</blockquote>`); continue; }
    m = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(l.trim());
    if (m) { flush(); const src = href(m[2], dir); const file = path.join(shotDir, path.basename(src)); const size = fs.existsSync(file) ? png(file) : null;
      if (!size) console.warn(`  note: image ${m[2]} is not in docs/screenshots yet`);
      out.push(`<figure><button class="shot" type="button" data-full="${esc(src)}" data-caption="${esc(m[1])}" aria-label="Enlarge: ${esc(m[1])}"><img loading="lazy" src="${esc(src)}" alt="${esc(m[1])}"${size ? ` width="${size.w}" height="${size.h}"` : ''}></button><figcaption>${esc(m[1])}</figcaption></figure>`); i++; continue; }
    if (!l.trim()) { flush(); i++; continue; }
    para.push(l.trim()); i++;
  }
  flush(); return { html: out.join('\n'), toc };
}
// Splits a document into title, lead paragraph, body and the links of its "Related" section.
function parseDoc(file, dir) {
  const md = fs.readFileSync(file, 'utf8'); const name = path.basename(file, '.md');
  const t = /^# (.+)$/m.exec(md); if (!t) throw new Error(`${file}: no title`);
  let rest = md.slice(t.index + t[0].length).replace(/^\s+/, '');
  const leadEnd = rest.search(/\n\s*\n/); const lead = (leadEnd < 0 ? rest : rest.slice(0, leadEnd)).replace(/\n/g, ' ').trim(); rest = leadEnd < 0 ? '' : rest.slice(leadEnd);
  let related = []; const r = /\n## Related\n([\s\S]*)$/.exec(rest);
  if (r) { rest = rest.slice(0, r.index); related = [...r[1].matchAll(/^- \[([^\]]+)\]\(([^)]+)\)(?:: (.+))?$/gm)].map((x) => ({ title: x[1], url: href(x[2], dir), note: x[3] || '' })); }
  const body = render(rest, dir);
  return { name, dir, file, title: plain(t[1]), lead, leadHtml: inline(lead, dir), desc: plain(lead).slice(0, 300), html: body.html, toc: body.toc, related };
}
const readDir = (dir) => (fs.existsSync(path.join(APP, 'docs', dir)) ? fs.readdirSync(path.join(APP, 'docs', dir)).filter((f) => f.endsWith('.md') && f !== 'README.md').sort().map((f) => parseDoc(path.join(APP, 'docs', dir, f), dir)) : []);

// ---- page shell ---------------------------------------------------------------------------------
const NAV = [['./#what', 'What it does', 'home'], ['./#remote', 'Remote', 'home'], ['./#screens', 'Screens', 'home'], ['articles/', 'Guides', 'articles'], ['features/', 'Features', 'features'], ['./#status', 'Status', 'home']];
const I = { search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4', menu: 'M4 7h16M4 12h16M4 17h16', theme: 'M4 5h16v11H4zM9 20h6M12 16v4' };
const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
function page({ out, title, desc, body, section, type = 'article', base, absolute = false }) {
  // base: prefix from this page to the site root. The 404 page can be served at any depth, so it uses root-absolute paths.
  const b = absolute ? '/choco/' : base; const url = ORIGIN + (out === 'index.html' ? '' : out.replace(/index\.html$/, ''));
  const link = (h) => (h.startsWith('./#') ? (out === 'index.html' ? h.slice(2) : b + h) : b + h);
  const html = `<!doctype html>
<html lang="en" data-base="${b}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#8A3F0B">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${out === '404.html' ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta property="og:site_name" content="Material Choco">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Material Choco: the app icon and the Overview page of the app, showing updates ready on two machines.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ORIGIN}og.png">
<meta name="twitter:image:alt" content="Material Choco: the app icon and the Overview page of the app, showing updates ready on two machines.">
<link rel="icon" href="${b}icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${b}site.css?v=${ASSET_V}">
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('mc.site.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<header class="top">
  <a class="brand" href="${out === 'index.html' ? '#top' : b + './'}"><img src="${b}icon.svg" alt="" width="36" height="36"><span>Material Choco</span></a>
  <nav id="nav" aria-label="Site">${NAV.map(([h, l, s]) => `<a href="${link(h)}"${s === section && s !== 'home' ? ' aria-current="page"' : ''}>${l}</a>`).join('')}<a href="${REPO}/tree/main/material-choco">Source</a></nav>
  <div class="tools">
    <button class="tool search" type="button" data-open-palette aria-haspopup="dialog" aria-keyshortcuts="Control+Shift+F" aria-label="Search this site and run actions. Shortcut: Control Shift F">${ic(I.search)}<span class="lbl">Search</span><kbd>Ctrl+Shift+F</kbd></button>
    <button class="tool" type="button" id="theme-toggle" aria-label="Theme">${ic(I.theme)}</button>
    <button class="tool menu" type="button" id="menu-toggle" aria-expanded="false" aria-controls="nav" aria-label="Open the menu">${ic(I.menu)}</button>
  </div>
</header>
${body}
<footer>
  <nav aria-label="Footer"><a href="${b}./">Home</a><a href="${b}articles/">Guides</a><a href="${b}features/">Features</a><a href="${REPO}/releases">Releases</a><a href="${BLOB}material-choco/HANDOFF.md">What was checked</a><a href="${BLOB}material-choco/ROADMAP.md">Roadmap</a><a href="${REPO}/tree/main/material-choco">Source</a></nav>
  <p>This site documents Material Choco and links to its downloads. It is not the app: the app runs on your Windows PC, and the hub runs in your own container.</p>
  <p>Apache-2.0. Built on the Chocolatey CLI. Not affiliated with or endorsed by Chocolatey Software, Inc. "Chocolatey" is their trademark.</p>
  <p id="built">Build information loads with scripts enabled.</p>
</footer>
<script src="${b}site.js?v=${ASSET_V}"></script>
</body>
</html>
`;
  return [out, html];
}
const crumbs = (list) => `<ol class="crumbs">${list.map(([h, l]) => `<li>${h ? `<a href="${h}">${l}</a>` : `<span aria-current="page">${l}</span>`}</li>`).join('')}</ol>`;

// ---- collect documents ----------------------------------------------------------------------------
const guides = readDir('articles').sort((a, b) => (GUIDES.indexOf(a.name) + 1 || 99) - (GUIDES.indexOf(b.name) + 1 || 99));
const features = readDir('features'); const byName = new Map(features.map((f) => [f.name, f]));
const grouped = GROUPS.map(([g, names]) => [g, names.map((n) => byName.get(n)).filter(Boolean)]).filter(([, l]) => l.length);
const placed = new Set(GROUPS.flatMap(([, n]) => n)); const loose = features.filter((f) => !placed.has(f.name)); if (loose.length) grouped.push(['More', loose]);
for (const [, names] of GROUPS) for (const n of names) if (!byName.has(n)) console.warn(`  note: no document docs/features/${n}.md`);
const flat = grouped.flatMap(([, l]) => l);

function docPage(d, list, kind) {
  const i = list.indexOf(d); const prev = list[i - 1]; const next = list[i + 1]; const up = kind === 'Guide' ? ['../articles/', 'Guides'] : ['../features/', 'Features'];
  const toc = d.toc.length > 1 ? `<details class="toc" open><summary>On this page</summary><ol>${d.toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ol></details>` : '';
  const related = d.related.length ? `<h2>Related</h2><div class="grid">${d.related.map((r) => `<a class="card reveal" href="${esc(r.url)}"><h3>${esc(r.title)}</h3>${r.note ? `<p>${inline(r.note, d.dir)}</p>` : ''}<span class="more">Open</span></a>`).join('')}</div>` : '';
  const body = `<main id="main">
<div class="dochead"><div class="rays" aria-hidden="true"></div>${crumbs([['../', 'Home'], up, [null, esc(d.title)]])}<h1>${esc(d.title)}</h1><p class="lead"><span>${d.leadHtml}</span></p></div>
<div class="doc${toc ? ' withtoc' : ''}">${toc}<article class="prose">
${d.html}
<p class="srclink">Source of this page: <a href="${BLOB}material-choco/docs/${d.dir}/${d.name}.md">docs/${d.dir}/${d.name}.md</a>. It describes version 0.1 of the app. See the <a href="../#status">honest status</a> for what has and has not been proven.</p>
</article></div>
<section class="related">${related}
<nav class="pager" aria-label="More ${kind === 'Guide' ? 'guides' : 'features'}">${prev ? `<a href="${prev.name}.html"><small>Previous</small>${esc(prev.title)}</a>` : `<a href="./"><small>Back to</small>All ${kind === 'Guide' ? 'guides' : 'features'}</a>`}${next ? `<a class="next" href="${next.name}.html"><small>Next</small>${esc(next.title)}</a>` : `<a class="next" href="./"><small>Back to</small>All ${kind === 'Guide' ? 'guides' : 'features'}</a>`}</nav>
</section>
</main>`;
  return page({ out: `${d.dir}/${d.name}.html`, title: `${d.title} · Material Choco`, desc: d.desc, body, section: d.dir, base: '../' });
}
const featureGroups = (prefix, withFilter) => `<div class="groups">${grouped.map(([g, l]) => `<${withFilter ? 'section' : 'details'} class="group reveal">${withFilter ? `<h3>${g}</h3>` : `<summary><span class="h">${g}</span><span class="n">${l.length} features</span></summary>`}<ul>${l.map((f) => `<li${withFilter ? ` data-feature="${esc((f.title + ' ' + f.desc + ' ' + g).toLowerCase())}"` : ''}><a href="${prefix}${f.name}.html">${esc(f.title)}${withFilter ? `<small>${esc(f.desc.split(/(?<=\.)\s/)[0])}</small>` : ''}</a></li>`).join('')}</ul></${withFilter ? 'section' : 'details'}>`).join('')}</div>`;
const guideCards = (prefix) => `<div class="grid">${guides.map((g, i) => `<a class="card reveal" href="${prefix}${g.name}.html"><span class="num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(g.title)}</h3><p>${esc(g.desc.split(/(?<=\.)\s/)[0])}</p><span class="more">Read the guide</span></a>`).join('')}</div>`;
function gallery() {
  const have = SHOTS.filter(([f]) => shotFiles.includes(f) && !HELD[f]);
  for (const f of shotFiles) if (!SHOTS.some(([s]) => s === f) && !HELD[f]) console.warn(`  note: ${f} has no caption in SHOTS and is not shown`);
  for (const [f, why] of Object.entries(HELD)) if (shotFiles.includes(f)) console.warn(`  note: ${f} is held back: ${why}`);
  const groups = [...new Set(have.map((s) => s[3]))];
  return groups.map((g, gi) => { const list = have.filter((s) => s[3] === g);
    const fig = ([f, t, c, , cls]) => { const { w, h } = png(path.join(shotDir, f)); return `<figure class="reveal${cls === 'wide' ? ' wide' : ''}"><button class="shot" type="button" data-full="shots/${f}" data-caption="${esc(t + '. ' + c)}" aria-label="Enlarge: ${esc(t)}"><img loading="lazy" src="shots/${f}" alt="${esc(c)}" width="${w}" height="${h}"></button><figcaption><b>${esc(t)}</b>${esc(c)}</figcaption></figure>`; };
    const desk = list.filter((s) => s[4] !== 'phone'); const ph = list.filter((s) => s[4] === 'phone');
    return `<details class="fold"${gi < 2 ? ' open' : ''}><summary><span class="h">${g}</span><span class="n">${list.length} captures</span></summary>${desk.length ? `<div class="shots">${desk.map(fig).join('')}</div>` : ''}${ph.length ? `<div class="shots phones"${desk.length ? ' style="margin-top:20px"' : ''}>${ph.map(fig).join('')}</div>` : ''}</details>`; }).join('\n') + `\n<p class="count" style="margin-top:24px">${have.length} captures shown.</p>`;
}

// ---- write everything -------------------------------------------------------------------------------
const pages = [];
const home = fs.readFileSync(path.join(TOOLS, 'home.html'), 'utf8').replace('{{FEATURES}}', featureGroups('features/', false)).replace('{{GUIDES}}', guideCards('articles/')).replace('{{GALLERY}}', gallery()).replace('{{FEATURE_COUNT}}', String(flat.length)).replace('{{GUIDE_COUNT}}', String(guides.length));
const HOME_DESC = 'A desktop app and a remote management hub for the Chocolatey CLI. Manage packages on one Windows PC or many, from a desktop app, a browser or a phone. Chocolatey ships inside.';
pages.push(page({ out: 'index.html', title: 'Material Choco: Chocolatey with a real interface, on one PC or a whole fleet', desc: HOME_DESC, body: home, section: 'home', type: 'website', base: '' }));
pages.push(page({ out: 'articles/index.html', title: 'Guides · Material Choco', desc: 'Step by step guides for Material Choco: one PC, the hub in a container, pairing, security, every command, and more.', section: 'articles', base: '../',
  body: `<main id="main"><div class="dochead"><div class="rays" aria-hidden="true"></div>${crumbs([['../', 'Home'], [null, 'Guides']])}<h1>Guides</h1><p class="lead"><span>${guides.length} how-to guides, written from the source and the README. Each one says what has been checked and what has not.</span></p></div><section class="band">${guideCards('')}<p class="sub" style="margin-top:28px">Looking for one specific feature? The <a href="../features/">feature pages</a> cover each of them separately, or press <kbd>Ctrl+Shift+F</kbd> to search everything.</p></section></main>` }));
pages.push(page({ out: 'features/index.html', title: 'Features · Material Choco', desc: `Every feature that ships in Material Choco 0.1, one page each: what it is, how to use it, how it was checked and its known limits.`, section: 'features', base: '../',
  body: `<main id="main"><div class="dochead"><div class="rays" aria-hidden="true"></div>${crumbs([['../', 'Home'], [null, 'Features']])}<h1>Features</h1><p class="lead"><span>Every feature that ships in this build has its own page: what it is, how to use it, what was checked and how, and its known limits. Features that are planned and not built are listed in the roadmap, not here.</span></p></div><section class="band"><label class="filter"><span class="sr">Filter features</span>${ic(I.search).replace('<svg', '<svg class="ic"')}<input id="feature-filter" type="search" placeholder="Filter features" autocomplete="off"></label><p class="count" id="feature-count" aria-live="polite"></p>${featureGroups('', true)}</section></main>` }));
for (const g of guides) pages.push(docPage(g, guides, 'Guide'));
for (const f of flat) pages.push(docPage(f, flat, 'Feature'));
pages.push(page({ out: '404.html', title: 'Page not found · Material Choco', desc: 'This page does not exist on the Material Choco site.', section: '', base: '', absolute: true,
  body: `<main id="main"><section class="hero notfound" id="top"><div class="rays" aria-hidden="true"></div><div class="blob" aria-hidden="true"><img src="/choco/icon.svg" alt="" width="120" height="120"></div><h1>Nothing is installed here.</h1><p class="lead">This address does not match any page of the Material Choco site. The page may have moved, or the link may be mistyped.</p><div class="cta"><a class="dl" href="/choco/">Go to the home page</a><button class="ghost" type="button" data-open-palette style="background:none;font:inherit;font-weight:700;font-size:1.12rem;cursor:pointer">Search the site</button></div><p class="fine">You can also browse the <a href="/choco/articles/">guides</a> or the <a href="/choco/features/">feature pages</a>.</p></section></main>` }));

const search = [
  { kind: 'Page', title: 'Home', sub: 'Download, overview, screenshots and status.', url: './' }, { kind: 'Page', title: 'Guides', sub: `${guides.length} how-to guides.`, url: 'articles/' }, { kind: 'Page', title: 'Features', sub: `${flat.length} feature pages.`, url: 'features/' },
  ...[['top', 'Download the installer', 'download setup windows'], ['what', 'What it does', 'highlights'], ['everything', 'Everything in this build', 'feature list all'], ['remote', 'Remote management in three steps', 'hub docker pairing agent'], ['guides', 'Guides', 'articles how to'], ['screens', 'Screenshots', 'gallery pictures captures'], ['status', 'Honest status', 'verified proven limits unsigned']].map(([id, t, w]) => ({ kind: 'Section', title: t, sub: 'On the home page.', url: './#' + id, words: w })),
  ...guides.map((g) => ({ kind: 'Guide', title: g.title, sub: g.desc.split(/(?<=\.)\s/)[0], url: `articles/${g.name}.html`, words: g.toc.map((t) => t[1]).join(' ').toLowerCase() })),
  ...guides.flatMap((g) => g.toc.map(([id, t]) => ({ kind: 'Section', title: t, sub: `In the guide: ${g.title}`, url: `articles/${g.name}.html#${id}` }))),
  ...flat.map((f) => ({ kind: 'Feature', title: f.title, sub: f.desc.split(/(?<=\.)\s/)[0], url: `features/${f.name}.html` })),
];
pages.push(['search.json', JSON.stringify(search) + '\n']);

let stale = 0;
for (const [out, text] of pages) {
  const file = path.join(SITE, out);
  if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('stale: ' + out); stale++; } continue; }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
}
// Pages whose source document was removed are deleted so they cannot go stale.
for (const dir of ['articles', 'features']) for (const f of fs.existsSync(path.join(SITE, dir)) ? fs.readdirSync(path.join(SITE, dir)) : []) if (f.endsWith('.html') && !pages.some(([o]) => o === `${dir}/${f}`)) { if (check) { console.error('orphan: ' + dir + '/' + f); stale++; } else fs.rmSync(path.join(SITE, dir, f)); }
console.log(check ? (stale ? `${stale} page(s) differ from their sources. Run the generator.` : `${pages.length} files match their sources.`) : `Wrote ${pages.length} files: ${guides.length} guides, ${flat.length} feature pages.`);
process.exit(stale ? 1 : 0);
