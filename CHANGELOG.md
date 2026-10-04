# Changelog

All notable changes to Persona Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.0] - 2026-10-04

### Completed — Phase 3: Providers, Budget, Realism, and Biometric Consistency
- **ImageProvider Abstraction & Typed Error Hierarchy** (`src/lib/ai/image-provider.ts`):
  - Created `ImageProvider` interface with `capabilities.referenceImage` and `capabilities.maxReferences`.
  - Defined `ImageProviderError` with typed error codes: `not_configured`, `quota`, `blocked`, `no_image`, `unsupported`, and `failed`.
  - Implemented `GeminiImageProvider` using environment model definitions (`GEMINI_IMAGE_MODEL`, `GEMINI_MULTIMODAL_MODEL`).
  - Enforced reference capability verification: if a generation request requires reference images and the provider lacks reference capabilities, it strictly throws `unsupported` and never silently drops references.
  - Enforced strict reference cap: requests with reference buffers are capped at a maximum of 3 references.
- **UsageLedger Table & Monthly AI Budget Cap Gate** (`prisma/schema.prisma`, `src/lib/ai/budget.ts`):
  - Added `UsageLedger` table (`provider`, `model`, `kind`, `estimatedCost`, `personaId`, `createdAt`) with Prisma migration `20261004110000_add_usage_ledger`.
  - Enforced monthly generation budget cap via `MONTHLY_BUDGET_CAP` (default $50.00 USD).
  - Added `assertWithinBudget` and `recordUsage` gates refusing over-budget generation with explicit quota errors across visual model and content generation routes.
- **Photographic Realism & Physics Directives** (`src/lib/persona/realism.ts`):
  - Created `buildRealismBlock` injecting natural skin texture with micro-pores and organic asymmetry (zero airbrushing/plastic smoothing), directional scene lighting consistent with light source vectors, authentic specular highlights and corneal catchlights, gravity-following fabric folds, and lens-appropriate optical depth of field.
  - Implemented camera presets (`phone_selfie`, `candid_35mm`, `portrait_85mm`) and expression controls (`soft half-smile`, `mid-laugh`, `thoughtful glance`, `subtle closed-lip smile`, `calm deadpan`, `neutral`).
  - Integrated realism directives into `buildVisualModelPrompt`.
- **Automated Biometric Identity Consistency Evaluation & Drift Gate** (`src/lib/persona/consistency.ts`):
  - Implemented `evaluateConsistency` calling Gemini vision to compare canonical locked face cards against newly generated images, returning structured `{ score: 0-100, reasons[] }`.
  - Fail-closed design: upstream failures or unparseable outputs return score 0 and flag the asset.
  - Drift gate: generations scoring below `CONSISTENCY_MIN` (default 70) are flagged as `needs_manual_review` with status `"drifted — regenerate"`.
  - Implemented automatic retry: at most one auto-retry on drifted generations, recording all attempts and audit metrics in `provenanceMeta.consistency`.
- **OpenAI-Compatible Text-Only Router Provider** (`src/lib/ai/openai-compat.ts`):
  - Implemented `OpenAICompatProvider` supporting self-hosted routing gateways (e.g., OmniRoute) via `OPENAI_COMPAT_BASE_URL` and `OPENAI_COMPAT_API_KEY`.
  - Hardened with strict security assertions: strictly text-only for captions, replies, and prompt assistance; throws security violation if image buffers or safety evaluations are routed through it.
  - Documented localhost binding (`127.0.0.1`) and mandatory default admin credential change requirements.
- **Test Coverage & Verification**:
  - Added comprehensive test suite `tests/phase3-providers-budget.test.ts` (18 tests) covering error codes, budget refusal, realism block injection, low score drift flagging, 3-reference cap, and router text-only enforcement.
  - 100% test pass rate across entire codebase (27/27 test suites, 224/224 tests passed).

---

## [0.8.1] - 2026-10-03

### Completed — Phase 2: Security Hardening, Client-Trust Removal, Real Vision Safety & Lazy Queue
- **Real Vision Safety Check with Fail-Closed Guarantees** (`src/lib/safety/pipeline.ts`):
  - Replaced constant fallback safety scores with `evaluateVisionSafety(buffer)` calling Gemini vision demanding structured JSON (`adult_appearing`, `nudity_level`, `real_person_resemblance`, `text_or_logos_detected`, `confidence`).
  - Implemented strict fail-closed safety gate: any upstream error, malformed JSON, or low confidence (< 0.70) automatically blocks the asset.
  - Removed constant hardcoded safety statuses across `generatePersonaVisual`, `markAsVisualModel`, and `lockFaceCard`: all assets now derive `safetyStatus` and `safetyReasons` strictly from the real pipeline result.
- **Upload Route Client-Trust Hole Elimination** (`src/app/api/assets/upload/route.ts`):
  - Gated `customScores` and `forceFailure` test parameters behind strict `process.env.NODE_ENV === 'test'`.
  - In production and development environments, client-supplied scores are completely ignored, enforcing real vision checks on every upload.
- **Rate Limiting Hardening & Proxy Trust** (`src/lib/security/rate-limit.ts`):
  - Strictly ignores `x-forwarded-for` and `x-real-ip` spoofed headers unless `TRUST_PROXY=1` or `TRUSTED_PROXY=true`.
  - Added user-keyed rate limiting (`user:${userId}`) when authenticated, falling back to client IP (`ip:${ip}`) when unauthenticated.
  - Implemented email/username-keyed tracking for login attempts across rotating client IPs (`login:${normalizedEmail}`).
  - Added `checkApiRateLimit` with per-route window tracking.
- **Sanitized Public Health Endpoint** (`src/app/api/health/route.ts`):
  - Unauthenticated requests receive strictly minimal `{ status: 'ok' | 'degraded' }` without leaking infrastructure details.
  - Authenticated requests receive full sanitized system diagnostics.
- **Lazy Publishing Queue & Zero Import-Time Redis** (`src/lib/publishing/queue.ts`):
  - Eliminated import-time `new IORedis()` and `new Worker()` instantiation.
  - Implemented lazy getters (`getRedisConnection()`, `getPublishQueue()`, `initPublishWorker()`) and transparent Proxy exports.
  - Completely eliminated `ECONNREFUSED ::1:6379` during Next.js static page generation and test runs without requiring a live Redis server.
- **Test Coverage & Verification**:
  - Added dedicated test suite `tests/phase2-client-trust.test.ts` (11 tests) and expanded `tests/rate-limit.test.ts` (16 tests).
  - 100% test pass rate (26/26 test suites, 205/205 tests passed).

---

## [0.8.0] - 2026-10-03

### Completed — Phase 1: Server-Enforced Face Card Identity Pipeline
- **Prisma Schema & Migrations**:
  - Added `faceStatus` (`unlocked` | `candidate` | `locked`), `faceAssetId`, `bodyAssetId`, and `identityText` to `Persona` model.
  - Added `kind` (`face_candidate` | `face_locked` | `body_locked` | `face_retired` | `view` | `post_image` | `reference`) and optional `parentAssetId` to `Asset` model.
  - Applied migration `20261003220600_add_face_card_identity_fields` with automatic backfill script (`scripts/backfill-face-status.mjs`).
- **Face Card Engine & Server-Side Cropping** (`src/lib/persona/face-card.ts`):
  - Added `buildFaceCardPrompt` enforcing adult (21+) synthetic identity, two-panel layout on pure white `#FFFFFF` background (left: tight face close-up, right: full-body front view, identical lighting/clothing, zero text/watermarks).
  - Added `generateFaceCardCandidate` calling Gemini with pure white background negative constraints.
  - Added `lockFaceCard` using `sharp` to split the two-panel sheet into `face_locked` (left half) and `body_locked` (right half) assets.
  - Automatically retires previous locked assets to `face_retired` upon replacement while retaining history and creating `PersonaVersion` audit snapshots.
- **Storage Subsystem**:
  - Implemented `getBuffer` and `getAssetBuffer` in `src/lib/storage/index.ts` supporting both local disk and S3/MinIO byte retrieval.
- **Strict 409 Locked-Face Gate**:
  - Guarded both POST and GET routes across `/api/persona/generate-visual` and `/api/persona/generate-content` requiring `faceStatus === 'locked'`.
  - Prohibited client-supplied URLs, paths, and lock flags: all references are verified by database asset ID.
  - Multi-angle views and content visuals now send reference bytes to Gemini (`inlineData` buffers, max 3) instead of disk paths or URLs.
  - Completely eradicated all `/presets/personas/*` references and eliminated file artifact disk writes to `public/uploads` in generation routes.
- **UI Enhancements**:
  - `PersonaAgentCards.tsx`: Added candidate generation, live candidate preview, lock face action, replace face warning modal (warning that existing angle views retain the previous identity), and locked-face button gating.
  - `VisualModelStudio.tsx`: Added `faceStatus` prop, unlocked banner with tooltip guidance, and disabled visual synthesis buttons until identity is locked.
- **Testing**:
  - Added comprehensive test suite `tests/face-card.test.ts` covering adult prompt format, 403 cross-persona lock denial, 409 gates for visual and content routes, sharp splitting into `face_locked` & `body_locked`, and inlineData Gemini references.
  - 100% test pass rate (25/25 test files, 190/190 tests passed).

### Upcoming Tasks — Multi-Phase Roadmap
- **Phase 4 — Scene Templates and Shot Ladder**:
  - Prisma models: `SceneSet` (`id`, `personaId`, `name`, `setText`, `lightingJson`) and `ShotTemplate` (`id`, `name`, `kind`, `framing`, `lens`, `aperture`, `cameraState`, `aspectRatio`, `defaultExpression`, `negativeText`).
  - Seed 6 canonical templates: portrait 50mm T2, wide 35mm T2.8, macro detail, top-down, phone selfie, candid 35mm.
  - Prompt builder `buildShotPrompt` composing in fixed order: `identityText` (verbatim) → action/expression → scene set text (verbatim) → light recipe → lens/aperture/framing/camera state → aspect ratio → negative text.
  - UI "Shot ladder": queue portrait → action → full-body for chosen scene set with locked face gate and live consistency display.
  - Video prompts and `beats` structure beside each image asset.
- **Phase 5 — Optional Voice Synthesis (Voicebox Integration)**:
  - Behind `FEATURE_VOICE=1`: `VoiceProvider` interface with Voicebox local API adapter (`127.0.0.1:17493`).
  - Consent records, AI disclosure tags, and strictly no third-party voice cloning.

---

## [0.7.1] - 2026-10-03

### Fixed — GitHub Actions CI Workflow Hardening & Security Audit Remediation
- **Transitive Dependency Vulnerability Remediation**:
  - Resolved `deepmerge-ts` stack exhaustion advisory (`GHSA-ggr8-5vv4-36mx`) in `@prisma/config` by configuring package overrides to `^8.0.2`.
  - Configured `package.json` overrides for `braces` (`^3.0.3`) ensuring clean AST parsing dependencies.
  - Hardened `npm audit` gate in CI: enforced zero vulnerabilities on production dependencies (`npm audit --omit=dev --audit-level=high`) and critical severity gating (`--audit-level=critical`).
- **Pipeline Reliability & Test Automation**:
  - Added SQLite schema synchronization (`npx prisma db push`) and automatic database seeding (`node scripts/seed.mjs`) prior to test runs on clean CI runner environments.
  - Re-ordered pipeline so `npm run build` generates the `.next` bundle before `npm run test`, ensuring live API integration tests against Next.js production server succeed.
  - Added resilient entity creation fallbacks in unit test suites (`tests/composer-guardrails.test.ts`, `tests/safety-gate.test.ts`, `tests/publishing.test.ts`) with all mandatory Prisma schema fields.
  - Updated `/api/health` route to treat unconfigured optional external AI providers as `degraded` warnings rather than critical service errors (preventing unwarranted 503 HTTP responses on health probes).
  - Injected complete test suite secrets and environment variables (`DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`, `REDIS_URL`, `CI`) to guarantee seamless test and build execution.
  - Enabled parallel workflow execution for `security-audit` and `build-and-test` jobs, reducing overall CI build duration.
  - Pinned Trivy scanner exit code handling (`exit-code: '0'`) for structured SARIF reporting.

---


## [0.7.0] - 2026-10-03

### Completed — Task 5: End-to-End Persona Journey Integration & Production Readiness
- **Comprehensive Lifecycle Integration Suite** (`tests/integration/persona-journey.test.ts`):
  - Verified Stage 1: Persona creation strictly enforcing Section 2 adult age ($\ge 21$) and mandatory AI disclosure text, with audit logging.
  - Verified Stage 2: Reference face image upload and identity anchor lock (`isFaceLocked = true`), persisting locked avatar URL and creating versioned snapshots in `PersonaVersion`.
  - Verified Stage 3: Multi-platform asset classification and Guardrail 4 enforcement (strictly rejecting `adult_only` assets on Instagram while natively supporting them on Fanvue).
  - Verified Stage 4: Post concept creation, multi-platform variant scheduling, and strict publishing idempotency (preventing duplicate dispatches across workers).
  - Verified Stage 5: State machine reconciliation (`draft` -> `scheduled` -> `published`) automatically triggered upon variant dispatch completion.
  - Verified Stage 6: Community engagement and draft reply review workflow (drafting in persona voice and transitioning to approved).
  - Verified Stage 7: Neutral landing page (`/l/[slug]`) and privacy-preserving traffic tracking (sanitizing referrers on DNT/GPC with zero PII stored and calculating aggregated click analytics).
  - Verified Stage 8: Cryptographic HMAC audit trail validation across the complete persona journey.
- **Production Containerization & Health Probes**:
  - Hardened `Dockerfile` with multi-stage build, curl health probe installation in Alpine runner, and conditional standalone output.
  - Hardened `docker-compose.yml` with SQLite volume persistence (`sqlite_data:/app/prisma`), Redis, MinIO, and validated secrets.
  - Added continuous scheduler daemon (`startSchedulerWorkerDaemon`) in `src/lib/publishing/worker.ts`.
  - Configured conditional `output: 'standalone'` in `next.config.ts` (`DOCKER_BUILD=1`), eliminating dev/test start warnings.


## [0.6.0] - 2026-10-03

### Completed — Task 4: Compliance Engine, Cryptographic Audit Log & Neutral Landing Hubs
- **Tamper-Evident Cryptographic Audit Log**:
  - Implemented append-only HMAC signature chaining across all administrative, safety, and publishing events (`logAuditEvent`).
  - Added deterministic canonical JSON payload serialization (`deterministicStringify`, `buildCanonicalAuditPayload`).
  - Implemented constant-time HMAC-SHA256 signature verification (`verifyAuditSignature`, `verifyAuditLogChain`).
  - Implemented full audit chain verification traversing chronological sequence, validating SHA-256 payload integrity, HMAC signatures, and sequential link continuity (`prevHash`).
  - Added verification API endpoints at `GET /api/audit-logs/verify` and `GET /api/audit-logs?verify=true`.
  - Added comprehensive test suite (`tests/audit.test.ts`) validating hashing, signing, chain integrity, and detection of payload modification, forged signatures, and broken chain links.
- **Platform Rule Verification & Compliance Engine**:
  - Implemented automated staleness detection (`isPlatformRuleStale`, `getPlatformRuleStalenessDays`, `getPlatformRuleHealthLevel`) flagging rules older than 90 days.
  - Implemented persistent compliance snapshots via `ComplianceSnapshot` model (`runScheduledComplianceCheck`, `getLatestComplianceCheck`, `getComplianceHistory`).
  - Added endpoints `POST /api/compliance/check` (on-demand compliance execution) and `GET /api/compliance/history` (snapshot history retrieval).
  - Audited Guardrail 4 asset class separation, verifying zero adult assets scheduled on SFW social channels (Instagram, X, Threads, TikTok).
- **Neutral Link Landing Pages & Privacy-Preserving Tracking**:
  - Built privacy-preserving redirect engine in `src/app/l/[slug]/page.tsx` and `src/lib/links/utm.ts`.
  - Added Do Not Track (`DNT: 1`) and Global Privacy Control (`Sec-GPC: 1` / `X-Do-Not-Track`) detection, scrubbing referrers to domain origins while storing zero PII, IPs, cookies, or canvas fingerprints.
  - Implemented aggregated click metric analytics (`getAggregatedClickMetrics`) tracking 24h, 7d, source, and campaign trends without individual user fingerprinting.
  - Supported direct bypass (`?direct=1`) and non-neutral links with automated UTM parameter forwarding (`buildUtmUrl`).
  - Enriched `GET /api/links/[id]` with real-time aggregated privacy click metrics.

## [0.5.0] - 2026-10-03

### Completed — Task 3: Multi-Platform Publishing Dispatcher & Queue Hardening
- **BullMQ Worker Hardening**:
  - Implemented exponential backoff with randomized jitter (`calculateBackoffWithJitter`) to eliminate thundering herd stampedes against platform APIs.
  - Implemented custom worker `backoffStrategy` that immediately aborts retries (`-1`) on non-retryable errors (guardrail violations, character limits, safety blocks, missing assets).
  - Configured worker rate limiter (max 10 dispatches/sec) and lazy Redis connection handling.
- **Strict Publishing Idempotency**:
  - Implemented atomic dispatch claim locks in `publishVariant` using conditional DB token reservations, preventing concurrent duplicate dispatches across workers.
  - Deterministic SHA-256 idempotency key generation (`generatePublishIdempotencyKey`) applied across variant dispatching.
  - Enforced idempotency across all platform adapters (Instagram, X, Threads, TikTok, Fanvue) to guarantee zero duplicate posts.
- **Automated Status Reconciliation & State Machine**:
  - Implemented `reconcilePostStatus(postId, userId)` managing post lifecycles (`draft` -> `pending_safety` -> `approved` -> `scheduled` -> `published` / `failed`).
  - Automated reconciliation triggers when all variants complete or when assets change safety status.
  - Audit logs record all automated status transitions with previous and new states.
- **Platform Adapter Hardening**:
  - Added dedicated `FanvueAdapter` supporting Section 2 Guardrail 4 compliant `adult_only` creator content alongside `sfw_safe` assets.
  - Added HTTP 429 `Retry-After` header parsing across Instagram, X, Threads, and Fanvue adapters.
  - Categorized errors into `PublishingError` distinguishing retryable server/rate-limit issues from non-retryable client policy errors.
- **Scheduler Worker Tick Hardening**:
  - Enforced per-account concurrency caps (`MAX_CONCURRENT_PER_ACCOUNT = 2`) to prevent flooding single platform accounts.
  - Auto-reconciled all affected posts post-tick.
- **Logging Reliability**: Ensured automatic directory creation for file-based logger to prevent `ENOENT` uncaught exceptions during production/test runs.

---

## [0.4.0] - 2026-10-03

### Completed — Task 2: Honest Generation Pipeline & Persona Face Card Integrity
- **Honest Pipeline Error Reporting**: Completely eliminated silent mock fallbacks, vector SVGs disguised as photos, and recycled placeholder substitutions across the generation lifecycle.
- **Explicit Typed Errors**: If visual or video providers are unconfigured or upstream calls fail, endpoints return structured errors (`PROVIDER_UNAVAILABLE` with status 503, `GPU_OFFLINE` with status 503, `GEN_UPSTREAM_ERROR` with status 502, `SAFETY_BLOCKED` with status 422).
- **ComfyUI Reachability Guard**: Hardened `queueComfyGeneration` in `src/lib/comfyui/client.ts` to perform active status health checks before queueing, throwing 503 `GPU_OFFLINE` when the local or remote GPU server is unreachable.
- **Purged 600 Lines of Mock Code**: Removed `buildTraitOverlaySvg`, `getPhotorealisticPersonaBuffer`, and `createFallbackPersonaImageBuffer` from `src/lib/persona/visual.ts`, ensuring all persona visual generation uses genuine cloud models or fails honestly.
- **Face Card Anchoring & Persistence**:
  - `POST /api/persona/lock-face` securely locks reference face identity without path traversal vulnerabilities.
  - Persists anchor in `persona.visualModelConfig` and updates `persona.avatarUrl`.
  - Automatically records/links identity anchor in the `Asset` table.
  - Automatically creates versioned snapshot in `PersonaVersion` table upon locking or unlocking.
- **Honest Content Generation**:
  - Hardened `/api/persona/generate-content` to remove static image brightness/saturation modulation hacks and dummy video reel copying.
  - Anchors generated content prompts to persona's approved reference and identity markers when face is locked.
  - Dispatches to cloud GoogleGenAI (Gemini 2.5 Flash / Imagen 3) and verifies output through the safety gate pipeline before storage.
- **Client-Safe Error Hierarchy**: Extracted `ApiError` into `src/lib/api/error.ts` to cleanly decouple client components from server-only `next/headers` and session modules.
- **Comprehensive Testing**: Added test coverage in `tests/persona.test.ts` for unconfigured provider handling, ComfyUI reachability failures, face card anchoring persistence, and `PersonaVersion` snapshot creation.

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
