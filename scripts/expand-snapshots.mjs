import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchesPredicate, normalize } from './lib/data-utils.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const entities = await load('data/curated/entities.json');
const prompts = await load('data/curated/prompts.json');
const rarity = await load('data/overrides/rarity.json');
const byName = new Map();
for (const entity of entities) for (const type of entity.types) for (const name of [entity.name, ...entity.aliases]) byName.set(type + '|' + normalize(name), entity);

function add(record, promptId, tier) {
  const key = record.types[0] + '|' + normalize(record.name);
  const withoutArticle = normalize(record.name).replace(/^the /, '');
  let entity = byName.get(key) ?? byName.get(record.types[0] + '|' + withoutArticle);
  if (!entity) {
    entity = record;
    entities.push(entity);
    for (const type of entity.types) byName.set(type + '|' + normalize(entity.name), entity);
  } else {
    entity.aliases = [...new Set([...entity.aliases, ...record.aliases])];
    entity.types = [...new Set([...entity.types, ...record.types])];
    entity.sourceIds = [...new Set([...entity.sourceIds, ...record.sourceIds])];
    const currentPopulation = entity.familiaritySignals?.population ?? -1;
    const incomingPopulation = record.familiaritySignals?.population ?? -1;
    const keepIncomingPlace = !record.types.includes('populated-place') || incomingPopulation > currentPopulation;
    entity.props = {
      ...entity.props,
      ...(keepIncomingPlace ? record.props : {}),
      promptIds: [...new Set([...(entity.props.promptIds ?? []), ...(promptId ? [promptId] : [])])],
    };
    if (keepIncomingPlace) entity.familiaritySignals = { ...entity.familiaritySignals, ...record.familiaritySignals };
  }
  for (const type of entity.types) for (const name of [entity.name, ...entity.aliases]) byName.set(type + '|' + normalize(name), entity);
  if (promptId) {
    rarity[promptId] ??= {};
    rarity[promptId][entity.id] ??= { tier, source: 'provisional' };
  }
  return entity;
}

const countryInfo = new Map();
for (const line of (await readFile(resolve(root, 'data/sources/geonames/countryInfo.txt'), 'utf8')).split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const columns = line.split('\t');
  countryInfo.set(columns[0], { population: Number(columns[7]) || 0, currency: columns[10] });
}

const countrySnapshot = await load('data/sources/wikidata/countries.json');
const countries = new Map();
for (const binding of countrySnapshot.results.bindings) {
  const qid = binding.country.value.split('/').at(-1);
  const current = countries.get(qid) ?? { id: qid, name: binding.countryLabel.value, iso2: binding.iso2.value, continents: new Set(), capitals: new Map() };
  if (binding.continentLabel) current.continents.add(binding.continentLabel.value);
  if (binding.capital && binding.capitalLabel) current.capitals.set(binding.capital.value.split('/').at(-1), binding.capitalLabel.value);
  countries.set(qid, current);
}
for (const country of countries.values()) {
  const signals = countryInfo.get(country.iso2) ?? { population: 0, currency: '' };
  const countryTier = signals.population >= 50000000 ? 'Pebble' : signals.population >= 10000000 ? 'Copper' : signals.population >= 2000000 ? 'Quartz' : signals.population >= 500000 ? 'Sapphire' : signals.population >= 100000 ? 'Amethyst' : 'Stardust';
  add({
    id: 'wikidata:' + country.id,
    name: country.name,
    aliases: [],
    types: ['country'],
    props: { sovereign: true, iso2: country.iso2, continents: [...country.continents] },
    sourceIds: ['wikidata:' + country.id],
    familiaritySignals: { population: signals.population },
  }, null, countryTier);
  for (const [capitalId, capitalName] of country.capitals) add({
    id: 'wikidata:' + capitalId,
    name: capitalName,
    aliases: [],
    types: ['city', 'capital'],
    props: { capitalOf: country.name, continents: [...country.continents] },
    sourceIds: ['wikidata:' + capitalId],
    familiaritySignals: { countryPopulation: signals.population },
  }, null, countryTier);
}

const periodic = await load('data/sources/pubchem/periodic-table.json');
for (const row of periodic.Table.Row) {
  const [atomicNumber, symbol, name] = row.Cell;
  const number = Number(atomicNumber);
  const tier = number <= 20 ? 'Copper' : number <= 50 ? 'Quartz' : number <= 80 ? 'Sapphire' : number <= 100 ? 'Amethyst' : 'Stardust';
  add({
    id: 'pubchem:element:' + atomicNumber,
    name,
    aliases: [symbol],
    types: ['chemical-element'],
    props: { promptIds: ['science-03'], atomicNumber: number, symbol },
    sourceIds: ['pubchem:periodic-table'],
    familiaritySignals: { atomicNumber: number },
  }, 'science-03', tier);
}

const allowedPlaceCodes = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLC']);
const admin1Names = new Map();
for (const line of (await readFile(resolve(root, 'data/sources/geonames/admin1CodesASCII.txt'), 'utf8')).split(/\r?\n/)) {
  if (!line) continue;
  const [code, name] = line.split('\t');
  if (code.startsWith('ZA.')) admin1Names.set(code.slice(3), name);
}
const placeRows = (await readFile(resolve(root, 'data/sources/geonames/za/ZA.txt'), 'utf8')).split(/\r?\n/);
for (const line of placeRows) {
  if (!line) continue;
  const c = line.split('\t');
  if (c[6] !== 'P' || !allowedPlaceCodes.has(c[7])) continue;
  const population = Number(c[14]) || 0;
  const normalizedName = normalize(c[1]);
  const lettersOnly = normalizedName.replace(/[^a-z]/g, '');
  const tier = population >= 500000 ? 'Pebble' : population >= 100000 ? 'Copper' : population >= 25000 ? 'Quartz' : population >= 5000 ? 'Sapphire' : population >= 500 ? 'Amethyst' : 'Stardust';
  add({
    id: 'geonames:' + c[0],
    name: c[1],
    aliases: c[2] && normalize(c[2]) !== normalize(c[1]) ? [c[2]] : [],
    types: ['city', 'town', 'populated-place'],
    props: {
      promptIds: ['sa-02'], country: 'South Africa', province: admin1Names.get(c[10]) ?? c[10], featureCode: c[7],
      initial: lettersOnly[0] ?? '', ending: lettersOnly.at(-1) ?? '', letters: [...new Set(lettersOnly)],
      nameLength: lettersOnly.length, wordCount: normalizedName.split(' ').filter(Boolean).length,
    },
    sourceIds: ['geonames:' + c[0]],
    familiaritySignals: { population },
  }, 'sa-02', tier);
}

// Correct the handful of legacy calls whose optional difficulty argument was
// captured by the one-time positional-format migrator.
const invalidLegacyIds = new Set([
  'saffilion:planet:easy', 'saffilion:answer:games-02:easy',
  'saffilion:answer:sport-02:easy', 'saffilion:province:easy',
]);
for (let index = entities.length - 1; index >= 0; index--) if (invalidLegacyIds.has(entities[index].id)) entities.splice(index, 1);
const platypus = entities.find(entity => entity.id === 'saffilion:answer:nature-03:duck-billed-platypus-challenging');
if (platypus) platypus.name = 'Duck-billed platypus';
for (const prompt of prompts) {
  delete prompt.migratedMembershipIds;
  if (['geo-02', 'science-01', 'games-02', 'sport-02', 'sa-01'].includes(prompt.id)) prompt.difficulty = 'easy';
  if (prompt.id === 'nature-03') prompt.difficulty = 'hard';
  if (prompt.id === 'words-04') {
    prompt.text = 'Name an official language of South Africa.';
    prompt.mode = 'specialist';
    prompt.coverage = 'finite-set';
    prompt.target = null;
  }
  if (prompt.id === 'geo-01') prompt.where = { all: [{ op: 'type', value: 'country' }, { op: 'eq', property: 'sovereign', value: true }, { op: 'includes', property: 'continents', value: 'Africa' }] };
  if (prompt.id === 'geo-02') prompt.where = { all: [{ op: 'type', value: 'country' }, { op: 'eq', property: 'sovereign', value: true }, { op: 'includes', property: 'continents', value: 'South America' }] };
  if (prompt.id === 'geo-03') prompt.where = { all: [{ op: 'type', value: 'country' }, { op: 'eq', property: 'sovereign', value: true }, { op: 'startsWith', property: 'name', value: 'B' }] };
  if (prompt.id === 'geo-04') prompt.where = { all: [{ op: 'type', value: 'capital' }, { op: 'includes', property: 'continents', value: 'Europe' }] };
}

const officialLanguages = new Set(['english','isizulu','isixhosa','afrikaans','sepedi','setswana','sesotho','tshivenda','siswati','isindebele','xitsonga','south african sign language']);
for (const entity of entities.filter(item => item.types.includes('language'))) {
  const accepted = officialLanguages.has(normalize(entity.name));
  if (accepted) entity.props.officialIn = ['South Africa'];
  else entity.props.promptIds = (entity.props.promptIds ?? []).filter(id => id !== 'words-04');
  if (normalize(entity.name) === 'xitsonga') {
    entity.name = 'Xitsonga';
    entity.aliases = [...new Set(entity.aliases)].filter(alias => normalize(alias) !== normalize(entity.name));
    entity.props.officialIn = ['South Africa'];
  }
}

// Makhanda and its historical name Grahamstown are one place, not two answers.
const makhanda = entities.find(entity => entity.id === 'saffilion:city:makhanda');
const grahamstownIndex = entities.findIndex(entity => entity.id === 'geonames:1000501');
if (makhanda && grahamstownIndex >= 0) {
  const grahamstown = entities[grahamstownIndex];
  makhanda.types = [...new Set([...makhanda.types, ...grahamstown.types])];
  makhanda.sourceIds = [...new Set([...makhanda.sourceIds, ...grahamstown.sourceIds])];
  makhanda.props = { ...makhanda.props, ...grahamstown.props };
  makhanda.familiaritySignals = { ...makhanda.familiaritySignals, ...grahamstown.familiaritySignals };
  entities.splice(grahamstownIndex, 1);
  delete rarity['sa-02']?.['geonames:1000501'];
}

for (const prompt of prompts) {
  rarity[prompt.id] ??= {};
  for (const entity of entities) {
    if (!matchesPredicate(entity, prompt.where) || rarity[prompt.id][entity.id]) continue;
    const population = entity.familiaritySignals?.population ?? entity.familiaritySignals?.countryPopulation ?? 0;
    const tier = population >= 50000000 ? 'Pebble' : population >= 10000000 ? 'Copper' : population >= 2000000 ? 'Quartz' : population >= 500000 ? 'Sapphire' : population >= 100000 ? 'Amethyst' : 'Stardust';
    rarity[prompt.id][entity.id] = { tier, source: 'provisional' };
  }
}

const compact = value => JSON.stringify(value);
await mkdir(resolve(root, 'public/data/v2'), { recursive: true });
await mkdir(resolve(root, 'data/snapshots'), { recursive: true });
await writeFile(resolve(root, 'data/curated/entities.json'), JSON.stringify(entities, null, 2) + '\n');
await writeFile(resolve(root, 'data/curated/prompts.json'), JSON.stringify(prompts, null, 2) + '\n');
await writeFile(resolve(root, 'data/overrides/rarity.json'), JSON.stringify(rarity, null, 2) + '\n');
const science = entities.filter(entity => entity.types.includes('chemical-element'));
const southAfrica = entities.filter(entity => entity.props.country === 'South Africa' || entity.props.promptIds?.includes('sa-02'));
await writeFile(resolve(root, 'public/data/v2/science.json'), compact(science));
const southAfricaShards = [];
for (let index = 0; index < southAfrica.length; index += 750) {
  const part = southAfrica.slice(index, index + 750);
  const id = 'south-africa-' + String(index / 750 + 1).padStart(2, '0');
  await writeFile(resolve(root, 'public/data/v2/' + id + '.json'), compact(part));
  southAfricaShards.push({ id, url: 'data/v2/' + id + '.json', entities: part.length });
}
const manifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  sourceVersions: {
    geonames: { version: 'daily dump snapshot', retrieved: '2026-11-27', licence: 'CC BY 4.0' },
    pubchem: { version: 'PUG periodic-table snapshot', retrieved: '2026-11-27', licence: 'US public domain' },
    wikidata: { version: 'UN-member SPARQL snapshot', retrieved: '2026-11-27', licence: 'CC0 1.0' },
  },
  shards: [
    { id: 'science', url: 'data/v2/science.json', entities: science.length },
    ...southAfricaShards,
  ],
};
await writeFile(resolve(root, 'public/data/v2/manifest.json'), compact(manifest));
await writeFile(resolve(root, 'data/snapshots/phase2-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Expanded to ' + entities.length + ' entities; SA shard ' + southAfrica.length + '; science shard ' + science.length + '.');
