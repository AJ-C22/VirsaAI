# VirsaAI database schema (v2)

Production-oriented, **vault + person-centric** model for:

`Audio → written history → timeline + editable family tree`

## Apply (local)

Start Postgres, then from `backend/`:

```bash
cd docker && docker compose up -d db   # host port 5433
cd ../backend
python apply_schema.py
# If you renamed v1 tables to *_v1 first:
# python apply_schema.py --migrate
```

Or with psql:

```bash
psql "postgresql://postgres:mysecretpassword@localhost:5433/visra" \
  -f backend/db/schema.sql
```

**Warning:** `schema.sql` drops v2 tables (and legacy v1 names). Back up first.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Canonical v2 schema + default vault seed |
| `schema_v1_legacy.sql` | Archived v1 (story-centric) |
| `migrate_v1_to_v2.sql` | Data migration from renamed `*_v1` tables |
| `supabase_rls.sql` | Row Level Security for Supabase Auth |
| `db_operations.py` | Python data access for FastAPI / `load_data.py` |

## Core entities

```
family_vaults
  ├── vault_members → profiles
  ├── persons
  │     ├── person_aliases
  │     ├── relationships (graph edges)
  │     ├── timeline_events
  │     ├── occupations
  │     └── places
  └── stories
        ├── media_assets
        ├── processing_jobs
        ├── story_themes → themes
        └── ai_suggestions
```

**Default vault id (local):** `00000000-0000-0000-0000-000000000001`

## Design rules

1. **Persons** are the hub — not stories.
2. Many **stories** can attach to one **subject_person_id**.
3. **Timeline** queries by `person_id`; master timeline = all confirmed events in a vault.
4. **Relationships** are persisted edges (`from_person_id` → `to_person_id` + type).
5. AI writes **`ai_suggestions`**; `save_complete_story(..., auto_confirm=True)` is used by the offline CLI to also write confirmed facts.

## Living platform (v2.1)

Additive migration (keeps data):

```bash
cd backend
python3 - <<'PY'
from pathlib import Path
import os, psycopg2
conn = psycopg2.connect(
    dbname=os.getenv("POSTGRES_DB","visra"),
    user=os.getenv("POSTGRES_USER","postgres"),
    password=os.getenv("POSTGRES_PASSWORD","mysecretpassword"),
    host=os.getenv("POSTGRES_HOST","localhost"),
    port=os.getenv("POSTGRES_PORT","5433"),
)
conn.autocommit = True
conn.cursor().execute(Path("db/schema_v2_1_living_platform.sql").read_text())
print("v2.1 applied")
PY
```

Adds: cultural kinship on vaults, `artifacts`, `shared_memories` + perspectives, archive full-text search.
