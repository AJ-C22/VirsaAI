-- =============================================================================
-- VirsaAI production schema (v2)
-- Person + vault centric. Supabase-ready (UUID PKs, RLS hooks in supabase_rls.sql)
--
-- Product model:
--   family_vault  → shared family history space
--   persons       → stable identities (hub for tree + timelines)
--   relationships → editable family graph
--   stories       → oral history evidence (audio → transcript → biography)
--   timeline_events / occupations / places → facts about persons
--   ai_suggestions → review queue before facts are confirmed
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop v2 tables (safe re-run). Also drop legacy v1 names if present.
DROP TABLE IF EXISTS ai_suggestions CASCADE;
DROP TABLE IF EXISTS processing_jobs CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS story_themes CASCADE;
DROP TABLE IF EXISTS themes CASCADE;
DROP TABLE IF EXISTS occupations CASCADE;
DROP TABLE IF EXISTS places CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;
DROP TABLE IF EXISTS person_aliases CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS persons CASCADE;
DROP TABLE IF EXISTS vault_members CASCADE;
DROP TABLE IF EXISTS family_vaults CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Legacy v1 leftovers
DROP TABLE IF EXISTS family_relationships CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS person CASCADE;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE vault_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE story_status AS ENUM (
        'draft', 'uploading', 'processing', 'ready', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE job_stage AS ENUM (
        'queued', 'transcribing', 'writing', 'extracting', 'saving',
        'completed', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE relationship_type AS ENUM (
        'parent', 'child', 'spouse', 'sibling', 'grandparent', 'grandchild',
        'aunt_uncle', 'niece_nephew', 'cousin', 'in_law', 'relative', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE fact_status AS ENUM ('suggested', 'confirmed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE suggestion_kind AS ENUM (
        'person', 'relationship', 'timeline_event', 'occupation', 'place', 'theme'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE suggestion_status AS ENUM ('pending', 'accepted', 'rejected', 'merged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Profiles (maps to Supabase auth.users when deployed)
-- Locally: create a profile row without requiring auth.users
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Family vaults (tenancy boundary)
-- ---------------------------------------------------------------------------
CREATE TABLE family_vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vault_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role vault_role NOT NULL DEFAULT 'editor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (vault_id, user_id)
);

CREATE INDEX idx_vault_members_user ON vault_members(user_id);
CREATE INDEX idx_vault_members_vault ON vault_members(vault_id);

-- ---------------------------------------------------------------------------
-- Persons (stable identity — hub for tree & timelines)
-- ---------------------------------------------------------------------------
CREATE TABLE persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    given_name TEXT,
    family_name TEXT,
    birth_year INTEGER,
    birth_date DATE,
    birth_place TEXT,
    death_year INTEGER,
    death_date DATE,
    death_place TEXT,
    sex TEXT,
    notes TEXT,
    photo_url TEXT,
    is_living BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_persons_vault ON persons(vault_id);
CREATE INDEX idx_persons_vault_name ON persons(vault_id, display_name);

CREATE TABLE person_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (person_id, alias)
);

CREATE INDEX idx_person_aliases_alias ON person_aliases(alias);

-- ---------------------------------------------------------------------------
-- Relationships (family graph)
-- from_person --type--> to_person
-- Convention: parent → child uses type 'parent' (from=parent, to=child)
--             spouse is symmetric (store once; app may mirror in UI)
-- ---------------------------------------------------------------------------
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    from_person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    to_person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    type relationship_type NOT NULL DEFAULT 'relative',
    certainty REAL NOT NULL DEFAULT 1.0 CHECK (certainty >= 0 AND certainty <= 1),
    start_year INTEGER,
    end_year INTEGER,
    notes TEXT,
    source_story_id UUID, -- FK added after stories exists
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (from_person_id <> to_person_id),
    UNIQUE (from_person_id, to_person_id, type)
);

CREATE INDEX idx_relationships_vault ON relationships(vault_id);
CREATE INDEX idx_relationships_from ON relationships(from_person_id);
CREATE INDEX idx_relationships_to ON relationships(to_person_id);

-- ---------------------------------------------------------------------------
-- Stories (oral history evidence)
-- ---------------------------------------------------------------------------
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    subject_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    contributor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT,
    status story_status NOT NULL DEFAULT 'draft',
    language TEXT,
    transcript TEXT,          -- Whisper / raw_body
    biography TEXT,           -- AI narrative
    summary TEXT,
    extracted_data JSONB,     -- full AI extract audit blob
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stories_vault ON stories(vault_id);
CREATE INDEX idx_stories_subject ON stories(subject_person_id);
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_extracted ON stories USING GIN (extracted_data);

ALTER TABLE relationships
    ADD CONSTRAINT fk_relationships_source_story
    FOREIGN KEY (source_story_id) REFERENCES stories(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Media & processing
-- ---------------------------------------------------------------------------
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,   -- local path or Supabase Storage path
    bucket TEXT,                  -- e.g. 'story-audio'
    mime_type TEXT,
    byte_size BIGINT,
    duration_sec REAL,
    checksum TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_story ON media_assets(story_id);

CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    stage job_stage NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
    error TEXT,
    model_info JSONB,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_story ON processing_jobs(story_id);
CREATE INDEX idx_jobs_stage ON processing_jobs(stage);

-- ---------------------------------------------------------------------------
-- Timeline events (facts about a person; optional story provenance)
-- ---------------------------------------------------------------------------
CREATE TABLE timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    source_story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    year INTEGER,
    event_date DATE,
    date_precision TEXT DEFAULT 'year', -- year | month | day | approx
    title TEXT NOT NULL,
    description TEXT,
    place TEXT,
    category VARCHAR(50),
    confidence REAL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    status fact_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_vault ON timeline_events(vault_id);
CREATE INDEX idx_timeline_person ON timeline_events(person_id);
CREATE INDEX idx_timeline_year ON timeline_events(year);
CREATE INDEX idx_timeline_story ON timeline_events(source_story_id);
CREATE INDEX idx_timeline_status ON timeline_events(status);

-- ---------------------------------------------------------------------------
-- Occupations & places (person-scoped life facts)
-- ---------------------------------------------------------------------------
CREATE TABLE occupations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    source_story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    location TEXT,
    status fact_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_occupations_person ON occupations(person_id);

CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    source_story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    place TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    purpose TEXT,
    status fact_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_places_person ON places(person_id);

-- ---------------------------------------------------------------------------
-- Themes
-- ---------------------------------------------------------------------------
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE story_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (story_id, theme_id)
);

-- ---------------------------------------------------------------------------
-- AI suggestions (review queue)
-- ---------------------------------------------------------------------------
CREATE TABLE ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    kind suggestion_kind NOT NULL,
    payload JSONB NOT NULL,
    status suggestion_status NOT NULL DEFAULT 'pending',
    resolved_entity_id UUID,  -- person/relationship/event id after accept
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_suggestions_story ON ai_suggestions(story_id);
CREATE INDEX idx_suggestions_status ON ai_suggestions(status);
CREATE INDEX idx_suggestions_vault ON ai_suggestions(vault_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vaults_updated BEFORE UPDATE ON family_vaults
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_persons_updated BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_relationships_updated BEFORE UPDATE ON relationships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_stories_updated BEFORE UPDATE ON stories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON processing_jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_timeline_updated BEFORE UPDATE ON timeline_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: local default vault (dev / single-family until auth lands)
-- ---------------------------------------------------------------------------
INSERT INTO family_vaults (id, name, description)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Family Vault',
    'Local development vault. Replace with real vaults after Supabase Auth.'
)
ON CONFLICT (id) DO NOTHING;
