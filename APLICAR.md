# Newgestor — Como aplicar o remodel SaaS multi-tenant

Este documento mostra **exatamente o que você precisa fazer** pra colocar o Newgestor remodelado no ar como SaaS revendido pra agências e gestores de tráfego.

---

## 🧠 O que mudou (visão geral)

| Antes | Agora |
|---|---|
| 1 usuário = 1 Meta App | **Organização** (agência) = 1 Meta App; vários membros podem operar a org no futuro |
| Sem hierarquia | **Agência → Clientes**. Agência atribui contas Meta e permissões aos clientes. |
| Sem portal pro cliente final | **/portal** — cliente loga, vê só as ad accounts liberadas e suas permissões granulares |
| Meta App em env do Vercel | Meta App cadastrado **dentro da plataforma** (cifrado AES-256, por org). Vercel só hospeda. |
| Sem convites | Link de convite (`/invite/<token>`) com expiração de 7 dias |
| Sem limites de plano | Plano free/starter/pro/agency aplica limite de clientes e contas Meta |

Hierarquia de dados:

```
organizations  (a agência/gestor — tenant raiz)
  ├── organization_members   (auth.users que operam a org)
  ├── meta_credentials       (App ID + Secret cifrado, único por org)
  ├── meta_tokens            (long-lived token Facebook, único por org)
  ├── clients                (clientes da agência)
  │     ├── client_ad_accounts   (quais ad accounts cada cliente vê + permissions)
  │     └── client_invitations   (link de convite p/ acessar o portal)
  └── account_cache          (cache opcional de metadados Meta)
```

Papéis (resolvidos a partir de `profiles.role` e `organization_members.role`):

- **owner** — criou a org, controla billing, edita Meta App.
- **manager** — futuro role multi-equipe na mesma agência (estrutura pronta, UI ainda só pra owner).
- **client** — só vê o portal, e só as contas liberadas. Não tem org própria.

---

## ✅ Passo 1 — Supabase

### 1.1 Crie o projeto

Em https://supabase.com/dashboard → New Project → escolha região (preferir `sa-east-1` se quiser baixa latência no BR).

### 1.2 Rode a migration

Abra **SQL Editor → New query**, cole o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) **inteiro** e clique Run.

> ⚠️ Se você já rodou a versão antiga do `0001_init.sql` (que tinha `meta_credentials.user_id`), antes de rodar o novo execute:
> ```sql
> drop table if exists public.meta_tokens, public.meta_credentials, public.account_cache, public.profiles cascade;
> ```
> Não há dado de produção pra perder ainda.

Verifique no **Database → Tables** que existem:
`organizations`, `organization_members`, `profiles`, `meta_credentials`, `meta_tokens`, `clients`, `client_ad_accounts`, `client_invitations`, `account_cache`.

### 1.3 Habilite Google OAuth (opcional, mas recomendado pros gestores)

**Authentication → Providers → Google**:
1. Crie um OAuth Client no Google Cloud Console (`https://console.cloud.google.com/apis/credentials`).
2. Tipo: Web. Redirect URI: `https://<seu-project>.supabase.co/auth/v1/callback`.
3. Cole Client ID + Secret no Supabase. Salvar.

### 1.4 Pegue as chaves

**Project Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← **NUNCA exponha no client**, só nas envs do Vercel

### 1.5 Configure URLs de redirecionamento

**Authentication → URL Configuration → Redirect URLs**, adicione:
- `http://localhost:3000/auth/callback`
- `https://SEU-DOMINIO/auth/callback` (após deploy)

---

## ✅ Passo 2 — Variáveis de ambiente

Local:
```bash
cp .env.example .env.local
```

Edite `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
ENCRYPTION_KEY=<gere>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Gere a `ENCRYPTION_KEY` (32 bytes em base64):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> 🚨 **Não perca essa chave.** É ela que cifra os App Secrets e tokens Meta de TODOS os seus clientes-agência. Se trocar, todos precisam reconfigurar. Guarde num gerenciador (1Password, Bitwarden, etc).

**O Meta App da plataforma NÃO vai mais em env vars.** Cada agência cadastra o próprio direto na UI (`/onboarding`). Não há mais `META_APP_ID` ou `META_APP_SECRET` na Vercel.

---

## ✅ Passo 3 — Rodar local

```bash
npm install
npm run dev
```

Acesse http://localhost:3000.

Fluxo de teste end-to-end:

1. **Como agência** — `/login` → crie conta → cai em `/onboarding`:
   - Passo 1: nome da agência (ex.: "Tráfego Premium")
   - Passos 2–5: cria Meta App, cola App ID + Secret, autoriza Facebook
2. Vai pro `/dashboard`. Crie um cliente em `/dashboard/clients`.
3. Abra o cliente → **Atribuir conta** → escolha uma ad account das suas → marque as permissões (ver campanhas, insights, etc.)
4. Clique em **Convidar pro portal** → digite email do cliente → **Gerar link** → copie.
5. **Em janela anônima**, cole o link `/invite/<token>` → cria conta com o email → cai em `/portal` → vê só as contas que você liberou.

---

## ✅ Passo 4 — Deploy no Vercel

1. `git push` para um repo (GitHub/GitLab).
2. https://vercel.com → New Project → Import.
3. **Environment Variables** (em Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ← Production only se quiser ser extra seguro
   - `ENCRYPTION_KEY`
   - `NEXT_PUBLIC_APP_URL` ← URL pública final (ex: `https://newgestor.com`)
4. Deploy.
5. Volte no Supabase → **Authentication → URL Configuration → Redirect URLs** → adicione `https://newgestor.com/auth/callback`.

---

## ✅ Passo 5 — Onboarding do primeiro gestor (você)

Acesse a URL pública. Crie sua conta. No `/onboarding`:

1. **Crie a "agência"** (mesmo que você seja solo, isso é o seu tenant raiz).
2. Em `developers.facebook.com`, crie um Meta App tipo "Empresa" com:
   - Produto **Marketing API** (adicionar)
   - Produto **Login com Facebook** (adicionar) → em Configurações → **OAuth Redirect URIs**, cole `https://newgestor.com/api/meta/callback`
3. Pegue **App ID** + **App Secret** (Configurações → Básico).
4. Volte na nossa UI → cola App ID + Secret → "Salvar".
5. Clique "Conectar com Facebook" → autoriza → volta logado e com token cifrado salvo.

---

## ✅ Passo 6 — Revender pra outras agências

Quando uma agência se cadastra:

1. Ela cria a conta em `/login` → `/onboarding`.
2. **Ela** cria o Meta App dela (tem instruções passo a passo no onboarding).
3. **Ela** cola App ID + Secret próprios. **Nunca compartilhe o seu.**

Cada agência fica isolada das outras por RLS (Row Level Security) + criptografia AES-256 do App Secret.

**Limites por plano** (configurado em `0001_init.sql`, função `apply_plan_limits`):

| Plano | Clientes | Ad accounts |
|---|---|---|
| free | 1 | 3 |
| starter | 5 | 25 |
| pro | 25 | 100 |
| agency | 999 | 9999 |

Pra mudar o plano de uma agência manualmente (até integrar Stripe):
```sql
update organizations set plan = 'pro' where slug = 'agencia-x';
```
(O trigger `orgs_plan_limits` ajusta `max_clients`/`max_ad_accounts` automaticamente.)

---

## ✅ Passo 7 — Próximos passos (roadmap)

- [ ] **Stripe / pagamento** — paywall pra upgrade de plano. Webhook atualiza `organizations.plan`.
- [ ] **Cron renovar token** — Supabase Edge Function (ou Vercel Cron) que toda noite pega tokens com `expires_at < now + 14d` e renova via Marketing API.
- [ ] **Email de convite** — hoje o link é gerado e a agência envia manualmente (WhatsApp/email). Integrar Resend pra mandar automático.
- [ ] **Multi-membro por org** — UI pra owner convidar managers da equipe (o schema `organization_members` já suporta).
- [ ] **Custom domain por org** — `agenciax.newgestor.com.br` pra cada cliente final (Vercel Domains API).
- [ ] **Dashboard mais rico** — KPIs comparativos, breakdowns, anúncios ativos compartilháveis, export CSV/JSON pra IA.
- [ ] **Audit log** — `audit_log` table registrando ações sensíveis (mudança de plano, atribuição/remoção de conta, convite aceito).

---

## 🔐 Modelo de segurança

- **Service role só no server.** Todas as rotas que tocam `meta_credentials`/`meta_tokens` usam `requireAgency()` ou `requireClient()` antes de consultar.
- **RLS em todas as tabelas.** Mesmo se um bug vazasse o anon key, ainda assim o usuário só veria os próprios registros.
- **AES-256-GCM** pro App Secret e access tokens (ver `src/lib/crypto.ts`). IV + auth tag concatenados no payload base64.
- **CSRF** no OAuth dance via cookie `meta_oauth_state` (nonce httpOnly, 10min).
- **Convites** só são aceitos se o email do user logado bate exatamente com o email do convite (impede roubo de link).
- **Permissões granulares** no `client_ad_accounts.permissions` (jsonb) — `view_campaigns`, `view_insights`, `view_creatives`, `view_budget`, `view_audiences`.

---

## 📁 O que tem no projeto agora

```
src/
  app/
    api/
      auth/callback/        Supabase OAuth + roteamento por papel
      meta/
        credentials/        salva/lê App ID + Secret cifrado (POR ORG)
        connect/            inicia OAuth dance
        callback/           recebe ?code= → long-lived token
        status/             estado da conexão
        disconnect/         apaga token
      accounts/             lista todas ad accounts visíveis (lista mestra agência)
      org/                  GET/POST/PATCH organização
      clients/              GET/POST clientes da org
      clients/[id]/         GET/PATCH/DELETE detalhe
      clients/[id]/accounts/        atribuir/desatribuir/mudar permissions de ad account
      clients/[id]/invite/  gerar link de convite
      invite/[token]/       GET info + POST aceite
      portal/me/            cliente: dados próprios + contas liberadas
      portal/insights/      cliente: KPIs/campanhas/criativos (respeita permissions)
    dashboard/              agência: dashboard, clientes, settings
    portal/                 cliente: portal e detalhe de conta
    onboarding/             5 passos (org + Meta App + OAuth)
    invite/[token]/         aceitar convite (signup/login + accept)
    login/
  lib/
    crypto.ts               AES-256-GCM
    org.ts                  resolveSession, requireAgency/Client, createOrganization
    supabase/               browser/server/middleware clients
    meta/
      api.ts                Graph wrapper com retry
      insights.ts           helpers de leitura (campaigns, insights, ads)
      oauth.ts              URLs OAuth + scopes
      store.ts              load/save creds + tokens (POR ORG)
  middleware.ts             route guard (login obrigatório fora de rotas públicas)
supabase/migrations/0001_init.sql   schema SaaS completo + RLS + helpers + triggers
```

---

## 🆘 Troubleshooting

**"Onboarding pendente" infinito** → seu user não tem entry em `organization_members`. Vá em `/onboarding` e crie a org.

**"Você já pertence a uma organização" no /api/org POST** → você não pode criar 2 orgs com o mesmo user. Pra trocar de org no futuro, use o seletor (a construir).

**OAuth do FB retorna "URL not whitelisted"** → falta cadastrar `https://seu-dominio/api/meta/callback` no Meta App → Login com Facebook → Configurações → OAuth Redirect URIs.

**Cliente vê "Sem acesso a essa conta" no portal** → você não atribuiu a ad account em `/dashboard/clients/[id]`. Ou atribuiu, mas a permission `view_insights` está `false`.

**Token expira em 60 dias** → por enquanto, o gestor recebe alerta no dashboard e clica "Renovar token". Roadmap: cron noturno.
