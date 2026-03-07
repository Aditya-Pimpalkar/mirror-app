# 🪞 Mirror — Reputation Intelligence Engine

> **"Everyone has googled you. Now you can hear what they found."**

Mirror is a live AI-powered self-awareness app that simulates how four distinct people perceive you — a recruiter, a first date, a competitor, and an investigative journalist — through real-time voice conversations powered by Gemini Live API.

---

## 🏆 Hackathon: Gemini Live Agent Challenge
**Category:** Live Agents  
**Tech:** Gemini Live API · Gemini 1.5 Pro · Google ADK · Google Cloud Run · Firestore · Vertex AI

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│         Next.js Web  ·  React Native Mobile              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                  API GATEWAY (Cloud Run)                  │
│           Firebase Auth · Rate Limiting · CORS            │
└────┬──────────────┬───────────────┬──────────────────────┘
     │              │               │
┌────▼────┐  ┌──────▼──────┐  ┌────▼─────────┐
│ Persona │  │   Profile   │  │  Synthesis   │
│ Service │  │   Service   │  │   Service    │
│ :8080   │  │   :8081     │  │   :8082      │
└────┬────┘  └──────┬──────┘  └────┬─────────┘
     │              │               │
┌────▼──────────────▼───────────────▼──────────┐
│              Google Cloud                     │
│  Gemini Live API  ·  Gemini 1.5 Pro           │
│  Vertex AI Search  ·  Firestore               │
│  Firebase Auth  ·  Cloud Storage              │
│  Cloud Scheduler  ·  Secret Manager           │
└───────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Google Cloud CLI (`gcloud`)
- Firebase CLI
- Docker

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/mirror-app
cd mirror-app
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Fill in your values (see Environment Variables section)
```

### 3. Firebase Setup
```bash
firebase login
firebase use --add  # select your project
firebase deploy --only firestore:rules
```

### 4. Run Locally
```bash
# Run all services
npm run dev:all

# Or run individually
npm run dev:persona    # Persona service on :8080
npm run dev:profile    # Profile service on :8081  
npm run dev:synthesis  # Synthesis service on :8082
npm run dev:web        # Next.js frontend on :3000
```

### 5. Deploy to Google Cloud
```bash
# Automated deployment (satisfies hackathon IaC bonus)
bash scripts/deploy-all.sh
```

---

## 🏗️ Project Structure

```
mirror/
├── services/
│   ├── persona-service/        # Gemini Live voice conversations
│   ├── profile-service/        # Bio parsing, URL scraping, dossier
│   ├── synthesis-service/      # Perception Map, Gap Score, Reports
│   └── notification-service/  # Push notifications, scheduler
├── frontend/
│   ├── web/                    # Next.js web app
│   └── mobile/                 # React Native / Expo
├── infrastructure/
│   └── terraform/              # IaC for all GCP resources
├── scripts/
│   ├── deploy-all.sh           # Automated deployment
│   └── setup-gcp.sh            # First-time GCP setup
├── .github/
│   └── workflows/              # CI/CD via Cloud Build
└── firebase/
    ├── firestore.rules
    └── firestore.indexes.json
```

---

## 🔑 Environment Variables

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Gemini
GEMINI_API_KEY=your-gemini-api-key

# Firebase
FIREBASE_PROJECT_ID=your-project-id

# Services (local dev)
PERSONA_SERVICE_URL=http://localhost:8080
PROFILE_SERVICE_URL=http://localhost:8081
SYNTHESIS_SERVICE_URL=http://localhost:8082

# Secrets (use Secret Manager in production)
JWT_SECRET=your-jwt-secret
```

---

## 🎭 The Four Personas

| Persona | Domain | Voice | Agenda |
|---------|--------|-------|--------|
| **Rachel** 💼 | Career | Clipped, precise | Finds career narrative gaps |
| **Alex** 🥂 | Relationships | Warm, probing | Reads social signals |
| **Chris** ⚔️ | Competition | Cold, analytical | Knows your weaknesses |
| **Jordan** 🗞️ | Public Image | Deliberate, fair | Asks the hard questions |

---

## 📊 Key Features

- **Zero-friction onboarding** — Speak or type. No public profiles required.
- **Gemini Live voice** — Real-time streaming conversations with interruption support
- **Face emotion reading** — Gemini Vision detects incongruence between words and expression
- **Belief Meter** — Shifts only on verifiable evidence, not emotional pushback
- **Gap Score** — Longitudinal metric tracking self vs. perceived reputation
- **Perception Map** — Cross-persona synthesis with blind spots, risks, and verdicts
- **Archetype Reveal** — 6 reputation archetypes unlocked after 4 conversations
- **Weekly Reports** — Monday morning reputation delta via push notification
- **Mirror Moments** — Daily provocations from personas based on your history

---

## ☁️ Google Cloud Services Used

| Service | Purpose |
|---------|---------|
| Cloud Run | Hosts all 4 microservices (auto-scaling) |
| Gemini Live API | Real-time streaming voice conversations |
| Gemini 1.5 Pro | Synthesis, Perception Maps, dossier parsing |
| Vertex AI Search | Public profile grounding |
| Firestore | Primary database |
| Firebase Auth | User authentication |
| Firebase Storage | Voice recordings, exports |
| Cloud Scheduler | Weekly reports, Mirror Moments |
| Secret Manager | API keys, credentials |
| Cloud Build | CI/CD pipeline |
| Cloud Monitoring | Uptime and error tracking |

---

## 📹 Demo Video
[Link to demo video]

## 🏛️ Architecture Diagram
[See /docs/architecture.png]

---

*Built for the Gemini Live Agent Challenge — #GeminiLiveAgentChallenge*
