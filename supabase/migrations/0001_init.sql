-- ─────────────────────────────────────────────────────────────────────
-- Newgestor — schema SaaS multi-tenant (agencias/gestores → clientes)
--
-- Hierarquia:
--   organizations (tenant raiz, ex: "Agência X" ou "Gestor Solo")
--     ├── organization_members (auth.users que operam a org — owner/manager)
--     ├── meta_credentials      (1 Meta App da org, App ID + Secret cifrado)
--     ├── meta_tokens           (long-lived token resultante do OAuth)
--     ├── clients               (os clientes da agência)
--     │     ├── client_ad_accounts (quais ad accounts cada cliente pode ver)
--     │     └── client_invitations (link convite p/ cliente acessar portal)
--     └── account_cache         (cache de metadados Meta)
--
-- Tudo isolado por RLS. Service role só é usado em rotas server pra
-- cifrar/decifrar tokens e operações administrativas.
-- ─────────────────────────────────────────────────────────────────────

-- ─── organizations ────────────────────────────────────────────────────
create table if not exists public.organizations (
    id              uuid primary key default gen_random_uuid(),
    slug            text not null unique,
    name            text not null,
    plan            text not null default 'free' check (plan in ('free','starter','pro','agency')),
    owner_user_id   uuid not null references auth.users(id) on delete restrict,
    logo_url        text,
    primary_color   text default '#7c3aed',
    -- limites do plano (cache pra UI; checagem real fica no server)
    max_clients     int  not null default 1,
    max_ad_accounts int  not null default 3,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ─── organization_members ─────────────────────────────────────────────
-- Quem pode operar a org (donos da agência + futuros membros de equipe).
create table if not exists public.organization_members (
    id          uuid primary key default gen_random_uuid(),
    org_id      uuid not null references public.organizations(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    role        text not null default 'manager' check (role in ('owner','manager')),
    created_at  timestamptz not null default now(),
    unique (org_id, user_id)
);

alter table public.organization_members enable row level security;

create index if not exists idx_org_members_user on public.organization_members (user_id);
create index if not exists idx_org_members_org  on public.organization_members (org_id);

-- ─── profiles ─────────────────────────────────────────────────────────
-- Espelho de auth.users. Carrega papel ativo na plataforma e org ativa.
--
-- role:
--   'agency'  → opera uma org (gestor/agência). Tem entry em organization_members.
--   'client'  → cliente de uma agência. Não tem org própria; vê só portal.
create table if not exists public.profiles (
    id              uuid primary key references auth.users(id) on delete cascade,
    email           text not null,
    full_name       text,
    avatar_url      text,
    role            text not null default 'agency' check (role in ('agency','client')),
    current_org_id  uuid references public.organizations(id) on delete set null,
    client_id       uuid,  -- preenchido se role='client' (FK adicionado depois)
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ─── meta_credentials ────────────────────────────────────────────────
-- App ID + Secret do Meta For Developers, configurados pela agência.
-- Cifrados AES-256-GCM no servidor antes de salvar. Um Meta App por org.
create table if not exists public.meta_credentials (
    id                   uuid primary key default gen_random_uuid(),
    org_id               uuid not null references public.organizations(id) on delete cascade,
    app_id               text not null,
    app_secret_encrypted text not null,
    app_name             text,
    redirect_uri         text not null,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    unique (org_id)
);

alter table public.meta_credentials enable row level security;

-- ─── meta_tokens ──────────────────────────────────────────────────────
-- Long-lived user token (~60 dias) resultante do OAuth da agência.
create table if not exists public.meta_tokens (
    id                     uuid primary key default gen_random_uuid(),
    org_id                 uuid not null references public.organizations(id) on delete cascade,
    access_token_encrypted text not null,
    fb_user_id             text,
    fb_user_name           text,
    scopes                 text[],
    expires_at             timestamptz,
    refreshed_at           timestamptz not null default now(),
    created_at             timestamptz not null default now(),
    unique (org_id)
);

alter table public.meta_tokens enable row level security;

-- ─── clients ──────────────────────────────────────────────────────────
-- Cliente da agência. Pode ter ou não login (portal_enabled + auth_user_id).
create table if not exists public.clients (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references public.organizations(id) on delete cascade,
    name            text not null,
    contact_email   text,
    contact_phone   text,
    company         text,
    status          text not null default 'active' check (status in ('active','paused','archived')),
    portal_enabled  boolean not null default false,
    auth_user_id    uuid references auth.users(id) on delete set null,
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (org_id, contact_email)
);

alter table public.clients enable row level security;

create index if not exists idx_clients_org      on public.clients (org_id);
create index if not exists idx_clients_authuser on public.clients (auth_user_id);

-- FK pendente: profiles.client_id → clients.id
do $$
begin
    if not exists (
        select 1 from information_schema.table_constraints
        where table_schema = 'public' and table_name = 'profiles'
          and constraint_name = 'profiles_client_id_fkey'
    ) then
        alter table public.profiles
            add constraint profiles_client_id_fkey
            foreign key (client_id) references public.clients(id) on delete set null;
    end if;
end$$;

-- ─── client_ad_accounts ──────────────────────────────────────────────
-- Vínculo cliente ↔ ad account Meta. Define o que o cliente vê no portal.
-- Permissions controla granularidade (ex: ver insights mas não criativos).
create table if not exists public.client_ad_accounts (
    id              uuid primary key default gen_random_uuid(),
    client_id       uuid not null references public.clients(id) on delete cascade,
    org_id          uuid not null references public.organizations(id) on delete cascade,
    ad_account_id   text not null,            -- ex: 'act_1234567890'
    ad_account_name text,
    currency        text,
    permissions     jsonb not null default '{
        "view_campaigns": true,
        "view_insights":  true,
        "view_creatives": true,
        "view_budget":    false,
        "view_audiences": false
    }'::jsonb,
    created_at      timestamptz not null default now(),
    unique (client_id, ad_account_id)
);

alter table public.client_ad_accounts enable row level security;

create index if not exists idx_caa_client on public.client_ad_accounts (client_id);
create index if not exists idx_caa_org    on public.client_ad_accounts (org_id);

-- ─── client_invitations ──────────────────────────────────────────────
-- Convite que a agência manda pro cliente acessar o portal.
-- Cliente clica no link, faz signup/login, e vira role='client'
-- com client_id apontando pro registro em `clients`.
create table if not exists public.client_invitations (
    id          uuid primary key default gen_random_uuid(),
    client_id   uuid not null references public.clients(id) on delete cascade,
    org_id      uuid not null references public.organizations(id) on delete cascade,
    token       text not null unique,
    email       text not null,
    expires_at  timestamptz not null,
    accepted_at timestamptz,
    created_by  uuid references auth.users(id) on delete set null,
    created_at  timestamptz not null default now()
);

alter table public.client_invitations enable row level security;

create index if not exists idx_invites_client on public.client_invitations (client_id);
create index if not exists idx_invites_token  on public.client_invitations (token);

-- ─── account_cache ────────────────────────────────────────────────────
create table if not exists public.account_cache (
    org_id         uuid not null references public.organizations(id) on delete cascade,
    account_id     text not null,
    name           text,
    currency       text,
    account_status int,
    business_name  text,
    last_synced    timestamptz not null default now(),
    primary key (org_id, account_id)
);

alter table public.account_cache enable row level security;

-- ─────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (security definer, security barrier)
-- Usadas dentro das policies pra evitar recursão e simplificar checks.
-- ─────────────────────────────────────────────────────────────────────

-- Retorna true se o user logado é membro da org.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.organization_members
        where org_id = p_org_id and user_id = auth.uid()
    );
$$;

-- Retorna true se o user logado é o owner da org.
create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.organization_members
        where org_id = p_org_id and user_id = auth.uid() and role = 'owner'
    );
$$;

-- Retorna o client_id do user logado, se for cliente.
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select c.id from public.clients c
    where c.auth_user_id = auth.uid()
    limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────

-- organizations
drop policy if exists "org_select_members"   on public.organizations;
drop policy if exists "org_update_owner"     on public.organizations;
drop policy if exists "org_insert_self"      on public.organizations;
drop policy if exists "org_delete_owner"     on public.organizations;
drop policy if exists "org_select_client"    on public.organizations;

create policy "org_select_members" on public.organizations
    for select using (public.is_org_member(id));

-- Cliente também enxerga só metadata pública da org (nome, logo, cor) — RLS aqui é tudo ou nada.
-- Em vez de policy separada, a UI do portal busca só campos seguros via API com service role checando perms.
create policy "org_insert_self" on public.organizations
    for insert with check (auth.uid() = owner_user_id);

create policy "org_update_owner" on public.organizations
    for update using (public.is_org_owner(id));

create policy "org_delete_owner" on public.organizations
    for delete using (public.is_org_owner(id));

-- organization_members
drop policy if exists "om_select_self_or_org" on public.organization_members;
drop policy if exists "om_insert_owner"       on public.organization_members;
drop policy if exists "om_delete_owner"       on public.organization_members;
drop policy if exists "om_insert_self_first"  on public.organization_members;

create policy "om_select_self_or_org" on public.organization_members
    for select using (user_id = auth.uid() or public.is_org_member(org_id));

-- Inserir o próprio user_id como owner é permitido (signup inicial cria entry).
create policy "om_insert_self_first" on public.organization_members
    for insert with check (user_id = auth.uid());

create policy "om_delete_owner" on public.organization_members
    for delete using (public.is_org_owner(org_id));

-- profiles
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_insert_self"  on public.profiles;

create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id);

-- meta_credentials, meta_tokens, account_cache → escopo da org
drop policy if exists "creds_org_all"    on public.meta_credentials;
drop policy if exists "tokens_org_all"   on public.meta_tokens;
drop policy if exists "cache_org_all"    on public.account_cache;

create policy "creds_org_all" on public.meta_credentials
    for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "tokens_org_all" on public.meta_tokens
    for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "cache_org_all" on public.account_cache
    for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- clients → agência vê os clientes da sua org; cliente vê só o próprio registro
drop policy if exists "clients_org_all"   on public.clients;
drop policy if exists "clients_self_read" on public.clients;

create policy "clients_org_all" on public.clients
    for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "clients_self_read" on public.clients
    for select using (auth_user_id = auth.uid());

-- client_ad_accounts → agência manage; cliente vê só os próprios
drop policy if exists "caa_org_all"     on public.client_ad_accounts;
drop policy if exists "caa_self_read"   on public.client_ad_accounts;

create policy "caa_org_all" on public.client_ad_accounts
    for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "caa_self_read" on public.client_ad_accounts
    for select using (client_id = public.current_client_id());

-- client_invitations → só agência mexe
drop policy if exists "invites_org_all" on public.client_invitations;

create policy "invites_org_all" on public.client_invitations
    for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ─────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────

-- Cria profile (role default 'agency') no signup.
-- O signup do CLIENTE faz update do profile pra role='client' via API depois.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name, avatar_url, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        new.raw_user_meta_data->>'avatar_url',
        'agency'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
    for each row execute function public.touch_updated_at();

drop trigger if exists orgs_touch on public.organizations;
create trigger orgs_touch before update on public.organizations
    for each row execute function public.touch_updated_at();

drop trigger if exists meta_creds_touch on public.meta_credentials;
create trigger meta_creds_touch before update on public.meta_credentials
    for each row execute function public.touch_updated_at();

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
    for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- DEFAULTS DE PLANO (limites). Edite aqui se quiser ajustar a pricing.
-- A app consulta organizations.{max_clients, max_ad_accounts} em runtime.
-- Trigger ajusta limites quando o plan muda.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.apply_plan_limits()
returns trigger language plpgsql as $$
begin
    case new.plan
        when 'free'    then new.max_clients :=   1; new.max_ad_accounts :=   3;
        when 'starter' then new.max_clients :=   5; new.max_ad_accounts :=  25;
        when 'pro'     then new.max_clients :=  25; new.max_ad_accounts := 100;
        when 'agency'  then new.max_clients := 999; new.max_ad_accounts := 9999;
        else null;
    end case;
    return new;
end;
$$;

drop trigger if exists orgs_plan_limits on public.organizations;
create trigger orgs_plan_limits
    before insert or update of plan on public.organizations
    for each row execute function public.apply_plan_limits();
