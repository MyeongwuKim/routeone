
import { getNativeBridgeApi } from "./runtime";
import type {
  NativeArrivalNotificationPlace,
  NativeArrivalNotificationProgress,
  NativeFestivalNotification,
  NativeRouteReviewNotification,
} from "./types";

/**
 * 진행 중인 경로의 장소 목록을 네이티브 도착 알림 등록 상태와 맞춘다.
 * 권한 요청·현재 위치 확인·위치 대기 여부와 진행 단계 콜백을 그대로 전달하며 미지원 환경에서는 null을 반환한다.
 */
export function syncNativeRouteArrivalNotifications({
  places,
  radiusMeters,
  language,
  checkCurrentPosition,
  waitForCurrentPosition,
  requestPermissions,
  onProgress,
}: {
  places: NativeArrivalNotificationPlace[];
  radiusMeters?: number;
  language?: "ko" | "en";
  checkCurrentPosition?: boolean;
  waitForCurrentPosition?: boolean;
  requestPermissions?: boolean;
  onProgress?: (stage: NativeArrivalNotificationProgress) => void;
}) {
  const syncNotifications =
    getNativeBridgeApi()?.syncRouteArrivalNotifications;

  return syncNotifications
    ? syncNotifications({
        places,
        radiusMeters,
        language,
        checkCurrentPosition,
        waitForCurrentPosition,
        requestPermissions,
        onProgress,
      })
    : null;
}

/**
 * 도착 알림 테스트에 사용할 장소와 좌표를 네이티브에 적용한다.
 * place와 position을 null로 전달하면 테스트 위치를 해제하며 미지원 환경에서는 null을 반환한다.
 */
export function setNativeRouteArrivalTestLocation({
  place,
  position,
  language,
}: {
  place: NativeArrivalNotificationPlace | null;
  position?: { lat: number; lng: number } | null;
  language?: "ko" | "en";
}) {
  const setTestLocation = getNativeBridgeApi()?.setRouteArrivalTestLocation;

  return setTestLocation
    ? setTestLocation({ place, position, language })
    : null;
}

/**
 * 네이티브에 실제 표시된 도착 알림을 조회한다.
 * acknowledgedIds는 웹이 이미 처리한 알림 ID로 전달하며 미지원 환경에서는 null을 반환한다.
 */
export function getNativeDeliveredNotifications(
  acknowledgedIds: string[] = []
) {
  return (
    getNativeBridgeApi()?.getDeliveredNotifications?.({
      acknowledgedIds,
    }) ?? null
  );
}

/** 푸시 토큰과 권한 상태를 조회하고 requestPermission이 true이면 네이티브 권한 요청도 허용한다. 미지원 환경은 null이다. */
export function getNativePushToken(requestPermission = false) {
  return (
    getNativeBridgeApi()?.getPushToken?.({
      requestPermission,
    }) ?? null
  );
}

/** 서버에서 계산한 축제 알림 목록으로 네이티브 예약을 교체한다. 빈 배열은 기존 예약 제거이며 미지원 환경은 null이다. */
export function syncNativeFestivalNotifications(
  notifications: NativeFestivalNotification[]
) {
  const syncNotifications = getNativeBridgeApi()?.syncFestivalNotifications;

  return syncNotifications ? syncNotifications({ notifications }) : null;
}

/** 여행 종료 후 검토 알림 목록으로 네이티브 예약을 교체한다. 빈 배열은 기존 예약 제거이며 미지원 환경은 null이다. */
export function syncNativeRouteReviewNotifications(
  notifications: NativeRouteReviewNotification[]
) {
  const syncNotifications =
    getNativeBridgeApi()?.syncRouteReviewNotifications;

  return syncNotifications ? syncNotifications({ notifications }) : null;
}
