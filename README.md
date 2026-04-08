# softwareproj

Modern Craigslist-style MVP scaffold using React + Vite + Supabase.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and set:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Start dev server:

```bash
npm run dev
```

## Supabase migrations (Step #4)

Migrations are in `supabase/migrations`.

- `20260408_000001_init_core_schema.sql`
- `20260408_000002_seed_regions_categories.sql`

Apply either:

- With Supabase CLI:
  - `supabase init`
  - `supabase link --project-ref <your-project-ref>`
  - `supabase db push`
- Or in Supabase SQL Editor by running the files in order.

## Netlify deployment (Step #5)

`netlify.toml` is configured with:

- Build command: `npm run build`
- Publish directory: `dist`

In Netlify site settings, add environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then deploy from GitHub.
