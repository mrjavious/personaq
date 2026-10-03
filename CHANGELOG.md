# Changelog

All notable changes to Persona Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned — Task 2: Honest Generation Pipeline & Persona Face Card Integrity
- **Honest Pipeline Execution**: Completely eliminate silent mock fallbacks and recycled placeholder substitution. If upstream cloud generation or local ComfyUI is unavailable or unconfigured, return typed structured errors (`GEN_TIMEOUT`, `GEN_UPSTREAM_ERROR`, `PROVIDER_UNAVAILABLE`, `GPU_OFFLINE`, `PROMPT_REJECTED`).
- **Cloud-First Visual Generation**: Support cloud-native image generation (Google Imagen / Gemini multimodal / cloud ComfyUI) with zero local GPU requirement.
- **Face Card Consistency & Anchor Locking**: Maintain identity consistency across generation requests using reference face embeddings and structured prompt seeds tied to the active Persona Version snapshot.
- **Safety Gate Integration**: Enforce adult-only ($\ge 21$) and synthetic disclosure watermarking across all generated visual assets prior to storage persistence.

### Planned — Task 3: Multi-Platform Publishing Dispatcher & Queue Hardening
- **Queue Worker Hardening**: BullMQ worker execution with exponential backoff, randomized jitter, and concurrency limits per platform account.
- **Publishing Idempotency**: Strict idempotency key verification to guarantee zero duplicate posts across Instagram, X, Threads, TikTok, and Fanvue.
- **Status Reconciliation**: Automated state transitions (`draft` -> `pending_safety` -> `approved` -> `scheduled` -> `published` / `failed`) with audit trail logging.

### Planned — Task 4: Compliance Engine, Cryptographic Audit Log & Neutral Landing Hubs
- **Guardrail Rule Verification**: Automated detection and alerting on stale platform rules (> 90 days).
- **Append-Only Cryptographic Audit Log**: Tamper-evident HMAC signature chaining across all administrative, safety, and publishing events.
- **Neutral Link Landing Pages**: Privacy-preserving redirect engine with aggregated click metrics and UTM parameter forwarding.

### Planned — Task 5: End-to-End Persona Journey Integration & Production Readiness
- **Comprehensive E2E Integration Suite**: Full lifecycle integration test covering Persona creation -> reference upload -> face lock -> visual generation -> post scheduling -> publishing -> engagement draft review.
- **Containerized Production Verification**: Validated Docker Compose deployment with production health probes and metrics export.

---

## [0.3.0] - 2026-10-03

### Completed — Task 0: Clean Baseline & Hygiene
- **Package Scripts Cleaned**: Removed unnecessary Husky and lint-staged hooks to ensure reliable, zero-friction builds across all platforms including Windows.
- **React Hydration & Theme Hygiene**: Refactored `AppShell` and `ThemeProvider` to use `useSyncExternalStore`, eliminating `setTimeout(0)` flash workarounds and hydration mismatch warnings.
- **Persona Component State Cleanup**: Removed redundant layout sync effects in `PersonaAgentCards`; cards now initialize directly from props keyed by persona ID.
- **Next.js 16 Flat Config Fix**: Resolved ESLint 9 plugin redefinition conflict with `next/core-web-vitals` in `eslint.config.mjs`.

### Completed — Task 1: API Correctness, RBAC, Rate Limiting, and Exposure Hardening
- **Unified API Handler**: Created `withApi(handler, options)` in `src/lib/api/handler.ts` mapping `ApiError` (401/403), `ZodError` (400 with flattened details), and generic errors (500) consistently across all 30+ endpoints.
- **Role-Based Access Control (RBAC)**: Enforced granular permissions (`manage_users`, `manage_persona`, `upload_assets`, `review_safety_overrides`, `compose_posts`, `schedule_posts`, `approve_replies`, `view_analytics`, `manage_platform_rules`) across all route handlers.
- **Strict Zod Input Validation**: Wired strict request body schemas across all mutating and generation routes.
- **Rate Limiting Hardening**:
  - Validated `TRUSTED_PROXY=true` before trusting `x-forwarded-for` or `x-real-ip` headers to block client IP spoofing.
  - Implemented per-user distributed lockout for TOTP verification across rotating client IPs.
  - Implemented daily per-user generation caps with bounded capacity maps and automatic expired entry sweeping.
- **Login Timing Protection**: Mitigated user enumeration timing attacks by running constant-time `bcrypt.compare` against a module-level pre-hashed dummy salt when non-existent emails are queried.
- **Sanitized Health Diagnostic Endpoint**: Configured `/api/health` so unauthenticated requests return strictly `{ status: 'ok' | 'degraded' }`, while authenticated requests receive a sanitized report with `REDIS_URL` credentials and filesystem paths omitted.
- **Next 16 Edge Proxy Migration**: Migrated edge route protection from deprecated `middleware.ts` to `src/proxy.ts` with exact and segment-boundary route matching, keeping `/uploads/*`, `/metrics`, and `/api-docs` strictly private.
- **Public Avatar Endpoint**: Created `/public-media/avatar/[personaId]` with strict path traversal validation for public link pages.
- **Dynamic Content Security Policy (CSP)**: Updated `next.config.ts` to dynamically allow configured S3/MinIO origins in `img-src` and `connect-src`.

---

## [0.2.0] - 2026-10-01

### Security

- Removed hardcoded JWT signing secret from `src/lib/auth/session.ts`
- Removed hardcoded AES-256-GCM encryption key from `src/lib/security/encryption.ts`
- Added rate limiting to authentication endpoints (login, 2FA verify, 2FA setup)
- Added `requireAuth()` guard to all 30+ API routes
- Added security headers (CSP, HSTS, X-Frame-Options, etc.) in `next.config.ts`
- Restricted JWT algorithm to HS256 with issuer/audience validation
- Encrypt TOTP secrets at rest using AES-256-GCM
- Created initial Zod schemas for core entity validation (`src/lib/validation/schemas.ts`)
- Added SameSite=Lax cookie-based session protection
- Fixed `.env.example` to use placeholder values instead of realistic defaults

### Architecture

- Fixed SQLite/PostgreSQL provider configuration
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
- Added health check endpoint
- Added API documentation (OpenAPI 3.0 spec)
- Added audit log CSV export
- Added scheduled compliance checks
- Added caching of platform rules data

### Testing

- Added Playwright E2E test configuration
- Added smoke tests for critical user flows
- Added accessibility testing (`eslint-plugin-jsx-a11y`)

### Operations

- Created database backup script (`scripts/backup.sh`)
- Created database restore script (`scripts/restore.sh`)
- Added metrics endpoint (`/api/metrics`)
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
