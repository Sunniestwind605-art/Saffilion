import { describe, expect, it } from 'vitest';
import { questions } from './questions';
import { validateQuestions } from '../game/engine';

describe('question database integrity', () => {
  it('has no schema, score, ID, or alias conflicts', () => expect(validateQuestions(questions)).toEqual([]));
  it('has substantial answer coverage', () => {
    const records = questions.reduce((n, q) => n + q.answers.length, 0);
    expect(records).toBeGreaterThanOrEqual(1400);
    expect(new Set(questions.map(q => q.category)).size).toBeGreaterThanOrEqual(10);
  });
  it('keeps broad international and South African coverage', () => {
    expect(questions.filter(q => q.category === 'South Africa').length).toBeGreaterThanOrEqual(8);
    expect(questions.find(q => q.id === 'geo-01')!.answers.length).toBeGreaterThanOrEqual(24);
    expect(questions.find(q => q.id === 'nature-01')!.answers.some(a => a.canonical === 'Fish')).toBe(true);
    expect(questions.find(q => q.id === 'sa-02')!.answers.some(a => a.canonical === 'Soweto')).toBe(true);
  });
});
