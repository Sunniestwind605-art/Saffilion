# Saffilion

Saffilion is a cozy, mobile-first rarity-mining game made with love for Safia. Answer one of seven open-ended questions, discover how unusual the answer is, and watch one of five original pixel cats dig through a changing underground world.

## What is included

- Five selectable, animated CSS pixel-art cats
- Seven-question expeditions with reliable 30-second deadlines
- 100+ offline questions across geography, nature, science, food, music, film, games, history, sports, books, everyday life, and South Africa
- Local canonical answers, aliases, six fixed rarity tiers, and post-submission typo correction
- Responsive portrait-first play, safe-area support, dynamic viewport sizing, landscape layouts, 44px controls, and a keyboard-conscious scene
- Five depth environments, touch-friendly controls, reduced motion, battery mode, and optional Web Audio sounds
- Versioned local save data, resumable expeditions, personal journal, export/import, missing-answer notes, and reset confirmation
- Installable PWA with an offline precache and a GitHub Pages workflow

## Rarity scoring

Rarity is a curated, versioned estimate of how familiar an answer is in the context of its question. It is not live popularity data. Pebble, Copper, Quartz, Sapphire, Amethyst, and Stardust answers are worth 10, 25, 45, 65, 85, and 100 points. Every point equals 10 metres. Aliases inherit their canonical answer's score.

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
npm run build
npx playwright install chromium
npm run test:e2e
```

## Offline support

`vite-plugin-pwa` generates a versioned Workbox service worker. The production build precaches the HTML, JavaScript, CSS, question database, and icon. Offline support begins only after one successful production load. iOS users install from Safari's **Share → Add to Home Screen**; Android installation prompts depend on the browser. Save data remains local to that browser/app storage and platform storage limits still apply.

## Save data

The `saffilion-save-v1` local-storage record contains the selected cat, active expedition deadline, finished rounds, journal, shuffle bag, crystals, settings, and locally suggested missing answers. The Journal can export and import validated JSON. Published question changes never rewrite completed expedition scores.

## Add questions

Questions live in `src/data/questions.ts`. `make()` accepts six semicolon-separated rarity groups and pipe-separated answers. Add aliases after `~`, for example `South Africa~RSA`. Keep IDs unique, use only verified answers, and run `npm run validate:data`. Limited finite sets may have fewer answers; open-ended topics should normally have at least 15.

## Add cats and cosmetics

Cat metadata is in `src/App.tsx`; visual layers and animations are in `src/styles.css`. New cats need a stable `CatId`, colours with accessible contrast, and states for idle, walking, digging, celebrating, and an incorrect answer. Cosmetic save IDs belong in `unlocked`; never gate core play behind crystals.

## GitHub Pages deployment

Push `main`, then in the repository open **Settings → Pages** and set **Source** to **GitHub Actions** if it is not already selected. `.github/workflows/deploy-pages.yml` type-checks, tests, builds, and deploys `dist` to `https://sunniestwind605-art.github.io/Saffilion/`.

## Data and licences

Game code, writing, and artwork are original and released under the repository licence. The answer book contains general factual knowledge curated for this game; it does not copy Krillion data or depend on Wikipedia or any runtime service. Country, language, astronomical, biological, and sporting names are factual terms and are not copyrightable datasets. Future imports from external datasets must document source URL, version, and licence here before use.

## Known limitations

- Rarity is necessarily subjective and should be reviewed as players record missing answers.
- Browser storage can be cleared by the operating system; exports are the portable backup.
- iOS does not expose the same install prompt or storage lifecycle as Android.
- The current Treasure Burrow explains the crystal economy but does not yet sell cosmetics; crystals are saved for a future asset pack.
- Physical-device testing is still required before claiming hardware certification; automated mobile browser emulation is included.
