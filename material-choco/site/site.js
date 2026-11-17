// Material Choco site behaviour: theme, compact menu, command palette, screenshot lightbox,
// installer lookup, page searches with a Regex switch and a pattern builder, and build
// information. No dependencies. The only request that leaves this site is the GitHub releases
// lookup below.
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
  const ICON = { close: 'M6 6l12 12M18 6L6 18', prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4', pattern: 'M17 3v8M13.5 5l7 4M13.5 9l7-4M4 15h6v6H4z', yes: 'M5 12l5 5 9-10' };
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

  // ---- searching: plain words, or a regular expression -------------------------------------------
  // Plain words by default: every word must appear somewhere, upper and lower case alike. With the
  // Regex switch on, the text is a JavaScript regular expression, case-insensitive. Every item is
  // read as lines: its name first, then its description and its group, so ^ and $ mark the start
  // and end of a line. A pattern that cannot be compiled, or that takes too long, matches nothing
  // and the search says why. Each search keeps its own text, Regex switch and builder parts for
  // this browser tab. Nothing is sent anywhere. A pattern reads at most TEXT_MAX characters of an
  // item, which covers the longest item on the site (a feature with every word of its page).
  const PATTERN_MAX = 200; const TEXT_MAX = 8000; const RUN_MS = 1000; const FLAGS = 'im';
  // Assigns text only when it changes, so a live region is not announced again with the same words.
  const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
  // A live count: the visible sentence and, for screen readers only, why a pattern cannot be used. The
  // error line shows the reason on screen, but it is not a live region, and a description that changes
  // while the field has focus is not read again, so the count carries it. The reason no longer repeats
  // the pattern, so it changes only when the reason itself changes.
  const setCount = (node, said, why) => {
    const full = why ? `${said} Reason: ${why}` : said;
    if (!node || node.textContent === full) return;
    node.replaceChildren(said, ...(why ? [' ', el('span', { class: 'sr', text: `Reason: ${why}` })] : []));
  };
  // The browser's message repeats the whole pattern. Only the reason is kept, so it stays short and
  // does not change with every character typed.
  const reason = (e) => { const s = String((e && e.message) || e).replace(/^(?:SyntaxError: )?Invalid regular expression: (?:\/[\s\S]*\/[a-z]*: )?/i, '').trim() || 'The browser did not accept it'; return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, '') + '.'; };
  const SLOW = `It took longer than ${RUN_MS / 1000} second to test, so it was stopped. Patterns that repeat a group which itself repeats, such as (a+)+, can take this long.`;
  function matcher(query, regex) {
    if (!query.trim()) return { ok: true, empty: true, test: () => true };
    if (!regex) { const words = query.toLowerCase().split(/\s+/).filter(Boolean); return { ok: true, test: (s) => { const l = s.toLowerCase(); return words.every((w) => l.includes(w)); } }; }
    if (query.length > PATTERN_MAX) return { ok: false, error: `It is longer than ${PATTERN_MAX} characters.` };
    try { new RegExp(query, FLAGS); } catch (e) { return { ok: false, error: reason(e) }; }
    return { ok: true, regex: true, source: query };
  }
  // A regular expression is tested in a background worker, so a pattern that backtracks without end
  // cannot stop the page. The worker is stopped after RUN_MS and the search says the pattern was too
  // slow. The worker is made from text in this file; it fetches nothing.
  const WORKER_SRC = 'onmessage=function(e){var d=e.data,re,h=[];try{re=new RegExp(d.source,d.flags)}catch(x){postMessage({id:d.id,error:String(x&&x.message||x)});return}for(var i=0;i<d.texts.length;i++)h.push(re.test(d.texts[i]));postMessage({id:d.id,hits:h})};';
  let workerUrl = null; let noWorker = false;
  // Without a worker the pattern runs on the page, where a slow one cannot be stopped. A pattern that
  // repeats a group containing a repeat or a choice is refused there instead of risking the page.
  const RISKY = /\((?:[^()\\]|\\.)*[*+}|](?:[^()\\]|\\.)*\)(?:[*+]|\{\d+,\d*\})/;
  function runHere(source, texts) {
    if (RISKY.test(source)) return { error: 'This browser cannot test patterns in the background, and a pattern that repeats a group containing a repeat or a choice could stop the page. Simplify the pattern.' };
    try { const re = new RegExp(source, FLAGS); return { hits: texts.map((s) => re.test(s)) }; } catch (e) { return { error: reason(e) }; }
  }
  // One runner per search: a new request replaces one that is still running. dispose() stops the
  // worker for good (a later run would start a new one), for a search that goes away, such as the
  // preview of a pattern builder that was closed.
  function patternRunner() {
    let w = null; let job = null; let serial = 0;
    const stop = () => { if (w) { w.terminate(); w = null; } };
    const finish = (result) => { const j = job; job = null; if (j) { clearTimeout(j.timer); j.resolve(result); } };
    return {
      run(source, texts) {
        if (job) { finish({ superseded: true }); stop(); }
        if (!w && !noWorker) {
          try {
            workerUrl = workerUrl || URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
            w = new Worker(workerUrl);
            w.onmessage = (e) => { if (job && e.data && e.data.id === job.id) finish(e.data.error ? { error: reason({ message: e.data.error }) } : { hits: e.data.hits }); };
            w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); noWorker = true; stop(); if (job) { const j = job; finish(runHere(j.source, j.texts)); } };
          } catch { noWorker = true; w = null; }
        }
        if (!w) return Promise.resolve(runHere(source, texts));
        const id = ++serial;
        return new Promise((resolve) => {
          job = { id, source, texts, resolve, timer: setTimeout(() => { if (job && job.id === id) { finish({ error: SLOW }); stop(); } }, RUN_MS) };
          w.postMessage({ id, source, flags: FLAGS, texts });
        });
      },
      dispose() { if (job) finish({ superseded: true }); stop(); },
    };
  }
  // Tests every text with a matcher. Resolves to { hits }, { error, hits } or { superseded }.
  async function evaluate(m, texts, runner) {
    if (m.empty) return { hits: texts.map(() => true) };
    if (!m.ok) return { error: m.error, hits: texts.map(() => false) };
    if (!m.regex) return { hits: texts.map((s) => m.test(s)) };
    const r = await runner.run(m.source, texts.map((s) => s.slice(0, TEXT_MAX)));
    if (r.superseded) return r;
    return r.error ? { error: r.error, hits: texts.map(() => false) } : { hits: r.hits };
  }
  const BLANK_PARTS = { any: '', starts: '', ends: '', word: '', not: '' };
  function searchState(id) {
    const key = 'mc.site.search.' + id; let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { saved = null; }
    const parts = { ...BLANK_PARTS };
    if (saved && saved.parts && typeof saved.parts === 'object') for (const k of Object.keys(parts)) if (typeof saved.parts[k] === 'string') parts[k] = saved.parts[k];
    const st = { q: saved && typeof saved.q === 'string' ? saved.q : '', regex: !!saved && saved.regex === true, parts };
    st.save = () => { try { sessionStorage.setItem(key, JSON.stringify({ q: st.q, regex: st.regex, parts: st.parts })); } catch { /* storage unavailable: the state lasts while the page is open */ } };
    return st;
  }
  // The Regex switch, the pattern builder button, the line that explains how a pattern reads an item
  // (shown while Regex is on) and the error line, for one search. items() returns what the builder
  // previews: [{ name, detail, text }]. The error line is not a live region: the count beside it
  // says that the pattern cannot be used and, for screen readers, why (see setCount).
  // The field is described by the error line, the ids in describe (its count), and, while Regex is
  // on, the explanation, so a screen reader says that Regex is on when the field is reached. Its
  // placeholder follows the switch too: words to look for, or a regular expression (rxPlaceholder).
  let searchSerial = 0;
  function searchTools(st, { what, noun = 'item', nouns = 'items', lines, items, input, run, describe = [], rxPlaceholder = 'A regular expression' }) {
    const n = ++searchSerial;
    const sw = el('button', { type: 'button', class: 'rxswitch', role: 'switch', 'aria-checked': String(st.regex), title: 'Treat the text as a regular expression' }, el('span', { class: 'knob', 'aria-hidden': 'true' }), 'Regex');
    const hint = el('p', { class: 'shint', id: 'search-hint-' + n, text: `Regex is on. Each ${noun} is read as lines: ${lines}. ^ and $ mark the start and end of a line. Upper and lower case are treated the same.` });
    const wordsPlaceholder = input.getAttribute('placeholder');
    const sync = () => { sw.setAttribute('aria-checked', String(st.regex)); hint.hidden = !st.regex; input.setAttribute('aria-describedby', [err.id, ...describe, ...(st.regex ? [hint.id] : [])].join(' ')); if (wordsPlaceholder) input.setAttribute('placeholder', st.regex ? rxPlaceholder : wordsPlaceholder); };
    sw.addEventListener('click', () => { st.regex = !st.regex; sync(); st.save(); run(); });
    const bb = el('button', { type: 'button', class: 'tool rxbuild', 'aria-haspopup': 'dialog', 'aria-label': `Build a pattern for ${what}`, title: 'Build a pattern from plain parts' }, svg(ICON.pattern), el('span', { class: 'lbl', text: 'Build a pattern' }));
    bb.addEventListener('click', () => openBuilder({ st, what, nouns, lines, items: items(), opener: bb, apply: (pat) => { st.q = pat; st.regex = true; input.value = pat; sync(); st.save(); run(); input.focus(); } }));
    const err = el('p', { class: 'serr', id: 'search-error-' + n });
    // Shows or clears the reason a pattern cannot be used, and marks the field as invalid meanwhile.
    const fail = (why) => { setText(err, why ? `The pattern cannot be used: ${why}` : ''); if (why) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); };
    sync();
    return { sw, bb, err, hint, sync, fail };
  }

  // ---- search boxes on the pages (features, guides, screens, long guides and feature pages) ---------
  // Each box looks for the elements marked data-search-item in the main content. Groups marked
  // data-search-group are hidden when none of their items match, with the jump links that lead into
  // them, and a list of jump links is hidden when none of its links is left. An item marked
  // data-broken (a picture that failed to load) stays hidden and is not counted. Below the field come
  // the error line, the count and the empty state, so they stay in view while typing, and then the
  // explanation of how a pattern reads an item.
  const searches = [];
  const linkItem = (a) => (a.parentElement && a.parentElement.tagName === 'LI' ? a.parentElement : a);
  const targetOf = (hash) => { try { return hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null; } catch { return null; } };
  for (const box of $$('[data-site-search]')) {
    const input = $('input', box); const count = $('.count', box); const row = $('.srow', box);
    if (!input || !count || !row) continue;
    const noun = box.dataset.noun || 'item'; const nouns = box.dataset.nouns || 'items';
    const lines = box.dataset.lines || 'its name first, then its description';
    const kind = /^search/i.test($('.slabel', box)?.textContent || '') ? 'search' : 'filter';
    const scope = $('#main') || document.body;
    const items = $$('[data-search-item]', scope).map((node) => { const name = node.dataset.name || ''; const detail = node.dataset.detail || ''; return { node, name, detail, text: name + '\n' + detail }; });
    const live = () => items.filter((it) => !it.node.hasAttribute('data-broken'));
    const jumpLists = $$('[data-search-jumps]', scope); const jumps = jumpLists.flatMap((j) => $$('a', j));
    const groups = $$('[data-search-group]', scope).map((node) => ({ node, items: items.filter((it) => node.contains(it.node)), jumps: jumps.filter((a) => { const t = targetOf(a.getAttribute('href') || ''); return !!t && (t === node || node.contains(t)); }) }));
    const st = searchState(box.dataset.siteSearch);
    const runner = patternRunner();
    let ticket = 0; let note = ''; let pending = Promise.resolve();
    const clear = () => { st.q = ''; input.value = ''; st.save(); return rerun(); };
    const empty = el('div', { class: 'sempty', hidden: true }, el('p'), el('button', { type: 'button', class: 'btn tonal', onclick: () => { clear(); input.focus(); } }, `Clear the ${kind}`));
    const run = async () => {
      const t = ++ticket; const m = matcher(st.q, st.regex); const list = live();
      const r = await evaluate(m, list.map((it) => it.text), runner);
      if (t !== ticket || r.superseded) return;
      const bad = r.error || ''; let n = 0;
      list.forEach((it, i) => { const hit = !!r.hits[i]; it.node.hidden = !hit; if (hit) n++; });
      for (const it of items) if (it.node.hasAttribute('data-broken')) it.node.hidden = true;
      for (const g of groups) {
        const all = g.items.filter((it) => !it.node.hasAttribute('data-broken')); const k = all.filter((it) => !it.node.hidden).length;
        // A group without items (a section of a guide with no list or table) only hides while a search is active.
        const off = !m.empty && k === 0; g.node.hidden = off;
        for (const a of g.jumps) linkItem(a).hidden = off;
        // A count may name what it counts: data-noun for one, data-nouns for more (or none).
        const word = (c) => (c.dataset.noun ? ' ' + (all.length === 1 ? c.dataset.noun : c.dataset.nouns || c.dataset.noun) : '');
        for (const c of [...$$('[data-group-count]', g.node), ...g.jumps.flatMap((a) => $$('[data-group-count]', a))]) setText(c, (m.empty ? `${all.length}` : `${k} of ${all.length}`) + word(c));
      }
      for (const j of jumpLists) j.hidden = !$$('a', j).some((a) => !linkItem(a).hidden);
      tools.fail(bad);
      const total = list.length;
      let said = bad ? `None of the ${total} ${nouns} are shown while the pattern cannot be used.` : m.empty ? `${total} ${total === 1 ? noun : nouns}.` : `${n} of ${total} ${nouns} match${st.regex ? ' the pattern' : ''}.`;
      if (note) { said += ' ' + note; note = ''; }
      setCount(count, said, bad);
      empty.hidden = !bad && (m.empty || n > 0);
      setText($('p', empty), bad ? `Nothing is shown because the pattern cannot be used. Fix it, turn Regex off, or clear the ${kind}.` : `No ${nouns} match the ${kind}.`);
    };
    const rerun = () => (pending = run());
    const tools = searchTools(st, { what: `the ${nouns} on this page`, noun, nouns, lines, items: () => live().map(({ name, detail, text }) => ({ name, detail, text })), input, run: rerun, describe: [count.id] });
    row.append(el('span', { class: 'stools' }, tools.sw, tools.bb)); row.after(tools.err); box.append(empty, tools.hint);
    input.value = st.q;
    const onType = () => { if (st.q === input.value) return; st.q = input.value; st.save(); rerun(); };
    input.addEventListener('input', onType); input.addEventListener('search', onType);
    // A link, bookmark or palette entry that leads to a part this search has hidden clears the search,
    // says so, and then shows that part. Returns true when it did.
    const reveal = async (target) => {
      await pending;
      if (!target || !scope.contains(target)) return false;
      const hiddenHere = groups.some((g) => g.node.hidden && g.node.contains(target)) || items.some((it) => it.node.hidden && !it.node.hasAttribute('data-broken') && it.node.contains(target));
      if (!hiddenHere) return false;
      note = `The ${kind} was cleared to show the part of the page you opened.`;
      await clear();
      target.scrollIntoView({ block: 'start' });
      return true;
    };
    searches.push({ reveal, refresh: rerun });
    rerun();
  }
  // Shows a target that a search has hidden. Returns true when a search had to be cleared for it.
  async function showTarget(target) { for (const s of searches) if (await s.reveal(target)) return true; return false; }
  if (searches.length) {
    if (location.hash) showTarget(targetOf(location.hash));
    addEventListener('hashchange', () => showTarget(targetOf(location.hash)));
  }

  // ---- pattern builder -----------------------------------------------------------------------------
  // Writes a regular expression from plain parts for one search, shows live which of that search's
  // items it matches, and on Apply puts the pattern into that search with Regex on.
  const rxEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const choices = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const BUILDER_PARTS = [
    ['any', 'Contains any of', 'Separate choices with commas. At least one of them must appear somewhere.'],
    ['starts', 'Starts with', 'The name begins with this text.'],
    ['ends', 'Ends with', 'The name finishes with this text.'],
    ['word', 'Whole word', 'This word appears on its own, not inside a longer word.'],
    ['not', 'Does not contain', 'Items with this text anywhere are left out.'],
  ];
  // The name is the first line and the description and group follow on the next lines. Searches read
  // ^ and $ as the start and end of any line, so a built pattern starts with (?<![\s\S]) instead,
  // which holds only at the very start of the item: from there [\s\S] lets a part look at all of the
  // text, "starts with" means the name starts with it, and, because a dot does not match a line
  // break, "ends with" looks at the name only.
  function composePattern(p) {
    const any = choices(p.any); const starts = p.starts.trim(); const ends = p.ends.trim(); const word = p.word.trim(); const not = p.not.trim();
    let head = '';
    if (not) head += `(?![\\s\\S]*${rxEsc(not)})`;
    if (any.length) head += `(?=[\\s\\S]*(?:${any.map(rxEsc).join('|')}))`;
    if (word) head += `(?=(?:[\\s\\S]*\\W)?${rxEsc(word)}(?!\\w))`;
    if (ends) head += `(?=.*${rxEsc(ends)}$)`;
    if (!head && !starts) return '';
    return '(?<![\\s\\S])' + head + rxEsc(starts);
  }
  function describePattern(p) {
    const q = (s) => `"${s}"`; const any = choices(p.any); const said = [];
    if (any.length) said.push(any.length === 1 ? `contain ${q(any[0])}` : `contain any of ${any.map(q).join(', ')}`);
    if (p.starts.trim()) said.push(`have a name that starts with ${q(p.starts.trim())}`);
    if (p.ends.trim()) said.push(`have a name that ends with ${q(p.ends.trim())}`);
    if (p.word.trim()) said.push(`contain the whole word ${q(p.word.trim())}`);
    if (p.not.trim()) said.push(`do not contain ${q(p.not.trim())}`);
    if (!said.length) return 'Fill in one or more parts. Every part you fill in must hold for an item to match.';
    return `Matches items that ${said.length > 1 ? said.slice(0, -1).join(', ') + ' and ' + said[said.length - 1] : said[0]}. Upper and lower case are treated the same.`;
  }
  const PREVIEW_MAX = 60;
  // A preview row shows at most 140 characters of a name or a description; a paragraph can be longer.
  const clip = (s) => (s.length > 140 ? s.slice(0, 139).trimEnd() + '…' : s);
  let builder = null;
  function openBuilder({ st, what, nouns, lines, items, opener, apply }) {
    if (builder) return;
    let applied = false;
    const out = el('code', { class: 'rxout' });
    const words = el('p', { class: 'rxwords' });
    const status = el('p', { class: 'rxstatus', role: 'status' });
    const list = el('ul', { class: 'rxlist', 'aria-label': 'Preview: whether the pattern matches each item' });
    const useBtn = el('button', { type: 'button', class: 'btn filled' }, 'Apply');
    const runner = patternRunner(); let ticket = 0;
    const draw = async () => {
      const t = ++ticket; const pat = composePattern(st.parts); const m = pat ? matcher(pat, true) : null;
      out.textContent = pat || '(no pattern yet)';
      words.textContent = describePattern(st.parts);
      if (!pat) { useBtn.disabled = true; setText(status, `The preview shows which of the ${items.length} ${nouns} match once a part is filled in.`); list.replaceChildren(); return; }
      const r = await evaluate(m, items.map((it) => it.text), runner);
      if (t !== ticket || r.superseded) return;
      useBtn.disabled = !!r.error;
      if (r.error) { setText(status, `This pattern cannot be used: ${r.error}`); list.replaceChildren(); return; }
      const rows = items.map((it, i) => ({ it, hit: !!r.hits[i] })); const hits = rows.filter((x) => x.hit).length;
      rows.sort((a, b) => Number(b.hit) - Number(a.hit));
      setText(status, `${hits} of ${items.length} ${nouns} match.` + (rows.length > PREVIEW_MAX ? ` The preview lists ${PREVIEW_MAX} of the ${items.length}, matches first.` : ' Matches are listed first.'));
      list.replaceChildren(...rows.slice(0, PREVIEW_MAX).map(({ it, hit }) => el('li', { class: hit ? 'hit' : 'miss' }, svg(hit ? ICON.yes : ICON.close), el('span', { class: 't' }, el('span', { class: 'sr', text: hit ? 'Matches: ' : 'Does not match: ' }), el('b', { text: clip(it.name) }), it.detail ? el('small', { text: clip(it.detail.split('\n')[0]) }) : null))));
    };
    const fields = BUILDER_PARTS.map(([key, label, hint]) => {
      const id = 'rx-' + key;
      const field = el('input', { id, type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': id + '-hint' });
      field.value = st.parts[key] || '';
      field.addEventListener('input', () => { st.parts[key] = field.value; st.save(); draw(); });
      return el('div', { class: 'rxfield' }, el('label', { for: id, text: label }), field, el('small', { id: id + '-hint', text: hint }));
    });
    const dlg = el('dialog', { class: 'rxdlg', 'aria-labelledby': 'rx-title', 'aria-describedby': 'rx-intro' },
      el('div', { class: 'rxhead' }, el('h2', { id: 'rx-title', text: 'Pattern builder' }), el('button', { type: 'button', class: 'tool', 'aria-label': 'Close the pattern builder', title: 'Close', onclick: () => dlg.close() }, svg(ICON.close))),
      el('div', { class: 'rxbody' },
        el('p', { id: 'rx-intro', text: `Describe what you are looking for in plain parts. The builder writes a regular expression for ${what} and escapes special characters for you. Each item is read as lines: ${lines}.` }),
        el('div', { class: 'rxfields' }, fields),
        el('p', { class: 'rxlabel', text: 'Pattern' }), out, words,
        el('h3', { text: 'Live preview' }), status, list),
      el('div', { class: 'rxfoot' }, el('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), useBtn));
    useBtn.addEventListener('click', () => { const pat = composePattern(st.parts); if (useBtn.disabled || !pat || !matcher(pat, true).ok) return; applied = true; dlg.close(); apply(pat); });
    // Enter in a part applies a usable pattern; Escape closes the dialog without changing the search.
    dlg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !useBtn.disabled) { e.preventDefault(); useBtn.click(); } });
    // Closing in any way (Apply, Cancel, Escape, the close button) stops the preview's background worker.
    dlg.addEventListener('close', () => { ticket++; runner.dispose(); dlg.remove(); builder = null; if (!applied && opener && opener.isConnected) opener.focus(); }, { once: true });
    document.body.append(dlg); builder = dlg;
    draw(); dlg.showModal(); $('input', dlg).focus();
  }

  // ---- screenshot lightbox --------------------------------------------------------------------------
  // The viewer moves through the pictures that are visible when it opens, so a filtered gallery stays
  // filtered. A picture that a search hides, or that failed to load, does not open.
  const shots = $$('.shot');
  const onView = () => shots.filter((b) => !b.closest('[hidden]'));
  let lightbox = null; let at = 0; let ring = shots;
  function showShot(i) {
    at = (i + ring.length) % ring.length; const b = ring[at]; const img = $('img', lightbox);
    img.src = b.dataset.full; img.alt = $('img', b).alt;
    $('.bar span', lightbox).textContent = `${at + 1} of ${ring.length}`;
    $('p', lightbox).textContent = b.dataset.caption || '';
    if (!reduced()) { img.style.animation = 'none'; void img.offsetWidth; img.style.animation = ''; }
  }
  function openShot(i) {
    const visible = onView();
    if (!visible.includes(shots[i])) return false;
    shots[i].closest('details')?.setAttribute('open', '');
    if (!lightbox) {
      const tool = (label, d, fn) => el('button', { class: 'tool', type: 'button', 'aria-label': label, title: label, onclick: fn }, svg(d));
      lightbox = el('dialog', { class: 'lightbox', 'aria-label': 'Screenshot viewer' },
        el('div', { class: 'bar' }, el('span', { 'aria-live': 'polite' }), tool('Previous screenshot', ICON.prev, () => showShot(at - 1)), tool('Next screenshot', ICON.next, () => showShot(at + 1)), tool('Close the viewer', ICON.close, () => lightbox.close())),
        el('div', { class: 'stage' }, el('img', { alt: '' })), el('p', {}));
      lightbox.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); showShot(at - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); showShot(at + 1); } else if (e.key === 'Home') { e.preventDefault(); showShot(0); } else if (e.key === 'End') { e.preventDefault(); showShot(ring.length - 1); } });
      lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.classList.contains('stage')) lightbox.close(); });
      let x0 = null; const stage = $('.stage', lightbox);
      stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
      stage.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 60) showShot(at + (e.clientX < x0 ? 1 : -1)); x0 = null; });
      document.body.append(lightbox);
    }
    ring = visible;
    const opener = shots[i];
    lightbox.addEventListener('close', () => opener.focus(), { once: true });
    showShot(ring.indexOf(shots[i])); lightbox.showModal(); $('.bar .tool:last-child', lightbox).focus();
    return true;
  }
  // The palette action: opens the first picture on view, so a filtered gallery stays filtered. When a
  // page search hides every picture it controls (the pictures inside its items and groups), and the
  // first picture of the page is one of them, the search is cleared and says so, as for a link to a
  // hidden part, and that picture then opens. A picture the search does not control, such as the
  // demo picture at the end of a page, does not count as one on view.
  const announce = (text) => { said.textContent = ''; setTimeout(() => { said.textContent = text; }, 30); };
  async function openFirstShot() {
    if (!shots.length) { location.href = base + 'screens.html'; return; }
    const visible = (b) => !b.closest('[hidden]');
    const usable = shots.filter((b) => !b.closest('[data-broken]'));
    const searched = usable.filter((b) => b.closest('[data-search-item], [data-search-group]'));
    if (usable.length && !visible(usable[0]) && !searched.some(visible)) await showTarget(usable[0]);
    const first = onView()[0];
    if (first) openShot(shots.indexOf(first)); else announce('None of the pictures on this page could be loaded, so there is no screenshot to open.');
  }
  // A picture that fails to load is hidden with its caption and marked, so a page search neither shows
  // it again nor counts it.
  const broken = (b) => { const fig = b.closest('figure'); if (!fig || fig.hasAttribute('data-broken')) return; fig.setAttribute('data-broken', ''); fig.hidden = true; for (const s of searches) s.refresh(); };
  shots.forEach((b, i) => { b.addEventListener('click', () => openShot(i)); const img = $('img', b); img.addEventListener('error', () => broken(b)); if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) broken(b); });

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
    { kind: 'Action', title: 'Open the first screenshot', sub: shots.length ? 'Opens the screenshot viewer on the first picture of this page.' : 'Opens the Screens page.', words: 'gallery screens pictures images lightbox', run: openFirstShot },
    { kind: 'Action', title: 'Open the demo', sub: 'The real interface in your browser, against simulated machines.', words: 'try demo simulated play', run: () => { location.href = base + 'demo/'; } },
    { kind: 'Action', title: 'View the source on GitHub', sub: 'The material-choco folder of the repository.', words: 'code repository github source', run: () => { location.href = 'https://github.com/Ding-Ding-Projects/choco/tree/main/material-choco'; } },
    { kind: 'Action', title: 'Back to the top of this page', sub: '', words: 'top scroll start', run: () => { scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); } },
  ];
  const ORDER = { Action: 0, Page: 1, Guide: 2, Feature: 3, Section: 4 };
  const SHOW_MAX = 40;
  // The palette keeps its Regex switch and builder parts while the tab is open; its text starts empty each time it opens.
  const palState = searchState('palette'); palState.q = '';
  let palTools = null; const palRunner = patternRunner(); let palTicket = 0;
  const palText = (it) => `${it.title}\n${it.sub || ''}\n${it.words || ''} ${it.kind}`;
  // An entry of the page index that leads to this page shows its target, clearing a page search that hides it.
  const goTo = (url) => { const u = new URL(url, location.href); if (u.href !== location.href) { location.href = url; return; } const t = targetOf(u.hash); if (!t) { document.body.scrollIntoView(); return; } showTarget(t).then((cleared) => { if (!cleared) t.scrollIntoView({ block: 'start' }); }); };
  const entries = () => [...actions(), ...(index || []).map((x) => ({ ...x, run: () => goTo(base + x.url) }))];
  // Resolves to { list, total, error }: the entries to show (at most SHOW_MAX), how many matched in all,
  // and why a pattern cannot be used. Resolves to null when a newer search replaced this one.
  async function search(q) {
    const t = ++palTicket; const all = entries(); const m = matcher(q, palState.regex);
    if (m.empty) { const list = all.filter((x) => x.kind !== 'Section'); return { list: list.slice(0, SHOW_MAX), total: list.length }; }
    if (!m.ok) return { list: [], total: 0, error: m.error };
    const scored = [];
    if (m.regex) {
      // Each entry is tested as lines (title, description, keywords); a match in the title ranks first.
      const r = await evaluate(m, [...all.map(palText), ...all.map((it) => it.title)], palRunner);
      if (t !== palTicket || r.superseded) return null;
      if (r.error) return { list: [], total: 0, error: r.error };
      all.forEach((it, i) => { if (r.hits[i]) scored.push([(r.hits[all.length + i] ? 0 : 10) + ORDER[it.kind], it]); });
    } else {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      for (const it of all) { const tt = it.title.toLowerCase(); const hay = `${tt} ${(it.sub || '').toLowerCase()} ${it.words || ''} ${it.kind.toLowerCase()}`; if (!words.every((w) => hay.includes(w))) continue; scored.push([(words.every((w) => tt.includes(w)) ? 0 : 10) + (tt.startsWith(words[0]) ? 0 : 2) + ORDER[it.kind], it]); }
    }
    scored.sort((a, b) => a[0] - b[0]);
    return { list: scored.slice(0, SHOW_MAX).map((x) => x[1]), total: scored.length };
  }
  async function drawPalette() {
    const res = await search(palState.q);
    if (!res || !palette.open) return;
    const list = $('[role="listbox"]', palette);
    shown = res.list; sel = Math.min(sel, Math.max(0, shown.length - 1));
    palTools.fail(res.error || '');
    // With Regex on, the count and the empty text both say that the text was read as a pattern.
    const asPattern = palState.regex && palState.q.trim() !== '';
    const none = res.error ? 'Nothing is shown while the pattern cannot be used. Fix it, or turn Regex off.' : index ? (asPattern ? 'Nothing matches the pattern. Turn Regex off to look for the words instead.' : 'Nothing matches. Try a shorter word.') : 'Nothing matches among the actions. The page index is still loading or could not be loaded.';
    list.replaceChildren(...(shown.length ? shown.map((it, i) => el('div', { class: 'prow', role: 'option', id: 'pal-' + i, 'aria-selected': String(i === sel), onclick: () => choose(i), onpointermove: () => { if (sel !== i) { sel = i; mark(); } } }, el('span', { class: 't' }, el('b', { text: it.title }), it.sub ? el('small', { text: it.sub }) : null), el('span', { class: 'kind', text: it.kind }))) : [el('p', { class: 'none', text: none })]));
    const forPattern = asPattern ? ' for the pattern' : '';
    const counted = res.error ? 'No results while the pattern cannot be used' : res.total > shown.length ? `${res.total} results${forPattern}, showing the first ${shown.length}` : `${res.total} result${res.total === 1 ? '' : 's'}${forPattern}`;
    setCount($('.hint .n', palette), counted + '.', res.error || '');
    // New results start from the top, so the tools, the count, any error and the Regex explanation are
    // in view. The chosen row is then scrolled to inside the result list only: scrolling the whole
    // body to it would push the tools out of view on every keystroke on a short screen. The arrow keys
    // still scroll the body to the row they choose.
    $('.pbody', palette).scrollTop = 0; list.scrollTop = 0;
    mark(false);
  }
  // Marks the chosen row. follow: scroll everything needed to show it; otherwise only the result list scrolls.
  function mark(follow = true) {
    const input = $('input', palette); $$('.prow', palette).forEach((r, i) => r.setAttribute('aria-selected', String(i === sel))); const cur = $('#pal-' + sel, palette);
    if (!cur) { input.removeAttribute('aria-activedescendant'); return; }
    input.setAttribute('aria-activedescendant', cur.id);
    if (follow) { cur.scrollIntoView({ block: 'nearest' }); return; }
    const list = cur.parentElement; const lr = list.getBoundingClientRect(); const r = cur.getBoundingClientRect();
    if (r.top < lr.top) list.scrollTop += r.top - lr.top; else if (r.bottom > lr.bottom) list.scrollTop += Math.min(r.bottom - lr.bottom, r.top - lr.top);
  }
  function choose(i) { const it = shown[i]; if (!it) return; if (it.keep) { it.run(); drawPalette(); return; } palette.close(); it.run(); }
  function openPalette() {
    if (palette?.open || builder) return;
    if (lightbox?.open) lightbox.close();
    setMenu(false);
    if (!palette) {
      const input = el('input', { type: 'search', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', 'aria-label': 'Search pages, guides, features and actions', placeholder: 'Search pages, guides, features and actions', autocomplete: 'off', spellcheck: 'false' });
      palTools = searchTools(palState, { what: 'the site search', noun: 'entry', nouns: 'entries', lines: 'its title first, then its description, then its keywords and its kind', input, items: () => entries().map((it) => { const detail = `${it.sub || ''}\n${it.words || ''} ${it.kind}`; return { name: it.title, detail, text: it.title + '\n' + detail }; }), run: () => { sel = 0; drawPalette(); }, describe: ['pal-hint'], rxPlaceholder: 'A regular expression for pages, guides, features and actions' });
      // Below the field, the tools, the messages and the results scroll together when the screen is
      // short, so a long error or large text never pushes the results out of reach. The error and the
      // count come straight after the tools, and the explanation of Regex after them.
      palette = el('dialog', { class: 'palette', 'aria-label': 'Command palette' },
        el('div', { class: 'q' }, svg(ICON.search), input, el('button', { class: 'tool', type: 'button', 'aria-label': 'Close the command palette', onclick: () => palette.close() }, svg(ICON.close))),
        el('div', { class: 'pbody' },
          el('div', { class: 'qtools' }, palTools.sw, palTools.bb), palTools.err,
          el('p', { class: 'hint', id: 'pal-hint', 'aria-live': 'polite' }, el('span', { class: 'n' }), el('span', { class: 'keys', text: ' Arrow keys move, Enter opens, Escape closes.' })), palTools.hint,
          el('div', { role: 'listbox', id: 'pal-list', 'aria-label': 'Results' })));
      input.addEventListener('input', () => { palState.q = input.value; sel = 0; drawPalette(); });
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
    const input = $('input', palette); input.value = ''; palState.q = ''; palTools.sync(); sel = 0; palette.showModal(); drawPalette(); input.focus();
  }
  $$('[data-open-palette]').forEach((b) => b.addEventListener('click', openPalette));
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openPalette(); } });
})();
