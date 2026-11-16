// Persisted settings. Every value has a compiled-in default so the UI can state provenance.
export const DEFAULTS = {
  lang: 'en', funnyEn: 5, funnyYue: 5, dialogEmoji: true, school: false, schoolName: 'School mode', schoolPin: '',
  theme: 'system', density: 'comfortable', motion: 'system', hue: 50, chroma: 1, textScale: 1, contrast: 'normal', targets: 'normal', focusRing: 'normal',
  drama: true, sounds: true, volume: 0.5, narration: false, narrationLang: 'en', voiceEn: '', voiceYue: '', rate: 1, pitch: 1,
  focusMode: false, lowStim: false, timeAware: false, oneThing: false, momentum: false,
  displayName: '', paletteSize: 'card', a11yMenu: true, closedTabs: [], pinnedTabs: [], collapsed: {}, onboarded: false, autoRefresh: true,
  defaultGlobal: { confirm: true, 'no-progress': true, 'no-color': true }, knownTabs: [], tabOrder: [],
  schedTheme: false, darkFrom: '19:00', darkTo: '07:00', schedRules: [],
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

// ---- settings that switch by time of day ----------------------------------------------------
// Times are the clock of this device. A window whose end is earlier than its start runs past
// midnight; its weekdays name the day it starts on. Later rules win over earlier ones, and
// every rule wins over the stored value while it is active. Nothing here changes a stored value.
export const SCHEDULABLE = { theme: ['light', 'dark'], density: ['comfortable', 'compact'], motion: ['full', 'reduced'], contrast: ['normal', 'high'], sounds: [true, false], drama: [true, false] };
export const minutesOf = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
export function inWindow(from, to, days, now = new Date()) {
  const a = minutesOf(from); const b = minutesOf(to); if (a === null || b === null || a === b) return false;
  const n = now.getHours() * 60 + now.getMinutes(); const d = now.getDay(); const on = (x) => !Array.isArray(days) || !days.length || days.includes(x);
  if (a < b) return n >= a && n < b && on(d);
  return (n >= a && on(d)) || (n < b && on((d + 6) % 7));
}
export const validRule = (r) => !!r && typeof r === 'object' && r.key in SCHEDULABLE && SCHEDULABLE[r.key].includes(r.value) && minutesOf(r.from) !== null && minutesOf(r.to) !== null && r.from !== r.to;
export const activeRules = (now = new Date()) => (Array.isArray(settings.schedRules) ? settings.schedRules : []).filter((r) => validRule(r) && r.enabled !== false && inWindow(r.from, r.to, r.days, now));
// The value in force right now: the stored value unless a timed rule replaces it.
export function eff(key, now = new Date()) {
  let v = settings[key];
  if (key === 'theme' && settings.schedTheme && minutesOf(settings.darkFrom) !== null && minutesOf(settings.darkTo) !== null && settings.darkFrom !== settings.darkTo) v = inWindow(settings.darkFrom, settings.darkTo, null, now) ? 'dark' : 'light';
  for (const r of activeRules(now)) if (r.key === key) v = r.value;
  return v;
}
export const timedOverride = (key) => key in SCHEDULABLE && eff(key) !== settings[key];
const timedSignature = () => Object.keys(SCHEDULABLE).map((k) => String(eff(k))).join('|');
let lastTimed = '';
export function apply() {
  const r = document.documentElement; const s = settings; const theme = eff('theme');
  r.dataset.theme = theme === 'system' ? (sysDark.matches ? 'dark' : 'light') : theme;
  r.dataset.density = eff('density'); r.dataset.contrast = eff('contrast'); r.dataset.targets = s.targets; r.dataset.focus = s.focusRing;
  r.dataset.motion = s.lowStim ? 'reduced' : eff('motion'); r.dataset.calm = s.lowStim ? 'on' : 'off'; r.dataset.focusmode = s.focusMode ? 'on' : 'off';
  r.style.setProperty('--h', s.hue); r.style.setProperty('--c', s.chroma); r.style.setProperty('--scale', s.textScale);
  r.lang = s.school ? 'en' : s.lang === 'yue' ? 'yue-HK' : 'en';
  document.title = s.displayName || 'Material Choco';
  lastTimed = timedSignature();
}
// Timed settings are checked again every minute; listeners hear 'timed' only when something changed.
setInterval(() => { const before = lastTimed; apply(); if (before !== lastTimed) for (const l of listeners) l('timed'); }, 60000);
export const reducedMotion = () => document.documentElement.dataset.motion === 'reduced' || (document.documentElement.dataset.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
