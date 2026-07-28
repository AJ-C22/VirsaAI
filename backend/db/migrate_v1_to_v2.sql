-- =============================================================================
-- Migrate VirsaAI v1 (story-centric) → v2 (vault + person-centric)
-- Run AFTER applying schema.sql on a DB that still has v1 data copied aside,
-- OR run against a DB where you renamed v1 tables first.
--
-- Safe recipe for an existing v1 database:
--   1. Rename v1 tables:  stories → stories_v1, etc. (see below)
--   2. Apply schema.sql (creates empty v2 tables + default vault)
--   3. Run this file
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Optional: if v1 tables are still named without _v1, rename them first.
-- Uncomment if needed.
-- ---------------------------------------------------------------------------
-- ALTER TABLE IF EXISTS stories RENAME TO stories_v1;
-- ALTER TABLE IF EXISTS person RENAME TO person_v1;
-- ALTER TABLE IF EXISTS timeline_events RENAME TO timeline_events_v1;
-- ALTER TABLE IF EXISTS family_members RENAME TO family_members_v1;
-- ALTER TABLE IF EXISTS family_relationships RENAME TO family_relationships_v1;
-- ALTER TABLE IF EXISTS locations RENAME TO locations_v1;
-- ALTER TABLE IF EXISTS occupations RENAME TO occupations_v1;
-- ALTER TABLE IF EXISTS themes RENAME TO themes_v1;
-- ALTER TABLE IF EXISTS story_themes RENAME TO story_themes_v1;

DO $$
DECLARE
    default_vault UUID := '00000000-0000-0000-0000-000000000001';
    r RECORD;
    new_story_id UUID;
    subject_id UUID;
    member_person_id UUID;
    rel_type relationship_type;
    v1_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'stories_v1'
    ) INTO v1_exists;

    IF NOT v1_exists THEN
        RAISE NOTICE 'stories_v1 not found — nothing to migrate. Skipping.';
        RETURN;
    END IF;

    -- Ensure default vault
    INSERT INTO family_vaults (id, name, description)
    VALUES (default_vault, 'Default Family Vault', 'Migrated from v1')
    ON CONFLICT (id) DO NOTHING;

    -- Map old integer story id → new UUID (temp)
    CREATE TEMP TABLE IF NOT EXISTS _story_id_map (
        old_id INTEGER PRIMARY KEY,
        new_id UUID NOT NULL
    ) ON COMMIT DROP;

    CREATE TEMP TABLE IF NOT EXISTS _member_id_map (
        old_id INTEGER PRIMARY KEY,
        new_person_id UUID NOT NULL
    ) ON COMMIT DROP;

    FOR r IN SELECT * FROM stories_v1 ORDER BY id LOOP
        -- Subject person
        INSERT INTO persons (
            vault_id, display_name, birth_year, birth_place, death_year
        )
        SELECT
            default_vault,
            COALESCE(r.person_name, p.person_name, 'Unknown'),
            p.person_birth_year,
            p.person_birth_place,
            p.person_death_year
        FROM (SELECT 1) _
        LEFT JOIN person_v1 p ON p.story_id = r.id
        RETURNING id INTO subject_id;

        IF subject_id IS NULL THEN
            INSERT INTO persons (vault_id, display_name)
            VALUES (default_vault, COALESCE(r.person_name, 'Unknown'))
            RETURNING id INTO subject_id;
        END IF;

        INSERT INTO stories (
            vault_id, subject_person_id, title, status,
            transcript, biography, summary, extracted_data,
            created_at, updated_at
        ) VALUES (
            default_vault,
            subject_id,
            COALESCE(r.person_name, 'Untitled story'),
            'ready',
            r.raw_body,
            r.story,
            r.summary,
            r.extracted_data,
            COALESCE(r.created_at, NOW()),
            COALESCE(r.updated_at, NOW())
        )
        RETURNING id INTO new_story_id;

        INSERT INTO _story_id_map (old_id, new_id) VALUES (r.id, new_story_id);

        -- Timeline events → person-scoped
        INSERT INTO timeline_events (
            vault_id, person_id, source_story_id, year, title, description,
            place, category, status, created_at
        )
        SELECT
            default_vault,
            subject_id,
            new_story_id,
            te.year,
            te.event,
            te.description,
            te.location,
            te.category,
            'confirmed',
            COALESCE(te.created_at, NOW())
        FROM timeline_events_v1 te
        WHERE te.story_id = r.id;

        -- Occupations
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'occupations_v1') THEN
            INSERT INTO occupations (
                vault_id, person_id, source_story_id, role, start_year, end_year, location, status
            )
            SELECT default_vault, subject_id, new_story_id, o.role, o.start_year, o.end_year, o.location, 'confirmed'
            FROM occupations_v1 o WHERE o.story_id = r.id;
        END IF;

        -- Places (from locations_v1)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locations_v1') THEN
            INSERT INTO places (
                vault_id, person_id, source_story_id, place, start_year, end_year, purpose, status
            )
            SELECT default_vault, subject_id, new_story_id, l.place, l.start_year, l.end_year, l.purpose, 'confirmed'
            FROM locations_v1 l WHERE l.story_id = r.id;
        END IF;
    END LOOP;

    -- Family members → persons + relationships to story subject
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_members_v1') THEN
        FOR r IN
            SELECT fm.*, m.new_id AS story_uuid, s.subject_person_id
            FROM family_members_v1 fm
            JOIN _story_id_map m ON m.old_id = fm.story_id
            JOIN stories s ON s.id = m.new_id
        LOOP
            INSERT INTO persons (
                vault_id, display_name, birth_year, death_year, notes
            ) VALUES (
                default_vault,
                COALESCE(r.name, 'Unknown relative'),
                r.birth_year,
                r.death_year,
                r.notes
            )
            RETURNING id INTO member_person_id;

            INSERT INTO _member_id_map (old_id, new_person_id)
            VALUES (r.id, member_person_id);

            -- Map common relationship strings → enum
            rel_type := CASE lower(COALESCE(r.relationship, 'relative'))
                WHEN 'father' THEN 'parent'::relationship_type
                WHEN 'mother' THEN 'parent'::relationship_type
                WHEN 'parent' THEN 'parent'::relationship_type
                WHEN 'son' THEN 'child'::relationship_type
                WHEN 'daughter' THEN 'child'::relationship_type
                WHEN 'child' THEN 'child'::relationship_type
                WHEN 'spouse' THEN 'spouse'::relationship_type
                WHEN 'wife' THEN 'spouse'::relationship_type
                WHEN 'husband' THEN 'spouse'::relationship_type
                WHEN 'brother' THEN 'sibling'::relationship_type
                WHEN 'sister' THEN 'sibling'::relationship_type
                WHEN 'sibling' THEN 'sibling'::relationship_type
                WHEN 'grandfather' THEN 'grandparent'::relationship_type
                WHEN 'grandmother' THEN 'grandparent'::relationship_type
                WHEN 'grandson' THEN 'grandchild'::relationship_type
                WHEN 'granddaughter' THEN 'grandchild'::relationship_type
                ELSE 'relative'::relationship_type
            END;

            -- Edge: relative described FROM subject TO member when child/spouse/sibling;
            -- for parent/grandparent, from=member to=subject with type parent/grandparent.
            IF rel_type IN ('parent', 'grandparent', 'aunt_uncle') THEN
                INSERT INTO relationships (
                    vault_id, from_person_id, to_person_id, type, source_story_id, certainty
                ) VALUES (
                    default_vault, member_person_id, r.subject_person_id, rel_type, r.story_uuid, 0.8
                )
                ON CONFLICT DO NOTHING;
            ELSIF rel_type IN ('child', 'grandchild', 'niece_nephew') THEN
                INSERT INTO relationships (
                    vault_id, from_person_id, to_person_id, type, source_story_id, certainty
                ) VALUES (
                    default_vault, r.subject_person_id, member_person_id, rel_type, r.story_uuid, 0.8
                )
                ON CONFLICT DO NOTHING;
            ELSE
                INSERT INTO relationships (
                    vault_id, from_person_id, to_person_id, type, source_story_id, certainty
                ) VALUES (
                    default_vault, r.subject_person_id, member_person_id, rel_type, r.story_uuid, 0.8
                )
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- Themes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'themes_v1') THEN
        INSERT INTO themes (name, created_at)
        SELECT name, COALESCE(created_at, NOW()) FROM themes_v1
        ON CONFLICT (name) DO NOTHING;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'story_themes_v1') THEN
            INSERT INTO story_themes (story_id, theme_id)
            SELECT m.new_id, t2.id
            FROM story_themes_v1 st
            JOIN _story_id_map m ON m.old_id = st.story_id
            JOIN themes_v1 t1 ON t1.id = st.theme_id
            JOIN themes t2 ON t2.name = t1.name
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RAISE NOTICE 'Migration complete.';
END $$;
