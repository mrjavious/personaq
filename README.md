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

## 🎬 Setup & Security Walkthrough

1. **Start the App:** Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
2. **Observe Guardrails Banner:** Notice the persistent top banner showing active enforcement of adult-only persona, AI disclosure, and asset separation.
3. **Check System Health:** The header and overview cards report real-time connectivity status for Database, Queue worker, MinIO storage, and AI providers.
4. **Sign In & 2FA Flow:**
   - Navigate to `/login`.
   - Sign in with dev credentials: `creator@personaq.local` / `password123`.
   - Experience the 2FA enrollment or verification screen with QR code and backup codes.
5. **Run Test Suite:** Run `npm test` to verify all unit tests asserting Section 2 Guardrail requirements pass.

---

## 🎬 Persona Agent & Identity Walkthrough

1. **Persona Agent Studio (`/persona`):**
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

## 🎬 Assets & Safety Gate Walkthrough

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

## 🎬 Content Engine & Composer Walkthrough

1. **AI Caption Assistant:**
   - Open [http://localhost:3000/scheduler](http://localhost:3000/scheduler).
   - In the Post Composer, type a post theme (e.g. `Exploring neural color grading in digital fashion`).
   - Click **AI Caption Assistant (3 Tones)**.
   - The Composite AI Provider queries Gemini with fallback to local Ollama (or deterministic template engine), automatically injecting the Persona Agent context and boundaries.
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

## 🎬 Publishing & Dispatcher Walkthrough

1. **Encrypted Credentials Vault & Account Hub (`/publishing`):**
   - Open [http://localhost:3000/publishing](http://localhost:3000/publishing).
   - Connect platform accounts (Instagram, X / Twitter, Threads, TikTok, Fanvue) with AES-256-GCM encrypted API tokens.
   - View account health, platform IDs, and mandatory AI bio disclosure status.
2. **Publishing Adapters & Character Constraint Gates:**
   - **Instagram Adapter:** Verifies image media URL requirement and formats caption with mandatory `#AI` tag.
   - **X Adapter:** Strictly validates 280-character limit and character encoding.
   - **Threads Adapter:** Enforces 500-character limit and format specifications.
   - **Manual-Assist Adapter:** For TikTok, Fanvue, and unlinked channels, generates a complete manual checklist and copies assets.
3. **Background Scheduler Worker:**
   - Click **Run Scheduler Tick Now** on `/publishing` (or call `/api/publishing/worker`).
   - The worker queries all scheduled variants whose publish time has arrived, validates Guardrail 4 and Safety Gate approval status, dispatches to adapters, updates database records to `published`, and logs audit records.

---

## 🎬 Funnel & Analytics Walkthrough

1. **Public Neutral Link Hub (`/l/[slug]`):**
   - Open [http://localhost:3000/l/aria](http://localhost:3000/l/aria).
   - Notice the neutral landing page design (protecting social bios from platform flags), verified character badge, and mandatory AI disclosure banner: `✨ Disclosed Fictional AI Persona`.
   - Tap "Exclusive Works & Gallery" to simulate outbound traffic to Fanvue. The beacon automatically logs privacy-respecting attribution without cookies or IP fingerprinting.
2. **Interactive UTM Link Generator & Privacy Vault (`/links`):**
   - Open [http://localhost:3000/links](http://localhost:3000/links).
   - Manage bio link hubs or toggle between neutral landing and direct redirect modes.
   - Switch to **UTM Link Builder**: select a platform (e.g. `Instagram`), placement (`Bio Link`), campaign (`cyber_launch`), and post ID (`post_101`).
   - Click **Copy URL** to get an attribution-tagged link ready for social bios.
   - Switch to **Funnel Clicks**: inspect live click events by platform and campaign. Test Section 7 privacy controls: **Export CSV** and **Purge All Logs**.
3. **Multi-Platform Analytics & Conversion Funnel (`/analytics`):**
   - Open [http://localhost:3000/analytics](http://localhost:3000/analytics).
   - Inspect the 3-step Funnel Pipeline:
     `SFW Social Reach` (Instagram, X, Threads, TikTok) $\to$ `Neutral Link Hub Clicks` $\to$ `Fanvue Creator Conversions`.
   - View auto-calculated Hub CTR (%) and Fanvue Conversion Rate (%).
   - Click **Generate Strategic Analysis**: Gemini (or local Ollama/template fallback) provides a synthesized performance briefing with 3 growth recommendations.
   - Click **Export CSV** or **Import CSV** to backup or sync external platform metrics.
4. **Enhanced Compliance Scorecard & Checklist (`/compliance`):**
   - Open [http://localhost:3000/compliance](http://localhost:3000/compliance).
   - Switch to the **Checklist Scorecard** tab:
     - Real-time **Compliance Health Score** (0-100%).
     - **Platform Account Checklist**: verifies AI disclosure in bio, rule staleness (<90d), and API status.
     - **Post & Asset Audit**: verifies 100% Guardrail 4 compliance (0 adult assets on SFW channels) and AI label application rate.
     - Instant warnings for stale rules or missing bio disclosures.

---

## 🎬 Engagement Assistant & Desktop App Walkthrough

1. **Engagement Assistant & Guardrail 5 Human-in-the-Loop (`/engagement`):**
   - Open [http://localhost:3000/engagement](http://localhost:3000/engagement).
   - Select a platform account (e.g. `Instagram (@aria.nova.ai)`) and paste an incoming comment (e.g. `Love the cyberpunk aesthetic in your latest artwork! What tools did you use?`).
   - Click **Draft 3 Persona Replies**: Gemini/Ollama generates 3 in-character options in Aria Nova's thoughtful and transparently digital voice.
   - The AI output passes through the Content Safety Filter to guarantee zero explicit or boundary-violating keywords.
   - Select a variation, make any desired custom edits in the review textarea, and click **Approve & Copy Reply**.
   - Notice the copy-to-clipboard action and the immutable record created in the **Reply Queue** and `AuditLog`.
   - Confirm Guardrail 5: No automated outbound messaging bot exists in the application; all replies require explicit manual review and sending.
2. **Pre-Approved Reply Templates:**
   - Switch to the **Quick Templates** tab to inspect pre-approved responses for recurring fan inquiries (AI tools & workflow disclosure, creative prompts, community gratitude, Fanvue VIP perks) with 1-click clipboard actions.
3. **Tauri Windows Desktop Wrapper (`src-tauri/`):**
   - Inspect the native desktop configuration in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/src/main.rs`.
   - Run locally as a native Windows desktop app via `npm run desktop:dev` or compile a standalone Windows installer via `npm run desktop:build` (prerequisites: Rust toolchain + WebView2).

---

## 🗺️ Feature Architecture & System Modules

- [x] **Setup & Security** (Scaffold, Docker, Prisma, 2FA Auth, Guardrails, Base Layout)
- [x] **Persona Foundations** (Persona Agent Studio, Versioning, Platform Rules, Audit Log)
- [x] **Assets & Safety** (S3 Storage, Asset Library, Safety Gate Pipeline, ComfyUI)
- [x] **Content Engine** (Caption Assistant with Gemini/Ollama, Post Composer, Calendar)
- [x] **Publishing** (Instagram, X, Threads Adapters, AES-256-GCM Vault, Scheduler Worker)
- [x] **Funnel & Insights** (Link Hub, UTM Tracker, Analytics Dashboard, Compliance Scorecard)
- [x] **Engagement & Desktop** (Engagement Assistant, Pre-Approved Templates, Tauri Desktop Wrapper)



