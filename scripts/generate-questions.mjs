import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchesPredicate, normalize, quantile } from './lib/data-utils.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const entities = await load('data/curated/entities.json');
const existingPrompts = await load('data/curated/prompts.json');
const difficultyOverrides = await load('data/overrides/difficulty.json');
const places = entities.filter(entity => entity.types.includes('populated-place') && entity.props.country === 'South Africa');
const provinces = [...new Set(places.map(entity => entity.props.province).filter(value => value && value !== '00'))].sort();
const continents = [...new Set(entities.filter(entity => entity.types.includes('country')).flatMap(entity => entity.props.continents ?? []))].sort();
const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
const lengths = Array.from({ length: 16 }, (_, index) => index + 3);
const wordCounts = [1, 2, 3, 4];
const title = value => String(value).replace(/\b\w/g, letter => letter.toUpperCase());
const slug = value => normalize(String(value)).replace(/\s+/g, '-');
const all = (...items) => ({ all: items });
const type = value => ({ op: 'type', value });
const eq = (property, value) => ({ op: 'eq', property, value });
const includes = (property, value) => ({ op: 'includes', property, value });

const templates = [
  {
    id: 'sa-place-province', category: 'South Africa', mode: 'standard', minimumAnswers: 100,
    combinations: provinces.map(province => ({ province })),
    text: ({ province }) => 'Name a city, town, or populated place in ' + province + '.',
    predicate: ({ province }) => all(type('populated-place'), eq('country', 'South Africa'), eq('province', province)),
    conditions: 2,
  },
  {
    id: 'sa-place-initial', category: 'South Africa', mode: 'standard', minimumAnswers: 100,
    combinations: letters.map(letter => ({ letter })),
    text: ({ letter }) => 'Name a South African place beginning with ' + letter.toUpperCase() + '.',
    predicate: ({ letter }) => all(type('populated-place'), eq('country', 'South Africa'), eq('initial', letter)),
    conditions: 2,
  },
  {
    id: 'sa-place-ending', category: 'South Africa', mode: 'standard', minimumAnswers: 100,
    combinations: letters.map(letter => ({ letter })),
    text: ({ letter }) => 'Name a South African place ending with ' + letter.toUpperCase() + '.',
    predicate: ({ letter }) => all(type('populated-place'), eq('country', 'South Africa'), eq('ending', letter)),
    conditions: 2,
  },
  {
    id: 'sa-place-length', category: 'Words & Books', mode: 'standard', minimumAnswers: 100,
    combinations: lengths.map(length => ({ length })),
    text: ({ length }) => 'Name a South African place with exactly ' + length + ' letters.',
    predicate: ({ length }) => all(type('populated-place'), eq('country', 'South Africa'), eq('nameLength', length)),
    conditions: 2,
  },
  {
    id: 'sa-place-contains', category: 'Words & Books', mode: 'standard', minimumAnswers: 100,
    combinations: letters.map(letter => ({ letter })),
    text: ({ letter }) => 'Name a South African place containing the letter ' + letter.toUpperCase() + '.',
    predicate: ({ letter }) => all(type('populated-place'), eq('country', 'South Africa'), includes('letters', letter)),
    conditions: 2,
  },
  {
    id: 'sa-place-province-contains', category: 'South Africa', mode: 'standard', minimumAnswers: 100,
    combinations: provinces.flatMap(province => letters.map(letter => ({ province, letter }))),
    text: ({ province, letter }) => 'Name a place in ' + province + ' containing the letter ' + letter.toUpperCase() + '.',
    predicate: ({ province, letter }) => all(type('populated-place'), eq('country', 'South Africa'), eq('province', province), includes('letters', letter)),
    conditions: 3,
  },
  {
    id: 'sa-place-province-length', category: 'South Africa', mode: 'standard', minimumAnswers: 100,
    combinations: provinces.flatMap(province => lengths.map(length => ({ province, length }))),
    text: ({ province, length }) => 'Name a ' + province + ' place with exactly ' + length + ' letters.',
    predicate: ({ province, length }) => all(type('populated-place'), eq('country', 'South Africa'), eq('province', province), eq('nameLength', length)),
    conditions: 3,
  },
  {
    id: 'sa-place-province-ending', category: 'South Africa', mode: 'standard', minimumAnswers: 100,
    combinations: provinces.flatMap(province => letters.map(letter => ({ province, letter }))),
    text: ({ province, letter }) => 'Name a place in ' + province + ' ending with ' + letter.toUpperCase() + '.',
    predicate: ({ province, letter }) => all(type('populated-place'), eq('country', 'South Africa'), eq('province', province), eq('ending', letter)),
    conditions: 3,
  },
  {
    id: 'sa-place-word-count', category: 'Words & Books', mode: 'standard', minimumAnswers: 100,
    combinations: wordCounts.map(words => ({ words })),
    text: ({ words }) => 'Name a South African place whose name has ' + words + ' ' + (words === 1 ? 'word.' : 'words.'),
    predicate: ({ words }) => all(type('populated-place'), eq('country', 'South Africa'), eq('wordCount', words)),
    conditions: 2,
  },
  {
    id: 'sa-place-province-word-count', category: 'South Africa', mode: 'standard', minimumAnswers: 100,
    combinations: provinces.flatMap(province => wordCounts.map(words => ({ province, words }))),
    text: ({ province, words }) => 'Name a ' + province + ' place whose name has ' + words + ' ' + (words === 1 ? 'word.' : 'words.'),
    predicate: ({ province, words }) => all(type('populated-place'), eq('country', 'South Africa'), eq('province', province), eq('wordCount', words)),
    conditions: 3,
  },
  {
    id: 'country-continent', category: 'Geography', mode: 'specialist', minimumAnswers: 10,
    combinations: continents.map(continent => ({ continent })),
    text: ({ continent }) => 'Name a sovereign country in ' + continent + '.',
    predicate: ({ continent }) => all(type('country'), eq('sovereign', true), includes('continents', continent)),
    conditions: 2,
  },
  {
    id: 'country-initial', category: 'Geography', mode: 'specialist', minimumAnswers: 4,
    combinations: letters.map(letter => ({ letter })),
    text: ({ letter }) => 'Name a sovereign country beginning with ' + letter.toUpperCase() + '.',
    predicate: ({ letter }) => all(type('country'), eq('sovereign', true), { op: 'startsWith', property: 'name', value: letter }),
    conditions: 2,
  },
  {
    id: 'capital-continent', category: 'Geography', mode: 'specialist', minimumAnswers: 8,
    combinations: continents.map(continent => ({ continent })),
    text: ({ continent }) => 'Name a national capital in ' + continent + '.',
    predicate: ({ continent }) => all(type('capital'), includes('continents', continent)),
    conditions: 2,
  },
  {
    id: 'element-atomic-range', category: 'Science & Space', mode: 'specialist', minimumAnswers: 20,
    combinations: [{ start: 1, end: 30 }, { start: 31, end: 60 }, { start: 61, end: 90 }, { start: 91, end: 118 }],
    text: ({ start, end }) => 'Name a chemical element with atomic number from ' + start + ' to ' + end + '.',
    predicate: ({ start, end }) => all(type('chemical-element'), { op: 'gte', property: 'atomicNumber', value: start }, { op: 'lte', property: 'atomicNumber', value: end }),
    conditions: 2,
  },
];

const tierFor = entity => {
  const population = entity.familiaritySignals?.population ?? entity.familiaritySignals?.countryPopulation ?? 0;
  if (population >= 500000) return 'Pebble';
  if (population >= 100000) return 'Copper';
  if (population >= 25000) return 'Quartz';
  if (population >= 5000) return 'Sapphire';
  if (population >= 500) return 'Amethyst';
  return 'Stardust';
};
const jaccard = (left, right) => {
  let intersection = 0;
  const smaller = left.size < right.size ? left : right;
  const larger = smaller === left ? right : left;
  for (const value of smaller) if (larger.has(value)) intersection++;
  return intersection / (left.size + right.size - intersection || 1);
};
const overlap = (left, right) => {
  let intersection = 0;
  const smaller = left.size < right.size ? left : right;
  const larger = smaller === left ? right : left;
  for (const value of smaller) if (larger.has(value)) intersection++;
  return intersection / (smaller.size || 1);
};
const difficultyFor = (template, count, members) => {
  if (template.mode === 'specialist') return count < 15 ? ['challenging', 'Small finite set requiring specialist recall.'] : ['medium', 'Finite factual set with several accessible answers.'];
  const familiar = members.filter(entity => ['Pebble', 'Copper', 'Quartz'].includes(tierFor(entity))).length / count;
  if (template.conditions <= 2 && count >= 1000) return ['easy', 'Large answer pool with one main condition.'];
  if (template.conditions >= 3 && (count < 250 || familiar < 0.08)) return ['challenging', 'Multiple conditions and a mostly unfamiliar answer pool.'];
  return ['medium', 'Verified answer pool with multiple viable approaches.'];
};

const candidates = [];
for (const template of templates) for (const parameters of template.combinations) {
  const predicate = template.predicate(parameters);
  const members = entities.filter(entity => matchesPredicate(entity, predicate));
  candidates.push({ template, parameters, predicate, text: template.text(parameters), members });
}

const existingSets = existingPrompts.map(prompt => ({ id: prompt.id, set: new Set(entities.filter(entity => matchesPredicate(entity, prompt.where)).map(entity => entity.id)) }));
const accepted = [];
const acceptedSets = [];
const rejected = [];
const texts = new Set(existingPrompts.map(prompt => normalize(prompt.text)));
for (const candidate of candidates) {
  const { template, parameters, predicate, text, members } = candidate;
  const set = new Set(members.map(entity => entity.id));
  let reason = '';
  if (members.length < template.minimumAnswers) reason = 'too-few-answers';
  else if (texts.has(normalize(text))) reason = 'duplicate-text';
  else {
    const tiers = new Set(members.map(tierFor));
    if (template.mode === 'standard' && tiers.size < 3) reason = 'insufficient-rarity-diversity';
  }
  if (!reason) {
    const comparisons = [...existingSets, ...acceptedSets];
    const duplicate = comparisons.find(item => jaccard(set, item.set) >= 0.94 || (overlap(set, item.set) >= 0.995 && Math.abs(set.size - item.set.size) <= 2));
    if (duplicate) reason = 'overlapping-answer-set:' + duplicate.id;
  }
  if (reason) {
    rejected.push({ templateId: template.id, parameters, text, answerCount: members.length, reason });
    continue;
  }
  const parameterKey = Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '-' + slug(value)).join('--');
  const id = 'gen:v1:' + template.id + ':' + parameterKey;
  const [automaticDifficulty, automaticReason] = difficultyFor(template, members.length, members);
  const manual = difficultyOverrides[id];
  const difficulty = manual?.difficulty ?? automaticDifficulty;
  const difficultyReason = manual?.reason ?? automaticReason;
  const answerSetHash = createHash('sha256').update([...set].sort().join('\n')).digest('hex').slice(0, 16);
  accepted.push({
    id, text, category: template.category, difficulty, mode: template.mode, coverage: template.mode === 'standard' ? 'broad' : 'finite-set',
    target: template.mode === 'standard' ? 100 : null, where: predicate, templateId: template.id, parameters,
    difficultyReason, sourceIds: ['geonames:ZA', 'wikidata:country-snapshot', 'pubchem:periodic-table'].filter(source =>
      template.id.startsWith('sa-') ? source === 'geonames:ZA' : template.id.startsWith('element-') ? source.startsWith('pubchem') : source.startsWith('wikidata')),
    generationVersion: '3.0.0', answerCount: members.length, answerSetHash,
  });
  acceptedSets.push({ id, set });
  texts.add(normalize(text));
}

const playable = [...existingPrompts, ...accepted];
const answerCounts = playable.map(prompt => entities.filter(entity => matchesPredicate(entity, prompt.where)).length).sort((a, b) => a - b);
const reportValue = (prompt, key) => key === 'difficulty' && prompt[key] === 'hard' ? 'challenging' : prompt[key];
const distribution = key => Object.fromEntries([...new Set(playable.map(prompt => reportValue(prompt, key)))].sort().map(value => [value, playable.filter(prompt => reportValue(prompt, key) === value).length]));
const standardAt100 = accepted.filter(prompt => prompt.mode === 'standard' && prompt.answerCount >= 100).length + existingPrompts.filter(prompt => prompt.mode === 'standard' && entities.filter(entity => matchesPredicate(entity, prompt.where)).length >= 100).length;
const report = {
  generationVersion: '3.0.0', generatedAt: new Date().toISOString(), templates: templates.length,
  candidates: candidates.length, accepted: accepted.length, rejected: rejected.length, playableQuestions: playable.length,
  standardQuestions: playable.filter(prompt => prompt.mode === 'standard').length,
  specialistQuestions: playable.filter(prompt => prompt.mode === 'specialist').length,
  standardQuestionsAtLeast100: standardAt100,
  categoryDistribution: distribution('category'), difficultyDistribution: distribution('difficulty'),
  minimumAnswers: answerCounts[0], medianAnswers: quantile(answerCounts, 0.5),
  averageAnswers: Number((answerCounts.reduce((sum, count) => sum + count, 0) / answerCounts.length).toFixed(2)),
  maximumAnswers: answerCounts.at(-1), canonicalMemberships: answerCounts.reduce((sum, count) => sum + count, 0),
  rejectionReasons: rejected.reduce((totals, item) => ({ ...totals, [item.reason.split(':')[0]]: (totals[item.reason.split(':')[0]] ?? 0) + 1 }), {}),
  manualDifficultyOverridesApplied: accepted.filter(prompt => difficultyOverrides[prompt.id]).length,
  rejectedCandidates: rejected,
};

if (playable.length < 300 || playable.length > 500) throw new Error('Playable question target missed: ' + playable.length);
if (standardAt100 < 100) throw new Error('Standard 100-answer target missed: ' + standardAt100);
await mkdir(resolve(root, 'data/generated'), { recursive: true });
await mkdir(resolve(root, 'data/reports'), { recursive: true });
await mkdir(resolve(root, 'public/data/v3'), { recursive: true });
await writeFile(resolve(root, 'data/generated/questions.json'), JSON.stringify(accepted, null, 2) + '\n');
await writeFile(resolve(root, 'data/reports/question-generation.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(root, 'public/data/v3/questions.json'), JSON.stringify(accepted));
await writeFile(resolve(root, 'public/data/v3/generation-report.json'), JSON.stringify(report));
console.log(JSON.stringify({ templates: report.templates, candidates: report.candidates, accepted: report.accepted, rejected: report.rejected, playable: report.playableQuestions, standardAt100 }, null, 2));
