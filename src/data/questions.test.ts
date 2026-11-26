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
});
