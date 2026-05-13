-- ─────────────────────────────────────────────────────────────────────
-- Newgestor — schema inicial
-- Tudo isolado por user_id via Row Level Security (RLS).
-- Rode este SQL no Supabase Dashboard → SQL Editor → New query.
-- ─────────────────────────────────────────────────────────────────────

-- ─── profiles ─────────────────────────────────────────────────────────
-- Espelha auth.users. Trigger preenche automaticamente no signup.
create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    email         text not null,
    full_name     text,
    avatar_url    text,
    plan          text not null default 'free' check (plan in ('free','starter','pro','agency')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"  on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own"  on public.profiles for update using (auth.uid() = id);

-- ─── meta_credentials ────────────────────────────────────────────────
-- App ID + App Secret que o usuário criou no developers.facebook.com.
-- O secret fica CIFRADO (AES-256-GCM) no servidor antes de salvar.
create table if not exists public.meta_credentials (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    app_id              text not null,
    app_secret_encrypted text not null,
    app_name            text,
    redirect_uri        text not null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (user_id)
);

alter table public.meta_credentials enable row level security;

create policy "meta_creds_select_own" on public.meta_credentials for select using (auth.uid() = user_id);
create policy "meta_creds_insert_own" on public.meta_credentials for insert with check (auth.uid() = user_id);
create policy "meta_creds_update_own" on public.meta_credentials for update using (auth.uid() = user_id);
create policy "meta_creds_delete_own" on public.meta_credentials for delete using (auth.uid() = user_id);

-- ─── meta_tokens ──────────────────────────────────────────────────────
-- Long-lived user token resultante do OAuth dance. Cifrado.
create table if not exists public.meta_tokens (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    access_token_encrypted text not null,
    fb_user_id        text,
    fb_user_name      text,
    scopes            text[],
    expires_at        timestamptz,
    refreshed_at      timestamptz not null default now(),
    created_at        timestamptz not null default now(),
    unique (user_id)
);

alter table public.meta_tokens enable row level security;

create policy "meta_tokens_select_own" on public.meta_tokens for select using (auth.uid() = user_id);
create policy "meta_tokens_modify_own" on public.meta_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── account_cache ────────────────────────────────────────────────────
-- Cache opcional de metadados de contas Meta — economiza chamadas API.
create table if not exists public.account_cache (
    user_id        uuid not null references auth.users(id) on delete cascade,
    account_id     text not null,
    name           text,
    currency       text,
    account_status int,
    business_name  text,
    last_synced    timestamptz not null default now(),
    primary key (user_id, account_id)
);

alter table public.account_cache enable row level security;

create policy "account_cache_select_own" on public.account_cache for select using (auth.uid() = user_id);
create policy "account_cache_modify_own" on public.account_cache for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── trigger: cria profile automaticamente no signup ─────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name, avatar_url)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ─── trigger: updated_at automatico ───────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
    for each row execute function public.touch_updated_at();

drop trigger if exists meta_creds_touch on public.meta_credentials;
create trigger meta_creds_touch before update on public.meta_credentials
    for each row execute function public.touch_updated_at();
