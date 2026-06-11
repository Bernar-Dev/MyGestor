-- Tabela: contas Meta que cada agência gerencia
-- Rode isso no Supabase Dashboard > SQL Editor
CREATE TABLE IF NOT EXISTS org_meta_accounts (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id      UUID        NOT NULL,
    account_id  TEXT        NOT NULL,   -- formato act_xxxxxxxx
    account_name TEXT,
    currency    TEXT,
    added_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, account_id)
);
