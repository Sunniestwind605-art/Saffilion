import { TIERS, type Question, type Tier } from '../game/types';
import rawEntities from '../../data/curated/entities.json';
import rawPrompts from '../../data/curated/prompts.json';
import rawRarity from '../../data/generated/rarity-v4.json';
import generatedPrompts from '../../data/generated/questions.json';

export const DATASET_VERSION = rawRarity.datasetVersion;
export const SCORING_VERSION = rawRarity.scoringVersion;
export const QUESTION_VERSION = rawRarity.questionVersion;
export const DAILY_SCHEDULE_VERSION = `daily-v2-rarity-${DATASET_VERSION}`;

export type EntityValue = string | number | boolean | string[] | number[];
export interface Entity {
  id: string;
  name: string;
  aliases: string[];
  types: string[];
  props: Record<string, EntityValue>;
  sourceIds: string[];
  familiaritySignals?: Record<string, number | null>;
}

type PropertyPredicate =
  | { op: 'eq'; property: string; value: EntityValue }
  | { op: 'in'; property: string; values: EntityValue[] }
  | { op: 'includes'; property: string; value: string | number }
  | { op: 'type'; value: string }
  | { op: 'exists'; property: string }
  | { op: 'gt' | 'gte' | 'lt' | 'lte'; property: string; value: number }
  | { op: 'before' | 'after'; property: string; value: string }
  | { op: 'startsWith'; property: 'name'; value: string };
export type EntityPredicate = PropertyPredicate | { all: EntityPredicate[] } | { any: EntityPredicate[] } | { not: EntityPredicate };

interface PromptRecord {
  id: string;
  text: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'challenging';
  mode: 'standard' | 'specialist';
  coverage: 'broad' | 'finite-set' | 'curated';
  target: number | null;
  where: EntityPredicate;
  templateId?: string;
  parameters?: Record<string, string | number>;
  difficultyReason?: string;
  sourceIds?: string[];
  generationVersion?: string;
  answerCount?: number;
  answerSetHash?: string;
}
export const entities = rawEntities as unknown as Entity[];
export const promptDefinitions = [...rawPrompts, ...generatedPrompts] as unknown as PromptRecord[];
const rarity = rawRarity;

for (const tier of rarity.tierOrder) {
  if (TIERS[tier as Tier] !== rarity.points[tier as keyof typeof rarity.points]) {
    throw new Error(`Rarity point mismatch for ${tier}`);
  }
}

export function normalizeEntityName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function matchesPredicate(entity: Entity, predicate: EntityPredicate): boolean {
  if ('all' in predicate) return predicate.all.every(item => matchesPredicate(entity, item));
  if ('any' in predicate) return predicate.any.some(item => matchesPredicate(entity, item));
  if ('not' in predicate) return !matchesPredicate(entity, predicate.not);
  const value = predicate.op === 'type' ? entity.types : predicate.property === 'name' ? entity.name : entity.props[predicate.property];
  switch (predicate.op) {
    case 'eq': return value === predicate.value;
    case 'in': return predicate.values.includes(value as EntityValue);
    case 'includes': return Array.isArray(value) && value.includes(predicate.value as never);
    case 'type': return entity.types.includes(predicate.value);
    case 'exists': return value !== undefined && value !== null;
    case 'gt': return typeof value === 'number' && value > predicate.value;
    case 'gte': return typeof value === 'number' && value >= predicate.value;
    case 'lt': return typeof value === 'number' && value < predicate.value;
    case 'lte': return typeof value === 'number' && value <= predicate.value;
    case 'before': return typeof value === 'string' && Date.parse(value) < Date.parse(predicate.value);
    case 'after': return typeof value === 'string' && Date.parse(value) > Date.parse(predicate.value);
    case 'startsWith': return typeof value === 'string' && normalizeEntityName(value).startsWith(normalizeEntityName(predicate.value));
  }
}

export const entityRegistry = new Map(entities.map(entity => [entity.id, entity]));
export const entityTypeIndex = new Map<string, Set<string>>();
export const entityPropertyIndexes = new Map<string, Map<string, Set<string>>>();
export const exactAliasIndex = new Map<string, Set<string>>();
for (const entity of entities) {
  for (const type of entity.types) {
    if (!entityTypeIndex.has(type)) entityTypeIndex.set(type, new Set());
    entityTypeIndex.get(type)!.add(entity.id);
  }
  for (const name of [entity.name, ...entity.aliases]) {
    const key = normalizeEntityName(name);
    if (!exactAliasIndex.has(key)) exactAliasIndex.set(key, new Set());
    exactAliasIndex.get(key)!.add(entity.id);
  }
}

export function getPropertyIndex(property: string) {
  const cached = entityPropertyIndexes.get(property);
  if (cached) return cached;
  const index = new Map<string, Set<string>>();
  for (const entity of entities) {
    const rawValue = entity.props[property];
    if (rawValue === undefined) continue;
    for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
      const key = String(value);
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(entity.id);
    }
  }
  entityPropertyIndexes.set(property, index);
  return index;
}

export const promptMemberships = new Map<string, Set<string>>();
export const questions: Question[] = promptDefinitions.map(prompt => {
  const members = entities.filter(entity => matchesPredicate(entity, prompt.where));
  const classification = rarity.questions[prompt.id as keyof typeof rarity.questions];
  if (!classification || classification.count !== members.length || classification.codes.length !== members.length) {
    throw new Error(`Missing or invalid rarity metadata for ${prompt.id}`);
  }
  const overrideIndexes = new Set<number>(classification.overrideIndexes as number[]);
  promptMemberships.set(prompt.id, new Set(members.map(entity => entity.id)));
  return {
    id: prompt.id,
    category: prompt.category,
    prompt: prompt.text,
    difficulty: prompt.difficulty === 'hard' ? 'challenging' : prompt.difficulty,
    mode: prompt.mode,
    coverage: prompt.coverage,
    templateId: prompt.templateId,
    difficultyReason: prompt.difficultyReason,
    sourceIds: prompt.sourceIds ?? ['saffilion:launch-bank'],
    generationVersion: prompt.generationVersion,
    answers: members.map((entity, index) => {
      const tier = rarity.tierOrder[Number(classification.codes[index])] as Tier | undefined;
      if (!tier || TIERS[tier] === undefined) throw new Error(`Invalid rarity code for ${prompt.id}/${entity.id}`);
      return { entityId: entity.id, canonical: entity.name, aliases: entity.aliases, tier, points: TIERS[tier], raritySource: overrideIndexes.has(index) ? 'override' : 'model' };
    }),
  };
});

export const categoryCounts = new Map([...new Set(questions.map(question => question.category))].map(category => [category, questions.filter(question => question.category === category && question.mode === 'standard').length]));
export const categories = ['All', ...[...categoryCounts].filter(([, count]) => count >= 7).map(([category]) => category)];
export const knownEntityIds = (value: string) => exactAliasIndex.get(normalizeEntityName(value)) ?? new Set<string>();
