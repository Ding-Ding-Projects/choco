// Language modes: English, Hong Kong Cantonese, bilingual. Strings live here, apart from logic.
// A string without a Cantonese entry falls back to English.
import { settings } from './settings.js';
const S = {
  overview: ['Overview', '總覽'], machines: ['Machines', '機器'], installed: ['Installed', '已安裝'], discover: ['Discover', '搵軟件'], updates: ['Updates', '更新'],
  sources: ['Sources', '來源'], config: ['Config and features', '設定同功能'], pins: ['Pins', '釘住'], apikeys: ['API keys', 'API 鎖匙'], builder: ['Package builder', '整包工具'],
  console: ['Console', '指令台'], jobs: ['Jobs', '工作'], schedules: ['Schedules', '時間表'], history: ['History', '紀錄'], help: ['Help', '幫助'], settings: ['Settings', '設定'], tools: ['Cache and templates', '快取同範本'],
  search_all: ['Search commands, packages, settings', '搵指令、軟件、設定'], all_machines: ['All machines', '全部機器'], this_pc: ['This PC', '呢部電腦'],
  upgrade: ['Upgrade', '升級'], upgrade_all: ['Upgrade everything', '全部升級'], uninstall: ['Uninstall', '剷走'], install: ['Install', '安裝'], pin: ['Pin', '釘住'], unpin: ['Unpin', '除釘'],
  refresh: ['Refresh', '重新整理'], cancel: ['Cancel', '取消'], close: ['Close', '閂'], copy: ['Copy', '複製'], run: ['Run', '執行'], save: ['Save', '儲存'], next: ['Next', '下一步'], back: ['Back', '返回'], skip: ['Skip for now', '遲啲先'], done: ['Done', '搞掂'], add: ['Add', '加'], remove: ['Remove', '移除'], reset: ['Reset', '重設'], export: ['Export', '匯出'], open: ['Open', '打開'],
  online: ['Online', '在線'], offline: ['Offline', '離線'], current: ['Current', '最新'], pinned: ['Pinned', '已釘'], running: ['Running', '進行中'], queued: ['Queued', '排緊隊'], succeeded: ['Succeeded', '成功'], failed: ['Failed', '失敗'], cancelled: ['Cancelled', '已取消'], expired: ['Expired', '過期'],
  updates_ready: ['{n} updates are ready', '有 {n} 個更新'], all_current: ['Everything is up to date', '全部都係最新'], no_machines: ['No machines yet', '未有機器'],
  machines_enrolled: ['Machines enrolled', '已登記機器'], packages_installed: ['Packages installed', '已安裝軟件'], updates_available: ['Updates available', '可以更新'], jobs_running: ['Jobs running now', '進行緊嘅工作'],
  needs_attention: ['Needs attention', '要留意'], recent_jobs: ['Recent jobs', '最近工作'], nothing_attention: ['Nothing needs attention right now.', '暫時冇嘢要留意。'],
  filter: ['Filter', '篩選'], plain: ['Plain text', '純文字'], regex: ['Regex', '正規表示式'], outdated_only: ['Outdated only', '只睇過期'],
  enroll: ['Enroll a machine', '登記機器'], pair_title: ['Pair a new machine', '配對新機器'], sign_in: ['Sign in', '登入'], sign_out: ['Sign out', '登出'], password: ['Password', '密碼'], name: ['Name', '名'],
  emergency_exit: ['Emergency exit', '緊急出口'], slide_confirm: ['Then slide all the way to confirm', '跟住拉到盡確認'], key_a: ['Hold key A', '撳住 A 鍵'], key_b: ['Hold key B', '撳住 B 鍵'], held: ['held', '撳實'],
  accessibility: ['Accessibility tools', '無障礙工具'], notifications: ['Notifications', '通知'], language: ['Language', '語言'], appearance: ['Appearance', '外觀'], sound: ['Sound and narration', '聲音同旁白'], focus_modes: ['Focus modes', '專注模式'], account: ['Sign in and locks', '登入同鎖'], about: ['About and changelog', '關於同更新紀錄'], data: ['Data and export', '資料同匯出'],
  job_ok: ['Job finished: {c}', '工作完成：{c}'], job_fail: ['Job failed with exit code {x}: {c}', '工作失敗，結束碼 {x}：{c}'], job_queued: ['Queued on {n} machine(s)', '已排入 {n} 部機器'],
  copied: ['Copied', '已複製'], no_results: ['No results', '冇結果'], results: ['{n} results', '{n} 個結果'], command_preview: ['Command that will run', '將會執行嘅指令'], run_on: ['Run on', '喺邊度執行'],
};
// Playful variants, used at funny level 4 and 5 for the matching language. Facts stay identical.
const FUN = {
  job_ok: ['Done and dusted: {c}', '搞掂晒，飲茶：{c}'], job_fail: ['That one fell over, exit code {x}: {c}', '今次仆咗，結束碼 {x}：{c}'], all_current: ['Everything is up to date. Go have tea.', '全部最新，去飲茶啦'],
  nothing_attention: ['All quiet. Suspiciously quiet.', '風平浪靜，靜到有啲得人驚。'], no_results: ['Nothing. Not even crumbs.', '乜都冇，連餅碎都冇。'], copied: ['Copied. It is yours now.', '複製咗，歸你喇'],
};
let vocab = null; let vocabRe = null;
export function setVocabulary(entries) {
  vocab = entries && Object.keys(entries).length ? new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v])) : null;
  vocabRe = vocab ? new RegExp('(?<![\\p{L}\\p{N}])(' + [...vocab.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\p{N}])', 'giu') : null;
}
export const hasVocabulary = () => !!vocab;
const personal = (s) => (vocabRe && !settings.school ? s.replace(vocabRe, (m) => vocab.get(m.toLowerCase()) ?? m) : s);
const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (_m, k) => (k in v ? v[k] : '')) : s);
export const mode = () => (settings.school ? 'en' : settings.lang);
function pick(key, li) { const fun = (li ? settings.funnyYue : settings.funnyEn) >= 4 && !settings.school && FUN[key]; const e = (fun && FUN[key][li]) || (S[key] && S[key][li]) || (S[key] && S[key][0]) || key; return e; }
// Primary string for the current mode.
export function t(key, vars) { return personal(fill(pick(key, mode() === 'yue' ? 1 : 0), vars)); }
// Secondary line for bilingual mode, or '' when it would repeat the primary.
export function t2(key, vars) { if (mode() !== 'bi') return ''; const a = pick(key, 0); const b = pick(key, 1); return a === b ? '' : fill(b, vars); }
export const p = personal;
export const emoji = (e) => (settings.dialogEmoji && !settings.school ? e + ' ' : '');
