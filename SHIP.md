# VirsaAI — Path to ship & monetize

Living family history platform: oral stories → biographies → knowledge graph → timelines, trees, shared memories, artifacts — with culturally aware kinship.

## Open todos (ask “what’s next”)

1. **Configure Stripe** — Checkout is coded; still need Dashboard prices + `.env` keys (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_FAMILY`, `STRIPE_PRICE_LEGACY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`) and webhook forward to `POST /billing/webhook`. Until then `/plans` shows `stripe_configured: false`.
2. Set strong `VIRSA_JWT_SECRET`
3. Host Postgres (Supabase) + schemas / RLS
4. Supabase Storage for audio/artifacts
5. Deploy API worker + Next.js
6. Enforce vault membership on every write

Details below and in `.cursor/rules/ship-backlog.mdc`.

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
| Stripe Checkout | Live (keys required) |
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
2. **Stripe** — create Family ($19) + Legacy ($49) recurring Prices; set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_FAMILY`, `STRIPE_PRICE_LEGACY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`; forward webhooks to `POST /billing/webhook` (`checkout.session.completed`, `customer.subscription.*`)  
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

## Stripe local test

1. Create two recurring Prices in Stripe (Family $19, Legacy $49).
2. Put keys in root `.env` (see `.env.example`).
3. Forward webhooks:
   ```bash
   stripe listen --forward-to localhost:8000/billing/webhook
   ```
   Copy the `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
4. Restart API. `/plans` should show `"stripe_configured": true`.
5. Sign in → Pricing → Checkout (test card `4242…`).

Endpoints: `POST /billing/checkout`, `POST /billing/portal`, `GET /billing/session/{id}`, `POST /billing/webhook`.

## Pitch one-liner

**VirsaAI is the living family history vault** — not a static memoir app or a cold genealogy tree. Families record interviews, add artifacts, and watch AI build a culturally aware knowledge graph that connects memories across generations.
