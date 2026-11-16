#!/usr/bin/env node
// Gives every release a dim sum code name and a public photo reference for that dish.
//
// The mapping is deterministic: the same release number always gives the same dish, and any
// DISHES.length consecutive release numbers give DISHES.length different dishes. The photo
// reference is a search link on Wikimedia Commons. It is never an image address and never a
// guessed file page, so nothing is hot-linked and no link points at a file that may not exist.
//
// Usage: node scripts/release-name.mjs <release> [--format text|title|markdown|json]
//   <release> is a release number (57), a version (0.1.57) or a tag (material-choco-v0.1.57).
//   The last whole number in it is the release number.
import { pathToFileURL } from 'node:url';

// [English name, Cantonese romanisation, Commons search words]
const LIST = [
  ['Shrimp dumpling', 'Har Gow', 'Har gow'],
  ['Pork and shrimp dumpling', 'Siu Mai', 'Siu mai dim sum'],
  ['Barbecued pork bun', 'Char Siu Bao', 'Char siu bao'],
  ['Rice noodle roll', 'Cheung Fun', 'Cheung fun'],
  ['Egg tart', 'Daan Taat', 'Egg tart Hong Kong'],
  ['Turnip cake', 'Lo Bak Go', 'Turnip cake dim sum'],
  ['Sticky rice in lotus leaf', 'Lo Mai Gai', 'Lo mai gai'],
  ['Steamed spare ribs with black bean', 'Dau Si Pai Gwat', 'Steamed spare ribs dim sum'],
  ['Phoenix claws', 'Fung Zao', 'Chicken feet dim sum'],
  ['Soup dumpling', 'Siu Lung Bao', 'Xiaolongbao'],
  ['Custard bun', 'Nai Wong Bao', 'Custard bun'],
  ['Molten salted egg custard bun', 'Lau Sa Bao', 'Liu sha bao'],
  ['Pineapple bun', 'Bo Lo Bao', 'Pineapple bun'],
  ['Sesame ball', 'Jin Deui', 'Jian dui'],
  ['Spring roll', 'Chun Gyun', 'Spring roll dim sum'],
  ['Taro dumpling', 'Wu Gok', 'Taro dumpling'],
  ['Fried glutinous rice dumpling', 'Ham Sui Gok', 'Ham sui gok'],
  ['Chiu Chow dumpling', 'Chiu Chow Fun Gwo', 'Fun guo'],
  ['Bean curd skin roll', 'Fu Pei Gyun', 'Tofu skin roll'],
  ['Steamed beef meatball', 'Ngau Yuk Kau', 'Steamed meatball dim sum'],
  ['Beef tripe', 'Ngau Pak Yip', 'Beef tripe dim sum'],
  ['Malay sponge cake', 'Ma Lai Go', 'Ma lai go'],
  ['Tofu pudding', 'Dau Fu Fa', 'Douhua'],
  ['Mango pudding', 'Mong Gwo Bou Din', 'Mango pudding'],
  ['Water chestnut cake', 'Ma Tai Go', 'Water chestnut cake'],
  ['Taro cake', 'Wu Tau Go', 'Taro cake'],
  ['Century egg and pork congee', 'Pei Daan Sau Yuk Juk', 'Century egg congee'],
  ['Potsticker', 'Wo Tip', 'Potsticker'],
  ['Lotus seed paste bun', 'Lin Yung Bao', 'Lotus seed bun'],
  ['Longevity peach bun', 'Sau Bao', 'Longevity peach bun'],
  ['Fried dough rice noodle roll', 'Zha Leung', 'Zhaliang'],
  ['Shrimp rice noodle roll', 'Ha Cheung', 'Shrimp rice noodle roll'],
  ['Barbecued pork rice noodle roll', 'Char Siu Cheung', 'Char siu rice noodle roll'],
  ['Barbecued pork pastry', 'Char Siu Sou', 'Char siu sou'],
  ['Wife cake', 'Lo Po Beng', 'Sweetheart cake'],
  ['Coconut pudding', 'Ye Zap Go', 'Coconut pudding dim sum'],
  ['Osmanthus jelly', 'Gwai Fa Go', 'Osmanthus cake'],
  ['Red bean pudding cake', 'Put Zai Go', 'Put chai ko'],
  ['White sugar sponge cake', 'Bak Tong Go', 'White sugar sponge cake'],
  ['Thousand layer cake', 'Chin Chang Go', 'Thousand layer cake dim sum'],
  ['Shrimp toast', 'Ha Do Si', 'Shrimp toast'],
  ['Three stuffed treasures', 'Jin Yeung Saam Bou', 'Stuffed three treasures'],
  ['Sticky rice dumpling', 'Zung', 'Zongzi'],
  ['Pearl chicken', 'Zan Zyu Gai', 'Lotus leaf rice dim sum'],
  ['Garlic chive dumpling', 'Gau Choi Gau', 'Chive dumpling'],
  ['Dumpling in soup', 'Gun Tong Gau', 'Guan tang jiao'],
  ['Scallop dumpling', 'Dai Zi Gau', 'Scallop dumpling'],
  ['Fried dace fish ball', 'Ling Yu Kau', 'Dace fish balls'],
  ['Cocktail bun', 'Gai Mei Bao', 'Cocktail bun'],
  ['Caramel egg fritter cake', 'Sat Kei Ma', 'Sachima'],
  ['Double skin milk', 'Seung Pei Naai', 'Double skin milk'],
  ['Black sesame roll', 'Zi Ma Gyun', 'Black sesame roll'],
  ['Red bean soup', 'Hung Dau Sa', 'Red bean soup'],
  ['Black sesame soup', 'Zi Ma Wu', 'Black sesame soup'],
  ['Mango pomelo sago', 'Yeung Zi Gam Lou', 'Mango pomelo sago'],
  ['Sweet rice balls in syrup', 'Tong Yun', 'Tangyuan'],
  ['Fried crab claw', 'Zaa Haai Kim', 'Fried crab claw'],
  ['Pan fried pork bun', 'Sang Zin Bao', 'Shengjian mantou'],
  ['Scallion pancake', 'Chung Yau Beng', 'Scallion pancake'],
  ['Fried milk', 'Zaa Sin Naai', 'Fried milk'],
  ['Durian puff', 'Lau Lin Sou', 'Durian puff'],
  ['Shredded radish pastry', 'Lo Bak Si Sou Beng', 'Radish puff pastry'],
  ['Steamed vegetable dumpling', 'Sou Choi Gau', 'Vegetable dumpling dim sum'],
  ['Steamed rice with chicken', 'Gai Faan', 'Steamed rice dim sum'],
];

export const DISHES = Object.freeze(LIST.map(([english, cantonese, search]) => Object.freeze({
  english, cantonese, search,
  photoUrl: 'https://commons.wikimedia.org/wiki/Special:MediaSearch?search=' + encodeURIComponent(search),
})));

// A step that shares no factor with the list length visits every dish once before any repeats,
// while neighbouring releases land far apart in the list.
const STEP = 37;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
if (gcd(STEP, DISHES.length) !== 1) throw new Error('STEP must share no factor with the number of dishes');

// Accepts 57, '57', '0.1.57' or 'material-choco-v0.1.57'. Returns the release number.
export function releaseNumber(release) {
  if (typeof release === 'number') {
    if (!Number.isSafeInteger(release) || release < 0) throw new Error('The release number must be a whole number, zero or more: ' + release);
    return release;
  }
  const m = /(\d+)\s*$/.exec(String(release ?? ''));
  if (!m) throw new Error('No release number at the end of: ' + JSON.stringify(release));
  const n = Number(m[1]);
  if (!Number.isSafeInteger(n)) throw new Error('The release number is too large: ' + m[1]);
  return n;
}

export function releaseName(release) {
  const number = releaseNumber(release);
  // The remainder is taken first so that very large release numbers stay exact.
  const index = ((number % DISHES.length) * STEP) % DISHES.length;
  const dish = DISHES[index];
  return { number, index, codeName: dish.cantonese, english: dish.english, cantonese: dish.cantonese, search: dish.search, photoUrl: dish.photoUrl };
}

// The part of a release title after the version, for example: "Har Gow" (Shrimp dumpling)
export const titleSuffix = (release) => { const r = releaseName(release); return `"${r.codeName}" (${r.english})`; };

// The lines that open the release notes.
export function notesHeader(release) {
  const r = releaseName(release);
  return [
    `Code name: **${r.codeName}** (${r.english}).`,
    '',
    `Photo reference: [${r.codeName} on Wikimedia Commons](${r.photoUrl}). The link opens a search of public photo pages for this dish. No image is embedded or copied into this release.`,
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--format');
  const format = at >= 0 ? args[at + 1] : 'text';
  const release = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
  try {
    if (release === undefined) throw new Error('Usage: node scripts/release-name.mjs <release> [--format text|title|markdown|json]');
    const r = releaseName(release);
    if (format === 'json') console.log(JSON.stringify(r));
    else if (format === 'title') console.log(titleSuffix(release));
    else if (format === 'markdown') console.log(notesHeader(release));
    else if (format === 'text') console.log(`Release ${r.number}: ${r.codeName} (${r.english})\nPhoto reference: ${r.photoUrl}`);
    else throw new Error('Unknown format: ' + format);
  } catch (e) { console.error(e.message); process.exit(1); }
}
