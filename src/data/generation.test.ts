import { describe, expect, it } from 'vitest';
import generatedPrompts from '../../data/generated/questions.json';
import { jaccardSimilarity, smallerSetOverlap, stableGeneratedId, validateTemplate } from './generation';

describe('question generation utilities', () => {
  it('rejects invalid template definitions', () => {
    expect(validateTemplate({ id: 'Bad ID', category: '', text: '', minimumAnswers: 2, conditions: 0 })).toHaveLength(5);
    expect(validateTemplate({ id: 'place-initial', category: 'Geography', text: 'Name a place.', minimumAnswers: 100, conditions: 2 })).toEqual([]);
  });

  it('makes stable IDs independent of parameter order', () => {
    expect(stableGeneratedId('place-test', { province: 'Eastern Cape', letter: 'M' }))
      .toBe(stableGeneratedId('place-test', { letter: 'M', province: 'Eastern Cape' }));
    expect(stableGeneratedId('place-test', { letter: 'M' })).toBe('gen:v1:place-test:letter-m');
  });

  it('measures duplicate answer pools', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['b', 'c', 'd'])).toBe(0.5);
    expect(smallerSetOverlap(['a', 'b'], ['a', 'b', 'c'])).toBe(1);
  });

  it('ships generated questions with stable metadata', () => {
    expect(generatedPrompts.length).toBeGreaterThanOrEqual(198);
    expect(generatedPrompts.every(prompt => prompt.id.startsWith('gen:v1:') && prompt.answerCount >= 4 && prompt.answerSetHash)).toBe(true);
    expect(new Set(generatedPrompts.map(prompt => prompt.id)).size).toBe(generatedPrompts.length);
  });
});
