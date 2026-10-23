# Moneo

Personal finance with an assistant that knows your numbers. Accounts, transactions and budgets, plus a chat that reads your own data to answer questions.

```
apps/site/     landing page (static)               → moneo.com          port 3030
apps/app/      the product (Clerk, Postgres, AI)   → app.moneo.com      port 3031
packages/ui/   shared tokens, base CSS, theme toggle
```

Stack: Next.js 16 (App Router, Cache Components), React 19, Tailwind v4, TypeScript strict, Clerk, Postgres + Drizzle, LangGraph.js with Gemini on Vertex AI.

## Run it locally

You need Node 24, Docker, and npm.

```bash
npm install
cp apps/app/.env.example apps/app/.env.local
(cd apps/app && npx clerk@latest init)   # once: writes Clerk dev keys to .env.local, no account needed
./dev.sh                                  # Postgres in Docker + both apps
```

Set `GOOGLE_CLOUD_PROJECT` (and `APP_GOOGLE_CREDENTIALS_JSON`, or run `gcloud auth application-default login`) in `apps/app/.env.local` to turn the assistant on. Without it, everything else works.

`./dev.sh` stops both apps and the database on Ctrl+C. The data stays in a Docker volume.

## Database and migrations

Tables live next to their module in `apps/app/lib/modules/*/schema.ts`. SQL migrations live in `apps/app/drizzle/`.

| When | What runs |
|------|-----------|
| `npm run dev` / `./dev.sh` | pending migrations are applied before the dev server starts |
| you change a schema file | `npm run db:generate` writes the SQL and applies it locally |
| a Vercel preview builds | migrates its own Neon branch, but only if `APP_PRODUCTION_DB_HOST` is set and does not match |
| a PR merges to `main` | `.github/workflows/migrate.yml` migrates production |
| CI | migrates an empty database, then fails if the schema changed without a migration |

Migrations take a Postgres advisory lock, so two runners never migrate at once.

Other commands: `npm run db:migrate`, `npm run db:studio`, `npm test` (unit tests plus database tests when `DATABASE_URL` is set), `npm run lint`, `npm run typecheck`.

## Environment variables

`apps/app/.env.example` lists them all. An empty value switches that feature off.

| Variable | App | Purpose |
|----------|-----|---------|
| `APP_ENVIRONMENT` | app | `development`, `preview` or `production`. Rate limits only in production. |
| `DATABASE_URL` | app | Postgres. Injected by the Vercel–Neon integration. `APP_DATABASE_URL` wins if both are set. |
| `APP_PRODUCTION_DB_HOST` | app | Production Neon hostname. Previews refuse to migrate against it. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | app | Clerk. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | app | `/sign-in`, `/sign-up`. |
| `GOOGLE_CLOUD_PROJECT` | app | Google Cloud project for Vertex AI. Empty turns off the assistant, quick add, month read and budget suggestions. |
| `GOOGLE_CLOUD_LOCATION` | app | Vertex region. Default `global`. |
| `APP_GOOGLE_CREDENTIALS_JSON` | app | Service account key JSON (needs the Vertex AI User role). Empty uses Application Default Credentials. |
| `APP_AI_MODEL` | app | Gemini model id on Vertex. Default `gemini-3.6-flash` (steady ~1 s per call on Vertex `global`; 3.8 was 2–30 s when tested). |
| `APP_AI_HOURLY_LIMIT` | app | Chat messages per user per hour in production. Default 60. |
| `APP_SANDBOX` | app | `on` lets the assistant make charts, reports and widgets. Also needs the assistant and all `APP_R2_*` values. |
| `APP_SANDBOX_HOURLY_LIMIT` | app | Files the assistant may make per user per hour in production. Default 20. |
| `APP_R2_ACCOUNT_ID`, `APP_R2_ACCESS_KEY_ID`, `APP_R2_SECRET_ACCESS_KEY`, `APP_R2_BUCKET` | app | Cloudflare R2 bucket (`moneo`) for those files. The key can only read and write that bucket. |
| `VERCEL_OIDC_TOKEN` | app | Signs in to Vercel Sandbox. Set by Vercel on deploys; `vercel env pull` writes a 12-hour one locally. |
| `APP_SITE_URL` | both | Landing page URL. The app sends people here after sign out. |
| `APP_WEB_URL` | both | App URL. The landing page links here to sign in and sign up. |

## Where the AI is

- **Assistant** (`/assistant`): a LangGraph agent ⇄ tools loop. The tools read accounts, categories, transactions, spending by category, monthly cash flow and budget status, all scoped to the signed-in user. Answers stream over `POST /api/chat` as NDJSON. Chats are stored in `conversations` and `messages`.
- **Quick add** (Transactions): plain words like "coffee 4.50 yesterday on my visa" fill the form. You review it before it is saved.
- **Month read** (Overview): a few sentences about the month, written from totals only.
- **Budget suggestions** (Budgets): limits based on the last three months. Nothing is saved until you add one.

- **Charts and files** (in the assistant): the data tools take `save_to_sandbox: true`, which writes their full result (up to 5,000 rows, no descriptions or notes) into the chat's own Vercel Sandbox (`chat-<conversationId>`, region `sin1`, no internet). `make_files` then runs the model's Python script there and keeps up to 3 `.html`, `.csv` or `.json` files from `out/`. Files go to R2 under `u/<userId>/c/<conversationId>/` with a row in `assistant_files`, and download through `GET /api/files/[id]`. Pages show in an `<iframe sandbox="allow-scripts">` with a no-network Content-Security-Policy. The sandbox stops after each turn and keeps `data/` for follow-ups; its saved copy expires after 7 days. Deleting a chat or the account deletes both. Code is in `lib/modules/files/`.
