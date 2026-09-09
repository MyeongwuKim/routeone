#!/usr/bin/env bash
# 고아 이미지 정리 Job과 매일 새벽 실행을 등록한다. 기본은 삭제 없는 점검 모드다.
set -euo pipefail

: "${PROJECT_ID:?Set the Google Cloud project ID.}"
: "${API_IMAGE:?Set the API image containing cleanupOrphanImages.js.}"
: "${IMAGE_CLEANUP_ENVIRONMENT:?Set dev or prod to match the connected database.}"
: "${DATABASE_SECRET:?Set the database secret for this environment.}"
: "${CF_ACCOUNT_SECRET:?Set the Cloudflare account ID secret.}"
: "${CF_TOKEN_SECRET:?Set the Cloudflare Images token secret.}"

case "${IMAGE_CLEANUP_ENVIRONMENT}" in dev|prod) ;; *) echo "Environment must be dev or prod." >&2; exit 1 ;; esac
REGION="${REGION:-asia-northeast3}"
JOB_NAME="${JOB_NAME:-routeone-image-cleanup-${IMAGE_CLEANUP_ENVIRONMENT}}"
SCHEDULER_JOB_NAME="${SCHEDULER_JOB_NAME:-${JOB_NAME}-daily}"
SCHEDULE="${SCHEDULE:-0 4 * * *}"
TIME_ZONE="${TIME_ZONE:-Asia/Seoul}"
DRY_RUN="${DRY_RUN:-true}"
GRACE_HOURS="${GRACE_HOURS:-24}"
MAX_DELETES="${MAX_DELETES:-100}"
CLEANUP_ENTRYPOINT="${CLEANUP_ENTRYPOINT:-dist/jobs/cleanupOrphanImages.js}"
RUNTIME_SERVICE_ACCOUNT_ID="${RUNTIME_SERVICE_ACCOUNT_ID:-routeone-image-clean-${IMAGE_CLEANUP_ENVIRONMENT}}"
SCHEDULER_SERVICE_ACCOUNT_ID="${SCHEDULER_SERVICE_ACCOUNT_ID:-routeone-image-cron-${IMAGE_CLEANUP_ENVIRONMENT}}"
case "${DRY_RUN}" in true|false) ;; *) echo "DRY_RUN must be true or false." >&2; exit 1 ;; esac
if [[ ! "${GRACE_HOURS}" =~ ^[1-9][0-9]*$ || ! "${MAX_DELETES}" =~ ^[1-9][0-9]*$ ]] || (( GRACE_HOURS < 24 )); then
  echo "GRACE_HOURS must be at least 24 and MAX_DELETES must be positive integers." >&2
  exit 1
fi

RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

ensure_service_account() {
  if ! gcloud iam service-accounts describe "$1" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$2" --project="${PROJECT_ID}" --display-name="$3"
  fi
}

gcloud services enable run.googleapis.com cloudscheduler.googleapis.com iam.googleapis.com secretmanager.googleapis.com --project="${PROJECT_ID}"

# 시크릿 값은 읽거나 로그에 출력하지 않고 존재 여부만 확인한다.
for secret in "${DATABASE_SECRET}" "${CF_ACCOUNT_SECRET}" "${CF_TOKEN_SECRET}"; do
  gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null
done

ensure_service_account "${RUNTIME_SERVICE_ACCOUNT}" "${RUNTIME_SERVICE_ACCOUNT_ID}" "RouteOne orphan image cleanup"
ensure_service_account "${SCHEDULER_SERVICE_ACCOUNT}" "${SCHEDULER_SERVICE_ACCOUNT_ID}" "RouteOne image cleanup scheduler"
for secret in "${DATABASE_SECRET}" "${CF_ACCOUNT_SECRET}" "${CF_TOKEN_SECRET}"; do
  gcloud secrets add-iam-policy-binding "${secret}" --project="${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" --role="roles/secretmanager.secretAccessor" >/dev/null
done

JOB_FLAGS=(
  "--project=${PROJECT_ID}" "--region=${REGION}" "--image=${API_IMAGE}"
  "--service-account=${RUNTIME_SERVICE_ACCOUNT}"
  "--command=node" "--args=${CLEANUP_ENTRYPOINT}"
  "--set-secrets=DATABASE_URL=${DATABASE_SECRET}:latest,CF_ACCOUNT=${CF_ACCOUNT_SECRET}:latest,CF_TOKEN=${CF_TOKEN_SECRET}:latest"
  "--set-env-vars=NODE_ENV=production,ROUTEONE_ENV=${IMAGE_CLEANUP_ENVIRONMENT},IMAGE_CLEANUP_ENVIRONMENT=${IMAGE_CLEANUP_ENVIRONMENT},IMAGE_CLEANUP_DRY_RUN=${DRY_RUN},IMAGE_CLEANUP_GRACE_HOURS=${GRACE_HOURS},IMAGE_CLEANUP_MAX_DELETES=${MAX_DELETES}"
  "--tasks=1" "--parallelism=1" "--max-retries=1" "--task-timeout=30m"
)
if gcloud run jobs describe "${JOB_NAME}" --project="${PROJECT_ID}" --region="${REGION}" >/dev/null 2>&1; then
  gcloud run jobs update "${JOB_NAME}" "${JOB_FLAGS[@]}"
else
  gcloud run jobs create "${JOB_NAME}" "${JOB_FLAGS[@]}"
fi
gcloud run jobs add-iam-policy-binding "${JOB_NAME}" --project="${PROJECT_ID}" --region="${REGION}" \
  --member="serviceAccount:${SCHEDULER_SERVICE_ACCOUNT}" --role="roles/run.invoker" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/cloudscheduler.serviceAgent" >/dev/null

SCHEDULER_FLAGS=(
  "--project=${PROJECT_ID}" "--location=${REGION}" "--schedule=${SCHEDULE}" "--time-zone=${TIME_ZONE}"
  "--uri=https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run"
  "--http-method=POST" "--oauth-service-account-email=${SCHEDULER_SERVICE_ACCOUNT}"
  "--oauth-token-scope=https://www.googleapis.com/auth/cloud-platform" "--message-body={}"
)
if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" --project="${PROJECT_ID}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" "--update-headers=Content-Type=application/json" "${SCHEDULER_FLAGS[@]}"
else
  gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" "--headers=Content-Type=application/json" "${SCHEDULER_FLAGS[@]}"
fi
echo "Cloud Run Job: ${JOB_NAME} (dry run: ${DRY_RUN})"
echo "Cloud Scheduler: ${SCHEDULER_JOB_NAME} (${SCHEDULE}, ${TIME_ZONE})"
