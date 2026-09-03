/**
 * 사용 위치: 진행 중인 여행의 DAY 장소 → GPS 테스트
 *
 * 용도:
 * 실제 위치에서 장소까지 가상 이동하거나 지도에서 고른 좌표를 테스트 GPS로 적용한다.
 *
 * 구조:
 * 장소·테스트 위치 지도와 가상 출발, 실제 GPS 복귀, 위치 적용 버튼으로 구성된다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { MdGpsFixed } from "react-icons/md";
import NaverMapView, {
  type NaverMapInstance,
  type NaverMapReadyContext,
  type NaverMarkerInstance,
} from "@/components/map/NaverMapView";
import { calculateDistanceMeters } from "@/lib/gangwonBoundaryUtils";
import { useUiText } from "@/lib/uiText";
import {
  nativeBridge,
  type NativeArrivalTestLocationResult,
} from "@/native-bridge";
import type { VisitCompletionTarget } from "../../models/dayRouteDialogTypes";

type TestLocation = {
  lat: number;
  lng: number;
};

type GpsTestLocationPopupProps = {
  target: VisitCompletionTarget;
  activeLocation: TestLocation | null;
  isApplying: boolean;
  onApply: (
    target: VisitCompletionTarget,
    position: TestLocation
  ) => Promise<NativeArrivalTestLocationResult | null>;
  onClear: () => Promise<NativeArrivalTestLocationResult | null>;
  onClose: () => void;
};

const ARRIVAL_RADIUS_METERS = 300;
const OUTSIDE_ARRIVAL_PRESET_METERS = 450;
const AUTO_WALK_FINAL_DISTANCE_METERS = 30;
const NEARBY_AUTO_WALK_DISTANCES_METERS = [
  1000,
  450,
  350,
  290,
  180,
  AUTO_WALK_FINAL_DISTANCE_METERS,
] as const;
const AUTO_WALK_STEP_DELAY_MS = 700;

function waitForAutoWalkStep() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, AUTO_WALK_STEP_DELAY_MS);
  });
}

function getOffsetTestLocation(
  place: TestLocation,
  distanceMeters: number
) {
  const latitudeRadians = (place.lat * Math.PI) / 180;
  const longitudeOffset =
    distanceMeters /
    (111_320 * Math.max(0.2, Math.cos(latitudeRadians)));

  return {
    lat: place.lat,
    lng: place.lng + longitudeOffset,
  };
}

function interpolateLocation(
  start: TestLocation,
  target: TestLocation,
  progress: number
) {
  const normalizedProgress = Math.max(0, Math.min(1, progress));

  return {
    lat: start.lat + (target.lat - start.lat) * normalizedProgress,
    lng: start.lng + (target.lng - start.lng) * normalizedProgress,
  };
}

function createAutoWalkSteps(
  start: TestLocation,
  target: TestLocation
) {
  const totalDistanceMeters = calculateDistanceMeters(start, target);
  const acceleratedDistances =
    totalDistanceMeters > 2000
      ? [totalDistanceMeters * 0.65, totalDistanceMeters * 0.3]
      : [];
  const remainingDistances = [
    totalDistanceMeters,
    ...acceleratedDistances,
    ...NEARBY_AUTO_WALK_DISTANCES_METERS,
  ]
    .filter(
      (distance) =>
        distance <= totalDistanceMeters &&
        (distance === totalDistanceMeters ||
          distance >= AUTO_WALK_FINAL_DISTANCE_METERS)
    )
    .sort((left, right) => right - left)
    .filter(
      (distance, index, distances) =>
        index === 0 || Math.abs(distances[index - 1] - distance) >= 10
    );

  return remainingDistances.map((remainingDistanceMeters) => ({
    distanceMeters: remainingDistanceMeters,
    position:
      totalDistanceMeters <= 0
        ? target
        : interpolateLocation(
            start,
            target,
            1 - remainingDistanceMeters / totalDistanceMeters
          ),
  }));
}

function getInitialTestLocation(
  target: VisitCompletionTarget,
  activeLocation: TestLocation | null
) {
  if (activeLocation) {
    return activeLocation;
  }

  return getOffsetTestLocation(
    target.stop.place,
    OUTSIDE_ARRIVAL_PRESET_METERS
  );
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }

  return `${(meters / 1000).toFixed(1)}km`;
}

function createPlaceMarkerIconHtml() {
  return `
    <div style="
      width:38px;
      height:38px;
      border:3px solid #ffffff;
      border-radius:9999px;
      background:#0f766e;
      box-shadow:0 8px 20px rgba(15,118,110,0.3);
      color:#ffffff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:12px;
      font-weight:900;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">P</div>
  `;
}

function createTestLocationMarkerIconHtml() {
  return `
    <div style="
      position:relative;
      width:46px;
      height:60px;
      transform:translate(-23px,-60px);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      pointer-events:auto;
      user-select:none;
    ">
      <div style="
        width:46px;
        height:46px;
        border:3px solid #ffffff;
        border-radius:9999px;
        background:#7c3aed;
        box-shadow:0 10px 24px rgba(124,58,237,0.34);
        color:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:11px;
        font-weight:900;
        line-height:1;
      ">GPS</div>
      <div style="
        position:absolute;
        left:50%;
        top:41px;
        width:0;
        height:0;
        transform:translateX(-50%);
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-top:13px solid #7c3aed;
      "></div>
    </div>
  `;
}

function GpsTestLocationPopup({
  target,
  activeLocation,
  isApplying,
  onApply,
  onClear,
  onClose,
}: GpsTestLocationPopupProps) {
  const text = useUiText();
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const testMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const fallbackInitialLocation = useMemo(
    () => getInitialTestLocation(target, activeLocation),
    [activeLocation, target]
  );
  const [realStartLocation, setRealStartLocation] =
    useState<TestLocation | null>(null);
  const [initialActiveLocation] = useState(activeLocation);
  const [isResolvingRealStart, setIsResolvingRealStart] = useState(true);
  const [realStartError, setRealStartError] = useState<string | null>(null);
  const initialLocation =
    initialActiveLocation ?? realStartLocation ?? fallbackInitialLocation;
  const [draftLocation, setDraftLocation] =
    useState<TestLocation>(fallbackInitialLocation);
  const [isAutoWalking, setIsAutoWalking] = useState(false);
  const [autoWalkStepIndex, setAutoWalkStepIndex] = useState<number | null>(
    null
  );
  const [autoWalkStepCount, setAutoWalkStepCount] = useState(0);
  const [autoWalkDistanceMeters, setAutoWalkDistanceMeters] = useState<
    number | null
  >(null);
  const autoWalkRunIdRef = useRef(0);
  const placeLocation = target.stop.place;
  const mapResetKey = `${target.stop.id}:${initialLocation.lat}:${initialLocation.lng}`;
  const isBusy = isApplying || isAutoWalking || isResolvingRealStart;

  useEffect(() => {
    let isActive = true;
    const positionRequest = nativeBridge.location.getCurrentPosition({
      useRealPosition: true,
    });
    const realPositionRequest =
      positionRequest ??
      Promise.reject(
        new Error(text.dayRoute.gpsTestRealLocationUnavailable)
      );

    void realPositionRequest
      .then((position) => {
        if (!isActive) {
          return;
        }

        const nextLocation = {
          lat: position.lat,
          lng: position.lng,
        };
        setRealStartLocation(nextLocation);
        if (!initialActiveLocation) {
          setDraftLocation(nextLocation);
        }
      })
      .catch((error) => {
        if (isActive) {
          setRealStartError(
            error instanceof Error
              ? error.message
              : text.dayRoute.gpsTestRealLocationUnavailable
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsResolvingRealStart(false);
        }
      });

    return () => {
      isActive = false;
      autoWalkRunIdRef.current += 1;
    };
  }, [
    initialActiveLocation,
    target.stop.id,
    text.dayRoute.gpsTestRealLocationUnavailable,
  ]);

  const updateDraftLocation = useCallback(
    (nextLocation: TestLocation, options: { pan?: boolean } = {}) => {
      setDraftLocation(nextLocation);

      if (!window.naver?.maps) {
        return;
      }

      const nextPosition = new window.naver.maps.LatLng(
        nextLocation.lat,
        nextLocation.lng
      );
      testMarkerRef.current?.setPosition?.(nextPosition);

      if (options.pan) {
        mapInstanceRef.current?.panTo?.(nextPosition);
      }
    },
    []
  );

  const handleMapReady = useCallback(
    ({ map, naverMaps }: NaverMapReadyContext) => {
      mapInstanceRef.current = map;

      const overlays: NaverMarkerInstance[] = [];
      const placePosition = new naverMaps.LatLng(
        placeLocation.lat,
        placeLocation.lng
      );
      const testPosition = new naverMaps.LatLng(
        initialLocation.lat,
        initialLocation.lng
      );
      const bounds = new naverMaps.LatLngBounds();
      bounds.extend(placePosition);
      bounds.extend(testPosition);

      const radiusCircle = new naverMaps.Circle({
        map,
        center: placePosition,
        radius: ARRIVAL_RADIUS_METERS,
        fillColor: "#14b8a6",
        fillOpacity: 0.13,
        strokeColor: "#0f766e",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        zIndex: 500,
      }) as NaverMarkerInstance;
      overlays.push(radiusCircle);

      const placeMarker = new naverMaps.Marker({
        map,
        position: placePosition,
        title: placeLocation.title,
        zIndex: 1600,
        icon: {
          content: createPlaceMarkerIconHtml(),
          anchor: new naverMaps.Point(19, 19),
        },
      }) as NaverMarkerInstance;
      overlays.push(placeMarker);

      const testMarker = new naverMaps.Marker({
        map,
        position: testPosition,
        draggable: true,
        zIndex: 2600,
        icon: {
          content: createTestLocationMarkerIconHtml(),
          anchor: new naverMaps.Point(0, 0),
        },
      }) as NaverMarkerInstance & {
        getPosition: () => { lat: () => number; lng: () => number };
      };
      testMarkerRef.current = testMarker;
      overlays.push(testMarker);

      const dragListener = naverMaps.Event.addListener(
        testMarker,
        "dragend",
        () => {
          const position = testMarker.getPosition();
          updateDraftLocation({
            lat: position.lat(),
            lng: position.lng(),
          });
        }
      );
      const clickListener = naverMaps.Event.addListener(
        map,
        "click",
        (event: { coord: { lat: () => number; lng: () => number } }) => {
          updateDraftLocation(
            {
              lat: event.coord.lat(),
              lng: event.coord.lng(),
            },
            { pan: true }
          );
        }
      );

      const fitVisibleBounds = () => {
        naverMaps.Event.trigger(map, "resize");

        try {
          map.fitBounds?.(bounds, {
            top: 120,
            right: 48,
            bottom: 80,
            left: 48,
          });
        } catch {
          map.fitBounds?.(bounds);
        }
      };
      const frameId = window.requestAnimationFrame(fitVisibleBounds);
      const timerId = window.setTimeout(fitVisibleBounds, 160);

      return () => {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(timerId);
        naverMaps.Event.removeListener(dragListener);
        naverMaps.Event.removeListener(clickListener);
        overlays.forEach((overlay) => overlay.setMap(null));
        testMarkerRef.current = null;
        mapInstanceRef.current = null;
      };
    }, [initialLocation, placeLocation, updateDraftLocation]
  );

  const handleAutoWalk = async () => {
    if (isBusy || !realStartLocation) {
      return;
    }

    const steps = createAutoWalkSteps(realStartLocation, placeLocation);
    const runId = autoWalkRunIdRef.current + 1;
    autoWalkRunIdRef.current = runId;
    setIsAutoWalking(true);
    setAutoWalkStepIndex(0);
    setAutoWalkStepCount(steps.length);
    setAutoWalkDistanceMeters(steps[0]?.distanceMeters ?? null);

    try {
      for (let index = 0; index < steps.length; index += 1) {
        if (autoWalkRunIdRef.current !== runId) {
          return;
        }

        const step = steps[index];
        setAutoWalkStepIndex(index);
        setAutoWalkDistanceMeters(step.distanceMeters);
        updateDraftLocation(step.position, { pan: true });

        const result = await onApply(target, step.position);

        if (!result || autoWalkRunIdRef.current !== runId) {
          return;
        }

        if (index < steps.length - 1) {
          await waitForAutoWalkStep();
        }
      }
    } finally {
      if (autoWalkRunIdRef.current === runId) {
        setIsAutoWalking(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[3200] bg-white dark:bg-slate-950">
      <div className="flex h-full flex-col">
        <header className="app-safe-area-header flex shrink-0 items-center justify-between border-b border-violet-100 bg-white px-4 py-3 dark:border-violet-400/20 dark:bg-slate-950">
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-trip text-sm text-violet-700 dark:text-violet-200">
              <MdGpsFixed />
              GPS TEST
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900 dark:text-white">
              {text.dayRoute.gpsTestTitle(target.stop.place.title)}
            </h2>
          </div>
          <button
            type="button"
            aria-label={text.dayRoute.gpsTestCloseAria}
            onClick={onClose}
            disabled={isBusy || !realStartLocation}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-xl text-violet-700 disabled:opacity-45 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-100"
          >
            <IoClose />
          </button>
        </header>

        <NaverMapView
          center={placeLocation}
          zoom={17}
          minZoom={10}
          resetKey={mapResetKey}
          className="relative min-h-0 flex-1 bg-violet-50 dark:bg-slate-900"
          onReady={handleMapReady}
        />

        <footer className="app-safe-area-footer shrink-0 border-t border-violet-100 bg-white px-4 py-3 dark:border-violet-400/20 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => {
              void handleAutoWalk();
            }}
            disabled={isBusy}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-3 py-3 text-sm font-black text-white disabled:opacity-45"
          >
            <MdGpsFixed className="text-base" />
            {isResolvingRealStart
              ? text.dayRoute.gpsTestResolvingRealLocation
              : isAutoWalking &&
                  autoWalkStepIndex != null &&
                  autoWalkDistanceMeters != null
              ? text.dayRoute.gpsTestWalkingStep(
                  autoWalkStepIndex + 1,
                  autoWalkStepCount,
                  formatDistance(autoWalkDistanceMeters)
                )
              : text.dayRoute.gpsTestAutoWalk}
          </button>
          {realStartError ? (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">
              {realStartError}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                void onClear().then((result) => {
                  if (result) {
                    const restoredLocation =
                      result.lat != null && result.lng != null
                        ? { lat: result.lat, lng: result.lng }
                        : realStartLocation;

                    if (restoredLocation) {
                      setRealStartLocation(restoredLocation);
                      updateDraftLocation(restoredLocation, { pan: true });
                    }
                  }
                });
              }}
              disabled={isBusy}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-600 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {text.dayRoute.gpsTestUseRealLocation}
            </button>
            <button
              type="button"
              onClick={() => {
                void onApply(target, draftLocation);
              }}
              disabled={isBusy}
              className="rounded-2xl bg-violet-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-45"
            >
              {isApplying
                ? text.dayRoute.gpsTestApplying
                : text.dayRoute.gpsTestApplyLocation}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default GpsTestLocationPopup;
