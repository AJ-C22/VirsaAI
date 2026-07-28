-- =============================================================================
-- VirsaAI v2.2 — Commercial / ship foundation (additive)
-- Auth-ready profiles, plans, invites, usage metering hooks
-- =============================================================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local';

ALTER TABLE family_vaults
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS story_limit INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS member_limit INTEGER DEFAULT 3;

DO $$ BEGIN
    CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS vault_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role vault_role NOT NULL DEFAULT 'editor',
    token TEXT NOT NULL UNIQUE,
    status invite_status NOT NULL DEFAULT 'pending',
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
);

CREATE INDEX IF NOT EXISTS idx_vault_invites_email ON vault_invites(email);
CREATE INDEX IF NOT EXISTS idx_vault_invites_vault ON vault_invites(vault_id);

CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- story_processed | artifact_uploaded | invite_sent
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_vault ON usage_events(vault_id, created_at DESC);

-- Plan catalog (reference; enforced in app)
COMMENT ON COLUMN family_vaults.plan IS 'free | family | legacy';
COMMENT ON COLUMN family_vaults.story_limit IS 'Max ready stories on plan; NULL = unlimited';
