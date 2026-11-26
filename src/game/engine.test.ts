import { describe, expect, it } from 'vitest';
import { distance, findAnswer, normalize, pickQuestions, rankFor, suggestAnswer, validateQuestions, freshSave } from './engine';
import { questions } from '../data/questions';

describe('answer engine', () => {
  const planets = questions.find(q => q.id === 'science-01')!;
  it('normalises case, accents, whitespace and punctuation', () => expect(normalize('  São--Tomé! ')).toBe('sao tome'));
  it('accepts canonical answers and curated aliases', () => {
    expect(findAnswer(planets, '  JUPITER ')?.points).toBe(10);
    expect(findAnswer(questions.find(q => q.id === 'geo-01')!, 'RSA')?.canonical).toBe('South Africa');
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
});
