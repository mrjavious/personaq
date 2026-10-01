# Persona Studio (`personaq`)

> A web application (and future Windows desktop app) for managing a **disclosed, fictional AI persona** across social platforms: content planning, asset management with safety checks, multi-platform scheduling, AI caption assistance, and funnel analytics from SFW social channels to creator monetization (Fanvue).

---

## 🛡️ Non-Negotiable Guardrails (Section 2)

1. **Adult-Only Persona:** Strict adult age check ($\ge 25$ recommended, $\ge 18$ absolute minimum). Any asset flagged as depicting a minor or youthful appearance is hard-blocked.
2. **Fictional Identity Only:** Zero likeness to real people or celebrities. No real-person reference images.
3. **AI Disclosure Everywhere:** Profile AI disclosure mandatory; every post flagged `ai_generated = true`; platform AI labels enforced.
4. **Asset Class Separation:** Database-level and service-level hard lock separating `sfw_safe` from `adult_only`. Adult assets can **never** target Instagram, X, Threads, or TikTok.
5. **Human-in-the-Loop:** Outbound replies, posts, and comments require manual approval; no auto-posting bots.
6. **Provenance & C2PA Metadata:** Exported media carries cryptographic/metadata provenance flags.
7. **Audit Logging:** Every publish, approval, safety decision, and override is permanently logged.
8. **Official APIs & Manual-Assist Queues:** No scraping or unauthorized automation.
9. **Platform Rules as Data:** Dynamic rule schemas with $> 90$-day staleness warnings.

---

## 🚀 Architecture & Core Infrastructure

- [x] **Scaffold:** Next.js (App Router) + TypeScript Strict Mode + Tailwind CSS v4.
- [x] **Data Layer:** Prisma ORM with full 12-model schema (SQLite for local dev, PostgreSQL for production).
- [x] **Infrastructure:** `docker-compose.yml` for PostgreSQL 16, Redis 7 (BullMQ), and MinIO (S3 object storage).
- [x] **Auth & 2FA:** JWT session management, TOTP authenticator app support (QR code + secret), single-use backup codes, and RBAC (`owner`, `admin`, `editor`).
- [x] **Guardrail Engine:** Service-level rules checking adult age, asset suitability platform separation, safety gate readiness, and rule staleness.
- [x] **Tooling & CI:** Vitest unit test suite, ESLint, Prettier, and GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- [x] **Base Layout & Dashboard:** High-end dark theme dashboard, persistent guardrails status banner, live system connectivity health check, and 2FA login screen.
- [x] **Security:** Rate limiting, circuit breakers, structured logging, and comprehensive health checks.
- [x] **Testing:** Playwright E2E tests, pre-commit hooks (Husky + lint-staged), and accessibility testing.
- [x] **Operations:** Database backup/restore scripts, metrics collection, and feature flags.

---

## 💻 Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file with the following variables:
```env
# Database
DATABASE_URL="file:./dev.db"

# Authentication (REQUIRED - generate secure values)
AUTH_SECRET="<generate with: openssl rand -base64 32>"
AUTH_REQUIRE_2FA=true

# Encryption (REQUIRED - generate secure value)
ENCRYPTION_KEY="<generate with: openssl rand -hex 32>"

# Redis (optional - for rate limiting)
REDIS_URL="redis://localhost:6379"

# Storage (optional - defaults to local disk)
STORAGE_USE_S3=false
STORAGE_ENDPOINT="http://localhost:9000"
STORAGE_BUCKET="personaq-assets"
```

### 3. Database Initialization & Seeding
```bash
# Push schema to SQLite
npm run db:push

# Seed default owner user, Aria Nova persona, and platform rules
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run linter
npm run lint

# Build production bundle
npm run build

# Run load tests (requires k6)
k6 run tests/performance/k6-load-test.js
```

---

## 🔒 Security Features

- **Rate Limiting:** Authentication endpoints are rate-limited to prevent brute-force attacks.
- **Circuit Breakers:** External AI API calls are protected by circuit breakers to prevent cascading failures.
- **Input Validation:** All API inputs are validated using Zod schemas.
- **Security Headers:** CSP, HSTS, X-Frame-Options, and other security headers are enforced.
- **TOTP Encryption:** 2FA secrets are encrypted at rest using AES-256-GCM.
- **Audit Logging:** All security-relevant actions are permanently logged.

---

## 📊 Monitoring & Operations

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Metrics
```bash
curl http://localhost:3000/api/metrics
```

### API Documentation
```
http://localhost:3000/api-docs
```

### Database Backup
```bash
./scripts/backup.sh
```

### Database Restore
```bash
./scripts/restore.sh <backup_file>
```

### Queue Management
```bash
# View queue status (requires Redis)
curl http://localhost:3000/api/publishing/worker
```

---

## 🎬 Setup & Security Walkthrough

### Initial Setup
1. Clone the repository
2. Run `npm install`
3. Configure `.env` with secure values
4. Run `npm run db:push` to initialize the database
5. Run `npm run db:seed` to create initial data
6. Start the development server with `npm run dev`

### Production Deployment
1. Set up PostgreSQL, Redis, and MinIO using `docker-compose.yml`
2. Configure environment variables for production
3. Run database migrations: `npm run db:migrate:deploy`
4. Build the application: `npm run build`
5. Start the server: `npm run start`

### Security Best Practices
- Always use strong, randomly generated secrets for `AUTH_SECRET` and `ENCRYPTION_KEY`
- Enable 2FA for all user accounts
- Regularly rotate encryption keys
- Monitor audit logs for suspicious activity
- Keep dependencies updated

---

## 📁 Project Structure

```
personaq/
├── prisma/              # Database schema and migrations
├── scripts/             # Backup and restore scripts
├── src/
│   ├── app/             # Next.js App Router pages and API routes
│   ├── components/      # React components
│   ├── lib/             # Business logic and utilities
│   │   ├── ai/          # AI providers and circuit breakers
│   │   ├── auth/        # Authentication and authorization
│   │   ├── compliance/  # Compliance scoring and scheduling
│   │   ├── db/          # Database client
│   │   ├── feature-flags/ # Feature flag system
│   │   ├── logging/     # Structured logging
│   │   ├── metrics/     # Metrics collection
│   │   ├── middleware/  # Request validation middleware
│   │   ├── security/    # Encryption and rate limiting
│   │   ├── storage/     # File storage abstraction
│   │   └── validation/  # Zod validation schemas
│   └── middleware.ts    # Edge middleware
├── tests/               # Unit and E2E tests
├── .github/workflows/   # CI/CD pipelines
├── docker-compose.yml   # Infrastructure services
└── Dockerfile           # Application container
```

---

## 📄 License

Proprietary - All rights reserved.
