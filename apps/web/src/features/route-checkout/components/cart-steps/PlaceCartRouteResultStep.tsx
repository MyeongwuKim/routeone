import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { IoLocationSharp } from "react-icons/io5";
import { routeCheckoutApi } from "@/api/routeCheckoutApi";
import { routeApi } from "@/api/routeApi";
import {
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "@/features/my-route/myRouteCache";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { createPlaceDuplicateKeySet } from "@/lib/placeDuplicate";
import { useRouteCheckout } from "../RouteCheckoutContext";
import PlaceCartRouteDayCard from "./PlaceCartRouteDayCard";
import StartLocationPickerPopup from "./StartLocationPickerPopup";
import type { TravelTempo } from "./PlaceCartTempoStep";
import { useRouteResultEditor } from "./useRouteResultEditor";
import { findRouteDateConflict } from "../../utils/routeDateConflict";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import type { MyRoutesQuery } from "@/generated/graphql";
import type { PlannedRouteDay, RouteStartLocation } from "./routePlanTypes";

type PlaceCartRouteResultStepProps = {
  savedPlaces: SavedPlaceItem[];
  candidatePlaces: MapSheetPlace[];
  initialRoutePlan?: PlannedRouteDay[] | null;
  currentLocation: RouteStartLocation | null;
  onClose: () => void;
  onClearPlaces: () => void;
  onRequestSearchPlace: () => void;
};

const TEMPO_LABEL: Record<TravelTempo, string> = {
  relaxed: "여유롭게",
  balanced: "보통",
  packed: "촘촘하게",
};

function formatClock(totalMinutes: number) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDurationText(totalMinutes: number) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));

  if (normalizedMinutes < 60) {
    return `${normalizedMinutes}분`;
  }

  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return minute > 0 ? `${hour}시간 ${minute}분` : `${hour}시간`;
}

function isSameRouteDay(left: PlannedRouteDay, right: PlannedRouteDay) {
  if (
    left.startLocation?.lat !== right.startLocation?.lat ||
    left.startLocation?.lng !== right.startLocation?.lng ||
    left.items.length !== right.items.length
  ) {
    return false;
  }

  return left.items.every(
    (item, index) => item.place.id === right.items[index]?.place.id
  );
}

function getRouteSaveErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "루트 저장에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

function PlaceCartRouteResultStep({
  savedPlaces,
  candidatePlaces,
  initialRoutePlan,
  currentLocation,
  onClose,
  onClearPlaces,
  onRequestSearchPlace,
}: PlaceCartRouteResultStepProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const openModal = useUiModalStore((state) => state.openModal);
  const appendTarget = useRouteEditFlowStore((state) => state.appendTarget);
  const clearAppendTarget = useRouteEditFlowStore(
    (state) => state.clearAppendTarget
  );
  const {
    travelStartDate,
    tripDays,
    setStep,
    dailyStartMinutes,
    scheduleEndMinutes,
    tempo,
    isScheduleValid,
  } = useRouteCheckout();
  const {
    routePlan,
    appliedRoutePlan,
    startLocation,
    isRouteEditDirty,
    handleChangeStayMinutes,
    handleChangeStartLocation,
    handleInsertPlace,
    handleRemoveRoutePlace,
    handleReorderRoutePlan,
    handleApplyRouteEdits,
    handleCancelRouteEdits,
  } = useRouteResultEditor({
    savedPlaces,
    initialRoutePlan,
    travelStartDate,
    tripDays,
    dailyStartMinutes,
    dailyEndMinutes: scheduleEndMinutes,
    tempo,
    isScheduleValid,
    currentLocation,
  });
  const [isOrderEditing, setIsOrderEditing] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isStartLocationPickerOpen, setIsStartLocationPickerOpen] =
    useState(false);
  const hasOverSchedule = routePlan.some((day) =>
    day.items.some((item) => item.isOverSchedule)
  );
  const hasEditableRoute = routePlan.some((day) => day.items.length > 0);
  const firstRouteItem =
    routePlan.find((day) => day.items.length > 0)?.items[0] ?? null;
  const firstTravelMinutes = firstRouteItem?.travelMinutesFromPrevious ?? null;
  const isRouteOrderEditing = isOrderEditing && hasEditableRoute;
  const excludedPlaceKeys = [
    ...createPlaceDuplicateKeySet(
      routePlan.flatMap((day) => day.items.map((item) => item.place))
    ),
  ];
  const getBaselineDay = (dayNumber: number) =>
    appliedRoutePlan.find((day) => day.day === dayNumber) ?? null;
  const startOrderEditing = () => {
    if (!hasEditableRoute || isOrderEditing) {
      return;
    }

    setIsOrderEditing(true);
  };
  const finishOrderEditing = () => {
    if (!isOrderEditing) {
      return;
    }

    setIsOrderEditing(false);
  };
  const getComparisonDay = (day: PlannedRouteDay) => {
    const baselineDay = getBaselineDay(day.day);

    if (!baselineDay || isSameRouteDay(day, baselineDay)) {
      return null;
    }

    return baselineDay;
  };
  const handleReorderDayItems = (
    dayNumber: number,
    nextItems: PlannedRouteDay["items"]
  ) => {
    handleReorderRoutePlan(
      routePlan.map((day) =>
        day.day === dayNumber
          ? {
              ...day,
              items: nextItems,
            }
          : day
      )
    );
  };
  const handleMovePlaceToDay = (
    placeId: string,
    targetDayNumber: number,
    position: "first" | "last"
  ) => {
    const movedItem = routePlan
      .flatMap((day) => day.items)
      .find((item) => item.place.id === placeId);

    if (!movedItem) {
      return;
    }

    const nextRoutePlan = routePlan.map((day) => {
      const nextItems = day.items.filter((item) => item.place.id !== placeId);

      if (day.day !== targetDayNumber) {
        return {
          ...day,
          items: nextItems,
        };
      }

      return {
        ...day,
        items:
          position === "first"
            ? [movedItem, ...nextItems]
            : [...nextItems, movedItem],
      };
    });

    handleReorderRoutePlan(nextRoutePlan);
  };

  if (!tempo) {
    return null;
  }

  const handleApplyResultEdits = () => {
    handleApplyRouteEdits();
    setIsOrderEditing(false);
  };

  const handleCancelResultEdits = () => {
    handleCancelRouteEdits();
    setIsOrderEditing(false);
  };
  const handleSaveRoute = async () => {
    if (isSavingRoute) {
      return;
    }

    if (!hasEditableRoute) {
      showToast("저장할 장소가 없어요.");
      return;
    }

    setIsSavingRoute(true);

    try {
      const routesData =
        queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY) ??
        (await queryClient.fetchQuery<MyRoutesQuery>({
          queryKey: MY_ROUTES_QUERY_KEY,
          queryFn: () => routeApi.myRoutes(),
        }));
      const conflict = findRouteDateConflict({
        routes: routesData.myRoutes,
        travelStartDate,
        tripDays,
        excludeRouteId: appendTarget?.routeId,
      });

      if (conflict) {
        openModal({
          title: "이미 일정이 있어요",
          description: `${conflict.requestedRangeLabel} 일정이 기존 ${conflict.existingRangeLabel} 일정과 겹쳐서 저장할 수 없어요.`,
          detail: "내 루트에서 기존 일정을 확인하거나 여행 날짜를 다시 선택해 주세요.",
          actions: [
            {
              label: "내 루트 보기",
              variant: "secondary",
              onClick: () => {
                onClose();
                navigate("/my-route");
              },
            },
            {
              label: "날짜 다시 선택",
              variant: "primary",
              onClick: () => {
                setStep("schedule");
              },
            },
          ],
        });
        setIsSavingRoute(false);
        return;
      }

      if (appendTarget) {
        const route = await routeCheckoutApi.appendRouteDays(appendTarget.routeId, {
          routePlan,
          travelStartDate,
          tripDays,
          dailyStartMinutes,
          scheduleEndMinutes,
          startLocation,
        });
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          (currentData) => upsertMyRouteCache(currentData, route.appendRouteDays)
        );
      } else {
        const route = await routeCheckoutApi.saveRoutePlan({
          routePlan,
          travelStartDate,
          tripDays,
          dailyStartMinutes,
          scheduleEndMinutes,
          startLocation,
        });
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          (currentData) => upsertMyRouteCache(currentData, route.createRoute)
        );

        showToast(`${route.createRoute.totalStopCount}개 장소로 루트를 저장했어요.`);
      }

      if (appendTarget) {
        showToast(`${appendTarget.routeTitle}에 DAY를 추가했어요.`);
      }
      clearAppendTarget();
      onClearPlaces();
      onClose();
    } catch (error) {
      showToast(getRouteSaveErrorMessage(error), 2600);
      setIsSavingRoute(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="route-checkout-step-enter space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-trip text-sm text-brand-700">ROUTE RESULT</p>
                {isRouteEditDirty ? (
                  <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    수정 중
                  </span>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {appendTarget ? "추가할 DAY를 만들었어요" : "추천 루트를 만들었어요"}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {appendTarget
                ? `${appendTarget.routeTitle}에 붙일 새 DAY입니다. 체류시간과 순서를 확인한 뒤 추가해요.`
                : `${TEMPO_LABEL[tempo]} 템포 기준 추천 체류시간과 거리 기반 차량 이동 추정치로 배치한 일정입니다. 체류시간은 역 카드에서 직접 수정할 수 있어요.`}
            </p>
          </div>

          {hasOverSchedule ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              담은 장소가 많아 일부 일정이 희망 종료 시간 {formatClock(scheduleEndMinutes)}을
              넘습니다. 여행 일수를 늘리거나 체류시간을 줄여 주세요.
            </div>
          ) : null}

          <div className="space-y-4">
            {startLocation ? (
              <section className="rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-xs font-black text-brand-700">
                      <IoLocationSharp className="text-sm" />
                      출발 위치
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                      {firstTravelMinutes != null && firstTravelMinutes >= 60
                        ? `첫 장소까지 약 ${formatDurationText(firstTravelMinutes)} 걸려요. 실제 출발지가 다르면 시작 마커를 옮겨요.`
                        : "현재 위치와 여행 지역이 다르면 시작 마커를 옮겨 다시 계산해요."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStartLocationPickerOpen(true)}
                    className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700"
                  >
                    마커 이동
                  </button>
                </div>
              </section>
            ) : null}

            {routePlan.map((day) => (
              <PlaceCartRouteDayCard
                key={day.day}
                day={day}
                routePlan={routePlan}
                isOrderEditing={isRouteOrderEditing}
                comparisonDay={getComparisonDay(day)}
                candidatePlaces={candidatePlaces}
                excludedPlaceKeys={excludedPlaceKeys}
                onChangeStayMinutes={handleChangeStayMinutes}
                onInsertPlace={handleInsertPlace}
                onRemovePlace={handleRemoveRoutePlace}
                onReorderDayItems={handleReorderDayItems}
                onMovePlaceToDay={handleMovePlaceToDay}
                onRequestOrderEditing={startOrderEditing}
                onFinishOrderEditing={finishOrderEditing}
                onRequestSearchPlace={onRequestSearchPlace}
              />
            ))}
          </div>
        </div>
      </div>

      <footer className="app-safe-area-footer shrink-0 border-t border-brand-100 px-4 py-4">
        {isRouteOrderEditing ? (
          <button
            type="button"
            disabled
            className="w-full rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 opacity-80"
          >
            순서 변경을 완료해 주세요
          </button>
        ) : isRouteEditDirty ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCancelResultEdits}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              변경 취소
            </button>
            <button
              type="button"
              onClick={handleApplyResultEdits}
              className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              변경 적용
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSaveRoute}
            disabled={isSavingRoute || !hasEditableRoute}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {isSavingRoute
              ? "저장 중..."
              : appendTarget
                ? "DAY 추가"
                : "완료"}
          </button>
        )}
      </footer>

      {isStartLocationPickerOpen && startLocation ? (
        <StartLocationPickerPopup
          routePlan={routePlan}
          initialLocation={startLocation}
          onClose={() => setIsStartLocationPickerOpen(false)}
          onApply={handleChangeStartLocation}
        />
      ) : null}
    </div>
  );
}

export default PlaceCartRouteResultStep;
