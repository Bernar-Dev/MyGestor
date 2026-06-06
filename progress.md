# meugestor — Progress

> **Context-overflow survival file.** Updated after every major change.  
> Full spec: `MIGRATION.md`

---

## Current Architecture

```
apps/frontend  (Next.js 15)  — UI only, auth via Supabase cookies
apps/backend   (NestJS 11)   — all API logic, auth via Bearer token
```

- Frontend: `apiFetch('/path')` → `NEXT_PUBLIC_API_URL/api/path` + auto Bearer header
- Backend: `Authorization: Bearer <jwt>` → `supabase.auth.getUser(token)` per request
- Both deployed on **Vercel** as separate projects from same GitHub repo
- Prod Supabase: `https://apvfxliqoabcndcdnjpi.supabase.co`
- Dev Supabase: `https://squvzuhbollzdzmgvlgd.supabase.co`

---

## Deployment State

| | Frontend | Backend |
|---|---|---|
| Platform | Vercel | Vercel |
| Root Dir | `apps/frontend` | `apps/backend` |
| Branch | `main` | `main` |
| Entry | Next.js auto | `api/index.js` → `dist/app.module` |
| Status | ✅ deployed | ✅ deployed |

### Vercel Env Vars — Frontend
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL          ← URL do backend Vercel
```

### Vercel Env Vars — Backend
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
WEB_ORIGIN                   ← URL do frontend Vercel
NODE_ENV=production
```

---

## Migration Phases

| # | Description | Status |
|---|---|---|
| 1 | pnpm workspace setup | ✅ done |
| 2 | NestJS skeleton (main.ts, health, CORS) | ✅ done |
| 3 | Auth Guard + SupabaseService + OrgService | ✅ done |
| 4 | All modules migrated (org, clients, invites, portal, meta) | ✅ done |
| 5 | Deploy to Vercel (frontend + backend) | ✅ done |
| 6 | Facebook OAuth platform-level (replace per-agency Meta App) | 🔜 next |
| 7 | Design System (shadcn/ui, AppShell) | ⏳ pending |
| 8 | Shared types `packages/shared` | ⏳ pending |

---

## Phase 6 — Facebook OAuth Refactor (NEXT)

**Goal:** Replace per-agency Meta App setup with platform-level Facebook Login.

**Current flow (per-agency):**
1. Each agency creates their own Meta Developer App
2. Saves App ID + Secret in the system
3. Does OAuth dance to get token
4. Token stored encrypted in `meta_tokens`

**New flow (platform-level):**
1. Developer creates ONE Meta App for the whole platform
2. User clicks "Login com Facebook" (Supabase Facebook provider)
3. Supabase handles OAuth with scopes: `ads_read`, `ads_management`, `business_management`, `read_insights`
4. `provider_token` extracted from Supabase session → exchanged for long-lived token
5. Token stored in `meta_tokens` — same table, same infrastructure

**What changes:**
- Remove onboarding steps 2-4 (Meta App creation)
- Remove `meta_credentials` table usage (no more per-agency App ID/Secret)
- Configure Supabase Facebook Auth provider (one-time platform setup)
- New `POST /api/meta/connect-facebook` endpoint to save provider_token
- Remove `apps/frontend/src/app/api/meta/connect/route.ts`
- Remove `apps/frontend/src/app/api/meta/callback/route.ts` (no longer needed)
- `meta/callback` stays if keeping per-agency flow as fallback

**What stays the same:**
- `meta_tokens` table and MetaStoreService
- MetaApiService (uses access_token regardless of source)
- All portal/insights endpoints

---

## All Migrated Endpoints

### ✅ In NestJS (`apps/backend`)
- `GET/POST/PATCH /api/org` → OrganizationModule
- `GET/POST /api/clients` + `GET/PATCH/DELETE /api/clients/:id` → ClientsModule
- `POST /api/clients/:id/accounts` + `PATCH` + `DELETE` → ClientsModule
- `POST /api/clients/:id/invite` → ClientsModule
- `GET /api/invite/:token` (Public) + `POST /api/invite/:token` → InvitesModule
- `GET /api/portal/me` → PortalModule
- `GET /api/portal/insights` → PortalModule
- `GET /api/accounts` → AccountsModule
- `GET/POST /api/meta/credentials` → MetaModule
- `GET /api/meta/status` → MetaModule
- `POST /api/meta/disconnect` → MetaModule

### 🔒 Staying in Next (`apps/frontend`) — until Phase 6
- `GET /api/meta/connect` — browser redirect + CSRF cookie
- `GET /api/meta/callback` — Meta OAuth callback (hardcoded URI)

---

## Key Files

### Backend (`apps/backend/src/`)
```
main.ts                              port 3001, CORS, prefix /api
api/index.js                         Vercel serverless entry → dist/app.module
app.module.ts
common/
  supabase/supabase.service.ts       service() | asUser(jwt) | getUserFromToken(jwt)
  org/org.service.ts                 resolveSession | requireAgency | requireClient
  org/types.ts                       AgencySession | ClientSession | OnboardingPending
  auth/supabase-auth.guard.ts        Bearer → req.user / req.session
  crypto/crypto.service.ts           AES-256-GCM encrypt/decrypt
  meta/meta-store.service.ts         load/save credentials and tokens
  meta/meta-api.service.ts           Meta Graph API calls + retry
  pipes/zod-validation.pipe.ts       Zod v4: result.error.issues (not .errors)
```

### Frontend (`apps/frontend/src/`)
```
lib/api-client.ts                    apiFetch<T> — auto Bearer, throws ApiError
lib/supabase/middleware.ts           NOTE: has /test bypass — remove when done
lib/crypto.ts                        AES-256-GCM (used by meta/callback)
lib/meta/                            used by meta/connect + meta/callback
app/api/meta/callback/route.ts       PERMANENT (or remove in Phase 6)
app/api/meta/connect/route.ts        remove in Phase 6
```

---

## Security Rules
1. `ENCRYPTION_KEY`: same in frontend + backend, **never change after prod data exists**
2. `SUPABASE_SERVICE_ROLE_KEY`: validate request BEFORE any service_role query
3. Nest CORS: only `WEB_ORIGIN` — never `*`
4. Nest reads only `Authorization: Bearer` — never cookies
5. Run `GRANT ALL ON ALL TABLES/SEQUENCES IN SCHEMA public` on new Supabase projects

---

## Known Gotchas
- **Zod v4**: `.error.issues[0].message` — NOT `.errors`
- **TS1272**: decorated params need `import type` for interfaces
- **pnpm 11**: `allowBuilds` needed for `@nestjs/core`, `sharp`, `unrs-resolver`
- **New Supabase key format**: `sb_publishable_*` / `sb_secret_*` — SDK accepts both
- **New Supabase projects**: need explicit GRANTs on all tables + USAGE on schema
- **Vercel serverless**: `api/index.js` (JS not TS) imports from `dist/` after `nest build`
- **`@UsePipes` on method**: applies to ALL params — use `@Body(pipe)` instead
- **invite bug fixed**: agency users blocked from accepting client invites

---

## Next Session Start
1. Read this file
2. Decide: implement Phase 6 (Facebook OAuth platform-level) or another task
3. Phase 6 requires: create Meta App platform-level → configure Supabase Facebook provider → update onboarding flow
4. Cleanup pending: remove `/test` bypass from `apps/frontend/src/lib/supabase/middleware.ts`
