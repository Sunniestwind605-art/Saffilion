# Saffilion

Saffilion is a cozy, mobile-first rarity-mining game made with love for Safia. Answer one of seven open-ended questions, discover how unusual the answer is, and watch one of five original pixel cats dig through a changing underground world.

## What is included

- Five selectable 48×48 canvas pixel cats with individual idle, happy, digging, and incorrect-answer reactions
- Seven-question expeditions with reliable 30-second deadlines
- 462 offline prompts backed by 12,000+ shared entities across geography, nature, science, food, music, film, games, history, sports, books, everyday life, and South Africa
- Deterministic Daily Digs, a 30-day practice archive, balanced 2/3/2 difficulty selection, and unlimited category play
- A build-time template engine with quality filters, overlap detection, stable generated IDs, and a developer-only bank explorer
- Stable entity IDs, context-aware aliases, six fixed rarity tiers, out-of-category detection, and post-submission typo correction
- Responsive portrait-first play, safe-area support, dynamic viewport sizing, landscape layouts, 44px controls, and a keyboard-conscious scene
- Staged rarity reveals, tier-scaled digging, and one deterministic excavated shaft spanning ten hand-authored biomes from Surface Roots to the Stardust Abyss
- Touch-friendly controls, keyboard-aware scene compression, reduced motion, battery mode, optional sound, and optional haptics
- Expedition results with rarity distribution, personal records, quick replay, and a thematic digging journal
- A deterministic cosmetic shop using earned crystals only—no randomness, purchases, or gameplay advantages
- Versioned local save data, crash-safe in-progress rounds, unlimited IndexedDB expedition history, cumulative discoveries, immutable original Daily results, export/import, local missing-answer reports, and reset confirmation
- Installable PWA with an offline precache and a GitHub Pages workflow

## Rarity scoring

Rarity is a versioned, question-specific estimate built from cached reference evidence, category-aware familiarity signals, relative answer-set rank and a small audited override list. It is not live player popularity data. Pebble, Copper, Quartz, Sapphire, Amethyst, and Stardust answers are worth 10, 15, 30, 60, 85, and 100 points. Every point equals 10 metres, so a seven-Stardust expedition remains 700 points and 7,000 metres. Aliases and confirmed spelling corrections inherit the canonical entity's exact score. See [RARITY_METHODOLOGY.md](./RARITY_METHODOLOGY.md).

The Phase 3 database contains 462 playable prompts, 12,964 unique entities and 233,777 canonical question-answer memberships. Of those, 331 standard questions have at least 100 verified answers. One entity can belong to several matching prompts without duplicated maintenance. Complete finite sets are intentionally not padded with false entries. See [DATA_SOURCES.md](./DATA_SOURCES.md), `data/reports/question-generation.json`, and `data/reports/question-validation.json` for the research, coverage and curation trail.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

The production base path is `/Saffilion/` for GitHub Pages.

```bash
npm run typecheck
npm test
npm run validate:questions
npm run build
npx playwright install chromium
npm run test:e2e
```

## Offline support

`vite-plugin-pwa` generates a versioned Workbox service worker. The production build precaches the HTML, JavaScript, CSS, entity registry, versioned knowledge shards, and icons. South African data is divided into sub-200 KiB shards, and the Workbox asset ceiling is explicitly sized for the measured application bundle. Offline support begins only after one successful production load. iOS users install from Safari's **Share → Add to Home Screen**; Android installation prompts depend on the browser. Save data remains local to that browser/app storage and platform storage limits still apply.

## Save data

Save schema 2 keeps a compact recent cache and active expedition in the backwards-compatible `saffilion-save-v1` local-storage key, while the full uncapped expedition journal lives in IndexedDB. Lifetime depth, correct answers, rare finds, achievements, and discovered biomes are derived during version-1 migration without rescoring historical rounds. A submitted answer is persisted before its digging animation, so a refresh cannot lose or duplicate that result. The Journal can export and import validated JSON, and published question changes never rewrite completed expedition scores.

## Underground world preview

During local development, open `/Saffilion/?worldPreview=1` to inspect all ten biomes with deterministic terrain, exact world coordinates, cat and viewport selectors, and all six dig strengths. The renderer anchors walls, landmarks, particles, and the final 7,000-metre chamber to absolute depth, so the same save and seed reproduce the same shaft after a reload.

## Knowledge-data workflow

The production bank is compiled from explicit entities, prompt predicates, provenance and prompt-specific rarity overrides. The old semicolon/pipe positional format has been retired.

```bash
npm run data:fetch      # refresh permitted upstream snapshots
npm run data:build      # merge, deduplicate, generate questions and create offline data
npm run data:generate-questions # rebuild only the generated Phase 3 bank
npm run data:collect-familiarity # rebuild evidence from checked-in snapshots
npm run data:rank-rarity         # generate question/entity rarity classifications
npm run data:audit-rarity        # verify determinism and write the rarity audit
npm run data:report     # regenerate the bank and both quality reports
npm run data:validate   # write the coverage/integrity report
```

Application builds consume only checked-in local snapshots and never require a live data request. Add or edit entities in `data/curated/entities.json`, prompt definitions in `data/curated/prompts.json`, generator templates in `scripts/generate-questions.mjs`, rarity weights in `data/rarity/config.json`, and audited exceptions in `data/overrides/rarity-v4.json`. Keep stable IDs and source IDs, then run `npm run data:report`. A developer bank explorer is available at `/Saffilion/dev/bank-explorer.html` in local and deployed builds; it is intentionally not linked from the game.

## Add cats and cosmetics

Cat metadata, sprite drawing, and cosmetic definitions are in `src/App.tsx`; presentation animations are in `src/styles.css`. New cats need a stable `CatId`, colours with accessible contrast, and states for idle, walking, happy, tiered digging, celebrating, and an incorrect answer. Cosmetic save IDs belong in `unlocked` and `equipped`; never gate core play behind crystals.

## GitHub Pages deployment

Push `main`, then in the repository open **Settings → Pages** and set **Source** to **GitHub Actions** if it is not already selected. `.github/workflows/deploy-pages.yml` type-checks, tests, builds, and deploys `dist` to `https://sunniestwind605-art.github.io/Saffilion/`.

## Data and licences

Game code, writing, and artwork are original and released under the repository licence. The answer book does not copy Krillion data and never depends on a runtime data service. Its open-data snapshots are GeoNames (CC BY 4.0), Wikidata (CC0), and PubChem public-domain factual data. Full attribution, transformations and limitations are documented in [DATA_SOURCES.md](./DATA_SOURCES.md).

## Known limitations

- Rarity is necessarily subjective and should be reviewed as players record missing answers.
- Seventeen broad launch prompts remain below the 100-answer Phase 2 target; the validator lists each one instead of padding it.
- Browser storage can be cleared by the operating system; exports are the portable backup.
- iOS does not expose the same install prompt or storage lifecycle as Android.
- Physical-device testing is still required before claiming hardware certification; automated mobile browser emulation is included.
