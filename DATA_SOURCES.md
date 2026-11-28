# Saffilion knowledge-source registry

Saffilion builds and validates its answer bank from local snapshots. `npm run build` never calls a data API. Rarity is prompt-specific: launch answers retain their curated bands and imported answers receive deterministic provisional bands for later Phase 4 review.

## GeoNames gazetteer

- Source: [GeoNames data export](https://www.geonames.org/export/) (`ZA.zip`, `countryInfo.txt`, and `admin1CodesASCII.txt`).
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: GeoNames.
- Snapshot: daily dump retrieved 27 November 2026; refresh with `npm run data:fetch`.
- Supports: South African cities, towns and populated places; country population signals.
- Imported fields: GeoNames ID, name, ASCII name, feature class/code, country code, first-level administrative division and population.
- Transform: retain South African `PPL`, `PPLA`, `PPLA2`, `PPLA3` and `PPLC` records; normalize names; merge matching launch entities; use the stable GeoNames ID; merge Makhanda/Grahamstown as one entity.
- Limitations: `PPL` means a populated place and does not guarantee municipal legal status. Duplicate place names are intentionally represented once in this prompt because the player cannot disambiguate two identical typed answers.

## Wikidata country snapshot

- Source: [Wikidata Query Service](https://query.wikidata.org/) using UN membership (`P463 = Q1065`) plus the Holy See and State of Palestine, with ISO alpha-2, continent and capital claims.
- Licence: [CC0 1.0](https://www.wikidata.org/wiki/Wikidata:Licensing). Attribution is not legally required; this project identifies Wikidata as the source.
- Snapshot: query retrieved 27 November 2026; exact query is in `scripts/fetch-data.mjs`.
- Supports: African countries, South American countries, countries beginning with B and European capitals.
- Imported fields: QID, English label, ISO alpha-2 code, continent QID/label and capital QID/label.
- Transform: group repeated continent/capital bindings by country QID; merge aliases from the launch bank; retain QIDs as source identifiers; compile memberships with typed predicates.
- Limitations: transcontinental states and countries with multiple official capitals can produce more than one defensible European-capital answer. The validation report therefore records the chosen snapshot count and does not present it as a universal political definition.

## PubChem periodic table

- Source: [PubChem PUG periodic-table endpoint](https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON), operated by the US National Library of Medicine.
- Licence: US government factual data is public domain; see [PubChem download policy](https://pubchem.ncbi.nlm.nih.gov/docs/downloads).
- Snapshot: retrieved 27 November 2026.
- Supports: all 118 named chemical elements.
- Imported fields: atomic number, symbol and element name.
- Transform: stable `pubchem:element:<atomic-number>` IDs; symbols become aliases; atomic number is retained as a future familiarity signal.
- Limitations: symbols are accepted only in the element prompt, so `C` cannot leak into unrelated prompts.

## Authoritative finite-set references

- [UN Statistics M49](https://unstats.un.org/unsd/methodology/m49/) supplies geographic-region definitions and current country/area naming context.
- [NASA planets](https://science.nasa.gov/solar-system/planets/) verifies the eight-planet set.
- [IUPAC periodic table](https://iupac.org/what-we-do/periodic-table-of-elements/) cross-checks the complete 118-element set.
- [South African Government: people and languages](https://www.gov.za/about-sa/south-africas-people) verifies the 12 official languages, including South African Sign Language.
- [South African Government: provinces](https://www.gov.za/about-sa/south-africas-provinces) verifies the nine provinces.
- The four Olympic competition strokes remain locked by the project’s prior Olympic Studies Centre reference.

## Launch-bank editorial data

- Source ID: `saffilion:launch-bank`.
- Licence: original project data.
- Supports: the remaining existing culture, nature, everyday-life, sport and entertainment prompts.
- Transform: the one-time migrator replaced semicolon/pipe strings with explicit entity, alias, prompt and rarity records. Normalized entities are shared when their type and identity agree.
- Limitations: 17 broad prompts remain below 100 verified canonical answers. They are listed in `data/reports/question-validation.json`; no padding or invented answers were added.

## Reproducibility and provenance

- `npm run data:fetch` downloads permitted snapshots and records retrieval metadata.
- `npm run data:build` merges sources, assigns stable IDs, applies curated rarity overrides and emits versioned offline shards.
- `npm run data:validate` writes the full coverage and integrity report.
- `npm run validate:questions` runs the report and fails on duplicate IDs, conflicting aliases, invalid predicates, missing source metadata, missing rarity or incorrect locked finite sets.

Generated public shards are modified extracts. GeoNames attribution and the CC BY 4.0 licence must remain with redistributions.

## Phase 3 generated question bank

The build-time generator combines verified entity properties into auditable question templates. It currently emits 360 generated prompts, which combine with 102 curated prompts for 462 playable questions and 233,777 canonical memberships. Generated questions store their template ID, sorted parameters, predicate, source IDs, answer count, answer-set hash, difficulty and human-readable difficulty reason.

Candidates are rejected when their answer set is too small, lacks useful rarity diversity, duplicates prompt text, or has near-identical answer membership by Jaccard/smaller-set overlap. Stable IDs use `gen:v1:<template>:<sorted parameters>`. The generator fails the build unless the complete bank remains between 300 and 500 prompts and at least 100 standard prompts have 100 verified answers. Current output has 331 such standard prompts.

Run `npm run data:generate-questions` to rebuild `data/generated/questions.json` and the public v3 files. Run `npm run data:report` to regenerate and validate the complete bank. The public developer explorer reads only these checked-in build outputs and never edits production data.
