# 🪞 Mirror — Reputation Intelligence Engine

> **"Everyone has googled you. Now you can hear what they found."**

Mirror is a live AI-powered self-awareness app that simulates how four distinct people perceive you — a recruiter, a first date, a direct competitor, and an investigative journalist — through real-time voice conversations powered by the Gemini Live API.

You speak your story. No public profiles required. Four AI personas interview you with genuine skepticism, and their belief in you shifts only on verifiable evidence — not emotional pushback.

**Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)**

### Quick links
| | |
|---|---|
| **Live app** | [Try Mirror](https://mirror-app-cyan.vercel.app/) |
| **Demo video** | [YouTube](https://youtu.be/3dESSPl5Tbk)|
| **Architecture** | Diagram below; backend runs on [Google Cloud Run](https://console.cloud.google.com/run) |
| **Code** | This repo — public for judging |

---

## 📋 Hackathon submission checklist

| Requirement | Status |
|-------------|--------|
| **Category** | Live Agents — real-time voice + vision |
| **Gemini Live API** | ✅ WebSocket proxy in `persona-service` → `gemini-2.5-flash-native-audio-preview` |
| **Google GenAI SDK** | ✅ `@google/generative-ai` used across persona, profile, synthesis |
| **Google Cloud hosting** | ✅ All backends on Cloud Run; Firestore, Secret Manager, Scheduler |
| **Public repo** | ✅ This repository |
| **Spin-up instructions** | ✅ Quick Start below + `scripts/deploy-all.sh` |
| **Proof of GCP** | Screen recording of Cloud Run console or link to deploy/code (see [Architecture](#-architecture)) |
| **Demo video** | ≤4 min, in English; link in Quick links above |
| **Architecture diagram** | ASCII diagram in README; optional: add `docs/architecture.png` |

---

## 🏆 Hackathon

| | |
|---|---|
| **Competition** | Gemini Live Agent Challenge (Devpost) |
| **Category** | Live Agents |
| **Deadline** | March 16, 2026 |

---

## ✨ Features

### Core Experience
- **Zero-friction onboarding** — Speak or type your story. No LinkedIn, no public profiles required.
- **4 distinct AI personas** — Each with unique voice, agenda, and belief system
- **Gemini Live voice** — Real-time bidirectional streaming with natural interruption support
- **Belief Meter** — Shifts only on verifiable evidence, not emotional pushback
- **Multi-session memory** — Personas remember what you told them last week

### Intelligence Layer
- **Gap Score** — Longitudinal metric: how far is your self-perception from how others see you?
- **Perception Map** — Cross-persona synthesis with consensus, blind spots, and risks
- **Archetype Reveal** — 6 reputation archetypes unlocked after all 4 conversations
- **Mirror Moments** — Daily provocations from your most recent persona, grounded in your actual conversations
- **Weekly Reputation Report** — AI synthesis of belief shifts and emerging patterns

### Power Features
- **Confrontation Mode** — One statement, all 4 personas respond simultaneously
- **Scenario Prep Mode** — Roleplay high-stakes situations (FAANG interview, investor pitch, salary negotiation, difficult co-founder conversation) with full 4-persona debrief
- **Face Emotion Reading** — Gemini Vision detects incongruence between your words and expression
- **Shareable Archetype Card** — Beautiful per-archetype PNG export for social sharing
- **Conviction Streaks** — Track consecutive days talking to each persona
- **Crisis Detection** — App detects when a conversation becomes distressing

---

## 🎭 The Four Personas

| Persona | Domain | Voice | Agenda |
|---------|--------|-------|--------|
| **Rachel** 💼 | Career | Kore — precise, measured | Finds gaps in your career narrative |
| **Alex** 🥂 | Relationships | Aoede — warm, curious | Reads social signals you don't notice |
| **Chris** ⚔️ | Competition | Charon — cold, flat | Knows your professional weaknesses |
| **Jordan** 🗞️ | Public Image | Fenrir — deliberate, fair | Asks the questions no one dares to |

### Belief System
Each persona starts with low conviction (Rachel: 20/100, Alex: 35, Chris: 18, Jordan: 28). Evidence — specific dates, metrics, verifiable links — raises belief. Emotional pushback lowers it. Baseline rises after sustained evidence across sessions.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│              Next.js Web (mobile-first)                  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│              4 Cloud Run Microservices                   │
├─────────────┬──────────────┬──────────────┬─────────────┤
│   Persona   │   Profile    │  Synthesis   │Notification │
│   :8080     │   :8081      │   :8082      │   :8083     │
│             │              │              │             │
│ Gemini Live │ Bio parsing  │ Perception   │ Scheduler   │
│ WebSocket   │ Dossier      │ Gap Score    │ Push notifs │
│ proxy       │ building     │ Archetypes   │             │
└──────┬──────┴──────────────┴──────────────┴─────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│                    Google Cloud                          │
│  Gemini 2.5 Flash Native Audio (Live API)               │
│  Gemini 2.5 Flash (synthesis, dossier, scenario prep)   │
│  Firestore · Firebase Auth · Cloud Storage              │
│  Cloud Scheduler · Secret Manager · Cloud Build         │
└─────────────────────────────────────────────────────────┘
```

### Key Technical Decisions
- **Gemini Live API** — `gemini-2.5-flash-native-audio-preview-12-2025` for real-time voice. WebSocket proxy pattern: browser → Node.js server → Gemini Live, with PCM16 audio at 16kHz input / 24kHz output.
- **Mic muting** — Gain node (0.15) mutes mic while persona speaks to prevent echo triggering false interruptions, while still allowing genuine interruptions to pass through.
- **Memory injection** — Prior session summaries injected into persona system prompts on every conversation start.
- **Belief engine** — Evidence scoring regex patterns per persona + sentiment analysis updates belief in real time during streaming.

---

## 📂 Project Structure

```
mirror-app/
├── services/
│   ├── persona-service/          # Gemini Live WebSocket proxy, 4 personas, belief engine
│   │   ├── src/
│   │   │   ├── index.js          # HTTP + WebSocket server
│   │   │   ├── personas.js       # Persona definitions, system prompts, evidence patterns
│   │   │   ├── routes/
│   │   │   │   ├── persona.js    # REST endpoints + confrontation mode
│   │   │   │   └── scenarios.js  # Scenario Prep Mode endpoints
│   │   │   ├── services/
│   │   │   │   ├── liveSessionManager.js  # Gemini Live session handling
│   │   │   │   ├── memoryManager.js       # Multi-session memory
│   │   │   │   └── confrontationMode.js   # All-4 parallel responses
│   │   │   └── utils/
│   │   │       ├── gemini.js     # Gemini client, voice config
│   │   │       └── firebase.js   # Admin SDK singleton
│   │   └── Dockerfile
│   ├── profile-service/          # Bio parsing, dossier building
│   ├── synthesis-service/        # Perception Maps, Gap Score, Reports, Archetypes
│   └── notification-service/     # Push notifications, Cloud Scheduler
├── frontend/
│   └── web/                      # Next.js 14 (App Router)
│       └── src/
│           ├── app/              # Layout, global CSS, routing
│           ├── components/       # All screens and UI components
│           ├── hooks/            # useGeminiLive, useEmotionCamera
│           ├── lib/              # Firebase client, API client
│           └── store/            # Zustand global state
├── firebase/
│   ├── firestore.rules
│   └── firestore.indexes.json
├── scripts/
│   └── deploy-all.sh             # One-command Cloud Run deployment
├── cloudbuild.yaml               # Cloud Build pipeline
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # Validate + syntax check
│   │   └── deploy-cloudrun.yml   # Deploy to Cloud Run on push to main
│   └── DEPLOY-CLOUDRUN-SETUP.md  # One-time GCP + GitHub secrets for CI/CD
└── LICENSE                       # MIT
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Google Cloud CLI (`gcloud`)
- Firebase CLI (`firebase-tools`)
- A GCP project with billing enabled

### 1. Clone & Install
```bash
git clone https://github.com/Aditya-Pimpalkar/mirror-app
cd mirror-app
npm install

# Install deps in each service
for service in persona-service profile-service synthesis-service notification-service; do
  cd services/$service && npm install && cd ../..
done
```

### 2. GCP Setup
```bash
# Authenticate
gcloud auth login
gcloud config set project mirror-app-aditya

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  firestore.googleapis.com firebase.googleapis.com \
  secretmanager.googleapis.com aiplatform.googleapis.com \
  generativelanguage.googleapis.com

# Create service account
gcloud iam service-accounts create mirror-dev --display-name="Mirror Dev"
gcloud projects add-iam-policy-binding mirror-app-aditya \
  --member="serviceAccount:mirror-dev@mirror-app-aditya.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
gcloud iam service-accounts keys create ./service-account.json \
  --iam-account=mirror-dev@mirror-app-aditya.iam.gserviceaccount.com
```

### 3. Firebase Setup
```bash
firebase login
firebase init  # Select Firestore, choose mirror-app-aditya
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Environment Variables
```bash
cp .env.example .env
# Fill in required values:
```

```bash
GOOGLE_CLOUD_PROJECT=mirror-app-aditya
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GCLOUD_REGION=us-central1

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025

FIREBASE_PROJECT_ID=mirror-app-aditya
FIREBASE_STORAGE_BUCKET=mirror-app-aditya.appspot.com

JWT_SECRET=your-jwt-secret
SCHEDULER_SECRET=your-scheduler-secret
INTERNAL_SERVICE_SECRET=your-internal-secret
```

```bash
# Copy to all services
for service in persona-service profile-service synthesis-service notification-service; do
  cp .env services/$service/.env
done
```

### 5. Frontend Setup
```bash
cd frontend/web
cp .env.local.example .env.local
# Fill in Firebase web config from Firebase Console → Project Settings → Your apps
npm install
```

### 6. Run Locally
```bash
# Terminal 1 — Persona service (Gemini Live voice)
cd services/persona-service && node src/index.js

# Terminal 2 — Profile service
cd services/profile-service && node src/index.js

# Terminal 3 — Synthesis service
cd services/synthesis-service && node src/index.js

# Terminal 4 — Frontend
cd frontend/web && npm run dev
```

Open `http://localhost:3000`

### 7. Deploy to Cloud Run (manual one-time or per release)
```bash
bash scripts/deploy-all.sh
```

**Or use CI/CD:** Push to `main` can auto-deploy backends (see [CI/CD](#-cicd) below). Frontend: connect this repo to [Vercel](https://vercel.com) and set env vars for production.

---

## 🔄 CI/CD

- **Backend (Cloud Run)** — GitHub Actions workflow [`.github/workflows/deploy-cloudrun.yml`](.github/workflows/deploy-cloudrun.yml) builds and deploys all four services to Cloud Run on every push to `main`. Requires one-time [GCP Workload Identity setup](.github/DEPLOY-CLOUDRUN-SETUP.md) and GitHub secrets `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`.
- **Frontend (Vercel)** — Connect this repo in [Vercel](https://vercel.com) → Git integration. Set production env vars (`NEXT_PUBLIC_*_SERVICE_URL` to your Cloud Run URLs, plus Firebase web config). Each push to `main` triggers a new production deploy.

One push to `main` → Cloud Run + Vercel updated.

---

## 🔑 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | ✅ |
| `GEMINI_API_KEY` | Google AI Studio API key | ✅ |
| `GEMINI_MODEL` | Text model — `gemini-2.5-flash` | ✅ |
| `GEMINI_LIVE_MODEL` | Live audio model | ✅ |
| `FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `SCHEDULER_SECRET` | Cloud Scheduler auth | ✅ |
| `INTERNAL_SERVICE_SECRET` | Inter-service auth | ✅ |

---

## ☁️ Google Cloud Services Used

| Service | Purpose |
|---------|---------|
| **Cloud Run** | Hosts all 4 microservices (auto-scaling to zero) |
| **Gemini Live API** | Real-time bidirectional voice streaming |
| **Gemini 2.5 Flash** | Synthesis, dossier parsing, scenario prep, debrief |
| **Firestore** | Primary database — user profiles, sessions, beliefs |
| **Firebase Auth** | Anonymous-first authentication |
| **Cloud Storage** | Archetype card exports |
| **Cloud Scheduler** | Weekly reports (Monday 8am) |
| **Secret Manager** | API keys and credentials |
| **Cloud Build** | CI/CD pipeline on every push |
| **Artifact Registry** | Docker image storage |

---

## 🎬 Scenario Prep Mode

Mirror includes 6 built-in high-stakes scenarios:

| Scenario | Persona Playing Opposite | Difficulty |
|----------|--------------------------|------------|
| FAANG Technical Interview | Rachel as Senior Engineering Manager | Hard |
| Investor Pitch | Jordan as Series A Partner | Hard |
| Salary Negotiation | Rachel as Head of Talent | Medium |
| Co-founder Conflict | Alex as Co-founder | Hard |
| Difficult Performance Review | Rachel as Direct Manager | Medium |
| Press Interview | Jordan as Tech Journalist | Hard |

After the session, all 4 personas give a scored debrief: verdict, strength, weakness, and one concrete action.

---

## 🗺️ Roadmap

### V1 (Hackathon — March 2026)
- [x] Voice + text onboarding
- [x] 4 personas with Gemini Live voice
- [x] Multi-session memory
- [x] Belief meters + Gap Score
- [x] Perception Map + Archetype Reveal
- [x] Confrontation Mode
- [x] Scenario Prep Mode (6 scenarios)
- [x] Shareable Archetype Cards
- [x] Weekly Reputation Reports
- [x] Mirror Moments
- [x] Conviction Streaks
- [x] Cloud Run deployment

### V1.5 (April 2026)
- [ ] Trusted Circle (invite real people)
- [ ] Debate Mode (2 personas argue about you)
- [ ] Persona Evolution (beliefs persist and evolve over months)
- [ ] 30/60/90 day snapshots

---

## 📹 Demo Video
| [YouTube](https://youtu.be/3dESSPl5Tbk)|

---

## 👤 Author

**Aditya Pimpalkar**
- GitHub: [@Aditya-Pimpalkar](https://github.com/Aditya-Pimpalkar)
- LinkedIn: [linkedin.com/in/aditya-pimpalkar](https://linkedin.com/in/aditya-pimpalkar)

---

*Built for the Gemini Live Agent Challenge · #GeminiLiveAgentChallenge*
