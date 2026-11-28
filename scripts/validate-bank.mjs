import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchesPredicate, normalize, quantile } from './lib/data-utils.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const entities = await load('data/curated/entities.json');
const curatedPrompts = await load('data/curated/prompts.json');
const generatedPrompts = await load('data/generated/questions.json');
const prompts = [...curatedPrompts, ...generatedPrompts];
const rarity = await load('data/overrides/rarity.json');
const errors = [];
const entityIds = new Set();
for (const entity of entities) {
  if (entityIds.has(entity.id)) errors.push('Duplicate entity ID: ' + entity.id);
  entityIds.add(entity.id);
  if (!entity.sourceIds?.length) errors.push('Missing source metadata: ' + entity.id);
}

const validOps = new Set(['eq','in','includes','type','exists','gt','gte','lt','lte','before','after','startsWith']);
function validPredicate(predicate) {
  if (!predicate || typeof predicate !== 'object') return false;
  if ('all' in predicate) return Array.isArray(predicate.all) && predicate.all.length > 0 && predicate.all.every(validPredicate);
  if ('any' in predicate) return Array.isArray(predicate.any) && predicate.any.length > 0 && predicate.any.every(validPredicate);
  if ('not' in predicate) return validPredicate(predicate.not);
  return validOps.has(predicate.op);
}

const counts = [];
const promptCounts = new Map();
const broadBelowTarget = [];
const finiteSets = [];
let memberships = 0;
let aliases = 0;
let missingRarity = 0;
for (const prompt of prompts) {
  if (!validPredicate(prompt.where)) errors.push('Invalid predicate: ' + prompt.id);
  const members = entities.filter(entity => matchesPredicate(entity, prompt.where));
  counts.push(members.length); promptCounts.set(prompt.id, members.length); memberships += members.length;
  const names = new Map();
  for (const entity of members) {
    if (!prompt.generationVersion && !rarity[prompt.id]?.[entity.id]) missingRarity++;
    for (const value of [entity.name, ...entity.aliases]) {
      const key = normalize(value); aliases += value === entity.name ? 0 : 1;
      const prior = names.get(key);
      if (prior && prior !== entity.id) errors.push('Conflicting alias in ' + prompt.id + ': ' + value);
      names.set(key, entity.id);
    }
  }
  if (prompt.coverage === 'broad' && members.length < (prompt.target ?? 100)) broadBelowTarget.push({ id: prompt.id, count: members.length, target: prompt.target ?? 100 });
  if (prompt.coverage === 'finite-set') finiteSets.push({ id: prompt.id, count: members.length });
}

const exactFinite = { 'geo-01': 54, 'geo-02': 12, 'geo-03': 17, 'science-01': 8, 'science-03': 118, 'games-02': 6, 'sport-02': 4, 'sa-01': 9, 'words-04': 12 };
for (const [id, expected] of Object.entries(exactFinite)) {
  const actual = finiteSets.find(item => item.id === id)?.count;
  if (actual !== expected) errors.push(id + ': expected ' + expected + ' finite members, found ' + actual);
}
if (missingRarity) errors.push('Missing rarity assignments: ' + missingRarity);
const generatedIds = new Set();
for (const prompt of generatedPrompts) {
  if (!prompt.id.startsWith('gen:v1:')) errors.push('Unstable generated ID: ' + prompt.id);
  if (generatedIds.has(prompt.id)) errors.push('Duplicate generated ID: ' + prompt.id);
  generatedIds.add(prompt.id);
  if (!prompt.templateId || !prompt.answerSetHash || !prompt.difficultyReason) errors.push('Incomplete generated metadata: ' + prompt.id);
  if (prompt.answerCount !== promptCounts.get(prompt.id)) errors.push(prompt.id + ': recorded ' + prompt.answerCount + ' answers, found ' + promptCounts.get(prompt.id));
}
const standardAt100 = prompts.filter(prompt => prompt.mode === 'standard' && (promptCounts.get(prompt.id) ?? 0) >= 100).length;
if (prompts.length < 300 || prompts.length > 500) errors.push('Playable bank outside 300-500 target: ' + prompts.length);
if (standardAt100 < 100) errors.push('Fewer than 100 standard questions have 100 answers: ' + standardAt100);
counts.sort((a, b) => a - b);
const sourceBytes = (await stat(resolve(root, 'data/curated/entities.json'))).size;
const shardFiles = (await load('public/data/v2/manifest.json')).shards;
let shardBytes = 0;
for (const shard of shardFiles) shardBytes += (await stat(resolve(root, 'public', shard.url))).size;
const report = {
  generatedAt: new Date().toISOString(),
  entities: entities.length,
  prompts: prompts.length,
  curatedPrompts: curatedPrompts.length,
  generatedPrompts: generatedPrompts.length,
  canonicalAnswerRecords: memberships,
  aliasRecords: aliases,
  min: counts[0],
  median: quantile(counts, 0.5),
  average: Number((memberships / prompts.length).toFixed(2)),
  max: counts.at(-1),
  broadQuestionsAtLeast100: prompts.filter(prompt => prompt.coverage === 'broad' && promptCounts.get(prompt.id) >= 100).length,
  standardQuestionsAtLeast100: standardAt100,
  questionsAtLeast100: counts.filter(count => count >= 100).length,
  questionsAtLeast500: counts.filter(count => count >= 500).length,
  questionsAtLeast1000: counts.filter(count => count >= 1000).length,
  broadBelowTarget,
  finiteSets,
  duplicateEntityIds: errors.filter(error => error.startsWith('Duplicate')).length,
  conflictingAliases: errors.filter(error => error.startsWith('Conflicting')).length,
  invalidPredicates: errors.filter(error => error.startsWith('Invalid')).length,
  missingSourceMetadata: errors.filter(error => error.startsWith('Missing source')).length,
  missingRarityAssignments: missingRarity,
  serializedEntityBytes: sourceBytes,
  offlineShardBytes: shardBytes,
  errors,
};
await mkdir(resolve(root, 'data/reports'), { recursive: true });
await writeFile(resolve(root, 'data/reports/question-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
