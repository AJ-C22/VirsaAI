-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS story_themes CASCADE;
DROP TABLE IF EXISTS occupations CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS person CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS themes CASCADE;

-- Main stories table
CREATE TABLE stories (
    id SERIAL PRIMARY KEY,
    person_name TEXT NOT NULL,
    raw_body TEXT NOT NULL,
    story TEXT NOT NULL,
    summary TEXT,
    -- Store full extracted JSON for flexibility
    extracted_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Person info (main storyteller)
CREATE TABLE person (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL UNIQUE,
    person_name TEXT,
    person_birth_year INTEGER,
    person_birth_place TEXT,
    person_death_year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_person_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Timeline events for chronological visualization
CREATE TABLE timeline_events (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    year INTEGER,
    event TEXT NOT NULL,
    description TEXT,
    location TEXT,
    category VARCHAR(50), 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_timeline_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Family members for family tree construction
CREATE TABLE family_members (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    name TEXT,
    relationship VARCHAR(50) NOT NULL,
    birth_year INTEGER,
    death_year INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_family_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Relationships between family members
CREATE TABLE family_relationships (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    related_to INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL, -- parent, child, spouse, sibling, etc
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Locations where the person lived or spent significant time
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    place TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    purpose TEXT, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_locations_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Occupations/career history
CREATE TABLE occupations (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_occupations_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Themes table (normalized for better querying)
CREATE TABLE themes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for story-theme many-to-many relationship
CREATE TABLE story_themes (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_story_themes_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    CONSTRAINT fk_story_themes_theme FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
    CONSTRAINT unique_story_theme UNIQUE (story_id, theme_id)
);

-- Indexes for performance
CREATE INDEX idx_timeline_events_story_id ON timeline_events(story_id);
CREATE INDEX idx_timeline_events_year ON timeline_events(year);
CREATE INDEX idx_timeline_events_category ON timeline_events(category);

CREATE INDEX idx_family_members_story_id ON family_members(story_id);
CREATE INDEX idx_family_members_relationship ON family_members(relationship);

CREATE INDEX idx_locations_story_id ON locations(story_id);
CREATE INDEX idx_locations_start_year ON locations(start_year);

CREATE INDEX idx_occupations_story_id ON occupations(story_id);
CREATE INDEX idx_occupations_start_year ON occupations(start_year);

CREATE INDEX idx_story_themes_story_id ON story_themes(story_id);
CREATE INDEX idx_story_themes_theme_id ON story_themes(theme_id);

-- Index for JSONB queries on extracted_data
CREATE INDEX idx_stories_extracted_data ON stories USING GIN (extracted_data);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();