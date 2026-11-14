import { useMemo, useRef, useState } from "react";
import { useAccountUser } from "@/components/account/useAccountUser";
import { useAuthSession } from "@/hooks/useAuthSession";
import { resolvePlaceVerificationPolicy } from "@/lib/placeVerificationPolicy";
import { useUiText } from "@/lib/uiText";
import { nativeBridge } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useCurrentPositionStore } from "@/stores/currentPositionStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { VisitCompletionTarget } from "../models/dayRouteDialogTypes";
import type { DayRoutePopupProps } from "../models/dayRoutePopupTypes";
import {
  getRouteDateKey,
  getSortedRouteDays,
  getTodayDateKey,
  isVisitedStop,
} from "../routeDisplay";
import { isTestAccountModeEnabled } from "../services/visitPhotoService";
import { getLocalizedRouteTitle } from "../utils/dayRouteFormatting";

type DayRouteGpsTestOptions = Pick<
  DayRoutePopupProps,
  "route" | "isReadOnly" | "visitCompletionMode"
>;

/**
 * DAY 팝업의 GPS 테스트 대상과 기기에 적용한 가상 위치, 적용 중 상태를 관리한다.
 * 로그인·역할·루트·네이티브 조건으로 새 명령을 제한하고, 네이티브 성공 뒤 공용 현재 위치를 바꾼다.
 * 대상 변경이나 팝업 닫기는 적용 좌표를 지우지 않으며, 실제 GPS 복귀 명령에서만 좌표를 비운다.
 */
export function useDayRouteGpsTest({
  route,
  isReadOnly = false,
  visitCompletionMode = "live",
}: DayRouteGpsTestOptions) {
  const { isAuthenticated } = useAuthSession();
  const { user } = useAccountUser();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const text = useUiText();
  const showToast = useUiToastStore((state) => state.showToast);
  const applyCurrentPosition = useCurrentPositionStore(
    (state) => state.applyPosition
  );
  const clearCurrentPosition = useCurrentPositionStore(
    (state) => state.clearPosition
  );
  const requestCurrentPosition = useCurrentPositionStore(
    (state) => state.requestCurrentPosition
  );
  /** 마지막으로 가상 위치 적용에 성공한 장소. 다른 테스트 대상을 열어도 유지한다. */
  const [gpsTestLocationStopId, setGpsTestLocationStopId] = useState<
    string | null
  >(null);
  const [gpsTestLocation, setGpsTestLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  /** 지도 팝업 대상. null로 닫아도 기기의 가상 위치는 유지한다. */
  const [gpsTestTarget, setGpsTestTarget] =
    useState<VisitCompletionTarget | null>(null);
  const [isGpsTestApplying, setIsGpsTestApplying] = useState(false);
  /** 다음 렌더 전의 중복 명령도 막고 실제 GPS 재조회가 끝날 때까지 유지한다. */
  const gpsTestApplyingRef = useRef(false);
  const sortedDays = useMemo(() => getSortedRouteDays(route), [route]);
  const isGpsTestEnabled =
    !isReadOnly &&
    visitCompletionMode !== "retrospective" &&
    route.isMine &&
    Boolean(route.startedAt) &&
    isAuthenticated &&
    (isTestAccountModeEnabled() ||
      user?.role === "OWNER" ||
      user?.role === "REVIEWER") &&
    nativeBridge.runtime.isAvailable();
  const indoorTestTarget = isGpsTestEnabled
    ? sortedDays
        .flatMap((routeDay) =>
          [...routeDay.stops]
            .sort((left, right) => left.order - right.order)
            .map((stop) => ({ routeDay, stop }))
        )
        .find(({ stop }) => !isVisitedStop(stop)) ?? null
    : null;

  /**
   * 사용 가능한 세션에서 한 번에 한 위치만 네이티브에 적용한다.
   * 반환 좌표가 있으면 공용 위치와 마지막 적용 좌표를 갱신하고, 실패하면 토스트와 null을 반환한다.
   * 이미 시작한 요청은 대상·권한이 바뀌어도 완료하며 알림 결과와 옵션에 맞춰 성공 안내를 선택한다.
   */
  const handleApplyGpsTestLocation = async (
    target: VisitCompletionTarget,
    position: { lat: number; lng: number },
    options: {
      showSuccessToast?: boolean;
      notificationWasScheduledEarlier?: boolean;
    } = {}
  ) => {
    if (!isGpsTestEnabled || gpsTestApplyingRef.current) {
      return null;
    }

    const request = nativeBridge.notifications.setRouteArrivalTestLocation({
      place: {
        id: `${route.id}:${target.stop.id}`,
        routeId: route.id,
        routeTitle: getLocalizedRouteTitle(route, text),
        dayId: target.routeDay.id,
        dayIndex: target.routeDay.dayIndex,
        dayDateKey:
          getRouteDateKey(target.routeDay.date) ?? getTodayDateKey(),
        stopId: target.stop.id,
        title: target.stop.place.title,
        lat: target.stop.place.lat,
        lng: target.stop.place.lng,
        radiusMeters: resolvePlaceVerificationPolicy(target.stop.place)
          .notificationRadiusMeters,
      },
      position,
      language: appLanguage,
    });

    if (!request) {
      showToast(text.dayRoute.gpsTestUnavailable);
      return null;
    }

    gpsTestApplyingRef.current = true;
    setIsGpsTestApplying(true);

    try {
      const result = await request;
      if (result.lat == null || result.lng == null) {
        throw new Error(text.dayRoute.gpsTestMoveFailed);
      }
      applyCurrentPosition({
        lat: result.lat,
        lng: result.lng,
        accuracyMeters: 1,
        timestamp: Date.now(),
      });
      setGpsTestLocationStopId(target.stop.id);
      setGpsTestLocation({ lat: result.lat, lng: result.lng });
      if (options.showSuccessToast !== false) {
        showToast(
          result.notificationScheduled ||
            options.notificationWasScheduledEarlier
            ? text.dayRoute.gpsTestAppliedWithNotification
            : result.withinRadius
              ? text.dayRoute.gpsTestAppliedInsideWithoutNotification
              : text.dayRoute.gpsTestAppliedWithoutNotification
        );
      }
      return result;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : text.dayRoute.gpsTestMoveFailed
      );
      return null;
    } finally {
      gpsTestApplyingRef.current = false;
      setIsGpsTestApplying(false);
    }
  };

  /**
   * 네이티브 가상 위치 해제에 성공하면 저장 좌표를 비우고 실제 GPS를 강제로 다시 조회한다.
   * GPS 조회까지 중복 명령을 막으며 조회 실패 시에도 해제된 가상 좌표는 되돌리지 않는다.
   */
  const handleClearGpsTestLocation = async () => {
    if (!isGpsTestEnabled || gpsTestApplyingRef.current) {
      return null;
    }

    const request = nativeBridge.notifications.setRouteArrivalTestLocation({
      place: null,
      language: appLanguage,
    });

    if (!request) {
      showToast(text.dayRoute.gpsTestUnavailable);
      return null;
    }

    gpsTestApplyingRef.current = true;
    setIsGpsTestApplying(true);

    try {
      const result = await request;
      clearCurrentPosition();
      setGpsTestLocationStopId(null);
      setGpsTestLocation(null);
      const realPosition = await requestCurrentPosition({
        forceRefresh: true,
      });
      showToast(text.dayRoute.gpsTestCleared);
      return {
        ...result,
        lat: realPosition.lat,
        lng: realPosition.lng,
      };
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : text.dayRoute.gpsTestMoveFailed
      );
      return null;
    } finally {
      gpsTestApplyingRef.current = false;
      setIsGpsTestApplying(false);
    }
  };

  /** 방문 순서상 첫 미방문 장소를 연다. 건너뛴 장소도 기존 테스트 선택 기준에 포함한다. */
  const openIndoorTest = () => {
    if (indoorTestTarget) {
      setGpsTestTarget(indoorTestTarget);
    }
  };

  return {
    isGpsTestEnabled,
    indoorTestTarget,
    gpsTestTarget,
    gpsTestLocationStopId,
    gpsTestLocation,
    isGpsTestApplying,
    setGpsTestTarget,
    openIndoorTest,
    handleApplyGpsTestLocation,
    handleClearGpsTestLocation,
  };
}
