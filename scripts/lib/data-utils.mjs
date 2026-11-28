export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function matchesPredicate(entity, predicate) {
  if ('all' in predicate) return predicate.all.every(item => matchesPredicate(entity, item));
  if ('any' in predicate) return predicate.any.some(item => matchesPredicate(entity, item));
  if ('not' in predicate) return !matchesPredicate(entity, predicate.not);
  const value = predicate.property === 'types' ? entity.types : predicate.property === 'name' ? entity.name : entity.props[predicate.property];
  switch (predicate.op) {
    case 'eq': return value === predicate.value;
    case 'in': return predicate.values.includes(value);
    case 'includes': return Array.isArray(value) && value.includes(predicate.value);
    case 'type': return entity.types.includes(predicate.value);
    case 'exists': return value !== undefined && value !== null;
    case 'gt': return typeof value === 'number' && value > predicate.value;
    case 'gte': return typeof value === 'number' && value >= predicate.value;
    case 'lt': return typeof value === 'number' && value < predicate.value;
    case 'lte': return typeof value === 'number' && value <= predicate.value;
    case 'before': return typeof value === 'string' && Date.parse(value) < Date.parse(predicate.value);
    case 'after': return typeof value === 'string' && Date.parse(value) > Date.parse(predicate.value);
    case 'startsWith': return typeof value === 'string' && normalize(value).startsWith(normalize(predicate.value));
    default: return false;
  }
}

export const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))] ?? 0;
