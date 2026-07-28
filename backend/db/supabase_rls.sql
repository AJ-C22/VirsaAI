-- =============================================================================
-- Supabase RLS policies for VirsaAI v2
-- Apply in Supabase SQL editor AFTER schema.sql
-- Requires: auth.users; link profiles.id = auth.users.id on signup
-- =============================================================================

-- Link profiles to auth (run once on Supabase)
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pkey CASCADE;
-- Better pattern: profiles.id REFERENCES auth.users(id) ON DELETE CASCADE
-- For greenfield Supabase projects, recreate profiles as:
--   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Helper: vaults the current user belongs to
CREATE OR REPLACE FUNCTION public.user_vault_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT vm.vault_id
    FROM vault_members vm
    JOIN profiles p ON p.id = vm.user_id
    WHERE p.auth_user_id = auth.uid()
       OR p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_vault(p_vault_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM vault_members vm
        JOIN profiles p ON p.id = vm.user_id
        WHERE vm.vault_id = p_vault_id
          AND vm.role IN ('owner', 'editor')
          AND (p.auth_user_id = auth.uid() OR p.id = auth.uid())
    );
$$;

ALTER TABLE family_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/update themselves
CREATE POLICY profiles_select_self ON profiles
    FOR SELECT USING (auth_user_id = auth.uid() OR id = auth.uid());
CREATE POLICY profiles_update_self ON profiles
    FOR UPDATE USING (auth_user_id = auth.uid() OR id = auth.uid());

-- Vaults
CREATE POLICY vaults_select ON family_vaults
    FOR SELECT USING (id IN (SELECT public.user_vault_ids()));
CREATE POLICY vaults_insert ON family_vaults
    FOR INSERT WITH CHECK (true); -- tighten: created_by must match profile
CREATE POLICY vaults_update ON family_vaults
    FOR UPDATE USING (public.user_can_edit_vault(id));

-- Vault members
CREATE POLICY vault_members_select ON vault_members
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY vault_members_write ON vault_members
    FOR ALL USING (public.user_can_edit_vault(vault_id));

-- Generic vault-scoped tables
CREATE POLICY persons_select ON persons
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY persons_write ON persons
    FOR ALL USING (public.user_can_edit_vault(vault_id));

CREATE POLICY relationships_select ON relationships
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY relationships_write ON relationships
    FOR ALL USING (public.user_can_edit_vault(vault_id));

CREATE POLICY stories_select ON stories
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY stories_write ON stories
    FOR ALL USING (public.user_can_edit_vault(vault_id));

CREATE POLICY timeline_select ON timeline_events
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY timeline_write ON timeline_events
    FOR ALL USING (public.user_can_edit_vault(vault_id));

CREATE POLICY occupations_select ON occupations
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY occupations_write ON occupations
    FOR ALL USING (public.user_can_edit_vault(vault_id));

CREATE POLICY places_select ON places
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY places_write ON places
    FOR ALL USING (public.user_can_edit_vault(vault_id));

CREATE POLICY suggestions_select ON ai_suggestions
    FOR SELECT USING (vault_id IN (SELECT public.user_vault_ids()));
CREATE POLICY suggestions_write ON ai_suggestions
    FOR ALL USING (public.user_can_edit_vault(vault_id));

-- Media / jobs via story vault
CREATE POLICY media_select ON media_assets
    FOR SELECT USING (
        story_id IN (
            SELECT id FROM stories WHERE vault_id IN (SELECT public.user_vault_ids())
        )
    );
CREATE POLICY media_write ON media_assets
    FOR ALL USING (
        story_id IN (
            SELECT id FROM stories
            WHERE public.user_can_edit_vault(vault_id)
        )
    );

CREATE POLICY jobs_select ON processing_jobs
    FOR SELECT USING (
        story_id IN (
            SELECT id FROM stories WHERE vault_id IN (SELECT public.user_vault_ids())
        )
    );
CREATE POLICY jobs_write ON processing_jobs
    FOR ALL USING (
        story_id IN (
            SELECT id FROM stories
            WHERE public.user_can_edit_vault(vault_id)
        )
    );

-- Storage bucket note (create in Supabase dashboard):
--   bucket: story-audio
--   path:   {vault_id}/{story_id}/{filename}
