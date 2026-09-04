/**
 * 용도:
 * 루트 장소에 저장된 방문 인증 반경을 화면과 위치 검증에서 함께 사용한다.
 *
 * 동작 방식:
 * 저장된 정책이 있으면 그대로 사용하고,
 * 기존 루트는 세부 카테고리명과 콘텐츠 유형으로 동일한 기본값을 계산한다.
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
  contentTypeId?: string | null;
  categoryName?: string | null;
  verificationRadiusMeters?: number | null;
  extendedVerificationRequiresPhoto?: boolean | null;
};

export type PlaceVerificationPolicy = {
  verificationRadiusMeters: number;
  extendedVerificationRequiresPhoto: boolean;
};

function normalizeStoredRadius(value: number | null | undefined) {
  if (
    value === DEFAULT_GPS_VERIFICATION_RADIUS_METERS ||
    value === GENERAL_GPS_VERIFICATION_RADIUS_METERS ||
    value === LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS
  ) {
    return value;
  }

  return null;
}

export function derivePlaceVerificationPolicy(
  place: PlaceVerificationPolicySource
): PlaceVerificationPolicy {
  const categoryName = place.categoryName?.trim() ?? "";
  const contentTypeId = place.contentTypeId?.trim() ?? "";

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
