# One-time setup: GitHub Actions → Cloud Run

The workflow [deploy-cloudrun.yml](.github/workflows/deploy-cloudrun.yml) deploys all four Mirror services to Google Cloud Run on every push to `main`. To enable it, do the following once.

## 1. Variables (edit if needed)

```bash
PROJECT_ID=mirror-app-aditya
REGION=us-central1
REPO=mirror-services
POOL_ID=github-pool
PROVIDER_ID=github-provider
SA_ID=mirror-ci
SA_EMAIL="$SA_ID@$PROJECT_ID.iam.gserviceaccount.com"
GITHUB_REPO="Aditya-Pimpalkar/mirror-app"   # your org/repo
```

## 2. Create Artifact Registry repo

```bash
gcloud config set project "$PROJECT_ID"
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Mirror Cloud Run services" \
  --async
```

(If it already exists, ignore the error.)

## 3. Create CI service account and roles

```bash
gcloud iam service-accounts create "$SA_ID" --display-name="GitHub Actions CI/CD"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountUser"
```

## 4. Workload Identity Pool + OIDC provider for GitHub

```bash
gcloud iam workload-identity-pools create "$POOL_ID" \
  --location="global" --display-name="GitHub Actions pool"

POOL_NAME=$(gcloud iam workload-identity-pools describe "$POOL_ID" \
  --location="global" --format="value(name)")

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$GITHUB_REPO'"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/$POOL_NAME/attribute.repository/$GITHUB_REPO"
```

## 5. GitHub repository secrets

In GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret name | Value |
|-------------|--------|
| `GCP_WORKLOAD_ID_PROVIDER` | `$POOL_NAME/providers/$PROVIDER_ID` (e.g. `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider`) |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `mirror-ci@mirror-app-aditya.iam.gserviceaccount.com` |

To get the full provider name:

```bash
echo "$POOL_NAME/providers/$PROVIDER_ID"
```

## 6. Frontend (Vercel)

- In [Vercel](https://vercel.com), import this repo and connect the `main` branch.
- Add **Environment Variables** for Production (and Preview if desired):
  - `NEXT_PUBLIC_PERSONA_SERVICE_URL`, `NEXT_PUBLIC_PROFILE_SERVICE_URL`, `NEXT_PUBLIC_SYNTHESIS_SERVICE_URL` → your Cloud Run URLs.
  - All `NEXT_PUBLIC_FIREBASE_*` from Firebase Console.
- Each push to `main` will then deploy the frontend automatically.

After this, a single `git push origin main` runs the Cloud Run workflow and (if Vercel is connected) deploys the frontend.
