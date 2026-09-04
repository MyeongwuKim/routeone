/**
 * 용도:
 * 장소의 세부 분류를 방문 인증 반경 정책으로 변환한다.
 *
 * 동작 방식:
 * 새 장소는 분류명과 콘텐츠 유형으로 정책을 계산하고,
 * 저장된 루트는 스냅샷 정책을 우선 사용해 생성 당시 기준을 유지한다.
 */

export const DEFAULT_GPS_VERIFICATION_RADIUS_METERS = 100;
export const GENERAL_GPS_VERIFICATION_RADIUS_METERS = 200;
export const LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS = 500;

const GENERAL_ATTRACTION_CONTENT_TYPE_IDS = new Set([
  "12",
  "14",
  "15",
  "28",
  "76",
  "77",
  "78",
  "85",
]);

const LARGE_OUTDOOR_CATEGORY_PATTERN =
  /해변|해수욕장|바다|해안|공원|휴양림|수목원|식물원|정원|숲|둘레길|산책로|트레킹|등산|계곡|폭포|호수|저수지|습지|섬|자연관광|생태관광|동굴|강|하천|beach|coast|seaside|ocean|\bsea\b|park|forest|arboretum|botanic|garden|trail|trek|hiking|mountain|valley|waterfall|lake|reservoir|wetland|island|nature|cave|river/i;

export type PlaceVerificationPolicySource = {
  contentTypeId?: unknown;
  categoryName?: unknown;
  verificationRadiusMeters?: unknown;
  extendedVerificationRequiresPhoto?: unknown;
};

export type PlaceVerificationPolicy = {
  verificationRadiusMeters: number;
  extendedVerificationRequiresPhoto: boolean;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStoredRadius(value: unknown) {
  const radius = typeof value === "number" ? value : Number(value);

  if (
    radius === DEFAULT_GPS_VERIFICATION_RADIUS_METERS ||
    radius === GENERAL_GPS_VERIFICATION_RADIUS_METERS ||
    radius === LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS
  ) {
    return radius;
  }

  return null;
}

export function derivePlaceVerificationPolicy(
  place: PlaceVerificationPolicySource
): PlaceVerificationPolicy {
  const categoryName = normalizeText(place.categoryName);
  const contentTypeId = normalizeText(place.contentTypeId);

  if (LARGE_OUTDOOR_CATEGORY_PATTERN.test(categoryName)) {
    return {
      verificationRadiusMeters: LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS,
      extendedVerificationRequiresPhoto: true,
    };
  }

  if (GENERAL_ATTRACTION_CONTENT_TYPE_IDS.has(contentTypeId)) {
    return {
      verificationRadiusMeters: GENERAL_GPS_VERIFICATION_RADIUS_METERS,
      extendedVerificationRequiresPhoto: true,
    };
  }

  return {
    verificationRadiusMeters: DEFAULT_GPS_VERIFICATION_RADIUS_METERS,
    extendedVerificationRequiresPhoto: false,
  };
}

export function resolvePlaceVerificationPolicy(
  place: PlaceVerificationPolicySource
): PlaceVerificationPolicy {
  const storedRadius = normalizeStoredRadius(place.verificationRadiusMeters);

  if (storedRadius == null) {
    return derivePlaceVerificationPolicy(place);
  }

  return {
    verificationRadiusMeters: storedRadius,
    extendedVerificationRequiresPhoto:
      storedRadius > DEFAULT_GPS_VERIFICATION_RADIUS_METERS &&
      place.extendedVerificationRequiresPhoto !== false,
  };
}
