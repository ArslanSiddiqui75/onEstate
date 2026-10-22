# Run locally

App root: the folder that contains `package.json`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

→ http://localhost:3000

Useful scripts: `npm test`, `npm run build`, `npm run lint`.

Without Supabase env, the app uses durable localStorage demo mode. With Supabase, apply migrations under `supabase/migrations/`.
