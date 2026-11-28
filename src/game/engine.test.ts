import { describe, expect, it } from 'vitest';
import { dailyQuestionIds, depthForPoints, digDurationForPoints, distance, equivalentAnswer, findAnswer, isKnownOutsideQuestion, loadSave, normalize, pickQuestions, rankFor, seedFrom, suggestAnswer, summarizeExpeditions, travelPixelsForPoints, validateQuestions, freshSave } from './engine';
import { questions } from '../data/questions';
import { DAILY_SCHEDULE_VERSION } from '../data/knowledge';
import { TIERS } from './types';
import overrides from '../../data/overrides/rarity-v4.json';

describe('answer engine', () => {
  const planets = questions.find(q => q.id === 'science-01')!;
  it('normalises case, accents, whitespace and punctuation', () => expect(normalize('  São--Tomé! ')).toBe('sao tome'));
  it('accepts canonical answers and curated aliases', () => {
    expect(findAnswer(planets, '  JUPITER ')?.points).toBe(15);
    expect(findAnswer(questions.find(q => q.id === 'geo-01')!, 'RSA')?.canonical).toBe('South Africa');
  });
  it('accepts safe plural variants without turning fuzzy matching into autocomplete', () => {
    expect(equivalentAnswer('lion', 'lions')).toBe(true);
    expect(equivalentAnswer('country', 'countries')).toBe(true);
    expect(equivalentAnswer('glass', 'glas')).toBe(false);
    expect(findAnswer(questions.find(q => q.id === 'nature-04')!, 'Lions')?.canonical).toBe('Lion');
  });
  it('uses Damerau-Levenshtein transpositions', () => expect(distance('Jupietr', 'Jupiter')).toBe(1));
  it('suggests only confident submitted near-matches', () => {
    expect(suggestAnswer(planets, 'Jupitr')?.canonical).toBe('Jupiter');
    expect(suggestAnswer(planets, 'Jupitr')?.points).toBe(findAnswer(planets, 'Jupiter')?.points);
    expect(suggestAnswer(planets, 'ju')).toBeUndefined();
    expect(suggestAnswer(planets, 'unrelated')).toBeUndefined();
  });
  it('distinguishes known out-of-category entities from unknown text', () => {
    const elements = questions.find(q => q.id === 'science-03')!;
    expect(findAnswer(elements, 'South Africa')).toBeUndefined();
    expect(suggestAnswer(elements, 'South Africa')).toBeUndefined();
    expect(isKnownOutsideQuestion(elements, 'South Africa')).toBe(true);
    expect(isKnownOutsideQuestion(elements, 'flibbertigibbet')).toBe(false);
  });
  it('keeps exact matching fast with a ten-thousand-answer pool', () => {
    const places = questions.find(q => q.id === 'sa-02')!;
    const started = performance.now();
    for (let index = 0; index < 250; index++) expect(findAnswer(places, 'Johannesburg')?.canonical).toBe('Johannesburg');
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe('game rules', () => {
  it('uses one authoritative six-tier scoring curve', () => {
    expect(TIERS).toEqual({ Pebble:10, Copper:15, Quartz:30, Sapphire:60, Amethyst:85, Stardust:100 });
    expect(depthForPoints(Object.values(TIERS).reduce((sum, points) => sum + points, 0))).toBe(3000);
  });
  it('contains at least 100 unique, valid questions', () => {
    expect(questions.length).toBeGreaterThanOrEqual(100);
    expect(validateQuestions(questions)).toEqual([]);
  });
  it('builds seven-question shuffle bags without duplicates', () => {
    const out = pickQuestions(questions, freshSave());
    expect(out.chosen).toHaveLength(7);
    expect(new Set(out.chosen).size).toBe(7);
  });
  it('builds a deterministic balanced daily sequence', () => {
    const first = dailyQuestionIds(questions, '2026-11-28');
    const second = dailyQuestionIds([...questions].reverse(), '2026-11-28');
    expect(first).toEqual(second);
    expect(first).toHaveLength(7);
    const selected = first!.map(id => questions.find(question => question.id === id)!);
    expect(selected.map(question => question.difficulty).sort()).toEqual(['challenging','challenging','easy','easy','medium','medium','medium']);
    expect(new Set(selected.map(question => question.category)).size).toBeGreaterThanOrEqual(4);
    expect(dailyQuestionIds(questions, '2026-11-28', DAILY_SCHEDULE_VERSION + '-other')).toBeNull();
  });
  it('keeps seeded unlimited selection reproducible and avoids recent questions', () => {
    const seed = seedFrom('repeatable-selection');
    const first = pickQuestions(questions, freshSave(), 'All', { seed });
    const second = pickQuestions(questions, freshSave(), 'All', { seed });
    expect(first.chosen).toEqual(second.chosen);
    const save = freshSave(); save.recentQuestions = first.chosen;
    expect(pickQuestions(questions, save, 'All', { seed }).chosen.some(id => first.chosen.includes(id))).toBe(false);
  });
  it('keeps ranking thresholds stable', () => {
    expect(rankFor(0)).toBe('Curious Kitten');
    expect(rankFor(700)).toBe('Stardust Legend');
  });
  it('uses the Phase 4 rarity curve and keeps weights meaningfully different', () => {
    const africa = questions.find(q => q.id === 'geo-01')!;
    expect(findAnswer(africa, 'South Africa')).toMatchObject({ tier: 'Pebble', points: 10 });
    expect(findAnswer(africa, 'Comoros')).toMatchObject({ tier: 'Stardust', points: 100 });
    expect(depthForPoints(10)).toBe(100);
    expect(depthForPoints(100)).toBe(1000);
    expect(travelPixelsForPoints(100)).toBeGreaterThan(travelPixelsForPoints(10) * 5);
    expect(digDurationForPoints(100)).toBeGreaterThan(digDurationForPoints(10) * 2);
    expect(findAnswer(africa, 'Comoros')!.points / findAnswer(africa, 'South Africa')!.points).toBe(10);
    expect(new Set(questions.flatMap(q => q.answers.map(a => a.tier)))).toEqual(new Set(['Pebble','Copper','Quartz','Sapphire','Amethyst','Stardust']));
  });
  it('keeps aliases on the exact canonical classification', () => {
    const africa = questions.find(q => q.id === 'geo-01')!;
    expect(findAnswer(africa, 'RSA')).toBe(findAnswer(africa, 'South Africa'));
  });
  it('uses question context instead of assigning one global tier', () => {
    const byEntity = new Map<string, Set<string>>();
    for (const question of questions) for (const answer of question.answers) {
      if (!byEntity.has(answer.entityId)) byEntity.set(answer.entityId, new Set());
      byEntity.get(answer.entityId)!.add(answer.tier);
    }
    expect([...byEntity.values()].some(tiers => tiers.size > 1)).toBe(true);
  });
  it('does not promote low-confidence missing evidence to Stardust', () => {
    expect(findAnswer(questions.find(q => q.id === 'sa-02')!, 'Copenhagen')).toMatchObject({ tier: 'Quartz', raritySource: 'model' });
  });
  it('applies every audited override to the requested question and entity', () => {
    for (const override of overrides) {
      const answer = questions.find(question => question.id === override.questionId)!.answers.find(item => item.entityId === override.entityId);
      expect(answer).toMatchObject({ tier: override.tier, raritySource: 'override' });
    }
  });
  it('rejects answers whose rarity provenance is absent', () => {
    const question = structuredClone(questions.find(q => q.id === 'science-01')!);
    (question.answers[0] as { raritySource?: string }).raritySource = undefined;
    expect(validateQuestions([question]).some(error => error.includes('missing rarity metadata'))).toBe(true);
  });
  it('loads historical scores exactly as recorded instead of rescoring them', () => {
    const historical = { ...freshSave(), expeditions:[{ id:'legacy', date:'2026-11-01T00:00:00.000Z', cat:'pebble', score:123, depth:1230, rounds:[{ questionId:'geo-01', prompt:'Legacy prompt', answer:'South Africa', canonical:'South Africa', points:5, tier:'Pebble', timedOut:false }] }] };
    const priorStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{ getItem:()=>JSON.stringify(historical), setItem:()=>undefined } });
    expect(loadSave().expeditions[0]).toMatchObject({ score:123, depth:1230, rounds:[{ points:5, tier:'Pebble' }] });
    Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:priorStorage });
  });
  it('migrates v1 saves and derives cumulative statistics without changing scores', () => {
    const legacy={...freshSave(),version:1,lifetimeStats:undefined,expeditions:[{id:'old',date:'2026-01-01T00:00:00.000Z',cat:'pebble',score:185,depth:1850,rounds:[{questionId:'q',prompt:'p',answer:'a',points:85,tier:'Amethyst',timedOut:false}]}]};
    const priorStorage=globalThis.localStorage;
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify(legacy),setItem:()=>undefined}});
    expect(loadSave()).toMatchObject({version:2,lifetimeStats:{expeditions:1,highestScore:185,deepestExpedition:1850,lifetimeDepth:1850,correctAnswers:1,rareAnswers:1}});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:priorStorage});
  });
  it('summarises more than one hundred expeditions without a history cap', () => {
    const expeditions=Array.from({length:175},(_,index)=>({id:`e-${index}`,date:new Date(index).toISOString(),cat:'pebble' as const,score:index,depth:index*10,rounds:[],discoveredBiomes:['roots']}));
    expect(summarizeExpeditions(expeditions)).toMatchObject({expeditions:175,highestScore:174,deepestExpedition:1740,lifetimeDepth:152250});
  });
});
