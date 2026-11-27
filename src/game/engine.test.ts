import { describe, expect, it } from 'vitest';
import { depthForPoints, digDurationForPoints, distance, equivalentAnswer, findAnswer, normalize, pickQuestions, rankFor, suggestAnswer, travelPixelsForPoints, validateQuestions, freshSave } from './engine';
import { questions } from '../data/questions';

describe('answer engine', () => {
  const planets = questions.find(q => q.id === 'science-01')!;
  it('normalises case, accents, whitespace and punctuation', () => expect(normalize('  São--Tomé! ')).toBe('sao tome'));
  it('accepts canonical answers and curated aliases', () => {
    expect(findAnswer(planets, '  JUPITER ')?.points).toBe(5);
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
    expect(suggestAnswer(planets, 'ju')).toBeUndefined();
    expect(suggestAnswer(planets, 'unrelated')).toBeUndefined();
  });
});

describe('game rules', () => {
  it('contains at least 100 unique, valid questions', () => {
    expect(questions.length).toBeGreaterThanOrEqual(100);
    expect(validateQuestions(questions)).toEqual([]);
  });
  it('builds seven-question shuffle bags without duplicates', () => {
    const out = pickQuestions(questions, freshSave());
    expect(out.chosen).toHaveLength(7);
    expect(new Set(out.chosen).size).toBe(7);
  });
  it('keeps ranking thresholds stable', () => {
    expect(rankFor(0)).toBe('Curious Kitten');
    expect(rankFor(700)).toBe('Stardust Legend');
  });
  it('keeps curated answer weights meaningfully different', () => {
    const africa = questions.find(q => q.id === 'geo-01')!;
    expect(findAnswer(africa, 'South Africa')).toMatchObject({ tier: 'Pebble', points: 5 });
    expect(findAnswer(africa, 'Comoros')).toMatchObject({ tier: 'Stardust', points: 100 });
    expect(depthForPoints(5)).toBe(50);
    expect(depthForPoints(100)).toBe(1000);
    expect(travelPixelsForPoints(100)).toBeGreaterThan(travelPixelsForPoints(5) * 7);
    expect(digDurationForPoints(100)).toBeGreaterThan(digDurationForPoints(5) * 2);
    expect(findAnswer(africa, 'Comoros')!.points / findAnswer(africa, 'South Africa')!.points).toBe(20);
    expect(new Set(questions.flatMap(q => q.answers.map(a => a.tier)))).toEqual(new Set(['Pebble','Copper','Quartz','Sapphire','Amethyst','Stardust']));
  });
});
