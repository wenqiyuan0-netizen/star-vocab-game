#!/usr/bin/env node
/**
 * Build public/dict/goethe_core.json — the Goethe A1–B1 word list with
 * Chinese meanings and bilingual example sentences, used to fill gaps in
 * common_2500.json (which lacks many basic words such as "auch", "heißen").
 *
 * Usage:
 *   node scripts/build-goethe-core.js <Goethe_A1-B1_Levels_Combined.json> [Kaikki_Dict_Output.json]
 *
 * The optional Kaikki export (Wiktionary) adds IPA + pronunciation audio.
 *
 * Output format (compact, one object per headword):
 *   { w, a?, pl?, p, l, c, x: [[de, cn], ...], i?, au?, alt?: [...] }
 */
const fs = require('fs');
const path = require('path');

const [goethePath, kaikkiPath] = process.argv.slice(2);
if (!goethePath) {
  console.error('Usage: node scripts/build-goethe-core.js <goethe.json> [kaikki.json]');
  process.exit(1);
}

// Labels in the source are mixed English/German ("Noun", "Nomen", "Modal Verb", "Adverb/Conjunction"...)
const POS_RULES = [
  // Order matters: "Adverb" contains "verb", so adverbs are matched first.
  [/^adverb/i, 'adv'], [/^(modal\s+)?verb/i, 'verb'], [/^(noun|nomen|substantiv)/i, 'noun'],
  [/^(adjective|adjektiv)/i, 'adj'], [/^(preposition|präposition)/i, 'prep'], [/^(conjunction|konjunktion)/i, 'conj'],
  [/(pronoun|pronomen|possessiv)/i, 'pron'], [/(article|artikel|determiner)/i, 'det'],
  [/particle|partikel/i, 'particle'], [/interjection|interjektion/i, 'intj'], [/phrase/i, 'phrase'],
  [/prefix/i, 'prefix'],
];
const mapPos = (label, article) => {
  const l = String(label || '').trim();
  for (const [re, v] of POS_RULES) if (re.test(l)) return v;
  return article ? 'noun' : 'unknown';
};

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Headword variants a user might have stored: "gern(e)" -> gern, gerne; "a/b" -> a, b
const variantsOf = (word) => {
  const w = clean(word).replace(/^(der|die|das)\s+/i, '');
  const out = new Set([w]);
  if (/\(.*\)/.test(w)) {
    out.add(clean(w.replace(/\(([^)]*)\)/g, '')));
    out.add(clean(w.replace(/\(([^)]*)\)/g, '$1')));
  }
  for (const part of w.split('/')) if (part.trim()) out.add(clean(part));
  if (/^sich\s+/i.test(w)) out.add(clean(w.replace(/^sich\s+/i, '')));
  out.delete('');
  return [...out];
};

const raw = JSON.parse(fs.readFileSync(goethePath, 'utf8'));
const entries = Array.isArray(raw) ? raw : Object.values(raw).flat();

let kaikki = new Map();
if (kaikkiPath && fs.existsSync(kaikkiPath)) {
  for (const k of JSON.parse(fs.readFileSync(kaikkiPath, 'utf8'))) {
    const key = (k.word || '').toLowerCase();
    if (!kaikki.has(key) && (k.ipa || k.audio)) kaikki.set(key, k);
  }
}

const LEVEL_ORDER = { A1: 1, A2: 2, B1: 3 };
const byKey = new Map();
for (const e of entries) {
  const word = clean(e.word).replace(/^(der|die|das)\s+/i, '');
  if (!word) continue;
  const key = word.toLowerCase();
  const examples = (e.examples || [])
    .map((x) => [clean(x.sentence), clean(x.translation)])
    .filter(([de]) => de.length > 1);

  const prev = byKey.get(key);
  if (prev) {
    // Same headword at several levels: keep the lowest level, union examples.
    const seen = new Set(prev.x.map(([de]) => de));
    for (const ex of examples) if (!seen.has(ex[0])) prev.x.push(ex);
    if ((LEVEL_ORDER[e.level] || 9) < (LEVEL_ORDER[prev.l] || 9)) prev.l = e.level;
    if (!prev.c && e.wordTranslation) prev.c = clean(e.wordTranslation);
    continue;
  }

  const item = {
    w: word,
    p: mapPos(e.partOfSpeech, clean(e.article)),
    l: e.level,
    c: clean(e.wordTranslation),
    x: examples,
  };
  if (clean(e.article)) item.a = clean(e.article);
  if (clean(e.plural)) item.pl = clean(e.plural);
  const alt = variantsOf(e.word).filter((v) => v.toLowerCase() !== key);
  if (alt.length) item.alt = alt;
  const k = kaikki.get(key) || alt.map((a) => kaikki.get(a.toLowerCase())).find(Boolean);
  if (k && k.ipa) item.i = k.ipa;
  if (k && k.audio) item.au = k.audio;
  byKey.set(key, item);
}

const out = [...byKey.values()].map((it) => ({ ...it, x: it.x.slice(0, 4) }));
const dest = path.join(__dirname, '..', 'public', 'dict', 'goethe_core.json');
fs.writeFileSync(dest, JSON.stringify(out));
const withEx = out.filter((e) => e.x.length).length;
console.log(`wrote ${out.length} headwords (${withEx} with examples, ${out.filter((e) => e.i).length} with IPA) -> ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(2)} MB)`);
