#!/bin/bash
# mirror/scripts/deploy-all.sh
#
# One-command deployment to Google Cloud.
# This script satisfies the hackathon's IaC/automated deployment bonus.
#
# Usage: bash scripts/deploy-all.sh [--project YOUR_PROJECT_ID] [--region us-central1]

set -e  # Exit on any error

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Config ──────────────────────────────────────────────────
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
REGION=${GCLOUD_REGION:-"us-central1"}
REPO_NAME="mirror"

# ─── Parse args ──────────────────────────────────────────────
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --project) PROJECT_ID="$2"; shift ;;
    --region)  REGION="$2"; shift ;;
  esac
  shift
done

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Mirror App — Cloud Deployment        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo -e "${YELLOW}Project:${NC} $PROJECT_ID"
echo -e "${YELLOW}Region:${NC}  $REGION"
echo ""

# ─── Verify gcloud auth ───────────────────────────────────────
echo -e "${BLUE}[1/7]${NC} Verifying gcloud authentication..."
gcloud auth print-access-token > /dev/null 2>&1 || {
  echo -e "${RED}Not authenticated. Run: gcloud auth login${NC}"
  exit 1
}
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Authenticated${NC}"

# ─── Enable APIs ─────────────────────────────────────────────
echo -e "${BLUE}[2/7]${NC} Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  aiplatform.googleapis.com \
  --quiet
echo -e "${GREEN}✓ APIs enabled${NC}"

# ─── Create Artifact Registry repo ───────────────────────────
echo -e "${BLUE}[3/7]${NC} Setting up Artifact Registry..."
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="Mirror App Docker images" \
  --quiet 2>/dev/null || echo "Repository already exists"

gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
echo -e "${GREEN}✓ Artifact Registry ready${NC}"

# ─── Store secrets in Secret Manager ─────────────────────────
echo -e "${BLUE}[4/7]${NC} Setting up Secret Manager..."

store_secret() {
  local name=$1
  local value=$2
  echo -n "$value" | gcloud secrets create $name --data-file=- --quiet 2>/dev/null || \
  echo -n "$value" | gcloud secrets versions add $name --data-file=- --quiet 2>/dev/null || true
}

if [ -f ".env" ]; then
  source .env
  [ -n "$GEMINI_API_KEY" ]      && store_secret "gemini-api-key"      "$GEMINI_API_KEY"
  [ -n "$JWT_SECRET" ]          && store_secret "jwt-secret"           "$JWT_SECRET"
  echo -e "${GREEN}✓ Secrets stored${NC}"
else
  echo -e "${YELLOW}⚠ No .env file found. Secrets must be configured manually.${NC}"
fi

# ─── Build and push Docker images ────────────────────────────
echo -e "${BLUE}[5/7]${NC} Building Docker images..."

SERVICES=("persona-service" "profile-service" "synthesis-service")
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

for service in "${SERVICES[@]}"; do
  echo -e "  Building ${YELLOW}${service}${NC}..."
  docker build \
    -t "${IMAGE_BASE}/${service}:latest" \
    "services/${service}" \
    --platform linux/amd64 \
    --quiet
  docker push "${IMAGE_BASE}/${service}:latest" --quiet
  echo -e "  ${GREEN}✓ ${service} built and pushed${NC}"
done

# ─── Deploy to Cloud Run ──────────────────────────────────────
echo -e "${BLUE}[6/7]${NC} Deploying to Cloud Run..."

deploy_service() {
  local name=$1
  local port=$2
  local memory=${3:-"1Gi"}
  local min_instances=${4:-"0"}

  echo -e "  Deploying ${YELLOW}mirror-${name}${NC}..."
  gcloud run deploy "mirror-${name}" \
    --image="${IMAGE_BASE}/${name}:latest" \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=$port \
    --memory=$memory \
    --cpu=1 \
    --min-instances=$min_instances \
    --max-instances=100 \
    --set-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=${PROJECT_ID},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
    --quiet

  local url=$(gcloud run services describe "mirror-${name}" --region=$REGION --format='value(status.url)')
  echo -e "  ${GREEN}✓ mirror-${name}: ${url}${NC}"
  echo "$url"
}

PERSONA_URL=$(deploy_service "persona-service" 8080 "1Gi" "1")
PROFILE_URL=$(deploy_service "profile-service" 8081 "1Gi" "0")
SYNTHESIS_URL=$(deploy_service "synthesis-service" 8082 "512Mi" "0")

# ─── Set up Cloud Scheduler ──────────────────────────────────
echo -e "${BLUE}[7/7]${NC} Setting up Cloud Scheduler..."

# Weekly report — every Monday at 8am UTC
gcloud scheduler jobs create http mirror-weekly-report \
  --location=$REGION \
  --schedule="0 8 * * 1" \
  --uri="${SYNTHESIS_URL}/synthesis/weekly-report" \
  --message-body='{"trigger":"scheduled"}' \
  --headers="Content-Type=application/json" \
  --description="Mirror weekly reputation report" \
  --quiet 2>/dev/null || \
gcloud scheduler jobs update http mirror-weekly-report \
  --location=$REGION \
  --uri="${SYNTHESIS_URL}/synthesis/weekly-report" \
  --quiet 2>/dev/null || true

echo -e "${GREEN}✓ Cloud Scheduler configured${NC}"

# ─── Deploy Firestore rules ───────────────────────────────────
echo -e "${BLUE}[+]${NC} Deploying Firestore security rules..."
firebase deploy --only firestore:rules --project $PROJECT_ID --non-interactive 2>/dev/null || \
  echo -e "${YELLOW}⚠ Firebase CLI not available. Deploy rules manually.${NC}"

# ─── Summary ─────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Deployment Complete! 🪞              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Service URLs:${NC}"
echo -e "  Persona Service:   ${PERSONA_URL}"
echo -e "  Profile Service:   ${PROFILE_URL}"
echo -e "  Synthesis Service: ${SYNTHESIS_URL}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Update frontend .env with service URLs above"
echo -e "  2. Deploy frontend: cd frontend/web && npm run build"
echo -e "  3. Test health: curl ${PERSONA_URL}/health"
echo -e "  4. Record Cloud Run console for hackathon proof"
echo ""
echo -e "  ${BLUE}Cloud Run Console:${NC}"
echo -e "  https://console.cloud.google.com/run?project=${PROJECT_ID}"
