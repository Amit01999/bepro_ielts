# BePro IELTS — Product Requirements & Status

## Original Problem Statement

Production-grade IELTS preparation, practice, mock-exam, AI evaluation,
subscription, batch-management, teacher-management and administration platform.
Realistic computer-delivered exam experience across Listening, Reading, Writing,
Speaking with band scoring (0–9), RBAC, entitlement-driven subscriptions,
batches/Exam IDs, AI Writing/Speaking evaluation, admin control and analytics.

## Tech / Choices

- Backend: FastAPI + MongoDB (motor), modular routers, JWT (Bearer) auth,
  bcrypt.
- Frontend: React + React Router + Tailwind + shadcn/ui + framer-motion +
  recharts + TanStack Query.
- AI: Gemini 3.1 Pro (writing/speaking eval) + OpenAI Whisper (STT) via Emergent
  Universal LLM key.
- Payments: SIMULATED for v1 (`POST /api/student/subscribe` activates
  instantly + writes PAID payment record).

## Architecture

- `security.py` — RBAC (roles + permissions), JWT, password hashing, permission
  dependencies.
- `entitlements.py` — entitlement engine; every user has a subscription (free by
  default); quotas consumed on exam/practice/AI use.
- `scoring.py` — band conversion tables (Listening / Academic Reading / GT
  Reading), scaled-to-40 raw, half-band rounding, answer normalization.
- `ai_service.py` — Gemini writing/speaking JSON evaluation + Whisper
  transcription.
- Routers: auth, admin
  (students/staff/batches/packages/settings/dashboard/audit), content
  (questions/exams/practice/assignments), exam (attempts state machine + server
  timer), student
  (dashboard/results/practice/subscriptions/analytics/notifications), ai
  (writing/speaking eval + teacher review).

## Implemented (2026-06)

- Auth + RBAC (super_admin, admin, sub_admin, content_manager, teacher,
  examiner, student) with permission checks and privilege-escalation guard.
- Entitlement engine + free plan (configurable in Settings); quota decrement +
  upgrade prompt on exhaustion (verified).
- Packages / subscriptions (simulated purchase) with entitlement snapshots.
- Question bank + schema-driven Exam Builder (sections, passages, questions,
  publish validation, versioning).
- Exam engine: server-authoritative timer (survives refresh), autosave
  (debounced), attempt state machine, idempotent submit, auto-submit on expiry,
  anti-cheat (visibility/blur violations, configurable warnings), exit rules.
  Reading split-screen, Listening audio, Writing editor with word count.
- Objective scoring → band; Writing AI evaluation (async, EVALUATING→COMPLETED)
  with per-criterion bands + teacher review/override.
- Exam ID scheduled entry with batch/PIN/attempt-limit checks.
- Admin dashboard + students table (search/paginate) + create student (auto
  STU-ID + temp password), batches (enroll → package grant), staff/roles,
  packages, settings, audit logs, reviews.
- Student dashboard, mock tests, practice runner, results + detail (answer
  review + AI feedback), analytics, subscription, notifications, profile.
- Public marketing site (Home, Pricing, Academic/GT/Practice/How-it-works) +
  auth pages.
- Seed data (super admin nirmul554@gmail.com, teacher, sample student with IELTS
  Pro, packages, batch, free Reading/Listening/Writing exams, practice sets).

## Implemented (2026-06) — Iteration 2

- **Full 4-skill Mock Test**: one connected attempt spanning Listening → Reading
  → Writing → Speaking with a skill-progress stepper, single refresh-safe server
  timer, section-by-section progression, and a combined overall band (half-band
  avg) that fills in as Writing/Speaking AI evaluations complete.
- **Complete Speaking exam**: browser microphone device check (permission + live
  level meter), MediaRecorder capture per question with Part 2 prep timer + auto
  start/stop, resilient chunked upload with retry, Whisper transcription
  (`transcribe_failed` status on error), Gemini speaking evaluation
  (Fluency/Coherence, Lexical, Grammar, Pronunciation), audio stored (base64)
  and replayable on the result page.
- Verified: iteration_2 test suite 6/6 backend + frontend passing, no
  critical/frontend issues.

- pytest 18/19 (server timer authority, idempotent submit, no answer-key leak,
  writing AI, admin CRUD, RBAC 403, exam-ID entry, publish validation). Frontend
  smoke: login→dashboard, exam runner (timer + navigator), admin console.
- Free quota decrement + exhaustion 403 (curl verified).

## Backlog (P1/P2)

- Speaking recorder UI (mic check + chunked upload) — backend
  `/api/ai/speaking/submit` exists; front-end recorder minimal.
- Real payment gateways (SSLCOMMERZ/bKash/Stripe) behind the existing payment
  abstraction.
- Study materials/notes, announcements UI, support tickets, coupons UI, reports
  export (CSV/PDF).
- S3 object storage for audio/images (currently URL fields), signed URLs.
- Background worker/queue (Redis) — AI currently runs via asyncio tasks
  in-process.
- Counter-based student ID → atomic counters collection.

## Next tasks

- Build the Speaking exam recorder + wire to `/api/ai/speaking/submit`.
- Add study materials + announcements admin/student surfaces.
- Integrate a real payment provider through the payment abstraction.
