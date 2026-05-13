# Newgestor

SaaS multi-tenant de gestão Meta Ads para agências e gestores de tráfego. Cada usuário cria seu Meta App, conecta sua conta via OAuth e gerencia suas próprias contas de cliente — tudo isolado por user via Supabase RLS.

## Stack

- **Next.js 16** (App Router, RSC)
- **Supabase** — Auth (Google OAuth + email/senha) + Postgres + Row Level Security
- **Tailwind 4** — estilos
- **Meta Marketing API v22.0** — todos os dados de anúncios
- **AES-256-GCM** — App Secret e access token cifrados em repouso

## Arquitetura (por que assim)

- **Per-user Meta App:** cada gestor cria seu próprio app no developers.facebook.com. A gente nunca centraliza tokens — se eu vazar minha chave mestra, não comprometo ninguém. Cada um tem seus dados.
- **OAuth dance no servidor:** o usuário cola App ID + Secret na nossa interface uma vez. A gente faz o `dialog/oauth` → `code` → short-lived token → **long-lived token (~60 dias)** automático.
- **RLS no Supabase:** todas as tabelas têm policies `auth.uid() = user_id`. O service_role só é usado em rotas server pra cifrar/decifrar tokens — nunca passa pelo client.

## Setup local

### 1. Supabase

1. Crie um projeto em https://supabase.com/dashboard.
2. **SQL Editor → New query** → cole `supabase/migrations/0001_init.sql` → Run.
3. **Authentication → Providers** → habilite **Google** e siga as instruções (precisa criar OAuth client no Google Cloud e configurar redirect `https://<seu-project>.supabase.co/auth/v1/callback`).
4. **Project Settings → API** → copie:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (mantenha em segredo!)

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
# preencha com os valores do Supabase + gere ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:3000.

## Setup do usuário (fluxo final do gestor)

1. Acessa /, clica "Começar grátis".
2. Login com Google (ou email/senha).
3. Vai pro **/onboarding** — 4 passos guiados:
   - Passo 1: clica "Criar App" → abre developers.facebook.com em nova aba com instruções de tipo "Empresa" + produto "Marketing API".
   - Passo 2: copia App ID e App Secret (a gente mostra qual menu).
   - Passo 3: cola no formulário aqui. App Secret é cifrado AES-256 antes de salvar.
   - Passo 4: clica "Conectar com Facebook". Vai pro OAuth do FB, autoriza scopes (`ads_read`, `ads_management`, `business_management`, `read_insights`), volta no callback. A gente automaticamente:
     - troca code por short-lived token
     - troca short por **long-lived (~60 dias)**
     - busca /me pra saber quem autorizou
     - salva tudo cifrado em `meta_tokens`
4. Pronto — dashboard mostra todas as contas de anúncio acessíveis.

## Deploy no Vercel

1. `git push` para um repo.
2. Vercel → New Project → import.
3. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_KEY`
   - `NEXT_PUBLIC_APP_URL` — URL pública (ex: `https://newgestor.vercel.app`)
4. Deploy.
5. No Supabase → Authentication → URL Configuration → adicione `https://newgestor.vercel.app/auth/callback` na **Redirect URLs**.

## Roadmap

- [x] Auth (Google + email)
- [x] Onboarding guiado p/ criar Meta App
- [x] OAuth dance com short→long token automático
- [x] Status da conexão + reconnect/disconnect
- [x] Listar contas de anúncio per-user
- [ ] Portar o dashboard completo de `meugestor` (KPIs, breakdowns, export, anúncios ativos)
- [ ] Cron diário pra renovar tokens antes de expirarem
- [ ] Stripe (paywall por plano)
- [ ] Convidar membros de equipe (multi-user por workspace)

## Estrutura

```
src/
  app/
    api/
      auth/callback/        Supabase OAuth callback
      meta/
        credentials/        POST/GET — salva/lê App ID + Secret cifrado
        connect/            Inicia OAuth dance com FB
        callback/           Recebe ?code= e troca por long-lived token
        status/             Estado atual (no_creds | no_token | connected | invalid)
        disconnect/         Apaga token salvo
      accounts/             Lista contas Meta usando token do user logado
    dashboard/              Tela principal
    login/                  Login com Google + email
    onboarding/             Wizard de 4 passos
  lib/
    crypto.ts               AES-256-GCM
    supabase/               browser/server/middleware clients
    meta/
      api.ts                Graph API wrapper (recebe accessToken como param)
      oauth.ts              URLs OAuth + scopes
      store.ts              load/save credentials e tokens cifrados
  middleware.ts             Route guard
supabase/migrations/        SQL
```
