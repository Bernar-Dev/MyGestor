# Newgestor

**SaaS multi-tenant de gestão Meta Ads** pra revender para agências e gestores de tráfego.

Cada agência:
- cadastra o **próprio Meta App** dentro da plataforma (não em env do Vercel)
- conecta sua conta Meta via OAuth (tokens cifrados AES-256)
- adiciona seus **clientes** e atribui quais ad accounts cada um vê (com permissões granulares)
- envia link de convite pro cliente acessar o **portal** somente-leitura

→ Veja [`APLICAR.md`](APLICAR.md) para o passo-a-passo completo de aplicação e deploy.

## Stack

- **Next.js 16** (App Router, RSC)
- **Supabase** — Auth (Google OAuth + email) + Postgres + RLS
- **Tailwind 4**
- **Meta Marketing API v22.0**
- **AES-256-GCM** — App Secret e tokens cifrados

## Hierarquia

```
organizations  (agência/gestor — tenant raiz)
  ├── organization_members   (donos da agência)
  ├── meta_credentials       (Meta App próprio cifrado)
  ├── meta_tokens            (long-lived token Facebook)
  ├── clients                (clientes da agência)
  │     ├── client_ad_accounts   (ad accounts liberadas + permissions)
  │     └── client_invitations
  └── account_cache
```

## Papéis

- **owner** — controla a agência, configura Meta App, gerencia clientes
- **manager** *(futuro)* — opera a agência sem permissões de billing
- **client** — só vê o portal, escopado às ad accounts liberadas

## Quickstart

Veja [`APLICAR.md`](APLICAR.md) para detalhes. Resumo:

```bash
# 1. Supabase: crie projeto, rode supabase/migrations/0001_init.sql, pegue chaves
# 2. .env.local com SUPABASE_URL/KEYS + ENCRYPTION_KEY gerada
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Local
npm install
npm run dev

# 4. http://localhost:3000 → cria agência → cadastra Meta App → adiciona cliente → convida
```

## Estrutura

```
src/
  app/
    api/
      meta/              credentials, connect, callback, status, disconnect
      accounts/          lista mestra de ad accounts visíveis pela agência
      org/               CRUD da organização
      clients/           CRUD clientes + accounts/invite por id
      invite/[token]/    GET info + POST aceite
      portal/            me + insights (escopado por cliente)
    dashboard/           agência (home, clients/[id], settings)
    portal/              cliente (home, accounts/[id])
    onboarding/          5-passo wizard (org + Meta App)
    invite/[token]/      aceite de convite
    login/
  lib/
    crypto.ts            AES-256-GCM
    org.ts               resolveSession, requireAgency/Client
    meta/                api, insights, oauth, store (todas por org)
    supabase/            browser/server/middleware
  middleware.ts
supabase/migrations/0001_init.sql
APLICAR.md               ← instruções completas de aplicação
```

## Próximos passos (roadmap)

- [ ] Stripe (paywall por plano)
- [ ] Cron de renovação automática de token Meta
- [ ] Email automático de convite (Resend)
- [ ] Multi-membro por org (gestores da equipe)
- [ ] Custom domain por agência
- [ ] Dashboard rico (KPIs comparativos, breakdowns, export)
- [ ] Audit log
