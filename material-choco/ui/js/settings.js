// Persisted settings. Every value has a compiled-in default so the UI can state provenance.
export const DEFAULTS = {
  lang: 'en', funnyEn: 5, funnyYue: 5, dialogEmoji: true, school: false, schoolName: 'School mode', schoolPin: '',
  theme: 'system', density: 'comfortable', motion: 'system', hue: 50, chroma: 1, textScale: 1, contrast: 'normal', targets: 'normal', focusRing: 'normal',
  drama: true, sounds: true, volume: 0.5, narration: false, narrationLang: 'en', voiceEn: '', voiceYue: '', rate: 1, pitch: 1,
  focusMode: false, lowStim: false, timeAware: false, oneThing: false, momentum: false,
  displayName: '', paletteSize: 'card', a11yMenu: true, closedTabs: [], pinnedTabs: [], collapsed: {}, onboarded: false, autoRefresh: true,
  defaultGlobal: { confirm: true, 'no-progress': true, 'no-color': true }, knownTabs: [],
};
const KEY = 'mc.settings.v1';
const listeners = new Set();
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { store = {}; }
export const settings = new Proxy({}, {
  get: (_t, k) => (k in store ? store[k] : DEFAULTS[k]),
  set: (_t, k, v) => { store[k] = v; persist(); apply(); for (const l of listeners) l(k, v); return true; },
});
export const isDefault = (k) => !(k in store);
export const resetSetting = (k) => { delete store[k]; persist(); apply(); for (const l of listeners) l(k, DEFAULTS[k]); };
export const resetAll = () => { store = {}; persist(); apply(); for (const l of listeners) l('*'); };
export const onSetting = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const exportSettings = () => JSON.stringify({ schema: 'material-choco-settings', version: 1, values: store }, null, 1);
export function importSettings(text) { const j = JSON.parse(text); if (j.schema !== 'material-choco-settings' || typeof j.values !== 'object') throw new Error('Not a Material Choco settings file'); store = {}; for (const k of Object.keys(DEFAULTS)) if (k in j.values) store[k] = j.values[k]; persist(); apply(); for (const l of listeners) l('*'); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage unavailable: settings last for this session */ } }
const sysDark = matchMedia('(prefers-color-scheme: dark)');
sysDark.addEventListener('change', apply);
export function apply() {
  const r = document.documentElement; const s = settings;
  r.dataset.theme = s.theme === 'system' ? (sysDark.matches ? 'dark' : 'light') : s.theme;
  r.dataset.density = s.density; r.dataset.contrast = s.contrast; r.dataset.targets = s.targets; r.dataset.focus = s.focusRing;
  r.dataset.motion = s.lowStim ? 'reduced' : s.motion; r.dataset.calm = s.lowStim ? 'on' : 'off'; r.dataset.focusmode = s.focusMode ? 'on' : 'off';
  r.style.setProperty('--h', s.hue); r.style.setProperty('--c', s.chroma); r.style.setProperty('--scale', s.textScale);
  r.lang = s.school ? 'en' : s.lang === 'yue' ? 'yue-HK' : 'en';
  document.title = s.displayName || 'Material Choco';
}
export const reducedMotion = () => document.documentElement.dataset.motion === 'reduced' || (document.documentElement.dataset.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
