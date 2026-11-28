import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchesPredicate } from './lib/data-utils.mjs';
import { CODE_TIERS, TIER_ORDER } from './lib/rarity-utils.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const entities = await load('data/curated/entities.json');
const prompts = [...await load('data/curated/prompts.json'), ...await load('data/generated/questions.json')];
const rarity = await load('data/generated/rarity-v4.json');
const scores = (await load('data/generated/familiarity-scores.json')).records;
const overrides = await load('data/overrides/rarity-v4.json');
const legacy = await load('data/overrides/rarity.json');
const criticalErrors = [], questions = [];
const overall = Object.fromEntries(TIER_ORDER.map(tier => [tier, 0]));
let memberships = 0, overrideTotal = 0;
const overrideMap = new Map(overrides.map(item => [item.questionId + '\0' + item.entityId, item]));
for (const prompt of prompts) {
  const members = entities.filter(entity => matchesPredicate(entity, prompt.where));
  const stored = rarity.questions[prompt.id];
  if (!stored) { criticalErrors.push('Missing classification: ' + prompt.id); continue; }
  if (stored.count !== members.length || stored.codes.length !== members.length) criticalErrors.push(prompt.id + ': classification length mismatch');
  const distribution = Object.fromEntries(TIER_ORDER.map(tier => [tier, 0]));
  const classified = members.map((entity, index) => {
    const tier = CODE_TIERS[stored.codes[index]];
    if (!tier) criticalErrors.push(prompt.id + ': invalid tier code at ' + index);
    distribution[tier] = (distribution[tier] ?? 0) + 1; overall[tier] = (overall[tier] ?? 0) + 1;
    const score = scores[entity.id];
    if (!score) criticalErrors.push(prompt.id + ': missing familiarity score for ' + entity.id);
    return { entityId: entity.id, name: entity.name, tier, familiarity: score?.familiarity ?? 0.5, confidence: score?.confidence ?? 0, missingWeight: score?.missingWeight ?? 1, override: overrideMap.has(prompt.id + '\0' + entity.id) };
  });
  memberships += members.length;
  const overrideCount = classified.filter(item => item.override).length; overrideTotal += overrideCount;
  const stardust = distribution.Stardust;
  const missingSignalPercentage = classified.length ? classified.filter(item => item.missingWeight > 0.5).length / classified.length : 0;
  const averageConfidence = classified.length ? classified.reduce((sum, item) => sum + item.confidence, 0) / classified.length : 0;
  const familiarities = classified.map(item => item.familiarity);
  const anomalies = [];
  if (new Set(classified.map(item => item.tier)).size === 1 && classified.length > 6) anomalies.push('uniform-tiers');
  if (classified.length >= 50 && stardust / classified.length > 0.035) anomalies.push('excessive-stardust');
  if (missingSignalPercentage > 0.75) anomalies.push('high-missing-signal-rate');
  if (classified.some(item => item.tier === 'Stardust' && item.familiarity > 0.7)) anomalies.push('familiar-answer-in-stardust');
  questions.push({
    id: prompt.id,
    prompt: prompt.text,
    category: prompt.category,
    answerCount: classified.length,
    distribution,
    minimumFamiliarity: Number(Math.min(...familiarities).toFixed(4)),
    maximumFamiliarity: Number(Math.max(...familiarities).toFixed(4)),
    missingSignalPercentage: Number((missingSignalPercentage * 100).toFixed(2)),
    classificationConfidence: Number(averageConfidence.toFixed(4)),
    editorialOverrides: overrideCount,
    stardustCount: stardust,
    mostFamiliar: [...classified].sort((a, b) => b.familiarity - a.familiarity || a.name.localeCompare(b.name)).slice(0, 5).map(({ entityId, name, tier, familiarity }) => ({ entityId, name, tier, familiarity })),
    selectedUncommon: classified.filter(item => ['Amethyst','Stardust'].includes(item.tier)).sort((a, b) => a.familiarity - b.familiarity || a.name.localeCompare(b.name)).slice(0, 5).map(({ entityId, name, tier, familiarity }) => ({ entityId, name, tier, familiarity })),
    anomalies
  });
}
const legacyCounts = Object.fromEntries(TIER_ORDER.map(tier => [tier, 0]));
for (const assignments of Object.values(legacy)) for (const assignment of Object.values(assignments)) if (assignment.tier in legacyCounts) legacyCounts[assignment.tier]++;
const report = {
  version: rarity.version,
  datasetVersion: rarity.datasetVersion,
  scoringVersion: rarity.scoringVersion,
  evidenceVersion: rarity.evidenceVersion,
  classificationHash: createHash('sha256').update(JSON.stringify(rarity)).digest('hex'),
  entities: entities.length,
  questions: prompts.length,
  memberships,
  distribution: overall,
  distributionPercentages: Object.fromEntries(TIER_ORDER.map(tier => [tier, Number((overall[tier] / memberships * 100).toFixed(3))])),
  stardustPercentage: Number((overall.Stardust / memberships * 100).toFixed(3)),
  legacyStardustAssignments: legacyCounts.Stardust,
  legacyStardustPercentage: Number((legacyCounts.Stardust / Object.values(legacyCounts).reduce((sum, count) => sum + count, 0) * 100).toFixed(3)),
  editorialOverrides: overrideTotal,
  questionsWithWarnings: questions.filter(question => question.anomalies.length).length,
  warningCounts: questions.flatMap(question => question.anomalies).reduce((totals, warning) => ({ ...totals, [warning]: (totals[warning] ?? 0) + 1 }), {}),
  criticalErrors,
  questions
};
await mkdir(resolve(root, 'data/reports'), { recursive: true });
await mkdir(resolve(root, 'public/data/v4'), { recursive: true });
await writeFile(resolve(root, 'data/reports/rarity-audit.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(root, 'public/data/v4/rarity-audit.json'), JSON.stringify({ ...report, questions: report.questions.map(question => ({ ...question, mostFamiliar: question.mostFamiliar.slice(0, 3), selectedUncommon: question.selectedUncommon.slice(0, 3) })) }));
console.log(JSON.stringify({ memberships, distribution: overall, stardustPercentage: report.stardustPercentage, legacyStardustPercentage: report.legacyStardustPercentage, overrides: overrideTotal, questionsWithWarnings: report.questionsWithWarnings, criticalErrors }, null, 2));
if (criticalErrors.length) process.exitCode = 1;
