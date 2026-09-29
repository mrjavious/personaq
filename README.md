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
5. **Run Test Suite:** Run `npm test` to verify all 28 unit tests asserting Section 2 Guardrail requirements pass.

---

## 🎬 Phase 1 Demo Script (Foundations)

1. **Persona Bible Manager (`/persona`):**
   - Open [http://localhost:3000/persona](http://localhost:3000/persona).
   - Review active persona **Aria Nova** (Adult Age: 26, Backstory, Appearance, Voice Tone, Catchphrases, Boundaries, Content Pillars, Mandatory AI Disclosure).
   - Test Adult-only Guardrail: try changing age to 16 or removing disclosure — notice the real-time guardrail validation alert instantly blocks saving.
   - Click the **System Prompt** tab to see the live compiled prompt injected into AI models.
   - Click the **History** tab to see immutable version snapshots and test instant revision rollback.
2. **Platform Rules & Compliance (`/compliance`):**
   - Open [http://localhost:3000/compliance](http://localhost:3000/compliance).
   - Review platform rule cards for Instagram, X, Threads, TikTok, Fanvue.
   - Notice the **Last Verified** status badge (Guardrail 9: warns if $>90$ days).
   - Click **Mark Verified** or **Edit JSON** to modify platform limits dynamically.
3. **Audit Log Explorer:**
   - On `/compliance`, switch to the **Audit Log Explorer** tab.
   - Filter by action (`publish`, `override`, `persona_update`, `settings_change`, `login`).
   - Click **View Meta** on any entry to inspect the full JSON cryptographic/activity audit payload.

---

## 🎬 Phase 2 Demo Script (Assets + Safety Gate)

1. **Asset Library (`/assets`):**
   - Open [http://localhost:3000/assets](http://localhost:3000/assets).
   - Click **Upload Asset**: choose any test image, tag it, and choose suitability (`SFW Safe` vs `Adult Only`).
   - Notice automatic background processing: EXIF metadata is stripped, a 400px thumbnail is generated, a cryptographic SHA-256 provenance manifest is stamped, and the Pluggable Safety Gate pipeline scans the asset.
   - Click any asset card to open the **Asset Inspector**: view full safety classifier breakdown, C2PA provenance JSON, and suitability class.
2. **Pluggable Safety Gate Review (`/safety-gate`):**
   - Open [http://localhost:3000/safety-gate](http://localhost:3000/safety-gate).
   - Inspect the 3 classifier stages: **Apparent-Age Check**, **Real-Person Likeness Check**, and **Platform SFW Check**.
   - Notice that hard-blocked assets (minor keywords, youth indicators, celebrity likeness) display "Hard-Blocked (No Override)".
   - For borderline cases in `Needs Manual Review`: click **Review & Override**, supply a required audit justification, and approve to clear the safety gate into the scheduling queue.
   - Check [http://localhost:3000/compliance](http://localhost:3000/compliance) Audit Log to see the override decision permanently logged.
3. **ComfyUI SFW Studio:**
   - On `/assets`, click **ComfyUI SFW Studio** to inspect local ComfyUI server connectivity (`:8188`), choose aspect ratios (1:1, 4:5, 9:16, 16:9), and queue SFW character workflows with character LoRA and negative prompts.

---

## 🎬 Phase 3 Demo Script (Content Engine)

1. **AI Caption Assistant:**
   - Open [http://localhost:3000/scheduler](http://localhost:3000/scheduler).
   - In the Post Composer, type a post theme (e.g. `Exploring neural color grading in digital fashion`).
   - Click **AI Caption Assistant (3 Tones)**.
   - The Composite AI Provider queries Gemini 2.5 Flash with fallback to local Ollama (or deterministic template engine), automatically injecting the Persona Bible context and boundaries.
   - Inspect the 3 generated options: `Witty & Engaging`, `Thoughtful & Technical`, and `Aesthetic & Minimal` complete with hashtags, alt-text, and mandatory `#AI` disclosure.
   - Click **Apply to Instagram** (or active platform) to populate the composer instantly.
2. **Multi-Platform Composer & Guardrail 4 Constraint:**
   - Attach an asset:
     - If an `Adult Only (18+)` asset is attached, notice SFW platforms (Instagram, X, Threads, TikTok) are locked and disabled with a red Guardrail 4 banner. Only Fanvue can be scheduled.
     - If an `SFW Safe` asset is attached, customize caption length, hashtags, and date/time across all platforms.
   - Click **Schedule Across Platforms** to save the post and its variants.
3. **Calendar View & Manual-Assist Queue:**
   - Switch to the **Calendar** tab to view scheduled variants with color-coded status badges.
   - Switch to the **Manual-Assist Queue** tab: for unlinked or manual channels (TikTok, Reddit, Fanvue), test the 1-click **Copy Caption** button and **Download Media** button.

---

## 🗺️ Build Phase Roadmap

- [x] **Phase 0: Setup** (Scaffold, Docker, Prisma, 2FA Auth, Guardrails, Base Layout)
- [x] **Phase 1: Foundations** (Persona Bible Manager, Versioning, Platform Rules, Audit Log)
- [x] **Phase 2: Assets + Safety** (S3 Storage, Asset Library, Safety Gate Pipeline, ComfyUI)
- [x] **Phase 3: Content Engine** (Caption Assistant with Gemini/Ollama, Post Composer, Calendar)
- [ ] **Phase 4: Publishing** (Instagram, X, Threads Adapters, BullMQ Scheduling Worker)
- [ ] **Phase 5: Funnel + Insights** (Link Hub, UTM Tracker, Analytics Dashboard, Compliance)
- [ ] **Phase 6: Polish + Desktop** (Engagement Assistant, Tauri Desktop Wrapper)
