export const TIER_ORDER = ['Pebble', 'Copper', 'Quartz', 'Sapphire', 'Amethyst', 'Stardust'];
export const TIER_CODES = Object.fromEntries(TIER_ORDER.map((tier, index) => [tier, String(index)]));
export const CODE_TIERS = Object.fromEntries(TIER_ORDER.map((tier, index) => [String(index), tier]));
export const LEGACY_TIER_FAMILIARITY = { Pebble: 1, Copper: 0.82, Quartz: 0.64, Sapphire: 0.44, Amethyst: 0.24, Stardust: 0.08 };

export function entityGroup(entity) {
  if (entity.types.includes('country')) return 'country';
  if (entity.types.includes('capital')) return 'capital';
  if (entity.types.includes('populated-place')) return 'populated-place';
  if (entity.types.includes('chemical-element')) return 'chemical-element';
  if (entity.types.includes('language')) return 'language';
  const prompts = entity.props?.promptIds ?? [];
  if (prompts.some(id => id.startsWith('words-'))) return 'ordinary-word';
  if (prompts.some(id => /^(music|screen|games|sport|history)-/.test(id))) return 'culture';
  if (prompts.some(id => id.startsWith('science-'))) return 'science';
  if (prompts.some(id => id.startsWith('nature-'))) return 'nature';
  if (prompts.some(id => id.startsWith('food-'))) return 'food';
  if (prompts.some(id => id.startsWith('everyday-'))) return 'everyday';
  return 'other';
}

export function tiedPercentiles(entries) {
  const sorted = [...entries].sort((left, right) => left.value - right.value || left.id.localeCompare(right.id));
  const result = new Map();
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const averageRank = (start + end - 1) / 2;
    const percentile = sorted.length <= 1 ? 0.5 : averageRank / (sorted.length - 1);
    for (let index = start; index < end; index++) result.set(sorted[index].id, percentile);
    start = end;
  }
  return result;
}

export function transformSignal(value, transform) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const number = Number(value);
  return transform === 'log1p' ? Math.log1p(Math.max(0, number)) : number;
}

export function capTier(tier, rarestAllowed) {
  return TIER_ORDER[Math.min(TIER_ORDER.indexOf(tier), TIER_ORDER.indexOf(rarestAllowed))];
}

export function classifyTier({ familiarity, relative, confidence, count, coverage }, config) {
  let tier;
  if (count <= 60 || coverage === 'finite-set') {
    const contextual = familiarity * 0.65 + relative * 0.35;
    tier = contextual >= 0.86 ? 'Pebble' : contextual >= 0.62 ? 'Copper' : contextual >= 0.46 ? 'Quartz' : contextual >= 0.3 ? 'Sapphire' : contextual >= 0.14 ? 'Amethyst' : 'Stardust';
  } else {
    const distribution = config.broadDistribution;
    tier = relative >= distribution.pebbleFrom ? 'Pebble' : relative >= distribution.copperFrom ? 'Copper' : relative >= distribution.quartzFrom ? 'Quartz' : relative >= distribution.sapphireFrom ? 'Sapphire' : relative >= distribution.amethystFrom ? 'Amethyst' : 'Stardust';
  }
  if (familiarity >= 0.82) tier = capTier(tier, 'Copper');
  else if (familiarity >= 0.7) tier = capTier(tier, 'Quartz');
  else if (familiarity >= 0.58) tier = capTier(tier, 'Sapphire');
  else if (familiarity > config.stardust.maximumAbsoluteFamiliarity) tier = capTier(tier, 'Amethyst');
  if (confidence < config.stardust.minimumConfidence) tier = capTier(tier, 'Amethyst');
  if (tier === 'Stardust' && relative > config.stardust.maximumRelativeShare) tier = 'Amethyst';
  return tier;
}
