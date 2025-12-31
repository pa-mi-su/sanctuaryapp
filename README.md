1.	Rebuild data:
npm run saints:build && npm run saints:check

2.	Run app:
npx expo start


Build the saints data artifacts (so the app has what it imports)
From your rg output, the UI imports data/saints_by_mmdd.json, not saints_enriched.json. So run the build step that generates saints_by_mmdd.json (and then index if needed):
# from project root
npx tsx scripts/build-saints-calendar.ts
npx tsx scripts/build-saints-index.ts
npm run saints:check

Start the app
npx expo start -c
