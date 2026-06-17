import { useEffect, useState } from "react";
import { useRouteCheckout } from "../RouteCheckoutContext";
import PlaceCartRouteDayCard from "./PlaceCartRouteDayCard";
import type { TravelTempo } from "./PlaceCartTempoStep";
import { useRouteResultEditor } from "./useRouteResultEditor";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import type { PlannedRouteDay, RouteStartLocation } from "./routePlanTypes";

type PlaceCartRouteResultStepProps = {
  savedPlaces: SavedPlaceItem[];
  candidatePlaces: MapSheetPlace[];
  currentLocation: RouteStartLocation | null;
  onClose: () => void;
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

function PlaceCartRouteResultStep({
  savedPlaces,
  candidatePlaces,
  currentLocation,
  onClose,
  onRequestSearchPlace,
}: PlaceCartRouteResultStepProps) {
  const {
    travelStartDate,
    tripDays,
    dailyStartMinutes,
    scheduleEndMinutes,
    tempo,
    isScheduleValid,
  } = useRouteCheckout();
  const {
    routePlan,
    appliedRoutePlan,
    isRouteEditDirty,
    handleChangeStayMinutes,
    handleInsertPlace,
    handleRemoveRoutePlace,
    handleReorderRoutePlan,
    handleApplyRouteEdits,
    handleCancelRouteEdits,
  } = useRouteResultEditor({
    savedPlaces,
    travelStartDate,
    tripDays,
    dailyStartMinutes,
    dailyEndMinutes: scheduleEndMinutes,
    tempo,
    isScheduleValid,
    currentLocation,
  });
  const [isOrderEditing, setIsOrderEditing] = useState(false);
  const hasOverSchedule = routePlan.some((day) =>
    day.items.some((item) => item.isOverSchedule)
  );
  const hasEditableRoute = routePlan.some((day) => day.items.length > 0);
  const excludedPlaceIds = routePlan.flatMap((day) =>
    day.items.map((item) => item.place.id)
  );
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

  useEffect(() => {
    if (!hasEditableRoute && isOrderEditing) {
      setIsOrderEditing(false);
    }
  }, [hasEditableRoute, isOrderEditing]);

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
              추천 루트를 만들었어요
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {TEMPO_LABEL[tempo]} 템포 기준 추천 체류시간과 거리 기반 차량 이동
              추정치로 배치한 일정입니다. 체류시간은 역 카드에서 직접 수정할 수 있어요.
            </p>
          </div>

          {hasOverSchedule ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              담은 장소가 많아 일부 일정이 희망 종료 시간 {formatClock(scheduleEndMinutes)}을
              넘습니다. 여행 일수를 늘리거나 체류시간을 줄여 주세요.
            </div>
          ) : null}

          <div className="space-y-4">
            {routePlan.map((day) => (
              <PlaceCartRouteDayCard
                key={day.day}
                day={day}
                routePlan={routePlan}
                isOrderEditing={isOrderEditing}
                comparisonDay={getComparisonDay(day)}
                candidatePlaces={candidatePlaces}
                excludedPlaceIds={excludedPlaceIds}
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

      <footer className="shrink-0 border-t border-brand-100 px-4 py-4">
        {isOrderEditing ? (
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
            onClick={onClose}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            완료
          </button>
        )}
      </footer>
    </div>
  );
}

export default PlaceCartRouteResultStep;
