/**
 * 사용 위치: 진행 중인 여행의 DAY 장소 → GPS 테스트
 *
 * 용도:
 * 지도에서 옮긴 마커를 즉시 테스트 GPS로 적용하고 해당 장소까지 가상으로 이동한다.
 *
 * 구조:
 * 위치 선택 지도와 지정한 GPS에서 출발, 원래 GPS로 복귀 버튼으로 구성된다.
 * 위치 적용·이동은 전용 훅에서, 지도 표시는 지도 훅에서 처리한다.
 */
import { useMemo } from "react";
import { IoClose } from "react-icons/io5";
import { MdGpsFixed } from "react-icons/md";
import NaverMapView from "@/components/map/NaverMapView";
import { resolvePlaceVerificationPolicy } from "@/lib/placeVerificationPolicy";
import { useUiText } from "@/lib/uiText";
import type { VisitCompletionTarget } from "../../models/dayRouteDialogTypes";
import {
  useGpsTestLocation,
  type GpsTestLocationActions,
} from "../../hooks/useGpsTestLocation";
import { useGpsTestMap } from "../../hooks/useGpsTestMap";
import {
  formatGpsTestDistance,
  type TestLocation,
} from "../../utils/gpsTestLocation";

type GpsTestLocationPopupProps = GpsTestLocationActions & {
  target: VisitCompletionTarget;
  activeLocation: TestLocation | null;
  isApplying: boolean;
  onClose: () => void;
};

function GpsTestLocationPopup({
  target,
  activeLocation,
  isApplying,
  onApply,
  onClear,
  onClose,
}: GpsTestLocationPopupProps) {
  const text = useUiText();
  const {
    location,
    isResolving,
    error,
    operation,
    walkProgress,
    handleSelectLocation,
    handleAutoWalk,
    handleRestoreLocation,
  } = useGpsTestLocation({ target, activeLocation, onApply, onClear });
  const placeLocation = target.stop.place;
  const verificationPolicy = useMemo(
    () => resolvePlaceVerificationPolicy(placeLocation),
    [placeLocation]
  );
  const handleMapReady = useGpsTestMap({
    placeLocation,
    location,
    verificationPolicy,
    disabled: operation === "walk" || operation === "restore",
    onSelect: (position) => {
      void handleSelectLocation(position);
    },
  });
  const mapResetKey = `${target.stop.id}:${verificationPolicy.notificationRadiusMeters}:${verificationPolicy.verificationRadiusMeters}`;
  const isBusy = isApplying || operation !== null;
  const statusText = isResolving
    ? text.dayRoute.gpsTestResolvingLocation
    : operation === "walk" && walkProgress
      ? text.dayRoute.gpsTestWalkingStep(
          walkProgress.current,
          walkProgress.total,
          formatGpsTestDistance(walkProgress.distanceMeters)
        )
      : isBusy
        ? text.dayRoute.gpsTestApplying
        : null;

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
            disabled={isBusy}
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
        >
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-teal-700 shadow ring-1 ring-teal-200 dark:bg-slate-950/95 dark:text-teal-200 dark:ring-teal-400/30">
              {text.dayRoute.gpsTestArrivalRadiusLegend(
                formatGpsTestDistance(verificationPolicy.notificationRadiusMeters)
              )}
            </span>
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-violet-700 shadow ring-1 ring-violet-200 dark:bg-slate-950/95 dark:text-violet-200 dark:ring-violet-400/30">
              {text.dayRoute.gpsTestVerificationRadiusLegend(
                formatGpsTestDistance(verificationPolicy.verificationRadiusMeters)
              )}
            </span>
          </div>
        </NaverMapView>

        <footer className="app-safe-area-footer shrink-0 border-t border-violet-100 bg-white px-4 py-3 dark:border-violet-400/20 dark:bg-slate-950">
          <p className="mb-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold leading-relaxed text-violet-700 dark:bg-violet-400/10 dark:text-violet-100">
            {text.dayRoute.gpsTestDescription}
          </p>
          {statusText ? (
            <p role="status" className="mb-3 text-xs font-bold text-violet-700 dark:text-violet-200">
              {statusText}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                void handleAutoWalk();
              }}
              disabled={isBusy || isResolving || !location}
              className="rounded-2xl bg-violet-600 px-3 py-3 text-sm font-black text-white disabled:opacity-45"
            >
              {text.dayRoute.gpsTestAutoWalk}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleRestoreLocation();
              }}
              disabled={isBusy}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-600 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {text.dayRoute.gpsTestUseRealLocation}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default GpsTestLocationPopup;
