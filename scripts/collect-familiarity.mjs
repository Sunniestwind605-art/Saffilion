import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { entityGroup, LEGACY_TIER_FAMILIARITY } from './lib/rarity-utils.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const entities = await load('data/curated/entities.json');
const legacyRarity = await load('data/overrides/rarity.json');
const refresh = process.argv.includes('--refresh');
const cachePath = resolve(root, 'data/sources/wikimedia/entity-metrics.json');
const evidencePath = resolve(root, 'data/familiarity/evidence.json');
const agent = 'SaffilionRarityResearch/4.0 (https://github.com/Sunniestwind605-art/Saffilion)';
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
async function fetchJson(url, attempts = 3) {
  let failure;
  for (let attempt = 0; attempt < attempts; attempt++) try {
    const response = await fetch(url, { headers: { 'User-Agent': agent, Accept: 'application/json' } });
    if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
    return await response.json();
  } catch (error) { failure = error; await sleep(350 * (attempt + 1)); }
  throw failure;
}

async function refreshWikimedia() {
  const qidEntities = entities.flatMap(entity => {
    const qid = entity.sourceIds.find(source => /^wikidata:Q\d+$/.test(source))?.slice('wikidata:'.length);
    return qid ? [{ entityId: entity.id, qid }] : [];
  });
  const byQid = new Map(qidEntities.map(item => [item.qid, item.entityId]));
  const records = {};
  for (const batch of chunks([...byQid.keys()], 50)) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    Object.entries({ action: 'wbgetentities', ids: batch.join('|'), props: 'sitelinks', format: 'json', formatversion: '2' }).forEach(([key, value]) => url.searchParams.set(key, value));
    const data = await fetchJson(url);
    for (const item of Array.isArray(data.entities) ? data.entities : Object.values(data.entities ?? {})) {
      const entityId = byQid.get(item.id); if (!entityId) continue;
      const sitelinks = item.sitelinks ?? {};
      const wikipediaSites = Object.keys(sitelinks).filter(site => site.endsWith('wiki') && !['commonswiki', 'specieswiki'].includes(site));
      records[entityId] = { qid: item.id, sitelinks: wikipediaSites.length, titles: Object.fromEntries(['enwiki','afwiki','zuwiki','xhwiki'].flatMap(site => sitelinks[site]?.title ? [[site, sitelinks[site].title]] : [])), pageviewsByWiki: {}, pageviews: 0 };
    }
    await sleep(80);
  }
  const dateKeys = new Set();
  for (const [site, host] of Object.entries({ enwiki: 'en.wikipedia.org', afwiki: 'af.wikipedia.org', zuwiki: 'zu.wikipedia.org', xhwiki: 'xh.wikipedia.org' })) {
    const titled = Object.entries(records).flatMap(([entityId, record]) => record.titles[site] ? [{ entityId, title: record.titles[site] }] : []);
    for (const batch of chunks(titled, 40)) {
      const url = new URL('https://' + host + '/w/api.php');
      Object.entries({ action: 'query', prop: 'pageviews', titles: batch.map(item => item.title).join('|'), redirects: '1', format: 'json', formatversion: '2' }).forEach(([key, value]) => url.searchParams.set(key, value));
      const data = await fetchJson(url);
      const aliases = new Map(batch.map(item => [item.title.replaceAll('_',' ').toLocaleLowerCase(), item.entityId]));
      for (const item of data.query?.normalized ?? []) { const entityId = aliases.get(item.from.toLocaleLowerCase()); if (entityId) aliases.set(item.to.toLocaleLowerCase(), entityId); }
      for (const item of data.query?.redirects ?? []) { const entityId = aliases.get(item.from.toLocaleLowerCase()); if (entityId) aliases.set(item.to.toLocaleLowerCase(), entityId); }
      for (const page of data.query?.pages ?? []) {
        const entityId = aliases.get(page.title.toLocaleLowerCase()); if (!entityId) continue;
        const views = Object.entries(page.pageviews ?? {}).reduce((sum, [date, value]) => { dateKeys.add(date); return sum + (Number(value) || 0); }, 0);
        records[entityId].pageviewsByWiki[site] = views;
        records[entityId].pageviews += views;
      }
      await sleep(100);
    }
  }
  const dates = [...dateKeys].sort();
  return { version: 'wikimedia-familiarity-v1', retrievedAt: new Date().toISOString(), observationPeriod: { start: dates[0] ?? null, end: dates.at(-1) ?? null, description: 'Daily article pageviews returned by MediaWiki PageViewInfo at collection time.' }, languages: ['en','af','zu','xh'], records };
}

let wikimedia;
if (refresh) {
  wikimedia = await refreshWikimedia();
  await mkdir(resolve(root, 'data/sources/wikimedia'), { recursive: true });
  await writeFile(cachePath, JSON.stringify(wikimedia, null, 2) + '\n');
} else {
  try { wikimedia = JSON.parse(await readFile(cachePath, 'utf8')); } catch { wikimedia = { version: 'wikimedia-familiarity-v1', retrievedAt: null, observationPeriod: null, languages: [], records: {} }; }
}

const editorial = new Map();
for (const [questionId, assignments] of Object.entries(legacyRarity)) {
  if (questionId === 'sa-02') continue;
  for (const [entityId, assignment] of Object.entries(assignments)) {
    if (!(assignment.tier in LEGACY_TIER_FAMILIARITY)) continue;
    const record = editorial.get(entityId) ?? { total: 0, count: 0 };
    record.total += LEGACY_TIER_FAMILIARITY[assignment.tier]; record.count++;
    editorial.set(entityId, record);
  }
}
const records = {};
for (const entity of entities) {
  const metrics = {};
  const localSignals = entity.familiaritySignals ?? {};
  if (Number.isFinite(localSignals.population) && localSignals.population > 0) metrics.population = localSignals.population;
  if (Number.isFinite(localSignals.countryPopulation) && localSignals.countryPopulation > 0) metrics.countryPopulation = localSignals.countryPopulation;
  const external = wikimedia.records?.[entity.id];
  if (external?.pageviews > 0) metrics.pageviews = external.pageviews;
  if (Number.isFinite(external?.sitelinks)) metrics.sitelinks = external.sitelinks;
  const prior = editorial.get(entity.id);
  if (prior) metrics.editorialPrior = Number((prior.total / prior.count).toFixed(6));
  metrics.referenceBreadth = new Set([...(entity.sourceIds ?? []), ...(entity.props?.promptIds ?? [])]).size;
  const regional = entity.props?.country === 'South Africa' || entity.props?.continents?.includes('Africa') || entity.props?.promptIds?.some(id => id.startsWith('sa-'));
  metrics.regionalRelevance = regional ? 1 : 0;
  records[entity.id] = { group: entityGroup(entity), metrics };
}
const evidence = {
  version: 'familiarity-evidence-v1',
  snapshotDate: '2026-11-28',
  sources: {
    geonamesPopulation: { source: 'GeoNames population fields', license: 'CC BY 4.0', snapshot: '2026-11-27', availability: 'Countries and South African populated places' },
    wikidataSitelinks: { source: 'Wikidata sitelinks keyed by QID', license: 'CC0', snapshot: wikimedia.retrievedAt, availability: 'Entities with stable Wikidata IDs' },
    wikimediaPageviews: { source: 'MediaWiki PageViewInfo', license: 'Aggregated usage metric; article content not copied', observationPeriod: wikimedia.observationPeriod, languages: wikimedia.languages, availability: 'Wikipedia articles resolved through Wikidata sitelinks' },
    editorialPrior: { source: 'Saffilion launch-bank manual familiarity ordering', license: 'Original project data', snapshot: 'pre-v4', availability: 'Curated launch entities; sa-02 defaults intentionally excluded' },
    referenceBreadth: { source: 'Count of independent source IDs and verified launch memberships', license: 'Derived', snapshot: '2026-11-28', availability: 'All entities' },
    regionalRelevance: { source: 'Declared African/South African entity properties and prompt context', license: 'Derived', snapshot: '2026-11-28', availability: 'All entities' }
  },
  records
};
await mkdir(resolve(root, 'data/familiarity'), { recursive: true });
await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ entities: entities.length, wikimediaEntities: Object.keys(wikimedia.records ?? {}).length, pageviewEntities: Object.values(wikimedia.records ?? {}).filter(record => record.pageviews > 0).length, editorialEntities: editorial.size, refresh }, null, 2));
