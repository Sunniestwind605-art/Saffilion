# Phase 4 rarity methodology

Saffilion rarity is an offline, reproducible estimate of answer familiarity and discovery value. It is not a percentage of real player answers. Correctness comes only from an entity's membership in a question; rarity is calculated afterwards for that valid `questionId + entityId` pair.

## Model and scoring versions

- Dataset: `4.0.0`
- Evidence: `familiarity-evidence-v1`
- Model: `rarity-model-v4.0.0`
- Scoring: `rarity-v4-curve-1`
- Questions: `question-bank-3.0.0`

The authoritative curve is `data/rarity/scoring.json`: Pebble 10, Copper 15, Quartz 30, Sapphire 60, Amethyst 85, and Stardust 100. Every point is 10 metres.

## Evidence and normalisation

The checked-in evidence snapshot combines stable-ID Wikimedia pageviews, Wikidata sitelink counts, multilingual article availability (English, Afrikaans, isiZulu and isiXhosa), verified population/prominence fields, reference breadth, a regional-relevance signal and a limited editorial prior. Wikimedia observations cover 29 September through 27 November 2026. Evidence is collected at build time and the game never calls these services at runtime.

Highly skewed numeric signals use `log(1 + value)`. Every signal is converted to a tie-preserving percentile within a compatible entity group, so a city is not ranked against a chemical element. Missing metrics are omitted and available weights are renormalised. Confidence falls with unavailable weight. With no usable evidence, familiarity is neutral (`0.5`); low confidence cannot create Stardust.

Category weights live in `data/rarity/config.json`. Named places emphasize pageviews, sitelinks and population; elements emphasize reference coverage, prominence and editorial familiarity; words, culture, food, nature and everyday objects use their own mixtures of pageviews, reference breadth, regional relevance and editorial priors. These are documented estimates, not Krillion's proprietary formula.

## Contextual ranking

Within each eligible answer set, general familiarity is combined with the answer's tie-preserving relative rank. Broad pools use distribution guidelines plus absolute familiarity caps. Small or finite sets use a separate calibration so a familiar eight-item set is not forced to contain a Stardust answer. Copper represents familiar secondary guesses where the context supports it. Stardust additionally requires sufficient confidence, low absolute familiarity and exceptional relative position.

The small override file `data/overrides/rarity-v4.json` handles misleading statistics and a few intentional discoveries. Each override must identify an existing member of its question and include a reason and review date. Eleven overrides are currently active.

## Calibration review

Manual checks covered countries (`geo-01`), cities and South African places (`sa-02`), animals (`nature-01` and `nature-04`), instruments (`music-01`), films (`screen-*`), foods (`food-01`), languages (`words-04`), elements and planets (`science-01` and `science-03`), and ordinary words (`words-*`). South Africa and Comoros intentionally anchor opposite ends of the African-country pool; Hydrogen and Oganesson do the same for elements. Missing-population GeoNames records stay mostly Quartz rather than becoming top-tier by absence of evidence.

The generated audit reports 233,777 classifications: Pebble 10,609; Copper 1,249; Quartz 210,079; Sapphire 652; Amethyst 6,765; Stardust 4,423. Stardust is 1.892% overall, down from the old provisional system's 77.13% assignment rate. The large Quartz share is intentional: 10,000+ imported place records have tied or incomplete evidence, and the model refuses to invent rarity among them. Audit warnings expose that limitation for future evidence improvements.

## Reproducible commands

```bash
npm run data:collect-familiarity  # rebuild evidence from checked-in source snapshots
npm run data:refresh-familiarity  # explicitly refresh permitted upstream evidence
npm run data:rank-rarity          # classify every question/entity membership
npm run data:audit-rarity         # verify deterministic output and write the audit
npm run data:build                # rebuild all local data products; no live API calls
```

`data/generated/rarity-v4.json` is the versioned application input. `data/reports/rarity-audit.json` contains per-question distributions, confidence, missing-signal rates, overrides, selected uncommon answers and anomalies. Completed saves store their original canonical entity, tier, points and data/scoring/question versions; they are never rescored.

## Genuine limitations

Reference attention is not the same thing as human recall. Wikipedia traffic has language and internet-access biases, and regional signals remain incomplete. Sparse source data makes many place classifications deliberately conservative. Editorial overrides improve a few obvious cases but cannot remove cultural subjectivity. The model is fixed and comparable for all players; it does not vary by location and cannot claim live global answer frequencies.
