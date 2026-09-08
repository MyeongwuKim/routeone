/**
 * 용도:
 * 장소의 세부 분류를 도착 알림·방문 인증 반경 정책으로 변환한다.
 *
 * 동작 방식:
 * 새 장소는 세부 분류명으로 정책을 계산하고,
 * 이전 정책으로 저장된 루트는 현재 분류 기준으로 반경을 보정한다.
 */

export const DEFAULT_NOTIFICATION_RADIUS_METERS = 150;
export const DEFAULT_GPS_VERIFICATION_RADIUS_METERS = 100;
export const LARGE_OUTDOOR_NOTIFICATION_RADIUS_METERS = 500;
export const LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS = 300;

const LARGE_OUTDOOR_CATEGORY_PATTERN =
  /해변|해수욕장|바다|해안|공원|휴양림|수목원|식물원|정원|숲|둘레길|산책로|트레킹|등산|계곡|폭포|호수|저수지|습지|섬|자연관광|생태관광|동굴|강|하천|beach|coast|seaside|ocean|\bsea\b|park|forest|arboretum|botanic|garden|trail|trek|hiking|mountain|valley|waterfall|lake|reservoir|wetland|island|nature|cave|river/i;

export type PlaceVerificationPolicySource = {
  contentTypeId?: unknown;
  categoryName?: unknown;
  notificationRadiusMeters?: unknown;
  verificationRadiusMeters?: unknown;
};

export type PlaceVerificationPolicy = {
  notificationRadiusMeters: number;
  verificationRadiusMeters: number;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStoredRadius(value: unknown, allowedValues: number[]) {
  const radius = typeof value === "number" ? value : Number(value);

  if (allowedValues.includes(radius)) {
    return radius;
  }

  return null;
}

export function derivePlaceVerificationPolicy(
  place: PlaceVerificationPolicySource
): PlaceVerificationPolicy {
  const categoryName = normalizeText(place.categoryName);

  if (LARGE_OUTDOOR_CATEGORY_PATTERN.test(categoryName)) {
    return {
      notificationRadiusMeters: LARGE_OUTDOOR_NOTIFICATION_RADIUS_METERS,
      verificationRadiusMeters: LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS,
    };
  }

  return {
    notificationRadiusMeters: DEFAULT_NOTIFICATION_RADIUS_METERS,
    verificationRadiusMeters: DEFAULT_GPS_VERIFICATION_RADIUS_METERS,
  };
}

export function resolvePlaceVerificationPolicy(
  place: PlaceVerificationPolicySource
): PlaceVerificationPolicy {
  const storedNotificationRadius = normalizeStoredRadius(
    place.notificationRadiusMeters,
    [
      // 이전 일반 장소 기본값 300m는 제외해 기존 루트도 150m로 보정한다.
      DEFAULT_NOTIFICATION_RADIUS_METERS,
      LARGE_OUTDOOR_NOTIFICATION_RADIUS_METERS,
    ]
  );
  const storedVerificationRadius = normalizeStoredRadius(
    place.verificationRadiusMeters,
    [
      DEFAULT_GPS_VERIFICATION_RADIUS_METERS,
      LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS,
    ]
  );

  const isStoredDefaultPolicy =
    storedNotificationRadius === DEFAULT_NOTIFICATION_RADIUS_METERS &&
    storedVerificationRadius === DEFAULT_GPS_VERIFICATION_RADIUS_METERS;
  const isStoredLargeOutdoorPolicy =
    storedNotificationRadius === LARGE_OUTDOOR_NOTIFICATION_RADIUS_METERS &&
    storedVerificationRadius ===
      LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS;

  return isStoredDefaultPolicy || isStoredLargeOutdoorPolicy
    ? {
        notificationRadiusMeters: storedNotificationRadius,
        verificationRadiusMeters: storedVerificationRadius,
      }
    : derivePlaceVerificationPolicy(place);
}
