# Changelog

All notable changes to Persona Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-10-01

### Security

- Removed hardcoded JWT signing secret from `src/lib/auth/session.ts`
- Removed hardcoded AES-256-GCM encryption key from `src/lib/security/encryption.ts`
- Added rate limiting to authentication endpoints (login, 2FA verify, 2FA setup)
- Added `requireAuth()` guard to all 30+ API routes
- Created `src/middleware.ts` for edge-level route protection
- Added security headers (CSP, HSTS, X-Frame-Options, etc.) in `next.config.ts`
- Restricted JWT algorithm to HS256 with issuer/audience validation
- Fixed user enumeration timing attack in login endpoint
- Encrypt TOTP secrets at rest using AES-256-GCM
- Added Zod input validation schemas for all API inputs
- Added CSRF protection via SameSite cookies + origin validation
- Fixed `.env.example` to use placeholder values instead of realistic defaults

### Architecture

- Fixed SQLite/PostgreSQL provider mismatch (schema now uses PostgreSQL)
- Added database indexes on frequently queried fields (PostVariant, ClickEvent, AnalyticsSnapshot, DraftReply, AuditLog)
- Fixed N+1 query pattern in `createPostWithVariants` and `updatePostWithVariants`
- Added idempotency checks to publishing (prevents duplicate publishes)
- Wrapped multi-step publish operations in database transactions
- Added retry logic with exponential backoff for failed publishes
- Created circuit breaker pattern for external AI API calls
- Created Redis caching utility for AI responses
- Added pagination to list endpoints (posts, links, personas, assets)
- Created Dockerfile + .dockerignore for containerized deployment
- Added app + worker services to docker-compose.yml
- Created CD pipeline (`.github/workflows/cd.yml`)
- Added CI security scanning (npm audit + Trivy)
- Added soft delete mechanism (`deletedAt` field on Persona, Post, Asset, LinkHub)
- Added CDN/signed URL support for private asset access
- Added image optimization pipeline (WebP/AVIF conversion, responsive sizes)
- Added feature flags system (DB-backed with caching)
- Added metrics collection (counters, histograms, gauges)
- Added structured logging utility
- Added comprehensive health check (DB latency, Redis, Storage, AI providers)
- Added request validation middleware
- Added API documentation (OpenAPI 3.0 spec)
- Added audit log CSV export
- Added scheduled compliance checks
- Added caching of platform rules data

### Testing

- Added Playwright E2E test configuration
- Added smoke tests for critical user flows
- Added pre-commit hooks (Husky + lint-staged)
- Added accessibility testing (`eslint-plugin-jsx-a11y`)

### Code Quality

- Created Zod validation schemas (`src/lib/validation/schemas.ts`)
- Created auth guard utilities (`src/lib/auth/guards.ts`)
- Created rate limiting utility (`src/lib/security/rate-limit.ts`)
- Created circuit breaker utility (`src/lib/ai/circuit-breaker.ts`)
- Created AI response caching utility (`src/lib/ai/cache.ts`)
- Created structured logging utility (`src/lib/logging/index.ts`)
- Created metrics collection utility (`src/lib/metrics/index.ts`)
- Created feature flags utility (`src/lib/feature-flags/index.ts`)
- Created image optimization utility (`src/lib/media/optimization.ts`)
- Created compliance scheduler (`src/lib/compliance/scheduler.ts`)
- Created database backup/restore scripts (`scripts/backup.sh`, `scripts/restore.sh`)
- Added migration scripts to package.json

### Operations

- Created database backup script (`scripts/backup.sh`)
- Created database restore script (`scripts/restore.sh`)
- Added metrics endpoint (`/api/metrics`)
- Added comprehensive health check endpoint
- Added API documentation endpoint (`/api-docs/openapi.json`)

---

## [0.1.0] - 2026-10-01

### Added

- Initial release of Persona Studio
- Next.js 16 + React 19 + TypeScript
- Prisma ORM with SQLite/PostgreSQL support
- JWT-based authentication with 2FA (TOTP)
- Role-based access control (owner, admin, editor)
- AI persona management with guardrails
- Asset library with safety gate pipeline
- Multi-platform post composer and scheduler
- Publishing adapters (Instagram, X, Threads, TikTok, Fanvue)
- Analytics dashboard with AI summaries
- Engagement assistant with draft replies
- UTM link generator with click tracking
- Compliance audit and platform rules
- Docker Compose infrastructure (PostgreSQL, Redis, MinIO)
- Tauri desktop app wrapper
