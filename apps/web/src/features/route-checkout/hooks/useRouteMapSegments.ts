/** 현재 일정과 비교 일정의 자동차 경로 선을 조회하고 직선 fallback 구간과 함께 관리한다. */
import { useEffect, useState } from "react";
import { useUiText } from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import {
  fetchRouteMapSegments,
  type RouteMapPoint,
  type RouteMapSegment,
} from "../models/routeMapModel";

type UseRouteMapSegmentsOptions = {

  routePoints: RouteMapPoint[];

  comparisonRoutePoints: RouteMapPoint[];

  fallbackSegments: RouteMapSegment[];

  comparisonFallbackSegments: RouteMapSegment[];
};

type RouteMapSegmentState = {
  routeSegments: RouteMapSegment[];
  comparisonRouteSegments: RouteMapSegment[];
  isRouteLoading: boolean;
  routeError: string | null;
};

/**
 * 두 경로를 병렬 조회하고 각 요청이 실패하거나 빈 결과를 반환하면 해당 fallback 구간을 유지한다.
 * 입력이나 언어가 바뀌면 이전 결과 반영을 막고, 현재 경로 실패만 사용자용 routeError로 노출한다.
 */
export function useRouteMapSegments({
  routePoints,
  comparisonRoutePoints,
  fallbackSegments,
  comparisonFallbackSegments,
}: UseRouteMapSegmentsOptions) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const [state, setState] = useState<RouteMapSegmentState>({
    routeSegments: fallbackSegments,
    comparisonRouteSegments: comparisonFallbackSegments,
    isRouteLoading: false,
    routeError: null,
  });

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setState({
        routeSegments: fallbackSegments,
        comparisonRouteSegments: comparisonFallbackSegments,
        isRouteLoading: true,
        routeError: null,
      });
    });

    const loadSegments = async (
      points: RouteMapPoint[],
      fallback: RouteMapSegment[]
    ) => {
      if (points.length < 2) {
        return fallback;
      }

      const segments = await fetchRouteMapSegments(points, appLanguage);
      return segments.length > 0 ? segments : fallback;
    };

    Promise.allSettled([
      loadSegments(routePoints, fallbackSegments),
      comparisonRoutePoints.length > 1
        ? loadSegments(comparisonRoutePoints, comparisonFallbackSegments)
        : Promise.resolve(comparisonFallbackSegments),
    ]).then(([currentResult, comparisonResult]) => {
      if (!isActive) {
        return;
      }

      const hasError =
        currentResult.status === "rejected" ||
        comparisonResult.status === "rejected";
      setState({
        routeSegments:
          currentResult.status === "fulfilled"
            ? currentResult.value
            : fallbackSegments,
        comparisonRouteSegments:
          comparisonResult.status === "fulfilled"
            ? comparisonResult.value
            : comparisonFallbackSegments,
        isRouteLoading: false,
        routeError: hasError
          ? text.dayRoute.routeMapPartialLoadError
          : null,
      });
    });

    return () => {
      isActive = false;
    };
  }, [
    appLanguage,
    comparisonFallbackSegments,
    comparisonRoutePoints,
    fallbackSegments,
    routePoints,
    text,
  ]);

  return state;
}
