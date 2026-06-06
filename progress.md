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
| URL | `https://meugestor-one.vercel.app` | backend Vercel URL |

### Vercel Env Vars — Frontend
```
NEXT_PUBLIC_SUPABASE_URL       = https://apvfxliqoabcndcdnjpi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key>
SUPABASE_SERVICE_ROLE_KEY      = <service role key>
ENCRYPTION_KEY                 = <AES-256 key>
NEXT_PUBLIC_APP_URL            = https://meugestor-one.vercel.app
NEXT_PUBLIC_API_URL            = <backend Vercel URL>
META_PLATFORM_APP_ID           = 1723020158823520  ← Consumer app (login)
META_PLATFORM_APP_SECRET       = <consumer app secret>
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
| 6 | Facebook OAuth platform-level (settings page) | ✅ done |
| 6b | Facebook Login on login page (Supabase provider) | 🔜 in progress |
| 7 | Google Login on login page | 🔜 in progress |
| 8 | Design System (shadcn/ui, AppShell) | ⏳ pending |
| 9 | Shared types `packages/shared` | ⏳ pending |

---

## Phase 6 — Facebook OAuth (DONE)

### Fluxo 1 — "Conectar com Facebook" nas Configurações (Meta Ads)
- Usa app Business: **meu-gestor** (App ID: `1764053491421830`)
- Flow: `/api/meta/connect?platform=1` → Facebook OAuth → `/api/meta/callback`
- Cookie `meta_oauth_platform=1` identifica modo plataforma no callback
- Scopes: `ads_read, ads_management, business_management, read_insights`
- Token salvo em `meta_tokens` via MetaStoreService
- `META_PLATFORM_APP_ID` + `META_PLATFORM_APP_SECRET` nas env vars do **frontend**

### Fluxo 2 — "Continuar com Facebook" na tela de login (Auth)
- Usa app Consumer: **myGest** (App ID: `1723020158823520`)
- Flow: Supabase `signInWithOAuth({ provider: 'facebook' })` → Supabase callback
- Configurado em Supabase → Authentication → Providers → Facebook
- ⚠️ **Problema conhecido**: Facebook não retorna email para contas criadas com telefone
  - Solução: funciona para a maioria dos usuários com email verificado no Facebook
  - Para contas sem email verificado via API → usar email/Google login

### Meta Apps configurados
| App | Tipo | Uso | App ID |
|---|---|---|---|
| meu-gestor | Business | Meta Ads API | `1764053491421830` |
| myGest | Consumer | Login autenticação | `1723020158823520` |

### Redirect URIs no app myGest (Consumer)
```
https://apvfxliqoabcndcdnjpi.supabase.co/auth/v1/callback
```

### Redirect URIs no app meu-gestor (Business)
```
https://apvfxliqoabcndcdnjpi.supabase.co/auth/v1/callback
https://meugestor-one.vercel.app/api/meta/callback
```

---

## Phase 7 — Google Login (IN PROGRESS)

**O botão "Continuar com Google" já existe na tela de login.**

Para ativar em produção:
1. Google Cloud Console → projeto MyGestor → APIs & Services → Credentials
2. Criar OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `https://apvfxliqoabcndcdnjpi.supabase.co/auth/v1/callback`
4. Pegar Client ID e Secret
5. Supabase → Authentication → Providers → Google → ativar + colocar credenciais

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

### 🔒 Staying in Next (`apps/frontend`)
- `GET /api/meta/connect` — browser redirect + CSRF cookie (suporta ?platform=1)
- `GET /api/meta/callback` — Meta OAuth callback

---

## Key Files

### Backend (`apps/backend/src/`)
```
main.ts
api/index.js                         Vercel serverless entry → dist/app.module
app.module.ts
common/
  supabase/supabase.service.ts
  org/org.service.ts
  org/types.ts
  auth/supabase-auth.guard.ts
  crypto/crypto.service.ts
  meta/meta-store.service.ts
  meta/meta-api.service.ts
  pipes/zod-validation.pipe.ts       Zod v4: result.error.issues (not .errors)
```

### Frontend (`apps/frontend/src/`)
```
lib/api-client.ts                    apiFetch<T> — auto Bearer, throws ApiError
lib/supabase/middleware.ts           Guard against missing NEXT_PUBLIC vars
app/api/meta/callback/route.ts       Suporta platform mode via cookie
app/api/meta/connect/route.ts        Suporta ?platform=1
app/dashboard/settings/page.tsx      Conectar com Facebook (Meta Ads)
app/login/page.tsx                   Continuar com Google + Facebook
```

---

## Security Rules
1. `ENCRYPTION_KEY`: mesmo no frontend + backend, **nunca mudar após ter dados prod**
2. `SUPABASE_SERVICE_ROLE_KEY`: validar request ANTES de qualquer query service_role
3. Nest CORS: só `WEB_ORIGIN` — nunca `*`
4. Nest lê só `Authorization: Bearer` — nunca cookies
5. Run `GRANT ALL ON ALL TABLES/SEQUENCES IN SCHEMA public` em novos projetos Supabase

---

## Known Gotchas
- **Zod v4**: `.error.issues[0].message` — NOT `.errors`
- **pnpm 11**: `allowBuilds` needed for `@nestjs/core`, `sharp`, `unrs-resolver`
- **New Supabase projects**: need explicit GRANTs on all tables + USAGE on schema
- **Vercel serverless**: `api/index.js` (JS not TS) imports from `dist/` after `nest build`
- **`@UsePipes` on method**: applies to ALL params — use `@Body(pipe)` instead
- **invite bug fixed**: agency users blocked from accepting client invites
- **createClient() in components**: NEVER at component body level — only inside functions/useEffect (causes SSG build failure)
- **NEXT_PUBLIC_* vars**: inlined at build time — must be set in Vercel before build
- **Middleware guard**: added null check for NEXT_PUBLIC vars to avoid MIDDLEWARE_INVOCATION_FAILED
- **Facebook login**: accounts created with phone number may not return email via Graph API
- **Two Meta Apps**: Business (meu-gestor) for Ads API, Consumer (myGest) for auth login
- **Vercel Root Directory**: NEVER reset — frontend=apps/frontend, backend=apps/backend

---

## Supabase Production Config
- Site URL: `https://meugestor-one.vercel.app`
- Redirect URLs: `https://meugestor-one.vercel.app/**`
- Facebook provider: enabled, App ID=1723020158823520 (myGest Consumer)
- Google provider: 🔜 in progress

---

## Next Session Start
1. Leia este arquivo
2. Google Login: finalizar configuração no Google Cloud Console + Supabase
3. Testar fluxo completo: login Google → dashboard → conectar Meta Ads
4. Pendente: remover `/test` bypass do middleware
5. Pendente: adicionar GRANT statements ao migration SQL
