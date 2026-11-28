import { inflateRawSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
async function download(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Saffilion data builder/2' } });
  if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
  return Buffer.from(await response.arrayBuffer());
}

function unzipFirst(buffer) {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= 0; index--) if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  if (eocd < 0) throw new Error('ZIP end record not found');
  const central = buffer.readUInt32LE(eocd + 16);
  if (buffer.readUInt32LE(central) !== 0x02014b50) throw new Error('ZIP central record not found');
  const method = buffer.readUInt16LE(central + 10);
  const compressedSize = buffer.readUInt32LE(central + 20);
  const local = buffer.readUInt32LE(central + 42);
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(start, start + compressedSize);
  if (method === 0) return compressed;
  if (method === 8) return inflateRawSync(compressed);
  throw new Error('Unsupported ZIP method ' + method);
}

const geonamesDir = resolve(root, 'data/sources/geonames');
const pubchemDir = resolve(root, 'data/sources/pubchem');
const wikidataDir = resolve(root, 'data/sources/wikidata');
await mkdir(resolve(geonamesDir, 'za'), { recursive: true });
await mkdir(pubchemDir, { recursive: true });
await mkdir(wikidataDir, { recursive: true });
const countryQuery = 'SELECT ?country ?countryLabel ?iso2 ?continent ?continentLabel ?capital ?capitalLabel WHERE { { ?country wdt:P463 wd:Q1065. } UNION { VALUES ?country { wd:Q237 wd:Q219060 } } ?country wdt:P297 ?iso2. OPTIONAL { ?country wdt:P30 ?continent. } OPTIONAL { ?country wdt:P36 ?capital. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }';
const wikidataRequest = fetch('https://query.wikidata.org/sparql', {
  method: 'POST',
  headers: { accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Saffilion/2 educational-game' },
  body: new URLSearchParams({ query: countryQuery }),
}).then(async response => {
  if (!response.ok) throw new Error('Wikidata: HTTP ' + response.status);
  return Buffer.from(await response.arrayBuffer());
});
const [zaZip, countryInfo, periodic, countries] = await Promise.all([
  download('https://download.geonames.org/export/dump/ZA.zip'),
  download('https://download.geonames.org/export/dump/countryInfo.txt'),
  download('https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON'),
  wikidataRequest,
]);
await writeFile(resolve(geonamesDir, 'ZA.zip'), zaZip);
await writeFile(resolve(geonamesDir, 'za/ZA.txt'), unzipFirst(zaZip));
await writeFile(resolve(geonamesDir, 'countryInfo.txt'), countryInfo);
await writeFile(resolve(pubchemDir, 'periodic-table.json'), periodic);
await writeFile(resolve(wikidataDir, 'countries.json'), countries);
await writeFile(resolve(root, 'data/sources/source-manifest.json'), JSON.stringify({
  retrievedAt: new Date().toISOString(),
  sources: ['GeoNames ZA.zip', 'GeoNames countryInfo.txt', 'PubChem PUG periodic table', 'Wikidata UN-member country query'],
}, null, 2) + '\n');
console.log('Downloaded and cached all Phase 2 source snapshots.');
