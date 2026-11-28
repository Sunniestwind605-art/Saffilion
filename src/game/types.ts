export const TIERS = {
  // A deliberately steep curve: the rarest answer is worth twenty common ones.
  // Stardust stays at 100 so a perfect seven-round expedition remains 700 points.
  Pebble: 5, Copper: 12, Quartz: 25, Sapphire: 45, Amethyst: 70, Stardust: 100,
} as const;
export type Tier = keyof typeof TIERS;
export type CatId = 'pebble' | 'mochi' | 'midnight' | 'nova' | 'marmalade';
export type Difficulty = 'easy' | 'medium' | 'challenging';
export type RaritySource = 'curated' | 'provisional';
export interface Answer { entityId: string; canonical: string; aliases: string[]; tier: Tier; points: number; raritySource: RaritySource }
export interface Question { id: string; category: string; difficulty: Difficulty; prompt: string; mode: 'standard' | 'specialist'; coverage: 'broad' | 'finite-set' | 'curated'; answers: Answer[]; templateId?: string; difficultyReason?: string; sourceIds: string[]; generationVersion?: string }
export interface RoundResult { questionId: string; prompt: string; answer: string; canonical?: string; points: number; tier?: Tier; timedOut: boolean }
export type GameMode = 'unlimited' | 'daily' | 'practice';
export interface Expedition { id: string; date: string; cat: CatId; score: number; depth: number; rounds: RoundResult[]; mode?: GameMode; dailyDate?: string; scheduleVersion?: string; questionIds?: string[] }
export interface ActiveGame { questionIds: string[]; round: number; results: RoundResult[]; deadline: number; category: string; mode?: GameMode; dailyDate?: string; scheduleVersion?: string }
export interface Settings { sound: boolean; haptics: boolean; reducedMotion: boolean; batterySaver: boolean }
export interface MissingAnswerReport { id?: string; questionId: string; answer: string; prompt?: string; datasetVersion?: string; date?: string; explanation?: string }
export interface DailyRecord { date: string; scheduleVersion: string; expeditionId: string; score: number; depth: number; cat: CatId; questionIds: string[]; rounds: RoundResult[]; completedAt: string }
export interface SaveData {
  version: 1; selectedCat: CatId; expeditions: Expedition[]; active: ActiveGame | null;
  questionBag: string[]; recentQuestions: string[]; missingAnswers: MissingAnswerReport[]; dailyRecords: DailyRecord[];
  crystals: number; unlocked: string[]; equipped: string | null; settings: Settings;
}
