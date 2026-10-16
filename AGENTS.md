<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Moneo

Things that are easy to get wrong. Read `README.md` for setup.

- Two Next.js apps share `packages/ui` (tokens, theme). `apps/site` is the static landing page; `apps/app` is the signed-in product. Never add auth, a database or request data to the site.
- `cacheComponents` is on. Anything that reads the session, `searchParams`, `params` or the database sits inside `<Suspense>`. Client components that call `usePathname`/`useSearchParams` too.
- Clerk is Core 3: `<Show>` replaced `<SignedIn>`/`<SignedOut>`, `ClerkProvider` goes inside `<body>`, the guard lives in `proxy.ts` (not `middleware.ts`).
- Layers: page/action/route handler (thin) → `lib/modules/*/service.ts` (rules, one `unitOfWork` per write) → `repository.ts` (queries only). Every repository query filters by the user id.
- Pages call `requireProfile()` (redirects); actions and route handlers call `requireUser()` (401 envelope). Actions return `runAction(...)` and call `refresh()` after a write.
- Errors use `{ error: { code, message, details } }`. Throw `AppError`; never return raw provider errors.
- Money is `numeric(14,2)` and stays a string until display. Signed: negative is money out. Never sum floats in JS when SQL can.
- Schema changes: edit `lib/modules/*/schema.ts`, run `npm run db:generate` (writes SQL and applies it locally). Commit the SQL. Production migrates from `migrate.yml` on merge; previews migrate on build only when `APP_PRODUCTION_DB_HOST` proves they are not production. Add columns before code uses them; drop them a PR later.
- Schema files use relative imports (drizzle-kit does not read the `@/` alias).
- AI: tools in `lib/modules/assistant/tools.ts` close over the user id and are read-only. Model output is untrusted: check ids against the user's own lists and let the person confirm before anything is saved. No investment, tax or legal advice in prompts.
- `GOOGLE_CLOUD_PROJECT` empty means every AI feature is off, cleanly. Gemini runs on Vertex AI through `ChatGoogle` from `@langchain/google/node` (`platformType: "gcp"`). Not `@langchain/google-vertexai` or `google-genai`: they drop Gemini 3 thought signatures when streaming tool calls (langchainjs #9624). Check `aiEnabled` before showing AI UI.
- Never log personal or financial data (names, emails, amounts, descriptions, message text). Log the kind of event and timings.
- Anything that changes what data is stored or sent to a third party updates `apps/site/app/privacy/page.tsx` in the same PR.
- App env vars are `APP_*`. Third-party ones keep their names (`DATABASE_URL`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, Clerk's).
- Offline: `public/sw.js` caches only build files and `/offline`, never signed-in pages or API responses. The device copy (snapshot and outbox) lives in IndexedDB via `lib/offline`, keyed to the user and cleared on sign-out. Offline creates carry a device-made id so a replayed sync never duplicates (`createTransactionOnce`). Bump `VERSION` in `sw.js` when its caching changes.
- A CSS custom property set to `color-mix()` with a `var()` inside gets dropped by the build; use a plain token value instead.
- Colours only through tokens (`bg-night-2`, `text-ink-soft`); one filled accent per screen; animate transform/opacity only.
