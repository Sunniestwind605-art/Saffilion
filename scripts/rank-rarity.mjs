import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchesPredicate } from './lib/data-utils.mjs';
import { classifyTier, entityGroup, tiedPercentiles, TIER_CODES, TIER_ORDER, transformSignal } from './lib/rarity-utils.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const entities = await load('data/curated/entities.json');
const prompts = [...await load('data/curated/prompts.json'), ...await load('data/generated/questions.json')];
const evidence = await load('data/familiarity/evidence.json');
const config = await load('data/rarity/config.json');
const scoring = await load('data/rarity/scoring.json');
const overrides = await load('data/overrides/rarity-v4.json');
if (evidence.version !== config.evidenceVersion) throw new Error(`Expected ${config.evidenceVersion}, found ${evidence.version}`);
if (scoring.version !== config.scoringVersion) throw new Error(`Expected ${config.scoringVersion}, found ${scoring.version}`);

const entityById = new Map(entities.map(entity => [entity.id, entity]));
const promptById = new Map(prompts.map(prompt => [prompt.id, prompt]));
const normalizedByEntity = new Map(entities.map(entity => [entity.id, {}]));
const groups = new Map();
for (const entity of entities) {
  const record = evidence.records[entity.id];
  if (!record) throw new Error('Missing familiarity evidence: ' + entity.id);
  const group = record.group ?? entityGroup(entity);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(entity.id);
}
for (const [group, entityIds] of groups) {
  const metricNames = new Set(entityIds.flatMap(id => Object.keys(evidence.records[id].metrics ?? {})));
  for (const metric of metricNames) {
    const transform = config.metricTransforms[metric] ?? 'identity';
    const entries = entityIds.flatMap(id => {
      const value = transformSignal(evidence.records[id].metrics?.[metric], transform);
      return value === null ? [] : [{ id, value }];
    });
    const percentiles = tiedPercentiles(entries);
    for (const [id, percentile] of percentiles) normalizedByEntity.get(id)[metric] = percentile;
  }
}

const scores = {};
for (const entity of entities) {
  const record = evidence.records[entity.id], group = record.group ?? entityGroup(entity);
  const weights = config.weights[group] ?? config.weights.other;
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let validWeight = 0, weighted = 0;
  const normalizedMetrics = normalizedByEntity.get(entity.id);
  for (const [metric, weight] of Object.entries(weights)) if (normalizedMetrics[metric] !== undefined) {
    validWeight += weight; weighted += weight * normalizedMetrics[metric];
  }
  const familiarity = validWeight ? weighted / validWeight : config.missingFallbackPercentile;
  const confidence = 0.2 + 0.8 * (validWeight / totalWeight);
  scores[entity.id] = {
    group,
    familiarity: Number(familiarity.toFixed(6)),
    confidence: Number(confidence.toFixed(6)),
    missingWeight: Number((1 - validWeight / totalWeight).toFixed(6)),
    metrics: normalizedMetrics
  };
}

const overrideKeys = new Set();
for (const override of overrides) {
  const key = override.questionId + '\0' + override.entityId;
  if (overrideKeys.has(key)) throw new Error('Duplicate rarity override: ' + override.questionId + ' / ' + override.entityId);
  overrideKeys.add(key);
  if (!promptById.has(override.questionId)) throw new Error('Override references missing question: ' + override.questionId);
  if (!entityById.has(override.entityId)) throw new Error('Override references missing entity: ' + override.entityId);
  if (!TIER_ORDER.includes(override.tier)) throw new Error('Override has invalid tier: ' + override.tier);
  if (!override.reason?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(override.reviewedAt ?? '')) throw new Error('Override lacks audit metadata: ' + key);
  if (!matchesPredicate(entityById.get(override.entityId), promptById.get(override.questionId).where)) throw new Error('Override entity is outside question: ' + key);
}
const overrideMap = new Map(overrides.map(override => [override.questionId + '\0' + override.entityId, override]));
const classifications = {};
for (const prompt of prompts) {
  const members = entities.filter(entity => matchesPredicate(entity, prompt.where));
  const relative = tiedPercentiles(members.map(entity => ({ id: entity.id, value: scores[entity.id].familiarity })));
  const codes = [];
  const overrideIndexes = [];
  for (let index = 0; index < members.length; index++) {
    const entity = members[index], score = scores[entity.id];
    const automatic = classifyTier({ familiarity: score.familiarity, relative: relative.get(entity.id), confidence: score.confidence, count: members.length, coverage: prompt.coverage }, config);
    const override = overrideMap.get(prompt.id + '\0' + entity.id);
    const tier = override?.tier ?? automatic;
    codes.push(TIER_CODES[tier]);
    if (override) overrideIndexes.push(index);
  }
  const answerSetHash = createHash('sha256').update(members.map(entity => entity.id).sort().join('\n')).digest('hex').slice(0, 16);
  classifications[prompt.id] = { count: members.length, answerSetHash, codes: codes.join(''), overrideIndexes };
}
const entityOrderHash = createHash('sha256').update(entities.map(entity => entity.id).join('\n')).digest('hex').slice(0, 16);
const modelHash = createHash('sha256').update(JSON.stringify({ config, scoring, evidence, overrides })).digest('hex');
const output = {
  version: config.version,
  datasetVersion: '4.0.0',
  scoringVersion: config.scoringVersion,
  questionVersion: config.questionVersion,
  evidenceVersion: evidence.version,
  entityOrderHash,
  modelHash,
  tierOrder: TIER_ORDER,
  points: scoring.points,
  questions: classifications
};
const outputText = JSON.stringify(output, null, 2) + '\n';
const outputPath = resolve(root, 'data/generated/rarity-v4.json');
if (process.argv.includes('--check')) {
  const prior = await readFile(outputPath, 'utf8');
  if (prior !== outputText) throw new Error('Rarity output is not reproducible. Run npm run data:rank-rarity and inspect the change.');
} else {
  await mkdir(resolve(root, 'data/generated'), { recursive: true });
  await mkdir(resolve(root, 'public/data/v4'), { recursive: true });
  await writeFile(outputPath, outputText);
  await writeFile(resolve(root, 'data/generated/familiarity-scores.json'), JSON.stringify({ version: config.version, evidenceVersion: evidence.version, records: scores }, null, 2) + '\n');
  await writeFile(resolve(root, 'public/data/v4/rarity.json'), JSON.stringify(output));
}
console.log(JSON.stringify({ entities: entities.length, questions: prompts.length, memberships: Object.values(classifications).reduce((sum, item) => sum + item.count, 0), overrides: overrides.length, modelHash: modelHash.slice(0, 16), check: process.argv.includes('--check') }, null, 2));
