/**
 * 용도:
 * 루트 장소에 저장된 도착 알림·방문 인증 반경을 함께 사용한다.
 *
 * 동작 방식:
 * 저장된 정책이 있으면 그대로 사용하고,
 * 기존 루트는 세부 카테고리명으로 동일한 기본값을 계산한다.
 */

export const DEFAULT_NOTIFICATION_RADIUS_METERS = 300;
export const DEFAULT_GPS_VERIFICATION_RADIUS_METERS = 100;
export const LARGE_OUTDOOR_NOTIFICATION_RADIUS_METERS = 500;
export const LARGE_OUTDOOR_GPS_VERIFICATION_RADIUS_METERS = 300;

const LARGE_OUTDOOR_CATEGORY_PATTERN =
  /해변|해수욕장|바다|해안|공원|휴양림|수목원|식물원|정원|숲|둘레길|산책로|트레킹|등산|계곡|폭포|호수|저수지|습지|섬|자연관광|생태관광|동굴|강|하천|beach|coast|seaside|ocean|\bsea\b|park|forest|arboretum|botanic|garden|trail|trek|hiking|mountain|valley|waterfall|lake|reservoir|wetland|island|nature|cave|river/i;

export type PlaceVerificationPolicySource = {
  contentTypeId?: string | null;
  categoryName?: string | null;
  notificationRadiusMeters?: number | null;
  verificationRadiusMeters?: number | null;
};

export type PlaceVerificationPolicy = {
  notificationRadiusMeters: number;
  verificationRadiusMeters: number;
};

function normalizeStoredRadius(
  value: number | null | undefined,
  allowedValues: number[]
) {
  if (typeof value === "number" && allowedValues.includes(value)) {
    return value;
  }

  return null;
}

export function derivePlaceVerificationPolicy(
  place: PlaceVerificationPolicySource
): PlaceVerificationPolicy {
  const categoryName = place.categoryName?.trim() ?? "";

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
