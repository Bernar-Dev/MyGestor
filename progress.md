# meugestor — Migration Progress

> **Context-overflow survival file.** Updated after every phase.  
> Full spec: `MIGRATION.md` | Session transcripts: `~/.claude/projects/…`

---

## Architecture

```
apps/web  (Next.js 15) — UI only, supabase-auth via cookies
apps/api  (NestJS 11)  — all API logic, auth via Bearer token
```

- Web fetches: `apiFetch('/path')` → `http://localhost:3001/api/path` + auto Bearer
- Nest Auth: `Authorization: Bearer <jwt>` → `supabase.auth.getUser(token)` per request
- **Meta OAuth callback stays in Next permanently** (`/api/meta/callback`) — hardcoded in Meta App
- `meta/connect` also stays in Next (sets cookies + redirects)
- ENCRYPTION_KEY: AES-256-GCM key for Meta secrets/tokens — **never change in prod**

---

## Phases

| # | Description | Status |
|---|---|---|
| 1 | pnpm workspace setup | ✅ done |
| 2 | NestJS skeleton (main.ts, health, CORS) | ✅ done |
| 3 | Auth Guard + SupabaseService + OrgService + DevModule | ✅ done |
| 4 | Module migration (org, clients, invites, portal, meta) | ✅ done |
| 5 | Design System (shadcn/ui, AppShell) | ⏳ pending |
| 6 | Shared types `packages/shared` | ⏳ pending |

---

## Phase 4 — Endpoint Migration Checklist ✅ COMPLETE

### ✅ Migrated to Nest (all done)
- `GET/POST/PATCH /api/org` → OrganizationModule
- `GET/POST /api/clients` + `GET/PATCH/DELETE /api/clients/:id` → ClientsModule
- `POST /api/clients/:id/accounts` → ClientsModule (upsert)
- `POST /api/clients/:id/invite` → ClientsModule
- `GET /api/invite/:token` (public) + `POST /api/invite/:token` → InvitesModule
- `GET /api/portal/me` → PortalModule
- `GET /api/accounts` → AccountsModule (MetaApiService)
- `GET/POST /api/meta/credentials` → MetaModule
- `GET /api/meta/status` → MetaModule
- `POST /api/meta/disconnect` → MetaModule
- `GET /api/portal/insights` → PortalModule (with permissions check)

### 🔒 Stays in Next permanently
- `GET /api/meta/connect` — sets cookies + browser redirect
- `GET /api/meta/callback` — hardcoded OAuth redirect URI in Meta App

---

## Key Files

### Nest API (`apps/api/src/`)
```
main.ts                              port 3001, CORS web, prefix /api
app.module.ts                        AppModule with all modules
common/
  supabase/supabase.service.ts       service() | asUser(jwt) | getUserFromToken(jwt)
  org/org.service.ts                 resolveSession | requireAgency | requireClient
  org/types.ts                       AgencySession | ClientSession | Session | OnboardingPending
  auth/supabase-auth.guard.ts        Bearer → req.user / req.session / req.token
  auth/decorators.ts                 @Public() @CurrentUser() @CurrentSession()
  exceptions/http-exception.filter.ts
  pipes/zod-validation.pipe.ts       Zod v4: result.error.issues (not .errors)
modules/
  health/health.controller.ts        GET /api/health (Public)
  _dev/dev.module.ts                 GET /api/whoami (dev only)
  organization/organization.controller.ts
  clients/clients.controller.ts
  invites/invites.controller.ts
  portal/portal.controller.ts
```

### Next Web (`apps/web/src/`)
```
lib/api-client.ts                    apiFetch<T> — auto Bearer, throws ApiError
lib/supabase/middleware.ts           early-return for /test (remove when phase 4 done)
lib/crypto.ts                        AES-256-GCM (stays for meta/callback)
lib/meta/                            stays for meta/connect + meta/callback
app/api/meta/callback/route.ts       PERMANENT — never delete
app/api/meta/connect/route.ts        stays (browser redirect + cookies)
```

---

## Env Files

### `apps/api/.env`
```
PORT=3001
WEB_ORIGIN=http://localhost:3000
NODE_ENV=development
SUPABASE_URL=https://squvzuhbollzdzmgvlgd.supabase.co
SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY=sb_secret_…
ENCRYPTION_KEY=<same as web>
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://squvzuhbollzdzmgvlgd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY=sb_secret_…
ENCRYPTION_KEY=RvqTrYSByK8JWIegiki5+kKFf5FnELUT206Mj8nvYdY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Security Rules (never break these)
1. ENCRYPTION_KEY: same value in both envs, never change after prod data exists
2. SUPABASE_SERVICE_ROLE_KEY: validate request BEFORE any service_role query
3. Nest CORS: only `WEB_ORIGIN` — never `*`
4. Nest reads only `Authorization: Bearer` — never cookies
5. Meta callback stays in Next permanently

---

## Common Gotchas
- **Zod v4**: `.error.issues[0].message` — NOT `.errors`
- **TS1272**: decorated params need `import type` for interfaces (`isolatedModules`)
- **pnpm 11**: `allowBuilds` in `pnpm-workspace.yaml` for `@nestjs/core`, `sharp`, `unrs-resolver`
- **New Supabase key format**: `sb_publishable_*` / `sb_secret_*` — SDK accepts both formats
- **`nest build` kills watch**: use `start:dev` for dev, `build` only for TS check
- **ENCRYPTION_KEY not yet added** to `apps/api/.env` — add when porting MetaStoreService

---

## Next Session Start Checklist
1. Read this file
2. Phase 4 is complete — all endpoints migrated and smoke-tested ✅
3. Remaining cleanup: remove `/test` early-return from middleware (`apps/web/src/lib/supabase/middleware.ts`)
4. Move to Phase 5: Design System (shadcn/ui, AppShell, standardized loading/error states)
5. After Phase 5: Phase 6 — shared types in `packages/shared`
6. **All changes still uncommitted** — commit when user asks
