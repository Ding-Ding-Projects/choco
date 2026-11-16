// Material Choco site behaviour: theme, compact menu, command palette, screenshot lightbox,
// installer lookup, feature filter and build information. No dependencies. The only request
// that leaves this site is the GitHub releases lookup below.
(() => {
  'use strict';
  const root = document.documentElement;
  const base = root.dataset.base || '';
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k);
    return n;
  };
  const svg = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(s.namespaceURI, 'path'); p.setAttribute('d', d); s.append(p); return s; };
  const ICON = { close: 'M6 6l12 12M18 6L6 18', prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4' };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable: the choice lasts for this page */ } } };

  // ---- theme: follows the system until the visitor chooses, then remembers the choice -----------
  const THEMES = ['system', 'light', 'dark'];
  const THEME_ICON = { system: 'M4 5h16v11H4zM9 20h6M12 16v4', light: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', dark: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' };
  const themeBtn = $('#theme-toggle');
  const currentTheme = () => (THEMES.includes(store.get('mc.site.theme')) ? store.get('mc.site.theme') : 'system');
  function setTheme(t) {
    store.set('mc.site.theme', t === 'system' ? null : t);
    if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
    if (themeBtn) { const label = { system: 'Theme: follows the system', light: 'Theme: light', dark: 'Theme: dark' }[t]; themeBtn.setAttribute('aria-label', label + '. Activate to change.'); themeBtn.title = label; themeBtn.replaceChildren(svg(THEME_ICON[t])); }
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#2A1D17' : '#8A3F0B');
  }
  setTheme(currentTheme());
  themeBtn?.addEventListener('click', () => setTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTheme(currentTheme()));

  // ---- header: compact menu on narrow screens, shadow after scrolling ---------------------------
  const top = $('.top'); const nav = $('#nav'); const menuBtn = $('#menu-toggle');
  const setMenu = (open) => { if (!nav || !menuBtn) return; nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Close the menu' : 'Open the menu'); };
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav?.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
  document.addEventListener('click', (e) => { if (nav?.classList.contains('open') && !top.contains(e.target)) setMenu(false); });
  const onScroll = () => top?.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // The page outline starts folded on narrow screens so the text comes first.
  if (matchMedia('(max-width: 999px)').matches) $$('.toc').forEach((t) => t.removeAttribute('open'));

  // ---- reveal on scroll ---------------------------------------------------------------------------
  const io = 'IntersectionObserver' in window && !reduced() ? new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -6% 0px' }) : null;
  $$('details').forEach((d) => d.addEventListener('toggle', () => { if (d.open) $$('.reveal', d).forEach((n) => n.classList.add('in')); }));
  $$('.reveal').forEach((n, i) => { n.style.setProperty('--i', i % 6); if (io) io.observe(n); else n.classList.add('in'); });
  // Safety net: the observer can miss an element (inside a fold, or in the last strip of the page that never crosses its margin).
  // Anything on screen is shown on the next scroll, resize or after a short wait, so content can never stay invisible.
  const showVisible = () => { for (const n of $$('.reveal:not(.in)')) { const b = n.getBoundingClientRect(); if (b.width && b.top < innerHeight && b.bottom > 0) n.classList.add('in'); } };
  let showTimer = 0; const showSoon = () => { clearTimeout(showTimer); showTimer = setTimeout(showVisible, 120); };
  addEventListener('scroll', showSoon, { passive: true }); addEventListener('resize', showSoon); setTimeout(showVisible, 1200);

  // ---- installer lookup ---------------------------------------------------------------------------
  // Finds the newest release whose tag starts with material-choco-v and that carries a Setup .exe,
  // points the download button at that file and lists the latest five. If the lookup fails, the
  // button keeps linking to the releases page and the page says so.
  const RELEASES = 'https://github.com/Ding-Ding-Projects/choco/releases';
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const fmtSize = (bytes) => `${Math.round(bytes / 1048576)} MB`;
  let installer = null; // { url, version } once known
  async function findReleases() {
    try { const c = JSON.parse(sessionStorage.getItem('mc.site.releases2') || 'null'); if (c && Date.now() - c.at < 10 * 60 * 1000) return c.list; } catch { /* no cache */ }
    const res = await fetch('https://api.github.com/repos/Ding-Ding-Projects/choco/releases?per_page=30', { headers: { accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(res.status === 403 || res.status === 429 ? `GitHub is rate limiting this network (status ${res.status})` : `GitHub answered ${res.status}`);
    const list = (await res.json()).filter((r) => !r.draft && typeof r.tag_name === 'string' && r.tag_name.startsWith('material-choco-v'))
      .map((r) => { const a = (r.assets || []).find((x) => /Setup.*\.exe$/i.test(x.name)); return a ? { version: r.tag_name.replace('material-choco-v', ''), date: r.published_at, size: a.size, url: a.browser_download_url, digest: typeof a.digest === 'string' ? a.digest : '', name: a.name, notes: r.html_url, pre: !!r.prerelease } : null; })
      .filter(Boolean).slice(0, 5);
    try { sessionStorage.setItem('mc.site.releases2', JSON.stringify({ at: Date.now(), list })); } catch { /* no cache */ }
    return list;
  }
  const dl = $('#dl');
  if (dl) (async () => {
    const note = $('#dl-note'); const label = $('#dl-label'); const host = $('#rel-list');
    try {
      const list = await findReleases();
      if (!list.length) throw new Error('no release with an installer was found');
      const r = list[0]; installer = r;
      dl.href = r.url; label.textContent = `Download for Windows, version ${r.version}`;
      note.textContent = `${r.name}, ${fmtSize(r.size)}, published ${fmtDate(r.date)}. 64-bit Windows. Not code signed.`;
      const dg = $('#digest-line'); if (dg && r.digest) dg.replaceChildren('SHA-256 of ' + r.name + ' as recorded by GitHub: ', el('span', { class: 'digest', text: r.digest.replace(/^sha256:/, '') })); else if (dg) dg.textContent = 'GitHub did not provide a digest for the newest installer in this lookup, so there is none to show here. The release page may list one.';
      host?.replaceChildren(el('ol', {}, list.map((x) => el('li', {}, el('b', { text: x.version + (x.pre ? ' (pre-release)' : '') }), el('span', { text: `${fmtDate(x.date)}, ${fmtSize(x.size)}` }), el('a', { href: x.url, text: 'Setup.exe', 'aria-label': `Download Setup.exe for version ${x.version}` }), el('a', { href: x.notes, text: 'Notes', 'aria-label': `Release notes for version ${x.version}` })))));
    } catch (e) {
      label.textContent = 'Open the releases page';
      note.textContent = `The newest installer could not be looked up just now (${e.message}). The button opens the releases page instead.`;
      host?.replaceChildren(el('p', {}, 'The list could not be loaded. Every release, with its installer, is on the ', el('a', { href: RELEASES, text: 'releases page' }), '.'));
    }
  })();

  // ---- build information --------------------------------------------------------------------------
  const built = $('#built');
  if (built) fetch(base + 'build.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing')))).then((b) => {
    const when = new Date(b.builtAt); const parts = [];
    if (b.version) parts.push(`Documents Material Choco ${b.version}.`);
    parts.push(`Site built ${Number.isNaN(when.getTime()) ? 'at an unknown time' : when.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}${b.commit ? ` from commit ${String(b.commit).slice(0, 7)}` : ''}.`);
    built.textContent = parts.join(' ');
  }).catch(() => { built.textContent = 'Build information is unavailable for this copy of the site.'; });

  // ---- feature filter (features index) ------------------------------------------------------------
  const filter = $('#feature-filter');
  if (filter) {
    const count = $('#feature-count'); const items = $$('[data-feature]');
    const run = () => { const q = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean); let n = 0; for (const li of items) { const hit = q.every((w) => li.dataset.feature.includes(w)); li.hidden = !hit; if (hit) n++; } for (const g of $$('.group')) g.hidden = !$$('[data-feature]', g).some((li) => !li.hidden); count.textContent = q.length ? `${n} of ${items.length} features match.` : `${items.length} features.`; };
    filter.addEventListener('input', run); run();
  }

  // ---- screenshot lightbox --------------------------------------------------------------------------
  const shots = $$('.shot');
  let lightbox = null; let at = 0;
  function showShot(i) {
    at = (i + shots.length) % shots.length; const b = shots[at]; const img = $('img', lightbox);
    img.src = b.dataset.full; img.alt = $('img', b).alt;
    $('.bar span', lightbox).textContent = `${at + 1} of ${shots.length}`;
    $('p', lightbox).textContent = b.dataset.caption || '';
    if (!reduced()) { img.style.animation = 'none'; void img.offsetWidth; img.style.animation = ''; }
  }
  function openShot(i) {
    shots[i].closest('details')?.setAttribute('open', '');
    if (!lightbox) {
      const tool = (label, d, fn) => el('button', { class: 'tool', type: 'button', 'aria-label': label, title: label, onclick: fn }, svg(d));
      lightbox = el('dialog', { class: 'lightbox', 'aria-label': 'Screenshot viewer' },
        el('div', { class: 'bar' }, el('span', { 'aria-live': 'polite' }), tool('Previous screenshot', ICON.prev, () => showShot(at - 1)), tool('Next screenshot', ICON.next, () => showShot(at + 1)), tool('Close the viewer', ICON.close, () => lightbox.close())),
        el('div', { class: 'stage' }, el('img', { alt: '' })), el('p', {}));
      lightbox.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); showShot(at - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); showShot(at + 1); } else if (e.key === 'Home') { e.preventDefault(); showShot(0); } else if (e.key === 'End') { e.preventDefault(); showShot(shots.length - 1); } });
      lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.classList.contains('stage')) lightbox.close(); });
      let x0 = null; const stage = $('.stage', lightbox);
      stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
      stage.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 60) showShot(at + (e.clientX < x0 ? 1 : -1)); x0 = null; });
      document.body.append(lightbox);
    }
    const opener = shots[i];
    lightbox.addEventListener('close', () => opener.focus(), { once: true });
    showShot(i); lightbox.showModal(); $('.bar .tool:last-child', lightbox).focus();
  }
  shots.forEach((b, i) => { b.addEventListener('click', () => openShot(i)); $('img', b).addEventListener('error', () => { b.closest('figure').hidden = true; }); });

  // ---- copy button on every code block -----------------------------------------------------------------
  // Added by script, so a page without scripts shows plain code blocks and nothing that cannot work.
  const said = el('div', { class: 'sr', role: 'status', 'aria-live': 'polite' }); document.body.append(said);
  const COPY = 'M9 9h10v11H9zM5 15V4h10'; const DONE = 'M5 12l5 5 9-10';
  for (const pre of $$('pre')) {
    const wrap = el('div', { class: 'codewrap' }); pre.replaceWith(wrap); wrap.append(pre);
    const btn = el('button', { class: 'copybtn', type: 'button', 'aria-label': 'Copy this code', title: 'Copy' }, svg(COPY)); btn.firstChild.setAttribute('class', '');
    btn.addEventListener('click', async () => {
      const text = pre.innerText.replace(/\n$/, ''); let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { try { const t = el('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' }); t.value = text; document.body.append(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch { ok = false; } }
      said.textContent = ''; setTimeout(() => { said.textContent = ok ? 'Copied' : 'Copy failed. Select the text and copy it by hand.'; }, 30);
      btn.classList.toggle('done', ok); btn.title = ok ? 'Copied' : 'Copy failed'; btn.replaceChildren(svg(ok ? DONE : COPY)); btn.firstChild.setAttribute('class', '');
      setTimeout(() => { btn.classList.remove('done'); btn.title = 'Copy'; btn.replaceChildren(svg(COPY)); btn.firstChild.setAttribute('class', ''); }, 1800);
    });
    wrap.append(btn);
  }

  // ---- command palette on Ctrl+Shift+F ----------------------------------------------------------------
  let palette = null; let index = null; let shown = []; let sel = 0;
  const actions = () => [
    { kind: 'Action', title: installer ? `Download the Windows installer, version ${installer.version}` : 'Get the Windows installer', sub: installer ? 'Starts the download of Setup.exe from the release.' : 'Opens the releases page on GitHub.', words: 'download install setup exe windows installer release', run: () => { location.href = installer ? installer.url : RELEASES; } },
    { kind: 'Action', title: 'Open all releases', sub: 'Every published version, on GitHub.', words: 'releases versions older changelog', run: () => { location.href = RELEASES; } },
    ...THEMES.map((t) => ({ kind: 'Action', title: { system: 'Theme: follow the system', light: 'Theme: light', dark: 'Theme: dark' }[t] + (currentTheme() === t ? ' (current)' : ''), sub: 'Changes the look of this site and remembers it on this device.', words: 'theme appearance dark light mode colour color system', keep: true, run: () => setTheme(t) })),
    { kind: 'Action', title: 'Open the first screenshot', sub: 'Opens the screenshot viewer on the home page.', words: 'gallery screens pictures images lightbox', run: () => { if (shots.length) openShot(0); else location.href = base + 'screens.html'; } },
    { kind: 'Action', title: 'Open the demo', sub: 'The real interface in your browser, against simulated machines.', words: 'try demo simulated play', run: () => { location.href = base + 'demo/'; } },
    { kind: 'Action', title: 'View the source on GitHub', sub: 'The material-choco folder of the repository.', words: 'code repository github source', run: () => { location.href = 'https://github.com/Ding-Ding-Projects/choco/tree/main/material-choco'; } },
    { kind: 'Action', title: 'Back to the top of this page', sub: '', words: 'top scroll start', run: () => { scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); } },
  ];
  const ORDER = { Action: 0, Page: 1, Guide: 2, Feature: 3, Section: 4 };
  function search(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const all = [...actions(), ...(index || []).map((x) => ({ ...x, run: () => { const url = base + x.url; if (new URL(url, location.href).href === location.href) $(new URL(url, location.href).hash || 'body')?.scrollIntoView(); else location.href = url; } }))];
    if (!words.length) return all.filter((x) => x.kind !== 'Section').slice(0, 40);
    const scored = [];
    for (const it of all) { const t = it.title.toLowerCase(); const hay = `${t} ${(it.sub || '').toLowerCase()} ${it.words || ''} ${it.kind.toLowerCase()}`; if (!words.every((w) => hay.includes(w))) continue; scored.push([(words.every((w) => t.includes(w)) ? 0 : 10) + (t.startsWith(words[0]) ? 0 : 2) + ORDER[it.kind], it]); }
    return scored.sort((a, b) => a[0] - b[0]).slice(0, 40).map((x) => x[1]);
  }
  function drawPalette() {
    const input = $('input', palette); const list = $('[role="listbox"]', palette); const hint = $('.hint', palette);
    shown = search(input.value); sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.replaceChildren(...(shown.length ? shown.map((it, i) => el('div', { class: 'prow', role: 'option', id: 'pal-' + i, 'aria-selected': String(i === sel), onclick: () => choose(i), onpointermove: () => { if (sel !== i) { sel = i; mark(); } } }, el('span', { class: 't' }, el('b', { text: it.title }), it.sub ? el('small', { text: it.sub }) : null), el('span', { class: 'kind', text: it.kind }))) : [el('p', { class: 'none', text: index ? 'Nothing matches. Try a shorter word.' : 'Nothing matches among the actions. The page index is still loading or could not be loaded.' })]));
    hint.textContent = `${shown.length} result${shown.length === 1 ? '' : 's'}. Arrow keys move, Enter opens, Escape closes.`;
    mark();
  }
  function mark() { const input = $('input', palette); $$('.prow', palette).forEach((r, i) => r.setAttribute('aria-selected', String(i === sel))); const cur = $('#pal-' + sel, palette); if (cur) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant'); }
  function choose(i) { const it = shown[i]; if (!it) return; if (it.keep) { it.run(); drawPalette(); return; } palette.close(); it.run(); }
  function openPalette() {
    if (palette?.open) return;
    if (lightbox?.open) lightbox.close();
    setMenu(false);
    if (!palette) {
      const input = el('input', { type: 'search', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', 'aria-label': 'Search pages, guides, features and actions', placeholder: 'Search pages, guides, features and actions', autocomplete: 'off', spellcheck: 'false' });
      palette = el('dialog', { class: 'palette', 'aria-label': 'Command palette' },
        el('div', { class: 'q' }, svg(ICON.search), input, el('button', { class: 'tool', type: 'button', 'aria-label': 'Close the command palette', onclick: () => palette.close() }, svg(ICON.close))),
        el('p', { class: 'hint', 'aria-live': 'polite' }), el('div', { role: 'listbox', id: 'pal-list', 'aria-label': 'Results' }));
      input.addEventListener('input', () => { sel = 0; drawPalette(); });
      palette.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
        else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); sel = 0; mark(); }
        else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); sel = shown.length - 1; mark(); }
        else if (e.key === 'Enter' && e.target === input) { e.preventDefault(); choose(sel); }
        else if (e.key === 'Escape') { e.preventDefault(); palette.close(); }
      });
      palette.addEventListener('click', (e) => { if (e.target === palette) palette.close(); });
      document.body.append(palette);
    }
    const opener = document.activeElement;
    palette.addEventListener('close', () => { if (document.activeElement === document.body || !document.activeElement) opener?.focus?.(); }, { once: true });
    if (!index) fetch(base + 'search.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing')))).then((j) => { index = j; if (palette.open) drawPalette(); }).catch(() => { /* the palette still offers its actions */ });
    const input = $('input', palette); input.value = ''; sel = 0; palette.showModal(); drawPalette(); input.focus();
  }
  $$('[data-open-palette]').forEach((b) => b.addEventListener('click', openPalette));
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openPalette(); } });
})();
