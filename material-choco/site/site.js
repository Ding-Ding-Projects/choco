// Finds the newest Material Choco installer and points the download button at it.
// If the lookup fails, the button keeps linking to the releases page and says so.
(async () => {
  const note = document.getElementById('dl-note'); const link = document.getElementById('dl'); const label = document.getElementById('dl-label');
  try {
    const res = await fetch('https://api.github.com/repos/Ding-Ding-Projects/choco/releases?per_page=30', { headers: { accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub answered ' + res.status);
    const rel = (await res.json()).find((r) => !r.draft && r.tag_name.startsWith('material-choco-v') && r.assets.some((a) => /Setup.*\.exe$/i.test(a.name)));
    if (!rel) throw new Error('no installer release found');
    const asset = rel.assets.find((a) => /Setup.*\.exe$/i.test(a.name));
    link.href = asset.browser_download_url; label.textContent = 'Download for Windows';
    note.textContent = `Version ${rel.tag_name.replace('material-choco-v', '')}, ${(asset.size / 1048576).toFixed(0)} MB, published ${new Date(rel.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}. 64-bit Windows.`;
  } catch (e) {
    label.textContent = 'Open the releases page'; note.textContent = 'The newest installer could not be looked up just now (' + e.message + '). The button opens the releases page instead.';
  }
})();
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px' }) : null;
document.querySelectorAll('.reveal').forEach((el, i) => { el.style.setProperty('--i', i % 6); if (io) io.observe(el); else el.classList.add('in'); });
fetch('build.json').then((r) => r.json()).then((b) => { document.getElementById('built').textContent = `Site built ${new Date(b.builtAt).toLocaleString(undefined, { timeZoneName: 'short' })} from commit ${b.commit.slice(0, 7)}.`; }).catch(() => {});
