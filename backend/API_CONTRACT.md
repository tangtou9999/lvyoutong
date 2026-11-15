# Backend API contract (design draft)

This API contract is partially implemented by a framework-neutral Request/Response handler in src/server/api.ts. It is not a running server: the host must provide authentication and a PostgreSQL-backed repository.

## Rules
- All write endpoints require authenticated identity and server-side authorization.
- Client-supplied user IDs, evidence levels, moderation status, reputation, and reward balances are ignored; the server derives them.
- Use UUID identifiers and UTC timestamps.
- Create operations accept an idempotency key to make mobile retries safe.
- Location is requested only when the user starts a location-dependent action; no background tracking.
- Public read endpoints expose only approved place data and published contributions.
- Price records always retain product specification, unit, currency, observed time, and menu-vs-paid distinction.

## Endpoints

### Places
- `GET /api/v1/places?near=...&radius_m=...&category=...`
  - Returns approved place summaries and current approved location only.
- `GET /api/v1/places/:placeId`
  - Returns place profile, recent published experiences, evidence-level counts, and price history.
- `POST /api/v1/places`
  - Creates a candidate place. It does not immediately publish a map marker.
  - Server performs duplicate candidate matching before creation.
- `POST /api/v1/places/:placeId/claims`
  - Creates a merchant claim for review; does not grant edit rights before approval.

### Experiences
- `POST /api/v1/experiences`
  - Creates one experience event and optional price observations.
  - Request includes placeId, experiencedAt, body, optional 1–5 dimension scores, and optional price observations.
  - Server validates event time, place state, content limits, and idempotency key.
  - Media upload is a separate pre-signed upload flow; client never sets verified evidence level.
- `GET /api/v1/places/:placeId/experiences`
  - Returns published experiences, newest first, with evidence classification and moderation state limited to public-safe values.

### Media and evidence
- `POST /api/v1/media/upload-intents`
  - Creates a short-lived upload intent after checking authentication, MIME allowlist, size limit, and rate limit.
- `POST /api/v1/experiences/:experienceId/evidence`
  - Associates uploaded media or user-submitted proof metadata with an experience.
  - Verification remains pending until server checks and moderation.

### Rewards (later phase)
- `GET /api/v1/me/rewards`
  - Returns ledger-derived balance and transaction history.
- `POST /api/v1/reward-tasks/:taskId/submissions`
  - Submits objective task evidence. No reward for positive sentiment or star rating.
- Reward settlement is server-side, idempotent, budget-capped, auditable, and reversible through compensating ledger entries.

## Transaction boundaries
- Experience + associated price observations + idempotency record are committed in one database transaction.
- Evidence association and moderation case creation are atomic.
- Reward ledger posting is a separate transaction after eligibility and fraud checks; never update a balance directly.
- Place merge and location history changes must preserve historical references and write an audit event.

## Current implementation boundary
- Implemented handler routes: health, public place list, authenticated experience submission.
- Automated tests cover authentication, idempotency-key requirement, input validation, identity trust boundary, and safe errors.
- Authentication and repository are dependency-injected; no production identity provider or PostgreSQL repository is connected.

## Not implemented yet
No API server, authentication provider, database connection, object storage, or production deployment exists in the current repository.
