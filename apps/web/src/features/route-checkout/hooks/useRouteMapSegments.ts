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
