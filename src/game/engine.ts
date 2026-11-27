import { TIERS, type Answer, type Question, type SaveData } from './types';

export function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function distance(a: string, b: string) {
  const x = normalize(a), y = normalize(b);
  const m = Array.from({ length: x.length + 1 }, (_, i) => Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i++) m[i][0] = i;
  for (let j = 0; j <= y.length; j++) m[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) {
    const cost = x[i - 1] === y[j - 1] ? 0 : 1;
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
  }
  return m[x.length][y.length];
}

export function findAnswer(question: Question, raw: string): Answer | undefined {
  const needle = normalize(raw);
  return question.answers.find(a => [a.canonical, ...a.aliases].some(v => normalize(v) === needle));
}

export function depthForPoints(points: number) { return Math.max(0, points) * 10; }

// Movement is deliberately close to proportional: a Stardust answer must feel
// dramatically heavier than a Pebble answer, while still fitting on a phone.
export function travelPixelsForPoints(points: number) { return points > 0 ? 60 + points * 6 : 0; }

export function digDurationForPoints(points: number, reducedMotion = false) {
  return reducedMotion ? 250 : points > 0 ? Math.min(1800, 600 + points * 12) : 500;
}

export function suggestAnswer(question: Question, raw: string): Answer | undefined {
  const needle = normalize(raw);
  if (needle.length < 3) return undefined;
  const ranked = question.answers.map(a => ({ a, d: Math.min(...[a.canonical, ...a.aliases].map(v => distance(needle, v))) })).sort((a, b) => a.d - b.d);
  const best = ranked[0];
  const limit = needle.length <= 4 ? 1 : needle.length <= 8 ? 2 : 3;
  return best && best.d <= limit && (!ranked[1] || ranked[1].d > best.d) ? best.a : undefined;
}

export function validateQuestions(questions: Question[]) {
  const errors: string[] = [], ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) errors.push(`Duplicate id: ${q.id}`); ids.add(q.id);
    if (!q.prompt.trim()) errors.push(`${q.id}: empty prompt`);
    if (q.answers.length < 6) errors.push(`${q.id}: only ${q.answers.length} answers`);
    const names = new Map<string, number>();
    for (const a of q.answers) {
      if (!(a.tier in TIERS) || a.points !== TIERS[a.tier]) errors.push(`${q.id}: invalid score for ${a.canonical}`);
      for (const name of [a.canonical, ...a.aliases].map(normalize)) {
        const prior = names.get(name); if (prior !== undefined && prior !== a.points) errors.push(`${q.id}: conflicting alias ${name}`); names.set(name, a.points);
      }
    }
  }
  return errors;
}

export function freshSave(): SaveData {
  return { version: 1, selectedCat: 'pebble', expeditions: [], active: null, questionBag: [], recentQuestions: [], missingAnswers: [], crystals: 0, unlocked: [], settings: { sound: true, reducedMotion: false, batterySaver: false } };
}

export function loadSave(): SaveData {
  try { const value = JSON.parse(localStorage.getItem('saffilion-save-v1') || 'null'); return value?.version === 1 ? { ...freshSave(), ...value } : freshSave(); } catch { return freshSave(); }
}
export function persist(save: SaveData) { localStorage.setItem('saffilion-save-v1', JSON.stringify(save)); }

export function shuffled<T>(items: T[]) {
  const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy;
}

export function pickQuestions(all: Question[], save: SaveData, category = 'All') {
  const pool = category === 'All' ? all : all.filter(q => q.category === category);
  let bag = save.questionBag.filter(id => pool.some(q => q.id === id) && !save.recentQuestions.includes(id));
  if (bag.length < 7) bag = shuffled(pool.map(q => q.id).filter(id => !save.recentQuestions.slice(-14).includes(id)));
  if (bag.length < 7) bag = shuffled(pool.map(q => q.id));
  const chosen = bag.slice(0, 7);
  return { chosen, bag: bag.slice(7), recent: [...save.recentQuestions, ...chosen].slice(-21) };
}

export function rankFor(score: number) {
  if (score >= 600) return 'Stardust Legend'; if (score >= 475) return 'Master Miner'; if (score >= 350) return 'Cave Adventurer';
  if (score >= 225) return 'Crystal Explorer'; if (score >= 100) return 'Little Digger'; return 'Curious Kitten';
}
