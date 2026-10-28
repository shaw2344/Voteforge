# VoteForge — Academic Voting Simulation Platform

A production-grade full-stack web application for running **academic-level voting simulations**. It supports both **candidate elections** (positions with candidates, e.g. student council) and **proposal ballots** (e.g. yes/no/abstain decisions), with real-time results, one-person-one-vote enforcement, a simulation mode that auto-generates voters, and an integrated **AI Security Copilot** for real-time threat analysis and defense.

---

## Default Login Credentials

| Role    | Student ID   | Password      |
|---------|-------------|---------------|
| Admin   | `admin`     | `Admin@2026`  |
| Student | `student001`| `Student@2026`|

These accounts are created by `npm run seed`. The admin account has full access to the AI Security Copilot, election management, and simulation tools.

---

## Features

### Core Voting

- **Two ballot types** — Candidate ballots (multiple positions, each with candidates) and proposal ballots (yes/no/abstain options).
- **One person, one vote** — enforced at the SQLite engine level via partial unique indexes, not just app logic.
- **Real-time results dashboard** — live bar and pie charts powered by Socket.IO; updates instantly as votes land.
- **Simulation mode** — admins auto-generate thousands of simulated voters and randomized ballots in one click (up to 5,000 per election).
- **Admin console** — create and manage elections, set statuses (draft/active/closed), list users, run simulations.

### Authentication & Sessions

- **Student ID + password** registration and login with bcrypt key stretching (10 rounds).
- **JWT sessions** — short-lived access tokens (30 min) + rotating refresh tokens (7 days) in `httpOnly`, `SameSite=strict` cookies.
- **Refresh token rotation with reuse detection** — replaying a rotated token automatically revokes the entire session chain.

### AI Security Copilot

- **Real-time threat dashboard** — system risk index (0–100), severity breakdowns (Critical/High/Medium/Low), 24-hour event counts, active IP blocks, and token replay alerts.
- **AI-powered analysis** — built-in heuristic threat reasoning engine with optional external LLM integration (OpenAI, Google Gemini, Ollama, or custom endpoint).
- **Interactive copilot chat** — natural language queries for security status, threat analysis, IP blacklist review, and election integrity verification.
- **SIEM event stream** — real-time security event log with severity filtering and full-text search, streamed via Socket.IO.
- **Attack simulator lab** — safely simulate credential stuffing, token replay, Sybil voting anomalies, and privilege escalation attempts to test defenses.
- **IP blacklist management** — block and unblock IP addresses directly from the copilot interface.
- **Automated audit reports** — generate exportable Markdown security compliance reports with MITRE ATT&CK alignment.
- **Prompt injection defense** — system instructions separated from untrusted telemetry data; automatic defense against prompt extraction attempts.
- **Advisory-only** — the copilot never modifies votes, election results, users, or permissions.

---

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 18, Vite 6, React Router 6, Recharts, Framer Motion, Socket.IO client |
| Backend    | Node.js 24 (built-in `node:sqlite`), Express 4 |
| Database   | SQLite (WAL mode, foreign keys, partial unique indexes) |
| Real-time  | Socket.IO 4 |
| Validation | Zod |
| Security   | Helmet, express-rate-limit, bcryptjs, JWT with rotating refresh tokens, CSRF-hardened cookies |
| AI Copilot | Built-in heuristic engine + optional OpenAI / Gemini / Ollama / custom LLM integration |

---

## Project Structure

```
voteforge/
├── server/
│   ├── src/
│   │   ├── index.js                 # Express app, middleware, static serving, startup
│   │   ├── config.js                # Environment config
│   │   ├── db.js                    # SQLite schema, migrations, helpers
│   │   ├── electionService.js       # Status & results computation
│   │   ├── securityCopilotService.js # AI Security Copilot core logic
│   │   ├── socket.js                # Socket.IO setup + auth middleware
│   │   ├── io.js                    # Shared Socket.IO reference
│   │   ├── middleware/
│   │   │   ├── auth.js              # requireAuth, requireAdmin
│   │   │   ├── rateLimiter.js       # Global + endpoint-specific rate limiters
│   │   │   ├── validate.js          # Zod validation + error handler
│   │   │   └── ipBlock.js           # IP blocklist middleware
│   │   └── routes/
│   │       ├── auth.js              # Register, login, refresh, logout, me
│   │       ├── elections.js         # Election CRUD + detail
│   │       ├── votes.js             # Cast vote, results, my-vote
│   │       ├── myVotes.js           # User vote history
│   │       ├── admin.js             # Admin stats, users, elections, simulation
│   │       └── security.js          # AI Security Copilot API endpoints
│   ├── scripts/
│   │   └── seed.js                  # Seed admin + demo accounts + elections
│   ├── .env.example                 # Environment variable template
│   └── package.json
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ElectionDetail.jsx
│   │   │   ├── Results.jsx
│   │   │   ├── LiveResults.jsx
│   │   │   ├── MyVotes.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Admin.jsx
│   │   │   └── SecurityCopilot.jsx  # AI Security Copilot dashboard
│   │   ├── components/
│   │   │   ├── NavBar.jsx
│   │   │   ├── VoteForm.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── AnimatedBarList.jsx
│   │   │   ├── DonutChart.jsx
│   │   │   └── BallotSceneContent.jsx
│   │   ├── auth/                    # AuthContext, ProtectedRoute
│   │   ├── theme/                   # ThemeContext (dark/light)
│   │   ├── styles.css               # Global design system + component styles
│   │   ├── api.js                   # Axios instance with interceptors
│   │   ├── App.jsx                  # Route definitions
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## Setup

Requirements: **Node.js >= 22.5** (uses the built-in `node:sqlite` — no native SQLite bindings needed).

### 1. Install dependencies

```bash
# Server
cd server
npm install

# Client (new terminal)
cd client
npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
# Edit .env with your own secrets (especially JWT_SECRET for production)
```

### 3. Seed demo data

```bash
cd server
npm run seed
```

This creates:

| Role    | Student ID   | Password      |
|---------|-------------|---------------|
| Admin   | `admin`     | `Admin@2026`  |
| Student | `student001`| `Student@2026`|

Plus two demo elections (a candidate ballot and a proposal ballot).

### 4. Run in development

```bash
# Terminal 1 — Server
cd server && npm run dev

# Terminal 2 — Client
cd client && npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` and `/socket.io` to the backend on port 4000.

---

## Production Build

```bash
# Build the client
cd client && npm run build    # outputs to client/dist

# Start the server (serves built client + API on :4000)
cd server && npm run start
```

For production, set these in your `.env`:

```env
NODE_ENV=production
JWT_SECRET=<long-random-string>
COOKIE_SECURE=true           # required when serving over HTTPS
```

The server refuses to start in production with the default development secret.

---

## AI Security Copilot Configuration

The copilot works out of the box with the **built-in heuristic threat reasoning engine** (zero API keys needed). For enhanced AI-powered analysis, configure an external LLM provider:

```env
# In server/.env

# Options: builtin | openai | gemini | ollama | custom
SECURITY_COPILOT_PROVIDER=builtin

# For OpenAI
OPENAI_API_KEY=sk-...
SECURITY_COPILOT_MODEL=gpt-4o

# For Google Gemini
GEMINI_API_KEY=...
SECURITY_COPILOT_MODEL=gemini-2.5-flash

# For local Ollama
OLLAMA_URL=http://localhost:11434
```

Provider configuration can also be updated at runtime through the copilot's settings panel (admin only).

---

## Security Copilot API Endpoints

All endpoints require admin authentication (`requireAuth` + `requireAdmin`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/security/dashboard` | System risk score, event counts, IP blocks, recent events |
| GET | `/api/admin/security/events` | Security event log with severity/type/search filters |
| POST | `/api/admin/security/analyze` | Run AI threat diagnostic on recent telemetry |
| POST | `/api/admin/security/chat` | Interactive copilot chat (natural language queries) |
| POST | `/api/admin/security/mitigate` | Execute defensive actions (block IP, revoke sessions, pause election) |
| POST | `/api/admin/security/simulate-attack` | Launch simulated attacks for testing |
| GET | `/api/admin/security/report` | Generate exportable audit report (Markdown) |
| POST | `/api/admin/security/config` | Update copilot provider settings |

---

## Security Measures

### Authentication & Authorization

- **bcrypt** password hashing (10 rounds); plaintext never stored or returned.
- **JWT access tokens** (30 min TTL) + **rotating refresh tokens** (7 days) in `httpOnly`, `SameSite=strict` cookies.
- **Refresh token reuse detection** — replaying a rotated token revokes the entire session chain.
- **RBAC** — admin-only routes guarded by role checks; simulated users flagged with `is_simulated`.

### Data Integrity

- **One-person-one-vote** enforced via SQLite partial unique indexes (`uq_vote_candidate`, `uq_vote_proposal`).
- All database queries use **prepared statements** — no SQL injection possible.

### Network & Transport

- **Helmet** sets secure HTTP headers; `X-Powered-By` disabled.
- **Rate limiting** — global limiter plus tighter limits on auth and voting endpoints.
- **CSRF protection** — cookies use `SameSite=strict`; state-changing endpoints require JSON content-type.
- **IP blocklist** — suspicious IPs can be blocked in real-time via the Security Copilot.

### Audit & Monitoring

- **Audit trail** — every auth event, admin action, and vote is recorded with IP address in `audit_log`.
- **Security event stream** — real-time telemetry broadcast via Socket.IO to admin dashboards.
- **AI Security Copilot** — continuous threat analysis with MITRE ATT&CK-aligned recommendations.

---

## Core API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | public | Create account |
| POST | `/api/auth/login` | public | Sign in |
| POST | `/api/auth/refresh` | public | Rotate session |
| POST | `/api/auth/logout` | public | End session |
| GET | `/api/auth/me` | user | Current user |
| GET | `/api/elections` | user | List elections |
| GET | `/api/elections/:id` | user | Election detail |
| GET | `/api/elections/:id/results` | user | Computed results |
| GET | `/api/elections/:id/my-vote` | user | My ballot |
| POST | `/api/elections/:id/vote` | user | Cast ballot |
| GET | `/api/votes` | user | My vote history |
| GET | `/api/admin/elections` | admin | Manage elections |
| POST | `/api/admin/elections` | admin | Create election |
| PATCH | `/api/admin/elections/:id` | admin | Update election |
| POST | `/api/admin/elections/:id/status` | admin | Set status |
| POST | `/api/admin/elections/:id/simulate` | admin | Run simulation |
| DELETE | `/api/admin/elections/:id` | admin | Delete election |
| GET | `/api/admin/users` | admin | List users |
| GET | `/api/admin/stats` | admin | Overview stats |

### Socket.IO Events

| Event | Room | Direction | Description |
|-------|------|-----------|-------------|
| `results:update` | `election:<id>` | Server → Client | Updated vote tallies |
| `vote:cast` | `election:<id>` | Server → Client | New vote notification |
| `election:status` | `election:<id>` | Server → Client | Election status change |
| `simulation:done` | `election:<id>` | Server → Client | Simulation complete |
| `security:event` | `admin:security` | Server → Client | New security event |
| `security:metrics` | `admin:security` | Server → Client | Updated risk metrics |

---

## Simulation

From the **Admin > Elections** tab, click **Simulate** on any election and enter a voter count (default 200, max 5,000). VoteForge generates that many simulated student accounts and casts randomized ballots, then pushes live results to any open dashboards.

---

## License

Built for academic use. For real legal elections, additional measures such as voter identity verification and independent tally audit would be required.
