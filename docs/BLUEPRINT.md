# VoteForge — Project Blueprint (Phase 0)

> Master design document. Everything in this document is the contract for implementation.
> Review and approve before Phase 1 begins.

---

## A. System Architecture

### A.1 Guiding decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Modern, single deployable, good for portfolio. |
| Styling | **TailwindCSS v4** | Utility-first, fast design-system work. |
| Server layer | **Next.js Route Handlers (+ minimal Server Actions)** | No separate backend needed — reduces attack surface and ops burden. |
| Database | **PostgreSQL** (Supabase-hosted recommended; local install fallback) | Prompt requirement; no Docker/Postgres installed locally yet. |
| ORM | **Prisma** | Strong typing, migrations, easy audit. |
| Validation | **Zod** | Strong typed schemas for every input boundary. |
| Auth | **Custom authentication** (argon2id + opaque DB-backed sessions) | Maximum demonstrable security engineering; full control over rate limiting, audit, and tokens. Supabase Auth would hide the exact controls this portfolio must prove. |
| Email | **Resend** | Simple transactional API, required by prompt. |
| Testing | **Vitest + Supertest** against a real Postgres test database | Integration + security tests must hit real constraints (unique, triggers). |
| Monitoring | **Audit + Security Event table**, structured for future SIEM export | SOC requirement. |

### A.2 Runtime architecture

```text
                          INTERNET
                             │
                             ▼
                 ┌───────────────────────────┐
                 │   Next.js App (single)    │
                 │                           │
                 │  UI (React, Tailwind)     │
                 │        │                  │
                 │  Route Handlers (API)     │
                 │        │                  │
                 │  Middleware (session,     │
                 │   rate limit, headers)    │
                 │        │                  │
                 │  Service Layer            │
                 │   auth · election · vote  │
                 │   notification · admin    │
                 │   audit                    │
                 └───────┬───────────────────┘
                         │
                 ┌───────┴────────┐
                 │  PostgreSQL    │
                 │  + Prisma      │
                 └───────┬────────┘
                         │
                 ┌───────┴────────┐
                 │  Resend API    │
                 │  (email)       │
                 └────────────────┘
```

- Single Next.js process. No microservices, no queues, no extra services (per "Do Not Overengineer").
- **Stateless request flow**: every request → middleware → validation → auth → authz → service → DB.
- **Async work** (email) is fire-and-forget with best-effort logging; no queue infrastructure.

### A.3 Security architecture (defense in depth)

```text
Layer                    Controls
─────────────────────────────────────────────────────────────────
Edge / middleware        Security headers, CSRF header check,
                         rate limiting fast-path, session auth
Validation               Zod schemas at every input boundary
Authorization            requireUser / requireAdmin + ownership checks
Service layer            Business rules (lifecycle, eligibility,
                         duplicate-vote, immutability)
Database                 UNIQUE(user_id, election_id), CHECK constraints,
                         append-only triggers, FK integrity
Audit                    Append-only audit_logs + security event feed
```

### A.4 Environment strategy

- `.env` / `.env.local` are git-ignored. `.env.example` documents all variables.
- Only `NEXT_PUBLIC_*` variables ever reach the browser.
- `DATABASE_URL`, `RESEND_API_KEY`, `AUTH_SECRET` are server-only.

```env
DATABASE_URL=postgresql://...           # app connection
DIRECT_URL=postgresql://...             # migrations (Supabase pooler needs this)
AUTH_SECRET=...                          # cookie/CSRF signing
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=...
EMAIL_FROM=VoteForge <no-reply@...>
```

---

## B. Folder Structure

```text
voteforge/
├── docs/                    # BLUEPRINT, later ARCHITECTURE/API/SECURITY/DATABASE/TESTING
├── prisma/
│   ├── schema.prisma        # DB schema (single source of truth)
│   ├── migrations/
│   ├── triggers.sql         # immutability / append-only triggers (applied after migrate)
│   └── seed.ts              # dev-only seed (clearly labeled, never shipped as real data)
├── src/
│   ├── app/
│   │   ├── (auth)/          # register / login / verify-email / forgot / reset
│   │   ├── (dashboard)/     # elections list, election detail, vote
│   │   ├── admin/           # overview, elections, users, security, audit
│   │   ├── api/
│   │   │   ├── auth/...     # route handlers (see API spec)
│   │   │   ├── elections/...
│   │   │   ├── admin/...
│   │   │   └── notifications/...
│   │   ├── layout.tsx       # root layout + providers
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/              # Button, Card, Input, Badge, Dialog, Skeleton, EmptyState...
│   │   ├── auth/
│   │   ├── elections/
│   │   ├── voting/
│   │   ├── admin/
│   │   ├── dashboard/
│   │   └── layout/          # Nav, Footer, ThemeProvider
│   ├── lib/
│   │   ├── db.ts            # Prisma client (server-only)
│   │   ├── auth.ts          # session helpers, requireUser/requireAdmin
│   │   ├── passwords.ts     # argon2id hashing/verify
│   │   ├── tokens.ts        # secure token generation + hashing
│   │   ├── rate-limit.ts    # RateLimiter interface + DB-backed impl
│   │   ├── csrf.ts          # CSRF token issue/verify
│   │   ├── security-headers.ts
│   │   ├── logger.ts        # structured, severity-aware logger
│   │   └── errors.ts        # AppError types + safe error mapping
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── election.service.ts
│   │   ├── vote.service.ts
│   │   ├── candidate.service.ts
│   │   ├── notification.service.ts  # channel abstraction
│   │   ├── admin.service.ts
│   │   └── audit.service.ts
│   ├── hooks/               # useQuery wrappers, form hooks
│   ├── schemas/             # Zod schemas (shared client/server)
│   ├── types/               # shared types
│   └── utils/               # cn(), formatters, date utils
├── middleware.ts            # headers, session bootstrap, CSRF header check
├── tests/
│   ├── unit/
│   ├── integration/
│   └── security/            # voting Test 1–7, IDOR, RBAC, rate limit
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
└── README.md
```

---

## C. Database Schema

All ids are `uuid` (Postgres `gen_random_uuid()`). All timestamp columns `timestamptz`. Soft-delete avoided; immutability via triggers where required.

### C.1 Tables

**users**
```text
id            uuid PK
name          text NOT NULL
email         citext NOT NULL UNIQUE
password_hash text NOT NULL             -- argon2id
role          user_role NOT NULL        -- enum: VOTER | ADMIN
status        user_status NOT NULL      -- enum: PENDING | ACTIVE | SUSPENDED
email_verified_at timestamptz NULL
password_changed_at timestamptz NULL
last_login_at timestamptz NULL
created_at    timestamptz NOT NULL DEFAULT now()
updated_at    timestamptz NOT NULL DEFAULT now()
```

**sessions** (opaque, revocable, hashed at rest)
```text
id           uuid PK
user_id      uuid FK → users ON DELETE CASCADE
token_hash   text NOT NULL UNIQUE      -- SHA-256(token); raw token only shown once
expires_at   timestamptz NOT NULL
ip_address   inet NULL
user_agent   text NULL
last_used_at timestamptz NULL
revoked_at   timestamptz NULL
created_at   timestamptz NOT NULL DEFAULT now()
```

**email_verification_tokens**
```text
id           uuid PK
user_id      uuid FK → users ON DELETE CASCADE
token_hash   text NOT NULL UNIQUE
expires_at   timestamptz NOT NULL
used_at      timestamptz NULL
created_at   timestamptz NOT NULL DEFAULT now()
```

**password_reset_tokens**
```text
id           uuid PK
user_id      uuid FK → users ON DELETE CASCADE
token_hash   text NOT NULL UNIQUE
expires_at   timestamptz NOT NULL
used_at      timestamptz NULL
invalidated_at timestamptz NULL        -- set on password change
created_at   timestamptz NOT NULL DEFAULT now()
```

**elections**
```text
id           uuid PK
title        text NOT NULL
description  text NOT NULL
created_by   uuid FK → users (admin)
status       election_status NOT NULL  -- enum: DRAFT | UPCOMING | ACTIVE | ENDED
start_date   timestamptz NOT NULL
end_date     timestamptz NOT NULL
created_at   timestamptz NOT NULL DEFAULT now()
updated_at   timestamptz NOT NULL DEFAULT now()
CHECK (end_date > start_date)
```

**candidates**
```text
id           uuid PK
election_id  uuid FK → elections ON DELETE CASCADE
name         text NOT NULL
description  text NOT NULL
image_url    text NULL
created_at   timestamptz NOT NULL DEFAULT now()
INDEX (election_id)
```

**votes**
```text
id              uuid PK
election_id     uuid FK → elections
candidate_id    uuid FK → candidates
user_id         uuid FK → users
confirmation_id text NOT NULL UNIQUE   -- short public reference, e.g. VF-XXXXXXXX
ip_address      inet NULL
created_at      timestamptz NOT NULL DEFAULT now()

UNIQUE (user_id, election_id)          -- THE duplicate-vote guarantee (DB enforced)
CHECK (candidate_belongs_to_election)  -- via trigger/FK composite; see C.2
IMMUTABLE trigger                      -- no UPDATE, no DELETE
```

**notifications**
```text
id           uuid PK
user_id      uuid FK → users ON DELETE CASCADE
type         notification_type NOT NULL -- enum: VERIFY | RESET | WELCOME |
                                         -- ELECTION_ANNOUNCEMENT | VOTE_CONFIRMATION |
                                         -- ELECTION_ENDED | SYSTEM
title        text NOT NULL
body         text NOT NULL
link         text NULL
read_at      timestamptz NULL
created_at   timestamptz NOT NULL DEFAULT now()
INDEX (user_id, read_at)
```

**audit_logs** (append-only; SIEM-ready)
```text
id            bigserial PK
event_type    audit_event NOT NULL     -- enum (see Section J.1)
user_id       uuid NULL FK → users
election_id   uuid NULL FK → elections
ip_address    inet NULL
user_agent    text NULL
metadata      jsonb NOT NULL DEFAULT '{}'
created_at    timestamptz NOT NULL DEFAULT now()

APPEND-ONLY trigger                     -- no UPDATE, no DELETE
INDEX (event_type, created_at)
INDEX (user_id, created_at)
INDEX (created_at)
```

### C.2 Critical constraints

1. `UNIQUE(user_id, election_id)` on `votes` — **the database is the final authority** against duplicate votes.
2. `candidate_id` must belong to `election_id` — enforced by composite FK:
   - `candidates(election_id, id)` unique, and `votes(election_id, candidate_id)` references it.
3. `CHECK (end_date > start_date)` on elections.
4. `votes` immutable via trigger (`raise exception` on UPDATE/DELETE).
5. `audit_logs` append-only via trigger.
6. Votes into non-ACTIVE elections blocked in service layer **and** a `CHECK` on the election status is enforced via the vote-insert trigger (double layer).

---

## D. Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ SESSION : "has"
    USER ||--o{ EMAIL_VERIFICATION_TOKEN : "owns"
    USER ||--o{ PASSWORD_RESET_TOKEN : "owns"
    USER ||--o{ ELECTION : "creates"
    USER ||--o{ VOTE : "casts"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ AUDIT_LOG : "subject"

    ELECTION ||--o{ CANDIDATE : "contains"
    ELECTION ||--o{ VOTE : "receives"
    CANDIDATE ||--o{ VOTE : "receives"
    ELECTION ||--o{ AUDIT_LOG : "subject"

    USER {
        uuid id PK
        text name
        citext email UK
        text password_hash
        user_role role
        user_status status
        timestamptz email_verified_at
        timestamptz last_login_at
    }
    ELECTION {
        uuid id PK
        text title
        election_status status
        timestamptz start_date
        timestamptz end_date
    }
    CANDIDATE {
        uuid id PK
        uuid election_id FK
        text name
    }
    VOTE {
        uuid id PK
        uuid election_id FK
        uuid candidate_id FK
        uuid user_id FK
        text confirmation_id UK
        timestamptz created_at
        _ "UK(user_id, election_id)"
    }
    AUDIT_LOG {
        bigserial id PK
        audit_event event_type
        jsonb metadata
    }
```

---

## E. Authentication Flow

### E.1 Registration → verification

```text
POST /api/auth/register
  → validate (Zod) + password policy
  → hash password (argon2id)
  → create user (status PENDING, role VOTER)
  → audit USER_REGISTERED
  → issue verification token (single-use, 24h)
  → notification service → email "Verify your VoteForge account"
  → in-app notification
  → 201 { message }
```

```text
POST /api/auth/verify-email   (token)
  → rate limit
  → lookup token by hash (not raw)
  → check unused + not expired
  → mark token used, set email_verified_at
  → audit USER_VERIFIED
  → notification → email "Welcome to VoteForge"
  → 200
```

Account is `PENDING` until verified; voting and some actions require `ACTIVE` + verified email.

### E.2 Login / session

```text
POST /api/auth/login
  → rate limit (IP + email)
  → find user by email
  → verify argon2id hash
  → if status SUSPENDED → blocked
  → create session token (256-bit random)
  → store SHA-256(token_hash) in DB (raw never persisted)
  → set httpOnly, SameSite=Strict, Secure cookie (cookie value = raw token)
  → update last_login_at → audit LOGIN_SUCCESS
  → failure → audit LOGIN_FAILED (+ SOC rule sees brute force)
```

Session cookie is signed with `AUTH_SECRET` (HMAC) to prevent cookie tampering. Sessions expire (configurable, e.g. 7 days sliding) and are revocable.

### E.3 Logout
`POST /api/auth/logout` → revoke session row + clear cookie + audit `LOGOUT`.

### E.4 Password reset

```text
POST /api/auth/forgot-password  (email)
  → rate limit (per email, strong)
  → always respond 200 (no user enumeration)
  → if user exists: create reset token (single-use, 30 min)
  → email "Reset your VoteForge password"
  → audit PASSWORD_RESET_REQUESTED
```

```text
POST /api/auth/reset-password   (token + new password)
  → validate + policy
  → lookup token by hash, check unused/not expired
  → re-hash password, set password_changed_at
  → invalidate token + all other sessions (session fixation / takeover defense)
  → audit PASSWORD_RESET_COMPLETED
```

Token rules: 256-bit random, only hash stored, single-use, expiring, invalidated on password change. Tokens are never logged.

---

## F. Authorization Model

### F.1 Roles & statuses

| Role | Capabilities |
|---|---|
| `ADMIN` | Everything: election CRUD/lifecycle, candidates, user management, audit/security views, stats |
| `VOTER` | Own profile, list elections, view results when permitted, cast one vote per election, notifications |

Status gates: `PENDING` (must verify email) → `ACTIVE` (can vote). `SUSPENDED` cannot log in or vote.

### F.2 Enforcement (server-side only)

```text
middleware / lib/auth.ts
  requireUser(request)   → returns session.user, else 401
  requireAdmin(request)  → 401 if unauthenticated, 403 if not ADMIN
  ownership: resource scoping uses session user id — NEVER from request body
```

- Role is read from the DB **per request**, never from the frontend or cookie claims.
- Admin endpoints live under `/api/admin/*` **and** re-check role server-side.
- All queries scope by session identity. No IDOR: a user cannot request another user's data by id.
- RLS: optional hardening if Supabase-hosted Postgres is used (session-scoped role for direct DB access). Primary enforcement is the application layer + DB constraints. RLS is not used as the sole control.

### F.3 Authorization test matrix (must fail appropriately)

| Request | Expected |
|---|---|
| Voter → admin endpoint | 403 |
| Voter → another user's profile | 403/404 |
| User → election they can't access | 403/404 |
| Unauthenticated → protected endpoint | 401 |
| Tampered cookie / bad session | 401 |
| Voter → create/start/end election | 403 |

---

## G. Voting Flow

```text
User opens election page (ACTIVE)
  → selects candidate
  → REVIEW screen (explicit confirmation, no accidental votes)
  → POST /api/elections/:id/vote
        ┌────────────────────────────────────────────┐
        │ 1. Rate limit (IP + user)                   │
        │ 2. requireUser (authenticated, ACTIVE)      │
        │ 3. load election BY ID from DB              │
        │ 4. election.status == ACTIVE  (else 409)    │
        │ 5. now within [start, end]                  │
        │ 6. candidate exists AND belongs to election │
        │    (composite FK also enforces at DB)       │
        │ 7. BEGIN TRANSACTION                        │
        │ 8. SELECT ... FOR UPDATE vote for           │
        │    (user, election) → duplicate check       │
        │ 9. INSERT vote (confirmation_id)            │
        │    → UNIQUE(user_id, election_id) backup    │
        │ 10. INSERT audit VOTE_CAST                  │
        │ 11. COMMIT  (any failure → ROLLBACK)        │
        │ 12. notification → in-app + email           │
        │ 13. return confirmation_id                  │
        └────────────────────────────────────────────┘
```

### G.1 Duplicate-vote & race protection (three layers)

1. **Application**: pre-check + row lock inside the transaction (`SELECT ... FOR UPDATE` on the voter's existing vote / serializable isolation).
2. **Database**: `UNIQUE(user_id, election_id)` — two simultaneous inserts → one succeeds, one throws; the loser is mapped to a safe `VOTE_ALREADY_CAST` error + `DUPLICATE_VOTE_ATTEMPT` audit.
3. **UI**: disabled submit + confirmation dialog (UX only, never the security control).

### G.2 Vote immutability

- No `PUT/PATCH/DELETE /votes/:id` routes exist.
- DB trigger rejects UPDATE/DELETE on `votes`.
- Results are computed by **server-side aggregation** of votes only. Frontend never submits or trusts counts.

### G.3 Results

```text
GET /api/elections/:id/results
  → admin or (voter, if election ENDED and results released)
  → SELECT candidate_id, COUNT(*) FROM votes WHERE election_id=? GROUP BY candidate_id
  → audit RESULT_VIEWED
```

No client-side math. No winner manipulation path.

---

## H. API Specification

Base: `/api`. All responses JSON. Errors: `{ error: { code, message } }` (safe messages; no stack traces). Validation: Zod before any service call.

### H.1 Auth
| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | – | IP | creates PENDING user |
| POST | `/api/auth/login` | – | IP+email | issues session cookie |
| POST | `/api/auth/logout` | ✓ | IP | revokes session |
| POST | `/api/auth/verify-email` | – | IP | body: `{ token }` |
| POST | `/api/auth/forgot-password` | – | IP+email | always 200 |
| POST | `/api/auth/reset-password` | – | IP | body: `{ token, password }` |
| GET | `/api/me` | ✓ | – | own profile |
| PATCH | `/api/me` | ✓ | – | name only (email change = separate verified flow, later) |

### H.2 Elections & voting
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/elections` | ✓ | list visible to user; status derived server-side |
| GET | `/api/elections/:id` | ✓ | detail + candidates + user's voting status |
| GET | `/api/elections/:id/results` | ✓ | gated by role/status/release rule |
| POST | `/api/elections/:id/vote` | ✓ | body `{ candidateId }`; strict limits |

### H.3 Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/stats` | totals, verification rate, activity |
| POST | `/api/admin/elections` | create (DRAFT) |
| PATCH | `/api/admin/elections/:id` | edit (only while DRAFT/UPCOMING) |
| POST | `/api/admin/elections/:id/start` | DRAFT/UPCOMING → ACTIVE (validated dates) |
| POST | `/api/admin/elections/:id/end` | ACTIVE → ENDED |
| POST | `/api/admin/elections/:id/candidates` | add candidate |
| PATCH | `/api/admin/elections/:id/candidates/:cid` | edit candidate |
| GET | `/api/admin/users` | list + filters |
| PATCH | `/api/admin/users/:id/status` | activate/suspend |
| GET | `/api/admin/audit-logs` | paged, filterable |
| GET | `/api/admin/security-events` | SOC detections feed |

### H.4 Notifications
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/notifications` | ✓ | own unread/read list |
| POST | `/api/notifications/:id/read` | ✓ | ownership check |

Status codes: `200` success · `201` created · `400` validation · `401` unauthenticated · `403` forbidden · `404` not found · `409` conflict (duplicate vote, wrong lifecycle) · `429` rate limited · `500` safe generic error.

---

## I. Email Notification Architecture

```text
Service/business logic
        │
        ▼
NotificationService.send(userId, event, payload)
        │
        ├── InAppChannel    → notifications table (user dashboard)
        └── EmailChannel    → Resend API (Resend SDK, template renderers)
        (Future: SMSChannel, PushChannel — interface without touching callers)
```

- Templates (safe, parameterized renderers — never raw HTML from users):
  - `verify-account` — "Verify your VoteForge account"
  - `password-reset` — "Reset your VoteForge password"
  - `welcome` — "Welcome to VoteForge"
  - `election-announcement` — "A new election is available"
  - `vote-confirmation` — "Your vote has been recorded"
  - `election-ended` — "The election has ended"
- Email channel failures are caught, logged as `NOTIFICATION_FAILED` audit events; they never break the business transaction (vote already committed).
- `RESEND_API_KEY` / `EMAIL_FROM` server-only.
- Every email also creates an in-app notification (dual channel).

---

## J. Security Threat Model

### J.1 Audit event catalog (enum `audit_event`)

`USER_REGISTERED · USER_VERIFIED · LOGIN_SUCCESS · LOGIN_FAILED · LOGOUT · PASSWORD_RESET_REQUESTED · PASSWORD_RESET_COMPLETED · SESSION_REVOKED · ELECTION_CREATED · ELECTION_UPDATED · ELECTION_STARTED · ELECTION_ENDED · CANDIDATE_CREATED · CANDIDATE_UPDATED · VOTE_CAST · VOTE_CONFIRMATION_SENT · DUPLICATE_VOTE_ATTEMPT · UNAUTHORIZED_ACCESS · RATE_LIMIT_TRIGGERED · USER_SUSPENDED · USER_ACTIVATED · RESULT_VIEWED · NOTIFICATION_FAILED`

**Never logged:** passwords, tokens (raw or hashed), secrets, reset codes, full email bodies.

### J.2 STRIDE summary + OWASP Top 10 mapping

| Threat (STRIDE) | OWASP | Mitigation |
|---|---|---|
| Spoofing / IDOR, BOLA | A01 Broken Access Control | server-side RBAC, ownership scoping, per-request role lookup |
| Tampering | A02 Cryptographic Failures | argon2id, signed cookies, token hashing at rest, HMAC |
| Repudiation | A09 Logging/Monitoring | append-only audit log, IP/UA captured |
| Information Disclosure | A01/A02/A05 | no secrets in logs, safe errors, minimal result exposure |
| DoS / abuse | A04/A07 | rate limiting, request size limits, input validation |
| Elevation of Privilege | A01 | `requireAdmin` + tests (Test 6) |
| Injection (SQL/XSS) | A03 | Prisma parameterized queries; React escapes by default; no `dangerouslySetInnerHTML` |
| Cryptographic failures | A02 | tokens ≥ 256-bit, hashed storage, expiring, single-use |
| Software/Data integrity | A08 | immutable votes, append-only audit, signed session cookies |
| Auth failures | A07 | session revocation, fixation defense, verified email gate |
| CSRF | – | SameSite=Strict + custom-header check + signed cookie |

### J.3 SOC detection rules (query `audit_logs`, surfaced on `/api/admin/security-events`)

| Rule | Pattern | Action |
|---|---|---|
| Brute force | ≥5 `LOGIN_FAILED` same user/IP in 15 min | audit `RATE_LIMIT_TRIGGERED`, flag user |
| Privilege escalation attempt | ≥3 `UNAUTHORIZED_ACCESS` from same user in 15 min | flag user |
| Voting abuse | `DUPLICATE_VOTE_ATTEMPT` (any) | flag election + user |
| API abuse | ≥10 `RATE_LIMIT_TRIGGERED` same IP in 1 h | flag IP |
| Account takeover signal | login from new IP/UA for account with recent password reset | flag |

Detection = labeled security events in the dashboard. **Honest labeling:** these are simulation detections over real audit data, not a real SIEM.

### J.4 Out-of-scope / honest notes
- RLS is optional hardening (app layer is primary). If skipped, it is stated — never faked.
- No real SIEM integration; the audit feed is structured to be exportable (JSONL/CSV export for the portfolio).
- Vote "immutability" is enforced by DB triggers; an admin correction path is deliberately **not** implemented in v1.

---

## K. Development Roadmap

| Phase | Deliverable | Exit criteria |
|---|---|---|
| 0 | This blueprint | Approved |
| 1 | Foundation: Next.js, Tailwind, ESLint, Prisma + migrations, logger, error handling, security headers, base UI primitives | `npm run lint`, `npm run typecheck`, build passes |
| 2 | Design system: tokens, primitives, status components, empty/loading/error states, responsive shell | Storybook-less component inventory |
| 3 | Auth: register, verify, login, logout, sessions, rate limiting, reset flow | Auth integration tests pass |
| 4 | User system: profile, admin user management, suspend/activate | IDOR/RBAC tests pass |
| 5–6 | Election + candidate management, lifecycle enforcement | Lifecycle tests pass |
| 7–9 | Voting: transaction, duplicate prevention, immutability, results | **Voting Test 1–7 all pass** |
| 10 | Notifications: in-app + Resend email, 6 templates | Notification tests pass |
| 11 | Admin dashboard + SOC security/audit views | Security event tests pass |
| 12 | Full test suite, VAPT-style audit, docs (ARCHITECTURE/API/DATABASE/SECURITY/TESTING), README | Final audit checklist complete |

---

## L. Testing Strategy

### L.1 Stack
Vitest + Supertest. Integration/security suites run against a dedicated test PostgreSQL database (migrations applied, reset between runs).

### L.2 Unit
- Zod schemas (email, password policy, IDs, dates, roles)
- Election lifecycle transition rules
- Password policy & hashing round-trip
- Token generation/hashing/expiry logic
- Rate-limiter behavior
- Authorization helpers (`requireUser`/`requireAdmin`)

### L.3 Integration (happy + negative)
- Registration → verification → login
- Election create → start → vote → end → results
- Password reset full cycle
- Notification delivery (in-app + email mocked)

### L.4 Security / critical voting tests (MUST PASS)
```text
Test 1  User votes once                                          → SUCCESS
Test 2  Same user votes again                                    → BLOCKED (409, DB constraint)
Test 3  Vote after election ends                                 → BLOCKED
Test 4  Candidate from another election                          → BLOCKED (service + composite FK)
Test 5  Unauthenticated vote attempt                             → BLOCKED (401)
Test 6  Voter attempts admin operation                           → BLOCKED (403)
Test 7  Two simultaneous vote requests (race)                    → exactly one vote row
```
Plus: IDOR/BOLA, RBAC matrix (F.3), injection probes, XSS (payloads in descriptions rendered as text), rate-limit bypass attempts, auth bypass, result-manipulation attempts (client cannot alter counts).

### L.5 VAPT-style final audit
Section 45 checklist run as a gate before "complete": auth, authz, injection, API, voting integrity, data exposure, secrets, infrastructure/dependency scan (`npm audit`), production config review.

---

## M. Environment / tooling notes

- This machine has no Docker or local PostgreSQL. DB options:
  - **Supabase PostgreSQL** (free hosted, recommended — `DATABASE_URL` + `DIRECT_URL`), or
  - **Local PostgreSQL install** (Windows installer) — requires manual setup.
- PowerShell blocks `.ps1` execution → npm must be invoked as `npm.cmd` / `npx.cmd`.
- Email (Resend) will be mocked in dev if no API key is present; a `dev` flag clearly labels simulated sends. Never shipped as real behavior.

---

*End of blueprint. Awaiting approval to begin Phase 1.*
