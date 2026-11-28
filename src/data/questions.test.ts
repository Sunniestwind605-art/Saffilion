import { describe, expect, it } from 'vitest';
import { questions } from './questions';
import { validateQuestions } from '../game/engine';
import { entities, matchesPredicate, promptDefinitions } from './knowledge';

describe('question database integrity', () => {
  it('has no schema, score, ID, or alias conflicts', () => expect(validateQuestions(questions)).toEqual([]));
  it('has substantial answer coverage', () => {
    const records = questions.reduce((n, q) => n + q.answers.length, 0);
    expect(entities.length).toBeGreaterThanOrEqual(12_000);
    expect(records).toBeGreaterThanOrEqual(12_000);
    expect(new Set(questions.map(q => q.category)).size).toBeGreaterThanOrEqual(10);
  });
  it('keeps broad international and South African coverage', () => {
    expect(questions.filter(q => q.category === 'South Africa').length).toBeGreaterThanOrEqual(8);
    expect(questions.find(q => q.id === 'geo-01')!.answers).toHaveLength(54);
    expect(questions.find(q => q.id === 'geo-02')!.answers).toHaveLength(12);
    expect(questions.find(q => q.id === 'science-03')!.answers).toHaveLength(118);
    expect(questions.find(q => q.id === 'sa-02')!.answers.length).toBeGreaterThan(10_000);
    expect(questions.find(q => q.id === 'nature-01')!.answers.some(a => a.canonical === 'Fish')).toBe(true);
    expect(questions.find(q => q.id === 'sa-02')!.answers.some(a => a.canonical === 'Soweto')).toBe(true);
    expect(questions.find(q => q.id === 'geo-08')!.answers.some(a => a.canonical === 'Bulgaria')).toBe(true);
    expect(questions.find(q => q.id === 'words-04')!.answers.some(a => a.canonical === 'South African Sign Language')).toBe(true);
  });
  it('keeps finite factual sets exact instead of padding them with wrong answers', () => {
    expect(questions.find(q => q.id === 'science-01')!.answers).toHaveLength(8);
    expect(questions.find(q => q.id === 'games-02')!.answers).toHaveLength(6);
    expect(questions.find(q => q.id === 'sa-01')!.answers).toHaveLength(9);
    expect(questions.find(q => q.id === 'sport-02')!.answers).toHaveLength(4);
    expect(questions.find(q => q.id === 'words-04')!.answers).toHaveLength(12);
  });
  it('selects shared entities through typed predicates', () => {
    const africa = promptDefinitions.find(prompt => prompt.id === 'geo-01')!;
    const startsWithB = promptDefinitions.find(prompt => prompt.id === 'geo-03')!;
    const elements = promptDefinitions.find(prompt => prompt.id === 'science-03')!;
    const synthetic = { id: 'test:country', name: 'Borealia', aliases: [], types: ['country'], props: { sovereign: true, continents: ['Africa'] }, sourceIds: ['test'] };
    expect(matchesPredicate(synthetic, africa.where)).toBe(true);
    expect(matchesPredicate(synthetic, startsWithB.where)).toBe(true);
    expect(matchesPredicate(synthetic, elements.where)).toBe(false);
  });
});
