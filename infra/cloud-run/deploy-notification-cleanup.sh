#!/usr/bin/env bash

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to the Google Cloud project ID.}"
: "${API_IMAGE:?Set API_IMAGE to the deployed API container image URI.}"

REGION="${REGION:-asia-northeast3}"
JOB_NAME="${JOB_NAME:-routeone-notification-cleanup}"
SCHEDULER_JOB_NAME="${SCHEDULER_JOB_NAME:-routeone-notification-cleanup-daily}"
DATABASE_SECRET="${DATABASE_SECRET:-routeone-database-url}"
RETENTION_DAYS="${RETENTION_DAYS:-180}"
SCHEDULE="${SCHEDULE:-30 3 * * *}"
TIME_ZONE="${TIME_ZONE:-Asia/Seoul}"
RUNTIME_SERVICE_ACCOUNT_ID="${RUNTIME_SERVICE_ACCOUNT_ID:-routeone-notification-cleanup}"
SCHEDULER_SERVICE_ACCOUNT_ID="${SCHEDULER_SERVICE_ACCOUNT_ID:-routeone-cleanup-scheduler}"
CLEANUP_ENTRYPOINT="${CLEANUP_ENTRYPOINT:-dist/jobs/cleanupNotifications.js}"

RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

ensure_service_account() {
  local service_account_email="$1"
  local service_account_id="$2"
  local display_name="$3"

  if gcloud iam service-accounts describe "${service_account_email}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
    return
  fi

  gcloud iam service-accounts create "${service_account_id}" \
    --project="${PROJECT_ID}" \
    --display-name="${display_name}"
}

gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  iam.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

ensure_service_account \
  "${RUNTIME_SERVICE_ACCOUNT}" \
  "${RUNTIME_SERVICE_ACCOUNT_ID}" \
  "RouteOne notification cleanup runtime"
ensure_service_account \
  "${SCHEDULER_SERVICE_ACCOUNT}" \
  "${SCHEDULER_SERVICE_ACCOUNT_ID}" \
  "RouteOne notification cleanup scheduler"

if ! gcloud secrets describe "${DATABASE_SECRET}" \
  --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Secret Manager secret '${DATABASE_SECRET}' does not exist." >&2
  exit 1
fi

gcloud secrets add-iam-policy-binding "${DATABASE_SECRET}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

JOB_FLAGS=(
  "--project=${PROJECT_ID}"
  "--region=${REGION}"
  "--image=${API_IMAGE}"
  "--service-account=${RUNTIME_SERVICE_ACCOUNT}"
  "--command=node"
  "--args=${CLEANUP_ENTRYPOINT}"
  "--set-secrets=DATABASE_URL=${DATABASE_SECRET}:latest"
  "--set-env-vars=NODE_ENV=production,USER_NOTIFICATION_RETENTION_DAYS=${RETENTION_DAYS}"
  "--tasks=1"
  "--max-retries=1"
  "--task-timeout=10m"
)

if gcloud run jobs describe "${JOB_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" >/dev/null 2>&1; then
  gcloud run jobs update "${JOB_NAME}" "${JOB_FLAGS[@]}"
else
  gcloud run jobs create "${JOB_NAME}" "${JOB_FLAGS[@]}"
fi

gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --member="serviceAccount:${SCHEDULER_SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" >/dev/null

PROJECT_NUMBER="$(
  gcloud projects describe "${PROJECT_ID}" \
    --format="value(projectNumber)"
)"
SCHEDULER_SERVICE_AGENT="service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SERVICE_AGENT}" \
  --role="roles/cloudscheduler.serviceAgent" >/dev/null

RUN_URI="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run"
SCHEDULER_FLAGS=(
  "--project=${PROJECT_ID}"
  "--location=${REGION}"
  "--schedule=${SCHEDULE}"
  "--time-zone=${TIME_ZONE}"
  "--uri=${RUN_URI}"
  "--http-method=POST"
  "--oauth-service-account-email=${SCHEDULER_SERVICE_ACCOUNT}"
  "--oauth-token-scope=https://www.googleapis.com/auth/cloud-platform"
  "--message-body={}"
)

if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http \
    "${SCHEDULER_JOB_NAME}" \
    "--update-headers=Content-Type=application/json" \
    "${SCHEDULER_FLAGS[@]}"
else
  gcloud scheduler jobs create http \
    "${SCHEDULER_JOB_NAME}" \
    "--headers=Content-Type=application/json" \
    "${SCHEDULER_FLAGS[@]}"
fi

echo "Cloud Run Job: ${JOB_NAME}"
echo "Cloud Scheduler: ${SCHEDULER_JOB_NAME} (${SCHEDULE}, ${TIME_ZONE})"
echo "Manual verification:"
echo "gcloud run jobs execute ${JOB_NAME} --project=${PROJECT_ID} --region=${REGION} --wait"
