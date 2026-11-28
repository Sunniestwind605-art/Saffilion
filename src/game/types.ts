import scoring from '../../data/rarity/scoring.json';

export type Tier = 'Pebble' | 'Copper' | 'Quartz' | 'Sapphire' | 'Amethyst' | 'Stardust';
export const TIERS = scoring.points as Record<Tier, number>;
export const SCORING_VERSION = scoring.version;
export const DEPTH_PER_POINT = scoring.depthPerPoint;
export type CatId = 'pebble' | 'mochi' | 'midnight' | 'nova' | 'marmalade';
export type Difficulty = 'easy' | 'medium' | 'challenging';
export type RaritySource = 'model' | 'override';
export interface Answer { entityId: string; canonical: string; aliases: string[]; tier: Tier; points: number; raritySource: RaritySource }
export interface Question { id: string; category: string; difficulty: Difficulty; prompt: string; mode: 'standard' | 'specialist'; coverage: 'broad' | 'finite-set' | 'curated'; answers: Answer[]; templateId?: string; difficultyReason?: string; sourceIds: string[]; generationVersion?: string }
export interface RoundResult { questionId: string; prompt: string; answer: string; canonical?: string; entityId?: string; points: number; tier?: Tier; timedOut: boolean; datasetVersion?: string; scoringVersion?: string; questionVersion?: string }
export type GameMode = 'unlimited' | 'daily' | 'practice';
export interface Expedition { id: string; date: string; cat: CatId; score: number; depth: number; rounds: RoundResult[]; mode?: GameMode; dailyDate?: string; scheduleVersion?: string; questionIds?: string[]; datasetVersion?: string; scoringVersion?: string; questionVersion?: string; seed?: string; discoveredBiomes?: string[] }
export interface ActiveGame { questionIds: string[]; round: number; results: RoundResult[]; deadline: number; category: string; mode?: GameMode; dailyDate?: string; scheduleVersion?: string; seed?: string; pendingResult?: RoundResult }
export interface Settings { sound: boolean; haptics: boolean; reducedMotion: boolean; batterySaver: boolean }
export interface MissingAnswerReport { id?: string; questionId: string; answer: string; prompt?: string; datasetVersion?: string; date?: string; explanation?: string }
export interface DailyRecord { date: string; scheduleVersion: string; expeditionId: string; score: number; depth: number; cat: CatId; questionIds: string[]; rounds: RoundResult[]; completedAt: string; datasetVersion?: string; scoringVersion?: string; questionVersion?: string }
export interface LifetimeStats { expeditions: number; highestScore: number; deepestExpedition: number; lifetimeDepth: number; correctAnswers: number; rareAnswers: number; discoveredBiomes: string[]; achievements: string[] }
export interface SaveData {
  version: 2; selectedCat: CatId; expeditions: Expedition[]; active: ActiveGame | null;
  questionBag: string[]; recentQuestions: string[]; missingAnswers: MissingAnswerReport[]; dailyRecords: DailyRecord[];
  crystals: number; unlocked: string[]; equipped: string | null; settings: Settings; lifetimeStats: LifetimeStats;
}
