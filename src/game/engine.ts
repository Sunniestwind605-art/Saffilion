import { DEPTH_PER_POINT, TIERS, type Answer, type Expedition, type LifetimeStats, type Question, type SaveData } from './types';
import { DAILY_SCHEDULE_VERSION, knownEntityIds } from '../data/knowledge';
import { BIOMES, biomesThroughDepth } from './world';

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
  const index = answerIndex(question);
  return index.get(needle) ?? index.get(singular(needle));
}

const answerIndexes = new WeakMap<Question, Map<string, Answer>>();
function answerIndex(question: Question) {
  let index = answerIndexes.get(question);
  if (!index) {
    index = new Map();
    for (const answer of question.answers) for (const name of [answer.canonical, ...answer.aliases]) {
      const normalized = normalize(name);
      index.set(normalized, answer);
      index.set(singular(normalized), answer);
    }
    answerIndexes.set(question, index);
  }
  return index;
}

export function isKnownOutsideQuestion(question: Question, raw: string) {
  const known = knownEntityIds(raw);
  return known.size > 0 && !question.answers.some(answer => known.has(answer.entityId));
}

function singular(value: string) {
  const words = value.split(' '), last = words.at(-1) || '';
  if (last.length < 5 || /(ss|us|is)$/.test(last)) return value;
  if (last.endsWith('ies')) words[words.length - 1] = `${last.slice(0,-3)}y`;
  else if (/(ches|shes|xes|zes)$/.test(last)) words[words.length - 1] = last.slice(0,-2);
  else if (last.endsWith('s')) words[words.length - 1] = last.slice(0,-1);
  return words.join(' ');
}

export function equivalentAnswer(a: string, b: string) {
  return a === b || (a.length >= 4 && b.length >= 4 && singular(a) === singular(b));
}

export function depthForPoints(points: number) { return Math.max(0, points) * DEPTH_PER_POINT; }

// Movement is deliberately close to proportional: a Stardust answer must feel
// dramatically heavier than a Pebble answer, while still fitting on a phone.
export function travelPixelsForPoints(points: number) { return points > 0 ? 60 + points * 6 : 0; }

export function digDurationForPoints(points: number, reducedMotion = false) {
  return reducedMotion ? 250 : points > 0 ? Math.min(1800, 600 + points * 12) : 500;
}

export function suggestAnswer(question: Question, raw: string): Answer | undefined {
  const needle = normalize(raw);
  if (needle.length < 3) return undefined;
  const limit = needle.length <= 4 ? 1 : needle.length <= 8 ? 2 : 3;
  const candidates = question.answers.filter(answer => [answer.canonical, ...answer.aliases].some(value => {
    const name = normalize(value);
    return name[0] === needle[0] && Math.abs(name.length - needle.length) <= limit;
  }));
  const ranked = candidates.map(a => ({ a, d: Math.min(...[a.canonical, ...a.aliases].map(v => distance(needle, v))) })).sort((a, b) => a.d - b.d);
  const best = ranked[0];
  return best && best.d <= limit && (!ranked[1] || ranked[1].d > best.d) ? best.a : undefined;
}

export function validateQuestions(questions: Question[]) {
  const errors: string[] = [], ids = new Set<string>();
  const finiteMinimums: Record<string, number> = { 'sport-02': 4 };
  for (const q of questions) {
    if (ids.has(q.id)) errors.push(`Duplicate id: ${q.id}`); ids.add(q.id);
    if (!q.prompt.trim()) errors.push(`${q.id}: empty prompt`);
    const minimumAnswers = q.mode === 'specialist' ? 4 : (finiteMinimums[q.id] ?? 6);
    if (q.answers.length < minimumAnswers) errors.push(`${q.id}: only ${q.answers.length} answers`);
    const names = new Map<string, number>();
    for (const a of q.answers) {
      if (!(a.tier in TIERS) || a.points !== TIERS[a.tier]) errors.push(`${q.id}: invalid score for ${a.canonical}`);
      if (a.raritySource !== 'model' && a.raritySource !== 'override') errors.push(`${q.id}: missing rarity metadata for ${a.canonical}`);
      for (const name of [a.canonical, ...a.aliases].map(normalize)) {
        const prior = names.get(name); if (prior !== undefined) errors.push(`${q.id}: duplicate or conflicting answer ${name}`); names.set(name, a.points);
      }
    }
  }
  return errors;
}

export function freshSave(): SaveData {
  return { version: 2, selectedCat: 'pebble', expeditions: [], active: null, questionBag: [], recentQuestions: [], missingAnswers: [], dailyRecords: [], crystals: 0, unlocked: [], equipped: null, settings: { sound: true, haptics: true, reducedMotion: false, batterySaver: false }, lifetimeStats: emptyLifetimeStats() };
}

export function emptyLifetimeStats(): LifetimeStats { return { expeditions:0, highestScore:0, deepestExpedition:0, lifetimeDepth:0, correctAnswers:0, rareAnswers:0, discoveredBiomes:['roots'], achievements:[] }; }
export function summarizeExpeditions(expeditions: Expedition[]): LifetimeStats {
  const rounds=expeditions.flatMap(item=>item.rounds), deepest=Math.max(0,...expeditions.map(item=>item.depth));
  const discovered=new Set(['roots',...expeditions.flatMap(item=>item.discoveredBiomes??biomesThroughDepth(item.depth))]);
  const achievements:string[]=[];
  if(expeditions.length)achievements.push('first-expedition');
  if(deepest>=1000)achievements.push('deep-1000');
  if(rounds.some(round=>round.tier==='Stardust'))achievements.push('stardust-find');
  if(BIOMES.every(biome=>discovered.has(biome.id)))achievements.push('world-explorer');
  return { expeditions:expeditions.length, highestScore:Math.max(0,...expeditions.map(item=>item.score)), deepestExpedition:deepest, lifetimeDepth:expeditions.reduce((sum,item)=>sum+item.depth,0), correctAnswers:rounds.filter(round=>round.points>0).length, rareAnswers:rounds.filter(round=>round.points>=TIERS.Amethyst).length, discoveredBiomes:[...discovered], achievements };
}

export function loadSave(): SaveData {
  try {
    const value = JSON.parse(localStorage.getItem('saffilion-save-v1') || 'null'); const clean=freshSave();
    if(value?.version!==1&&value?.version!==2)return clean;
    const expeditions=Array.isArray(value.expeditions)?value.expeditions:[];
    return { ...clean, ...value, version:2, expeditions, settings:{...clean.settings,...value.settings}, lifetimeStats:value.version===2&&value.lifetimeStats?{...clean.lifetimeStats,...value.lifetimeStats}:summarizeExpeditions(expeditions) };
  } catch { return freshSave(); }
}
const HISTORY_DB='saffilion-history-v2',HISTORY_STORE='expeditions';
function openHistory(){return new Promise<IDBDatabase>((resolve,reject)=>{if(!globalThis.indexedDB){reject(Error('IndexedDB unavailable'));return;}const request=indexedDB.open(HISTORY_DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(HISTORY_STORE))request.result.createObjectStore(HISTORY_STORE,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function writeHistory(expeditions:Expedition[],replace=false){try{const db=await openHistory(),tx=db.transaction(HISTORY_STORE,'readwrite'),store=tx.objectStore(HISTORY_STORE);if(replace)store.clear();for(const expedition of expeditions)store.put(expedition);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();}catch{/* local cache remains available when IndexedDB is unavailable */}}
export async function hydrateExpeditions(){try{const db=await openHistory(),tx=db.transaction(HISTORY_STORE,'readonly'),request=tx.objectStore(HISTORY_STORE).getAll();const records=await new Promise<Expedition[]>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result as Expedition[]);request.onerror=()=>reject(request.error);});db.close();return records.sort((a,b)=>b.date.localeCompare(a.date));}catch{return [] as Expedition[];}}
export async function replaceHistory(expeditions:Expedition[]){await writeHistory(expeditions,true);}
export async function clearHistory(){try{const db=await openHistory(),tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).clear();await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();}catch{/* nothing to clear */}}
export function persist(save: SaveData) { const local={...save,expeditions:save.expeditions.slice(0,25)};localStorage.setItem('saffilion-save-v1',JSON.stringify(local));void writeHistory(save.expeditions); }

export function shuffled<T>(items: T[]) {
  const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy;
}

export function seedFrom(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export function mulberry32(seed: number) {
  return () => { let value = seed += 0x6D2B79F5; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}
function shuffledWith<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) { const swap = Math.floor(random() * (index + 1)); [copy[index], copy[swap]] = [copy[swap], copy[index]]; }
  return copy;
}

const answerSetCache = new WeakMap<Question, Set<string>>();
function questionAnswerSet(question: Question) {
  let set = answerSetCache.get(question);
  if (!set) { set = new Set(question.answers.map(answer => answer.entityId)); answerSetCache.set(question, set); }
  return set;
}
function questionOverlap(left: Question, right: Question) {
  const a = questionAnswerSet(left), b = questionAnswerSet(right), smaller = a.size < b.size ? a : b, larger = smaller === a ? b : a;
  let intersection = 0; for (const value of smaller) if (larger.has(value)) intersection++;
  return intersection / Math.max(1, smaller.size);
}

export function pickQuestions(all: Question[], save: SaveData, category = 'All', options: { seed?: number; includeSpecialist?: boolean } = {}) {
  const categoryPool = category === 'All' ? all : all.filter(question => question.category === category);
  const standardPool = categoryPool.filter(question => question.mode === 'standard');
  const pool = options.includeSpecialist || standardPool.length < 7 ? categoryPool : standardPool;
  const recent = new Set(save.recentQuestions.slice(-28));
  let available = pool.filter(question => !recent.has(question.id));
  if (available.length < 7) available = [...pool];
  const random = options.seed === undefined ? Math.random : mulberry32(options.seed);
  const shuffledPool = shuffledWith(available, random);
  const desired: Question['difficulty'][] = ['easy', 'easy', 'medium', 'medium', 'medium', 'challenging', 'challenging'];
  const chosen: Question[] = [], categoryUse = new Map<string, number>(), templateUse = new Map<string, number>();
  for (const difficulty of desired) {
    const candidates = shuffledPool.filter(question => !chosen.includes(question));
    if (!candidates.length) break;
    const ranked = candidates.map(question => {
      const difficultyPenalty = question.difficulty === difficulty ? 0 : 500;
      const categoryPenalty = (categoryUse.get(question.category) ?? 0) * (category === 'All' ? 70 : 0);
      const family = question.templateId ?? question.id.split('-')[0];
      const templatePenalty = (templateUse.get(family) ?? 0) * 45;
      const overlapPenalty = chosen.length ? Math.max(...chosen.map(prior => questionOverlap(question, prior))) * 220 : 0;
      return { question, score: difficultyPenalty + categoryPenalty + templatePenalty + overlapPenalty + random() };
    }).sort((a, b) => a.score - b.score);
    const picked = ranked[0].question, family = picked.templateId ?? picked.id.split('-')[0];
    chosen.push(picked); categoryUse.set(picked.category, (categoryUse.get(picked.category) ?? 0) + 1); templateUse.set(family, (templateUse.get(family) ?? 0) + 1);
  }
  const chosenIds = chosen.map(question => question.id);
  const bag = pool.map(question => question.id).filter(id => !chosenIds.includes(id) && !recent.has(id));
  return { chosen: chosenIds, bag, recent: [...save.recentQuestions, ...chosenIds].slice(-42) };
}

export function utcDateKey(date = new Date()) { return date.toISOString().slice(0, 10); }

export function dailyQuestionIds(all: Question[], date: string, scheduleVersion = DAILY_SCHEDULE_VERSION) {
  if (scheduleVersion !== DAILY_SCHEDULE_VERSION || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const seed = seedFrom(scheduleVersion + ':' + date);
  return pickQuestions([...all].sort((a, b) => a.id.localeCompare(b.id)), freshSave(), 'All', { seed }).chosen;
}

export function rankFor(score: number) {
  if (score >= 525) return 'Stardust Legend'; if (score >= 350) return 'Master Miner'; if (score >= 200) return 'Cave Adventurer';
  if (score >= 100) return 'Crystal Explorer'; if (score >= 35) return 'Little Digger'; return 'Curious Kitten';
}
