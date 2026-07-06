-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0002 — Colaboradores e contas gerenciadas
-- Rodar no SQL Editor do Supabase (dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Coluna member_role em organization_members
--    Distingue donos/gestores (member_role IS NULL) de colaboradores convidados.
alter table public.organization_members
    add column if not exists member_role text
        check (member_role in ('gestor', 'observador'));

alter table public.organization_members
    add column if not exists invited_by uuid references auth.users(id) on delete set null;

-- 2. Coluna member em profiles.role (suporte a colaboradores)
alter table public.profiles
    drop constraint if exists profiles_role_check;
alter table public.profiles
    add constraint profiles_role_check
        check (role in ('agency', 'client', 'member'));

-- 3. Tabela de contas Meta gerenciadas pela agência
create table if not exists public.org_meta_accounts (
    id           uuid primary key default gen_random_uuid(),
    org_id       uuid not null references public.organizations(id) on delete cascade,
    account_id   text not null,
    account_name text,
    currency     text,
    added_at     timestamptz not null default now(),
    unique (org_id, account_id)
);

alter table public.org_meta_accounts enable row level security;

create policy "org_meta_accounts_org_members" on public.org_meta_accounts
    for all using (
        exists (
            select 1 from public.organization_members
            where org_id = org_meta_accounts.org_id
              and user_id = auth.uid()
        )
    );

-- 4. Acesso de colaboradores a clientes específicos
create table if not exists public.member_client_access (
    id             uuid primary key default gen_random_uuid(),
    org_id         uuid not null references public.organizations(id) on delete cascade,
    member_user_id uuid not null references auth.users(id) on delete cascade,
    client_id      uuid not null references public.clients(id) on delete cascade,
    unique (member_user_id, client_id)
);

alter table public.member_client_access enable row level security;

create policy "member_client_access_self" on public.member_client_access
    for select using (member_user_id = auth.uid());

-- 5. Clientes vinculados a convites de colaborador
create table if not exists public.invitation_member_clients (
    id            uuid primary key default gen_random_uuid(),
    invitation_id uuid not null references public.client_invitations(id) on delete cascade,
    client_id     uuid not null references public.clients(id) on delete cascade,
    unique (invitation_id, client_id)
);

-- 6. Colunas extras em client_invitations para convites de colaborador
alter table public.client_invitations
    add column if not exists invite_type  text not null default 'client'
        check (invite_type in ('client', 'member'));
alter table public.client_invitations
    add column if not exists member_role  text
        check (member_role in ('gestor', 'observador'));
alter table public.client_invitations
    add column if not exists created_by   uuid references auth.users(id) on delete set null;
