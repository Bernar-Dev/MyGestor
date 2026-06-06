# Migração — Monorepo Next → Workspace NestJS + Next + Design System

> Documento de continuidade. Sempre que abrir uma nova sessão do Claude Code (ou retomar o trabalho), leia este arquivo do começo ao fim. Ele tem todo o contexto necessário pra continuar de onde paramos sem perder nada.

---

## 🎯 Objetivo geral

Migrar o projeto `meugestor` (atualmente um Next.js 16 monorepo onde frontend, API routes e lógica de domínio vivem juntos em `src/`) para uma arquitetura separada:

- **`apps/web`** — Next.js 16 servindo SÓ o frontend (sem `/api`)
- **`apps/api`** — NestJS expondo todos os endpoints
- **`packages/shared`** (opcional, fase 6) — schemas Zod e tipos compartilhados

Adicionalmente: aplicar um **Design System** com shadcn/ui + Tailwind 4, padronizando botões, inputs, tabelas, estados (loading/empty/error) e o shell de navegação.

A branch de trabalho é **`feat/split-architecture`**.

---

## 🧠 Decisões de arquitetura travadas

Foram avaliadas três decisões críticas no início da migração. As escolhas abaixo priorizam **segurança e não-quebra do fluxo atual**:

### 1. Gerenciador de pacotes: `pnpm workspaces`
- Mais leve que turborepo; suficiente para 2-3 apps.
- Versão instalada: `pnpm@11.0.0`.
- Comando único da raiz: `pnpm dev`, `pnpm build`, `pnpm lint` (todos delegam pro `apps/web` via `--filter web`).

### 2. Autenticação cross-origin: **Bearer Token, sem cookie compartilhado**
- Cookie do Supabase Auth fica **apenas no domínio do Next**.
- No Next, um wrapper de `fetch` (`apps/web/src/lib/api-client.ts` — a criar na Fase 2) lê `supabase.auth.getSession().access_token` e manda como `Authorization: Bearer <token>` para o Nest.
- No Nest, um `SupabaseAuthGuard` global valida o token via `supabase.auth.getUser(token)` (a criar na Fase 3).
- **Por quê:** evita `SameSite=None` em cookies, evita CSRF cross-domain, funciona idêntico em dev e prod (não exige subdomínios compartilhados em dev). O `access_token` já é exposto a JS pelo Supabase por design, então não há piora de segurança.

### 3. Callback OAuth da Meta: **fica no Next durante toda a migração**
- O Meta App tem `OAuth Redirect URI` cravado em `https://<dominio>/api/meta/callback`. Mover esse path quebraria a integração com o Facebook.
- A rota `src/app/api/meta/callback/route.ts` permanece no Next. Ela apenas vai chamar o Nest para fazer o exchange do code e persistir o token cifrado.
- **Por quê:** zero impacto no fluxo Meta. O cookie CSRF `meta_oauth_state` continua no mesmo domínio que o setou.

---

## 📦 Plano em fases

| Fase | Descrição | Status |
|---|---|---|
| **0** | Preparação (pnpm, branch, backup) | ✅ Concluída |
| **1** | Workspace + mover Next pra `apps/web` | ✅ Concluída |
| **2** | Esqueleto do NestJS em `apps/api` | ✅ Concluída |
| **3** | Auth Guard global validando JWT Supabase | ✅ Concluída |
| **4** | Migrar módulos um a um (org → clients → accounts → invites → portal → meta) | 🔄 Em andamento (org ✅ / clients ✅ / invites ✅ / portal-me ✅ / accounts · portal-insights · meta ⏳) |
| **5** | Design System + UI/UX (shadcn/ui, AppShell, estados padronizados) | ⏳ Pendente (pode rodar em paralelo) |
| **6** | Tipos compartilhados em `packages/shared` | ⏳ Pendente |

---

## ✅ Fase 0 — Preparação (CONCLUÍDA)

- `npm install -g pnpm` → versão 11.0.0
- `git checkout -b feat/split-architecture` (a branch existe apenas no local; ainda não foi pra remote)
- Backup do `.env.local` — **não foi necessário**, o arquivo não existia
- `npm run dev` rodou sem erro de build (confirmou ponto de partida verde)

---

## ✅ Fase 1 — Workspace + mover Next pra `apps/web` (CONCLUÍDA)

### Estrutura final

```
meugestor/                            ← raiz do workspace
├── .git/
├── .gitignore                        ← reescrito com **/ globs
├── APLICAR.md
├── MIGRATION.md                      ← este arquivo
├── README.md
├── apps/
│   └── web/                          ← Next.js inteiro aqui
│       ├── .env.example
│       ├── .next/                    ← gerado pelo dev
│       ├── next-env.d.ts
│       ├── next.config.ts            ← + turbopack.root cravado
│       ├── node_modules/             ← symlinks do pnpm
│       ├── package.json              ← "name": "web"
│       ├── postcss.config.mjs
│       ├── src/                      ← (intacto, conteúdo idêntico ao original)
│       │   ├── app/
│       │   ├── lib/
│       │   └── middleware.ts
│       └── tsconfig.json
├── node_modules/                     ← store hoist do pnpm
├── package.json                      ← raiz do workspace (orquestrador)
├── pnpm-lock.yaml                    ← novo lockfile
├── pnpm-workspace.yaml               ← packages + allowBuilds
└── supabase/
    └── migrations/
        └── 0001_init.sql
```

### Arquivos criados ou alterados

**`package.json` (raiz, novo):**
```json
{
  "name": "meugestor",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "lint": "pnpm --filter web lint"
  },
  "packageManager": "pnpm@11.0.0"
}
```

**`pnpm-workspace.yaml` (novo):**
```yaml
packages:
  - "apps/*"
  - "packages/*"

allowBuilds:
  sharp: true
  unrs-resolver: true
```

> O `allowBuilds` libera os postinstall scripts de `sharp` (otimização de imagens do Next) e `unrs-resolver` (resolver Rust do Next). pnpm 11 bloqueia esses scripts por padrão como medida de segurança.

**`.gitignore` (raiz, reescrito):**
```gitignore
**/node_modules
**/.next
**/next-env.d.ts
**/.env
**/.env.local
**/.env*.local
**/.vercel
**/dist
**/build
.DS_Store
Thumbs.db
*.log
```

**`apps/web/package.json` — única alteração:** `"name": "newgestor"` → `"name": "web"`.

**`apps/web/next.config.ts` — adicionou `turbopack.root`:**
```ts
import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
    ],
  },
};

export default config;
```

> Sem isso, o Next reclamava de ter detectado um `package-lock.json` solto em `C:\Users\BERNARDO\` e inferiu o root errado.

### Como rodar agora

Sempre da raiz `C:\Users\BERNARDO\Desktop\meugestor`:

```powershell
pnpm dev
```

Sobe o Next em `http://localhost:3000`, idêntico ao comportamento anterior.

### Warning conhecido (tratar na Fase 4)

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

O Next 16 está depreciando `middleware.ts` em favor de `proxy.ts`. Sem impacto imediato; renomear `apps/web/src/middleware.ts` → `apps/web/src/proxy.ts` na Fase 4 quando estivermos reescrevendo a camada de auth.

---

## ✅ Fase 2 — Esqueleto do NestJS em `apps/api` (CONCLUÍDA)

### O que foi feito

- `apps/api/` criado via `npx -y @nestjs/cli@latest new api --package-manager pnpm --skip-git --skip-install` (o `pnpm dlx` quebrou no Windows com `'cli' não é reconhecido…`).
- `pnpm install` da raiz integrou ao workspace. Foi necessário aprovar o postinstall script de `@nestjs/core` no `pnpm-workspace.yaml`:
  ```yaml
  allowBuilds:
    sharp: true
    unrs-resolver: true
    '@nestjs/core': true
  ```
  Sem isso, qualquer `pnpm --filter api …` dispara um auto-install que falha com `ERR_PNPM_IGNORED_BUILDS`.
- `apps/api/src/main.ts` reescrito: CORS via `WEB_ORIGIN` (default `http://localhost:3000`) com `credentials: true`, `setGlobalPrefix('api')`, `listen(process.env.PORT ?? 3001)`, log de boot.
- `apps/api/src/app.module.ts` enxuto: só importa `HealthModule`. Removidos `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts` do scaffold.
- `apps/api/src/modules/health/{health.module.ts, health.controller.ts}` criados — `GET /api/health` retorna `{ ok: true, ts: ISO }`.
- `apps/api/package.json` ganhou um alias `"dev": "nest start --watch"` (pra simetria com `web`, pra `pnpm dev:all` funcionar).
- `apps/web/src/lib/api-client.ts` criado: `apiFetch<T>(path, init)` aponta pra `${NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api${path}`, com `credentials: "include"`, parsing seguro de JSON e classe `ApiError`.
- `apps/web/.env.example` ganhou `NEXT_PUBLIC_API_URL=http://localhost:3001`.
- `apps/web/src/app/test/page.tsx` (client component) chama `apiFetch("/health")` e renderiza o JSON.
- `apps/web/src/lib/supabase/middleware.ts` — early-return em `/test` **antes** de instanciar o `createServerClient` (smoke-test funciona sem `.env.local`). **Remover esse bloco quando a Fase 4 reescrever auth.**
- `package.json` raiz ganhou:
  ```json
  "dev:api": "pnpm --filter api start:dev",
  "dev:all": "pnpm -r --parallel --filter=./apps/* run dev",
  "build:api": "pnpm --filter api build"
  ```

### Desvios conscientes do plano original

- **`cookie-parser` não foi instalado.** A decisão de arquitetura #2 já travou que o Nest nunca lê cookies (só `Authorization: Bearer`). Instalar seria dead code.
- **Nome da página é `/test` (não `/_test`).** Pastas com prefixo `_` no App Router são "private folders" — o Next ignora e a rota nem existe.

### Validações executadas

- `curl http://localhost:3001/api/health` → `200 {"ok":true,"ts":"…"}` ✅
- Preflight `OPTIONS` com `Origin: http://localhost:3000` → `204` com `Access-Control-Allow-Origin: http://localhost:3000` e `Access-Control-Allow-Credentials: true` ✅
- Smoke-test no browser em `http://localhost:3000/test` → JSON renderizado em verde ✅

### Como rodar agora

```powershell
pnpm dev:all        # Next em 3000 + Nest em 3001 em paralelo
# ou em terminais separados:
pnpm dev            # só Next
pnpm dev:api        # só Nest
```

> Heads-up: se você tiver um `.env.local` em `apps/web/`, adicione `NEXT_PUBLIC_API_URL=http://localhost:3001`. Sem ele, o `api-client` cai no fallback `http://localhost:3001` — funciona em dev mas é melhor explicitar.

---

## ⏭️ Fase 2 — REFERÊNCIA HISTÓRICA — Esqueleto do NestJS em `apps/api`

### Objetivo

Provar que Next (porta 3000) consegue conversar com Nest (porta 3001). Sem auth ainda, sem migrar módulos — só infraestrutura.

### Passos

1. **Criar o projeto Nest:**
   ```powershell
   cd C:\Users\BERNARDO\Desktop\meugestor\apps
   pnpm dlx @nestjs/cli new api --package-manager pnpm --skip-git
   ```

2. **Trocar o `name` em `apps/api/package.json`** de `api` para algo escopado se quiser (sugestão: manter `api` mesmo). Adicionar `"port": 3001` em algum lugar acessível.

3. **Configurar `apps/api/src/main.ts`** com:
   - CORS liberando `http://localhost:3000` e `credentials: true`
   - `cookie-parser` (`pnpm add cookie-parser`)
   - `app.setGlobalPrefix('api')`
   - `app.listen(3001)`

4. **Criar `HealthModule`:**
   - `apps/api/src/modules/health/health.controller.ts` com `GET /health` retornando `{ ok: true, ts: new Date().toISOString() }`
   - Importar no `AppModule`

5. **No Next, criar `apps/web/src/lib/api-client.ts`:**
   ```ts
   const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

   export async function apiFetch<T = unknown>(
     path: string,
     init: RequestInit = {}
   ): Promise<T> {
     const res = await fetch(`${BASE}/api${path}`, {
       ...init,
       credentials: "include",
       headers: { "Content-Type": "application/json", ...init.headers },
     });
     if (!res.ok) throw new Error((await res.json())?.error || `HTTP ${res.status}`);
     return res.json();
   }
   ```

6. **Adicionar em `apps/web/.env.local`:**
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

7. **Adicionar scripts à raiz `package.json`:**
   ```json
   "dev:api": "pnpm --filter api start:dev",
   "dev:all": "pnpm --parallel --filter=\"web\" --filter=\"api\" run dev"
   ```
   (Pra rodar Next e Nest juntos com um único comando.)

8. **Teste de fogo:** criar uma página `apps/web/src/app/_test/page.tsx` que faça `apiFetch("/health")` e exiba o resultado. Se aparecer `{ ok: true, ts: "..." }` no navegador, os dois apps estão se comunicando.

### Checkpoint da Fase 2

Quando funcionar:
- `pnpm dev` sobe o Next em 3000
- `pnpm dev:api` sobe o Nest em 3001
- Página `/test` no Next mostra resposta do Nest
- CORS configurado corretamente (sem erro no console do browser)

---

## ✅ Fase 3 — Auth Guard global no Nest (CONCLUÍDA)

### Decisão travada

- **Validação simples por roundtrip**, sem Passport/passport-jwt. O Guard chama `supabase.auth.getUser(token)` a cada request autenticado. Adiciona ~30-50ms de latência por request, em troca de zero deps extras e código mínimo. Migrar pra validação local com JWKS é trivial depois se virar gargalo.

### Estrutura criada

```
apps/api/src/
├── common/
│   ├── supabase/
│   │   ├── supabase.module.ts        (Global)
│   │   └── supabase.service.ts       (service(), asUser(jwt), getUserFromToken(jwt))
│   ├── org/
│   │   ├── org.module.ts             (Global)
│   │   ├── org.service.ts            (resolveSession, requireAgency, requireClient, createOrganization, clientCanAccessAdAccount)
│   │   └── types.ts                  (AgencySession, ClientSession, Session, OnboardingPending, AuthUser)
│   ├── auth/
│   │   ├── public.decorator.ts       (@Public())
│   │   ├── current-user.decorator.ts (@CurrentUser())
│   │   ├── current-session.decorator.ts (@CurrentSession())
│   │   └── supabase-auth.guard.ts    (registrado como APP_GUARD global)
│   └── exceptions/
│       ├── http-error.ts             (class HttpError extends Error)
│       └── http-exception.filter.ts  (registrado como APP_FILTER global)
└── modules/
    ├── health/
    │   └── health.controller.ts       (marcado com @Public())
    └── _dev/
        ├── dev.module.ts              (carregado SÓ se NODE_ENV !== 'production')
        └── whoami.controller.ts       (GET /api/whoami → { user, session })
```

### Deps adicionadas

```
pnpm --filter api add @supabase/supabase-js @nestjs/config
```

### Envs do Nest

`apps/api/.env` (gitignored) — espelha o que o `apps/web/.env.local` já tem, mas com nomes sem prefixo `NEXT_PUBLIC_`:

```
PORT=3001
WEB_ORIGIN=http://localhost:3000
NODE_ENV=development
SUPABASE_URL=...
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

Documentado em `apps/api/.env.example`. `ConfigModule.forRoot({ isGlobal: true })` carrega no boot.

### Comportamento do Guard

1. Extrai `Authorization: Bearer <token>` do header.
2. Se há token: chama `supabase.auth.getUser(token)`. Se válido, anexa `req.user`, `req.session` (via `OrgService.resolveSession`), `req.token`.
3. Se a rota é `@Public()`: passa direto (com ou sem user).
4. Caso contrário: exige `req.user` ou joga `HttpError(401)`.

`HttpExceptionFilter` global converte `HttpError`, `HttpException` do Nest, e erros desconhecidos em `{ error: string }` com status correto.

### `apiFetch` atualizado

`apps/web/src/lib/api-client.ts` agora anexa `Authorization: Bearer <access_token>` automaticamente em chamadas client-side, lendo de `supabase.auth.getSession()`. SSR/Server Components não anexam (não tem acesso ao session cookie do browser).

### Endpoint smoke-test (`/api/whoami`)

- Só é registrado se `process.env.NODE_ENV !== 'production'`. Em prod, `DevModule` nem é importado, controller não existe.
- Sem `@Public()`, então exige autenticação.
- Retorna `{ user, session }` — útil pra debug.

### Validações executadas (curl)

| Caso | Esperado | Real |
|---|---|---|
| `GET /api/health` sem token | 200 + `{ok, ts}` | ✅ 200 |
| `GET /api/whoami` sem token | 401 + `{error}` | ✅ 401 `{"error":"Não autenticado"}` |
| `GET /api/whoami` com token inválido | 401 + `{error}` | ✅ 401 `{"error":"Não autenticado"}` |

### Validação no browser (logado)

Confirmada na sessão 2: `/test` exibe os dois blocos verdes — `/health` `{ok, ts}` e `/whoami` `{user, session}`.

---

## ⏳ Fases 4 a 6 — Resumo rápido

### Fase 4 — Módulo `org` (✅)

- Deps adicionada: `zod` no `apps/api`.
- `apps/api/src/common/pipes/zod-validation.pipe.ts` — pipe reusável que joga `HttpError(400, msg)` quando o body falha no schema. ⚠️ Zod **v4** mudou `result.error.errors` pra `result.error.issues` — descoberto no primeiro build.
- `apps/api/src/modules/organization/` com `OrganizationController` (`/api/org` GET/POST/PATCH), schemas em `dto.ts`. Reusa `OrgService.requireAgency`, `OrgService.createOrganization` e `SupabaseService.service()`.
- `OrganizationModule` importado no `AppModule`.
- Páginas Next migradas pra `apiFetch("/org")`:
  - `apps/web/src/app/dashboard/page.tsx`
  - `apps/web/src/app/dashboard/settings/page.tsx` (GET + PATCH)
  - `apps/web/src/app/onboarding/page.tsx` (GET + POST)
- `apps/web/src/app/api/org/route.ts` **apagado**.
- Smoke-test server: 3/3 verdes (GET/POST/PATCH sem token → 401 com `{error}`).

### Fase 4 — Módulo `clients` (✅)

9 endpoints portados num único `ClientsController`:

- `GET /api/clients` — lista clientes da org com contagem de ad_accounts
- `POST /api/clients` — cria cliente (checa limite `max_clients` do plano → 402)
- `GET /api/clients/:id` — detalhe + ad_accounts atribuídas
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`
- `POST /api/clients/:id/accounts` — atribui ad_account (checa limite `max_ad_accounts` → 402)
- `PATCH /api/clients/:id/accounts` — muda permissions
- `DELETE /api/clients/:id/accounts?ad_account_id=…`
- `POST /api/clients/:id/invite` — gera link de convite (token random 24 bytes, 7d TTL)

Adicionados:
- `apps/api/src/modules/clients/clients.service.ts` — `ensureClientOfOrg(clientId, orgId)` que joga 404
- `apps/api/src/modules/clients/dto.ts` — schemas zod (Create, Patch, AssignAccount, PatchPermissions, Invite, Permissions com defaults)
- `apps/api/src/modules/clients/clients.controller.ts` — todos os 9 endpoints
- `apps/api/src/modules/clients/clients.module.ts`
- Importado no `AppModule`

Pages Next migradas (10 call sites):
- `dashboard/page.tsx` (1: list)
- `dashboard/clients/page.tsx` (2: list + create)
- `dashboard/clients/[id]/page.tsx` (7: detail GET, PATCH, DELETE, accounts POST/PATCH/DELETE, invite POST)

Handlers Next apagados: `apps/web/src/app/api/clients/**` (4 arquivos + diretórios).

Smoke-test server: 9/9 endpoints retornam 401 sem token ✅. Validação positiva fica pro browser logado.

### Fase 4 — Módulos `invites` + `portal/me` (✅)

**Decisão de ordem:** `accounts` e `portal/insights` foram adiados pro final da Fase 4 porque ambos consomem `lib/meta/*` (loadMetaToken, getAllAdAccounts, getAccountInsights). Faz mais sentido portar a infra Meta inteira de uma vez e plugar esses dois junto, do que portar metade de `lib/meta/*` em dois passes.

**InvitesModule** (`apps/api/src/modules/invites/`):

- `GET /api/invite/:token` — **público** via `@Public()`. Retorna `{email, client_name, org_name, org_logo_url, org_primary_color}`. Joga 404/410 conforme estado do convite.
- `POST /api/invite/:token` — exige user autenticado (qualquer user — não precisa ser agency ou client). Verifica email do user contra `invitation.email` (anti-roubo de convite), associa `clients.auth_user_id`, atualiza profile com `role='client' + client_id`, marca `invitation.accepted_at`. Retorna `{ ok: true, redirect: '/portal' }`.

**PortalModule** (`apps/api/src/modules/portal/`):

- `GET /api/portal/me` — `requireClient`. Retorna `{client, agency, accounts}` pro portal montar header e lista.

Pages Next migradas:
- `apps/web/src/app/portal/page.tsx` — `apiFetch("/portal/me")`
- `apps/web/src/app/invite/[token]/page.tsx` — `apiFetch("/invite/:token")` GET + POST

Handlers Next apagados:
- `apps/web/src/app/api/invite/[token]/route.ts`
- `apps/web/src/app/api/portal/me/route.ts`

(`apps/web/src/app/api/portal/insights/route.ts` e `apps/web/src/app/api/accounts/route.ts` continuam no Next até o módulo `meta` ser portado.)

Smoke-test server:
- `GET /api/invite/no-such-token` → `404 {"error":"Convite inválido"}` ✅
- `POST /api/invite/x` sem token → 401 ✅
- `GET /api/portal/me` sem token → 401 ✅

### Fase 4 — Próximos módulos (⏳ — vão sair juntos no próximo sprint)

Tudo o que falta da Fase 4 depende de portar `apps/web/src/lib/meta/*` pro Nest:

- `apps/web/src/lib/meta/store.ts` → `MetaStoreService` (carrega/salva token Meta cifrado)
- `apps/web/src/lib/meta/api.ts` → `MetaApiService` (chamadas raw da Graph API)
- `apps/web/src/lib/meta/insights.ts` → reuso direto, sem novo serviço
- `apps/web/src/lib/meta/oauth.ts` → helpers de OAuth (state cifrado, exchange)
- `apps/web/src/lib/crypto.ts` → `CryptoService` (AES-256 com ENCRYPTION_KEY)

Endpoints a portar em sequência depois disso:
- `GET /api/accounts` — lista master de ad accounts da agência
- `GET /api/portal/insights` — KPIs + campanhas + ads (respeitando permissions)
- `GET/POST /api/meta/credentials` — App ID/Secret cifrados
- `GET /api/meta/status` — stage da conexão
- `POST /api/meta/disconnect`
- `GET /api/meta/connect` — redirect OAuth (fica no Next? ou no Nest?)
- `GET /api/meta/callback` — **fica no Next**, decisão arq #3 do MIGRATION.md (URI cravada no Meta App)
1. `org` — `/api/org` (GET, POST, PATCH)
2. `clients` — `/api/clients`, `/api/clients/:id`, `/api/clients/:id/accounts`, `/api/clients/:id/invite`
3. `accounts` — `/api/accounts`
4. `invites` — `/api/invite/:token` (GET público, POST autenticado)
5. `portal` — `/api/portal/me`, `/api/portal/insights`
6. `meta` — `credentials`, `status`, `disconnect`, `connect`, `callback` (callback fica no Next, só repassa pro Nest)

Para cada módulo:
- Criar `<modulo>.module.ts`, `<modulo>.controller.ts`, `<modulo>.service.ts` no Nest
- Mover a lógica de `apps/web/src/app/api/<modulo>/` e os helpers de `apps/web/src/lib/` correspondentes
- Validação com `nestjs-zod` ou `ZodValidationPipe`
- Atualizar a página/componente do Next pra consumir via `apiFetch`
- **Apagar a route handler antiga** só depois que o consumo novo estiver funcionando

Também aqui: renomear `apps/web/src/middleware.ts` → `proxy.ts` (resolve o warning do Next 16).

### Fase 5 — Design System + UI/UX (pode rodar em paralelo com Fase 4)
- `pnpm dlx shadcn@latest init` em `apps/web`
- Tokens de design em `apps/web/src/app/globals.css` via `@theme` do Tailwind 4
- Substituir `btn-primary`/`btn-secondary` (CSS global atual) por `<Button variant="primary" />` do shadcn
- Criar `<AppShell>` (sidebar + topbar) que envolve `/dashboard` e `/portal` — hoje cada página re-implementa header
- Padronizar `<EmptyState>`, `<LoadingState>`, `<ErrorState>` (hoje cada página tem inline)
- Trocar `<ul>` + `divide-y` por `<Table>` do shadcn nas listas de clients/accounts
- Tipografia: `pnpm add geist` e aplicar `GeistSans` no `layout.tsx`

### Fase 6 — Tipos compartilhados
- Criar `packages/shared/package.json` com `"name": "@meugestor/shared"`
- Mover schemas Zod (ex: `CreateBody` em `apps/web/src/app/api/clients/route.ts:44`) para `packages/shared/schemas/`
- Importar nos dois apps via `"@meugestor/shared": "workspace:*"`

---

## 🔐 Pontos sensíveis — não esquecer

1. **`ENCRYPTION_KEY`** (em `.env.local`, quando você criar) é o que cifra os App Secrets e tokens Meta de todas as agências. **NUNCA** mude essa chave depois de ter dados em produção, senão tudo se torna ilegível. Em prod, guarde num gerenciador de segredos.

2. **`SUPABASE_SERVICE_ROLE_KEY`** bypassa RLS. Hoje todas as rotas usam ele depois de validar a sessão. Quando migrar pro Nest, **essa validação tem que continuar sendo feita ANTES de qualquer query com service_role**. O `SupabaseAuthGuard` global da Fase 3 garante isso.

3. **CORS no Nest:** deve liberar SOMENTE `http://localhost:3000` em dev e o domínio do Vercel em prod. NUNCA `*`.

4. **Cookie do Supabase Auth** continua sendo gerenciado exclusivamente pelo Next (via `@supabase/ssr`). O Nest **nunca** lê cookies — só o header `Authorization`.

---

## 📋 Checklist de retomada (quando abrir nova sessão)

Ao iniciar uma sessão nova do Claude Code, **cole esta mensagem inicial**:

> Continuação da migração do meugestor. Leia o arquivo `MIGRATION.md` da raiz do projeto antes de qualquer coisa — ele tem o contexto completo. Fases 0 e 1 estão concluídas. Próximo passo é a Fase 2 (esqueleto do NestJS em `apps/api`). Antes de executar, faça uma análise rápida do estado atual para confirmar que nada mudou desde o último commit.

E confirme antes que:
- [ ] Você está com o terminal **dentro de** `C:\Users\BERNARDO\Desktop\meugestor` quando rodar `claude` (evita o problema do cwd ficar travado em outra pasta).
- [ ] A branch ativa é `feat/split-architecture` (`git branch --show-current`).
- [ ] `pnpm dev` da raiz ainda sobe o Next normalmente.

---

## 📝 Histórico de sessões

### Sessão 1 — 31/05/2026
- Cloned repo de `https://github.com/hvgtecnologia/meugestor`
- Análise completa do código (Next.js 16, App Router, Supabase, Meta API, Tailwind 4)
- Decisões de arquitetura travadas (pnpm, Bearer token, callback Meta no Next)
- Fase 0 concluída
- Fase 1 concluída
- **Parada:** antes de iniciar a Fase 2, porque o cwd da sessão estava travado em `MarIA` (problema de launch do Claude Code) e usuário quis reabrir limpo.

### Sessão 2 — 31/05/2026
- Fase 2 executada de ponta a ponta.
- Tropeços: (1) `pnpm dlx @nestjs/cli new` falhou no Windows; troquei pra `npx -y @nestjs/cli@latest new … --skip-install`. (2) `@nestjs/core` precisava ser aprovado em `allowBuilds` pra `pnpm --filter api` não disparar erro de auto-install. (3) `next dev` órfão de sessão anterior segurando porta 3000 + lock — matei 5 PIDs e limpei. (4) Middleware do Next instanciava `createServerClient` antes de checar o path → quebrava sem `.env.local`; resolvi com early-return em `/test` antes do Supabase.
- Desvios conscientes: pulei `cookie-parser` (decisão arq #2 já trava que o Nest não lê cookies), e a rota de teste virou `/test` em vez de `/_test` (private folder do App Router).
- `.env.local` criado em `apps/web/` com URL Supabase, chaves no **novo formato** `sb_publishable_*`/`sb_secret_*` (substituem as antigas JWT, suportadas transparentemente pelo SDK), `ENCRYPTION_KEY` gerada local (32 bytes base64) e `NEXT_PUBLIC_API_URL`.
- ⚠️ **Pendência de segurança**: a `sb_secret_*` foi colada no chat — usuário precisa rotacionar no dashboard Supabase quando puder, e atualizar `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`.
- Validações: `curl /api/health` 200, CORS preflight 204, smoke-test no browser em `/test` retornou `{ok, ts}` em verde.
- Fase 2 fechada com smoke-test no browser (`/test` renderizou `{ok:true,ts:...}` em verde).
- Fase 3 executada em sequência: SupabaseService + OrgService + SupabaseAuthGuard (Bearer + `supabase.auth.getUser`) + decorators (`@Public`, `@CurrentUser`, `@CurrentSession`) + HttpExceptionFilter global + WhoamiController (dev-only).
- Tropeço Fase 3: `isolatedModules + emitDecoratorMetadata` exigiu `import type` em parâmetros decorados (TS1272 no whoami.controller).
- `apiFetch` no Next agora anexa Bearer automaticamente lendo `supabase.auth.getSession()`.
- Página `/test` ampliada pra testar `/health` (público) + `/whoami` (autenticado) lado a lado.
- Validações via curl: 3/3 verdes (200 público, 401 sem token, 401 token inválido).
- Smoke-test logado validado no browser (`/test` mostrou os dois blocos verdes).
- **Parada:** Fase 3 fechada de verdade. Estado git: nada commitado — Fases 1, 2 e 3 inteiras estão staged. Próximo passo é Fase 4 (migrar módulo `org` primeiro).
