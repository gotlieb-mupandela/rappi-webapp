# RAPPI native shells

This folder is the store wrapper. The Next.js site stays the source of truth.

`capacitor.config.ts` loads `https://www.rappisportshub.com`.

```bash
npm install
npx cap sync
```

iOS builds run on Codemagic (`codemagic.yaml` at the repo root). Do not add a native admin UI here.
