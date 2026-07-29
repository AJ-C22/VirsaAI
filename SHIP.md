# VirsaAI — Path to ship & monetize

Living family history platform: oral stories → biographies → knowledge graph → timelines, trees, shared memories, artifacts — with culturally aware kinship.

## Product surface (today)

| Area | Status |
|------|--------|
| Oral story pipeline | Live (Whisper + Gemini) |
| Family vault / persons / relationships | Live |
| Cultural kinship labels | Live |
| Shared multi-perspective memories | Live |
| Artifacts + archive search | Live |
| Auth (register/login JWT) | Live (local; Supabase-swappable) |
| Plans + story quotas | Live (dev plan switcher) |
| Onboarding | Live |
| Stripe Checkout | Schema ready — not wired |
| Supabase Auth/Storage/RLS | SQL ready — not connected |

## Commercial plans

- **Free** — 5 stories, 3 members  
- **Family ($19/mo)** — 50 stories, 15 members  
- **Legacy ($49/mo)** — unlimited  

Enforced on story create (`402` when over quota). `/billing/set-plan` switches plans until Stripe is connected.

## Ship checklist

### Product polish (pre-Stripe) — done locally
- Timeline home + detail restyled; Timelines in nav
- Auth gate on app routes (`RequireAuth`)
- Vault invites: create / list / revoke / accept UI + expiry & email match
- Shared memories: confidence + rationale + unlink; vault-scoped
- Empty/loading polish; story **Export PDF** (print)
- Vault-scoped reads across archive / artifacts / library / family / timelines

### Must-have before paid beta
1. Set `VIRSA_JWT_SECRET` to a long random value  
2. Connect **Stripe Checkout** → write `stripe_customer_id` / `subscription_id` / `plan` on vault  
3. Host Postgres (Supabase) + apply `schema.sql` → `v2.1` → `v2.2` → `supabase_rls.sql`  
4. Move audio/artifacts to **Supabase Storage**  
5. Deploy API worker (Whisper is CPU-heavy — use a GPU/CPU worker queue)  
6. Deploy Next.js (Vercel) with `NEXT_PUBLIC_API_ROOT`  
7. Enforce vault membership on every write (not just optional Bearer)  

### Nice-to-have for growth
- Email delivery for invites (currently copy-link)
- Better shared-memory matching (embeddings)
- Full heirloom book package beyond print/PDF
- Mobile recording PWA  

## Local env

```bash
# backend
VIRSA_JWT_SECRET=change-me
GEMINI_KEY=...
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=visra
POSTGRES_USER=postgres
POSTGRES_PASSWORD=mysecretpassword

# frontend
NEXT_PUBLIC_API_ROOT=http://localhost:8000
```

## Pitch one-liner

**VirsaAI is the living family history vault** — not a static memoir app or a cold genealogy tree. Families record interviews, add artifacts, and watch AI build a culturally aware knowledge graph that connects memories across generations.
