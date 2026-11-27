export const TIERS = {
  // A deliberately steep curve: the rarest answer is worth twenty common ones.
  // Stardust stays at 100 so a perfect seven-round expedition remains 700 points.
  Pebble: 5, Copper: 12, Quartz: 25, Sapphire: 45, Amethyst: 70, Stardust: 100,
} as const;
export type Tier = keyof typeof TIERS;
export type CatId = 'pebble' | 'mochi' | 'midnight' | 'nova' | 'marmalade';
export type Difficulty = 'easy' | 'medium' | 'challenging';
export interface Answer { canonical: string; aliases: string[]; tier: Tier; points: number }
export interface Question { id: string; category: string; difficulty: Difficulty; prompt: string; answers: Answer[] }
export interface RoundResult { questionId: string; prompt: string; answer: string; canonical?: string; points: number; tier?: Tier; timedOut: boolean }
export interface Expedition { id: string; date: string; cat: CatId; score: number; depth: number; rounds: RoundResult[] }
export interface ActiveGame { questionIds: string[]; round: number; results: RoundResult[]; deadline: number; category: string }
export interface Settings { sound: boolean; haptics: boolean; reducedMotion: boolean; batterySaver: boolean }
export interface SaveData {
  version: 1; selectedCat: CatId; expeditions: Expedition[]; active: ActiveGame | null;
  questionBag: string[]; recentQuestions: string[]; missingAnswers: { questionId: string; answer: string }[];
  crystals: number; unlocked: string[]; equipped: string | null; settings: Settings;
}
