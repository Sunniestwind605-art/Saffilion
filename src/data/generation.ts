export interface QuestionTemplateDefinition {
  id: string;
  category: string;
  text: string;
  minimumAnswers: number;
  conditions: number;
}

export function validateTemplate(template: Partial<QuestionTemplateDefinition>) {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(template.id ?? '')) errors.push('Template ID must be a stable lowercase slug.');
  if (!(template.category ?? '').trim()) errors.push('Template category is required.');
  if (!(template.text ?? '').trim()) errors.push('Template question text is required.');
  if (!Number.isInteger(template.minimumAnswers) || (template.minimumAnswers ?? 0) < 4) errors.push('Template minimumAnswers must be an integer of at least 4.');
  if (!Number.isInteger(template.conditions) || (template.conditions ?? 0) < 1) errors.push('Template conditions must be a positive integer.');
  return errors;
}

const slug = (value: string | number) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function stableGeneratedId(templateId: string, parameters: Record<string, string | number>) {
  const key = Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)).map(([name, value]) => `${name}-${slug(value)}`).join('--');
  return `gen:v1:${templateId}:${key}`;
}

export function jaccardSimilarity(leftValues: Iterable<string>, rightValues: Iterable<string>) {
  const left = new Set(leftValues), right = new Set(rightValues);
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection++;
  return intersection / (left.size + right.size - intersection || 1);
}

export function smallerSetOverlap(leftValues: Iterable<string>, rightValues: Iterable<string>) {
  const left = new Set(leftValues), right = new Set(rightValues);
  const smaller = left.size <= right.size ? left : right, larger = smaller === left ? right : left;
  let intersection = 0;
  for (const value of smaller) if (larger.has(value)) intersection++;
  return intersection / (smaller.size || 1);
}
