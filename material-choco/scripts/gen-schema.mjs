#!/usr/bin/env node
// Generates shared/choco-schema.json from the Chocolatey CLI C# source in this repository,
// so the GUI covers every command, option, config setting and feature that the CLI defines.
// Usage: node scripts/gen-schema.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const app = path.join(repo, 'src', 'chocolatey', 'infrastructure.app');
const read = (p) => fs.readFileSync(p, 'utf8');

// --- tiny C# expression helpers -------------------------------------------------
// Reads one C# string literal starting at src[i] ('"', '@"', '$"', '$@"'). Returns [value, nextIndex].
function readString(src, i) {
  let verbatim = false;
  while (src[i] === '@' || src[i] === '$') { if (src[i] === '@') verbatim = true; i++; }
  if (src[i] !== '"') return null;
  i++;
  let out = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (verbatim) {
      if (c === '"') { if (src[i + 1] === '"') { out += '"'; i++; continue; } return [out, i + 1]; }
      out += c;
    } else {
      if (c === '\\') {
        const n = src[++i];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '' : n;
        continue;
      }
      if (c === '"') return [out, i + 1];
      out += c;
    }
  }
  return [out, i];
}
const isStrStart = (src, i) => src[i] === '"' || ((src[i] === '@' || src[i] === '$') && (src[i + 1] === '"' || src[i + 2] === '"'));

// Splits the top-level arguments of a call whose '(' is at src[open]. Returns [{text}], end index.
function splitArgs(src, open) {
  const args = []; let depth = 0; let start = open + 1;
  for (let i = open; i < src.length; i++) {
    if (isStrStart(src, i)) { const r = readString(src, i); if (r) { i = r[1] - 1; continue; } }
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') { depth--; if (depth === 0) { args.push(src.slice(start, i)); return [args, i]; } }
    else if (c === ',' && depth === 1) { args.push(src.slice(start, i)); start = i + 1; }
  }
  return [args, src.length];
}

// --- StringResources constants ---------------------------------------------------
const constants = {};
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.cs')) harvest(p); } }
function harvest(file) {
  const src = read(file);
  const re = /(?:const|static readonly)\s+string\s+(\w+)\s*=\s*/g; let m;
  while ((m = re.exec(src))) { if (isStrStart(src, re.lastIndex)) { const r = readString(src, re.lastIndex); if (r) (constants[m[1]] ??= []).push(r[0]); } }
}
walk(path.join(repo, 'src', 'chocolatey'));

function evalText(expr, wantSpec = false) {
  const pick = (vals) => vals.find((v) => wantSpec ? !/\s/.test(v) : /\s/.test(v)) ?? vals[0];
  // Concatenate every string literal in the expression; resolve Foo.Bar.Name constants by last segment.
  let out = ''; expr = expr.trim();
  for (let i = 0; i < expr.length; i++) {
    if (isStrStart(expr, i)) { const r = readString(expr, i); out += r[0]; i = r[1] - 1; continue; }
    if (expr.startsWith('.FormatWith', i)) break;
    const m = /^[A-Za-z_][\w.]*/.exec(expr.slice(i));
    if (m) { const key = m[0].split('.').pop(); if (m[0].includes('.') && constants[key] !== undefined && !out) out += pick(constants[key]); i += m[0].length - 1; }
  }
  return out.replace(/\s*\n\s*/g, ' ').replace(/\{\{/g, '{').replace(/\}\}/g, '}').trim();
}

function parseOptions(src) {
  const options = []; const re = /\.Add\(/g; let m;
  while ((m = re.exec(src))) {
    const [args] = splitArgs(src, m.index + 4);
    if (args.length < 3 || !/=>/.test(args.slice(2).join(','))) continue;
    const spec = evalText(args[0], true); if (!spec || /\s/.test(spec)) continue;
    const names = spec.split('|').map((s) => s.replace(/[=:]$/, ''));
    const takesValue = /[=:](\||$)/.test(spec);
    const long = names.filter((n) => n.includes('-')).sort((a, b) => b.length - a.length)[0] || names.slice().sort((a, b) => b.length - a.length)[0];
    const description = evalText(args[1]);
    const deprecated = /\[DEPRECATED\]|deprecated/i.test(description);
    const dashIdx = description.indexOf(' - ');
    options.push({
      id: long, flag: (long.length === 1 ? '-' : '--') + long, names, takesValue,
      label: dashIdx > 0 && dashIdx < 60 ? description.slice(0, dashIdx) : long,
      description, deprecated,
      secret: /password|api-?key|^key$|cert-password/i.test(long),
    });
  }
  // de-duplicate by id
  const seen = new Set(); return options.filter((o) => !seen.has(o.id) && seen.add(o.id));
}

function enumMembers(name) {
  const f = path.join(app, 'domain', name + '.cs'); if (!fs.existsSync(f)) return [];
  const body = read(f).split(/enum\s+\w+/)[1] || '';
  const out = []; let obsolete = false;
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t.startsWith('[Obsolete')) { obsolete = true; continue; }
    const m = /^([A-Za-z]\w*)\s*(=|,|$)/.exec(t);
    if (m) { if (!obsolete && m[1] !== 'Unknown' && /^[A-Z]/.test(m[1])) out.push(m[1].toLowerCase()); obsolete = false; }
  }
  return [...new Set(out)];
}

function helpText(src) {
  const i = src.indexOf('void HelpMessage('); if (i < 0) return '';
  const end = src.indexOf('\n        public ', i + 10); const body = src.slice(i, end < 0 ? src.length : end);
  const parts = [];
  for (let k = 0; k < body.length; k++) {
    if (isStrStart(body, k)) { const r = readString(body, k); if (r[0].trim().length > 3 && r[0].trim() !== 'chocolatey') parts.push(r[0].replace(/\r/g, '').replace(/\{\{/g, '{').replace(/\}\}/g, '}').trim()); k = r[1] - 1; }
  }
  return parts.join('\n\n');
}

// --- commands ----------------------------------------------------------------------
const mutating = new Set(['install', 'upgrade', 'uninstall', 'pin', 'source', 'config', 'feature', 'apikey', 'cache', 'new', 'pack', 'push', 'unpackself', 'export']);
const commands = [];
for (const file of fs.readdirSync(path.join(app, 'commands')).sort()) {
  if (!file.endsWith('.cs') || file === 'ChocolateyCommandBase.cs') continue;
  const src = read(path.join(app, 'commands', file));
  const fors = [...src.matchAll(/\[CommandFor\("([^"]+)",\s*"([^"]*)"(?:,\s*Version\s*=\s*"([^"]+)")?\)\]/g)];
  if (!fors.length) continue;
  const typeMatch = /\b(\w+CommandType)\b/.exec(src);
  commands.push({
    name: fors[0][1], aliases: fors.slice(1).map((f) => f[1]), summary: fors[0][2], since: fors[0][3] || null,
    deprecated: /\[DEPRECATED\]/.test(fors[0][2]),
    mutating: mutating.has(fors[0][1]),
    subcommands: typeMatch ? enumMembers(typeMatch[1]) : [],
    options: parseOptions(src), help: helpText(src), source: 'src/chocolatey/infrastructure.app/commands/' + file,
  });
}

// --- global options, config settings, features --------------------------------
const cb = read(path.join(app, 'builders', 'ConfigurationBuilder.cs'));
const globalOptions = parseOptions(cb);
const ap = read(path.join(app, 'ApplicationParameters.cs'));
const block = (cls) => { const i = ap.indexOf('public static class ' + cls); const j = ap.indexOf('\n        }', i); return [...ap.slice(i, j).matchAll(/string\s+(\w+)\s*=\s*"([^"]+)"/g)].map((m) => ({ key: m[1], name: m[2] })); };
function describe(kind, key) {
  const re = new RegExp('(SetConfigItem|SetFeatureFlag)\\(\\s*ApplicationParameters\\.' + kind + '\\.' + key + '\\b'); const m = re.exec(cb); if (!m) return {};
  const [args] = splitArgs(cb, m.index + m[1].length);
  if (m[1] === 'SetConfigItem') return { default: evalText(args[2] || ''), description: evalText(args[3] || '') };
  const def = args.find((a) => /defaultEnabled/.test(a)); const desc = args.find((a) => /description/.test(a));
  return { default: def ? /true/.test(def) : null, description: desc ? evalText(desc.replace(/^\s*description:\s*/, '')) : '' };
}
const configSettings = block('ConfigSettings').map((c) => ({ name: c.name, ...describe('ConfigSettings', c.key), secret: /password/i.test(c.name) }));
const features = block('Features').map((f) => ({ name: f.name, ...describe('Features', f.key) }));

const ver = /next-version:\s*([\d.]+)/.exec(fs.existsSync(path.join(repo, 'GitVersion.yml')) ? read(path.join(repo, 'GitVersion.yml')) : '') ;
const schema = { schemaVersion: 1, generatedFrom: 'src/chocolatey/infrastructure.app', cliVersionHint: ver ? ver[1] : null, globalOptions, commands, configSettings, features };
const out = path.join(here, '..', 'shared', 'choco-schema.json');
const text = JSON.stringify(schema, null, 1) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(out) || read(out) !== text) { console.error('choco-schema.json is out of date with the C# source. Run: node scripts/gen-schema.mjs'); process.exit(1); }
  console.log('schema matches source');
} else { fs.writeFileSync(out, text); }
console.log(`${commands.length} commands, ${commands.reduce((n, c) => n + c.options.length, 0)} command options, ${globalOptions.length} global options, ${configSettings.length} config settings, ${features.length} features`);
