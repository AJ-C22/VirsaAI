-- =============================================================================
-- VirsaAI v2.1 — Living family history platform extensions
-- Additive only (safe on existing v2 data)
-- =============================================================================

-- Vault cultural context
ALTER TABLE family_vaults
    ADD COLUMN IF NOT EXISTS cultural_context TEXT DEFAULT 'punjabi',
    ADD COLUMN IF NOT EXISTS primary_language TEXT DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS kinship_system TEXT DEFAULT 'punjabi';

COMMENT ON COLUMN family_vaults.cultural_context IS
    'Family cultural lens used for kinship terms and archival tone (e.g. punjabi, cantonese, generic).';
COMMENT ON COLUMN family_vaults.kinship_system IS
    'Kinship labeling system: punjabi | cantonese | mandarin | generic';

-- Artifact / media types beyond interview audio
DO $$ BEGIN
    CREATE TYPE artifact_type AS ENUM (
        'photo', 'document', 'letter', 'certificate', 'video', 'audio', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    artifact_type artifact_type NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    caption TEXT,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    byte_size BIGINT,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    taken_year INTEGER,
    taken_place TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_vault ON artifacts(vault_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_person ON artifacts(person_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_story ON artifacts(story_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);

-- Shared memories: one real-world event seen from multiple story perspectives
CREATE TABLE IF NOT EXISTS shared_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES family_vaults(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    year INTEGER,
    place TEXT,
    description TEXT,
    category VARCHAR(50),
    confidence REAL DEFAULT 0.7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_memories_vault ON shared_memories(vault_id);
CREATE INDEX IF NOT EXISTS idx_shared_memories_year ON shared_memories(year);

ALTER TABLE timeline_events
    ADD COLUMN IF NOT EXISTS shared_memory_id UUID REFERENCES shared_memories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_shared ON timeline_events(shared_memory_id);

ALTER TABLE artifacts
    ADD COLUMN IF NOT EXISTS shared_memory_id UUID REFERENCES shared_memories(id) ON DELETE SET NULL;

-- Perspective: which person/story contributed a view of a shared memory
CREATE TABLE IF NOT EXISTS memory_perspectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_memory_id UUID NOT NULL REFERENCES shared_memories(id) ON DELETE CASCADE,
    timeline_event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    perspective_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shared_memory_id, timeline_event_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_perspectives_memory ON memory_perspectives(shared_memory_id);

-- Relationship cultural label cache (optional; can also be computed live)
ALTER TABLE relationships
    ADD COLUMN IF NOT EXISTS cultural_label TEXT,
    ADD COLUMN IF NOT EXISTS cultural_label_system TEXT;

-- Search vector support for archive
ALTER TABLE stories
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE persons
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION stories_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.biography, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.transcript, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stories_search ON stories;
CREATE TRIGGER trg_stories_search
    BEFORE INSERT OR UPDATE OF title, summary, biography, transcript ON stories
    FOR EACH ROW EXECUTE FUNCTION stories_search_vector_update();

CREATE OR REPLACE FUNCTION persons_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.display_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.birth_place, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_persons_search ON persons;
CREATE TRIGGER trg_persons_search
    BEFORE INSERT OR UPDATE OF display_name, notes, birth_place ON persons
    FOR EACH ROW EXECUTE FUNCTION persons_search_vector_update();

CREATE INDEX IF NOT EXISTS idx_stories_search ON stories USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_persons_search ON persons USING GIN (search_vector);

-- Backfill search vectors
UPDATE stories SET title = title WHERE search_vector IS NULL;
UPDATE persons SET display_name = display_name WHERE search_vector IS NULL;

-- Default vault cultural settings
UPDATE family_vaults
SET cultural_context = COALESCE(cultural_context, 'punjabi'),
    kinship_system = COALESCE(kinship_system, 'punjabi'),
    primary_language = COALESCE(primary_language, 'en')
WHERE id = '00000000-0000-0000-0000-000000000001';
