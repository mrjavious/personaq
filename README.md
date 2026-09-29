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

## 🚀 Phase 0: Setup & Infrastructure (Completed)

- [x] **Scaffold:** Next.js (App Router) + TypeScript Strict Mode + Tailwind CSS v4.
- [x] **Data Layer:** Prisma ORM with full 12-model schema (SQLite for instantaneous local dev, PostgreSQL ready for Docker / production).
- [x] **Infrastructure:** `docker-compose.yml` for PostgreSQL 16, Redis 7 (BullMQ), and MinIO (S3 object storage).
- [x] **Auth & 2FA:** JWT session management, TOTP authenticator app support (QR code + secret), single-use backup codes, and RBAC (`owner`, `admin`, `editor`).
- [x] **Guardrail Engine:** Service-level rules checking adult age, asset suitability platform separation, safety gate readiness, and rule staleness.
- [x] **Tooling & CI:** Vitest unit test suite (25 tests passing), ESLint, Prettier, and GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- [x] **Base Layout & Dashboard:** High-end dark theme dashboard, persistent guardrails status banner, live system connectivity health check, and 2FA login screen.

---

## 💻 Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Inspect `.env` or `.env.local`:
```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="personaq_local_dev_secret_key_32_chars_long_minimum"
AUTH_REQUIRE_2FA=true
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
# Run unit tests (Guardrails & 2FA)
npm test

# Run linter
npm run lint

# Build production bundle
npm run build
```

---

## 🎬 Phase 0 Demo Script

1. **Start the App:** Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
2. **Observe Guardrails Banner:** Notice the persistent top banner showing active enforcement of adult-only persona, AI disclosure, and asset separation.
3. **Check System Health:** The header and overview cards report real-time connectivity status for Database, Queue worker, MinIO storage, and AI providers.
4. **Sign In & 2FA Flow:**
   - Navigate to `/login`.
   - Sign in with dev credentials: `creator@personaq.local` / `password123`.
   - Experience the 2FA enrollment or verification screen with QR code and backup codes.
5. **Run Test Suite:** Run `npm test` to verify all 25 unit tests asserting Section 2 Guardrail requirements pass.

---

## 🗺️ Build Phase Roadmap

- [x] **Phase 0: Setup** (Scaffold, Docker, Prisma, 2FA Auth, Guardrails, Base Layout)
- [ ] **Phase 1: Foundations** (Persona Bible Manager, Audit Log UI, Platform Rules Editor)
- [ ] **Phase 2: Assets + Safety** (S3 Storage, Asset Library, Safety Gate Pipeline, ComfyUI)
- [ ] **Phase 3: Content Engine** (Caption Assistant with Gemini/Ollama, Post Composer, Calendar)
- [ ] **Phase 4: Publishing** (Instagram, X, Threads Adapters, BullMQ Scheduling Worker)
- [ ] **Phase 5: Funnel + Insights** (Link Hub, UTM Tracker, Analytics Dashboard, Compliance)
- [ ] **Phase 6: Polish + Desktop** (Engagement Assistant, Tauri Desktop Wrapper)
