import { useEffect, useState } from "react";
import PlaceCartRouteDayCard from "./PlaceCartRouteDayCard";
import type { TravelTempo } from "./PlaceCartTempoStep";
import type { MapSheetPlace } from "@/stores/mapSheetStore";
import type { PlannedRouteDay, RouteInsertRequest } from "./routePlanTypes";

type PlaceCartRouteResultStepProps = {
  routePlan: PlannedRouteDay[];
  baselineRoutePlan: PlannedRouteDay[];
  tempo: TravelTempo;
  dailyEndMinutes: number;
  candidatePlaces: MapSheetPlace[];
  hasPendingChanges: boolean;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onInsertPlace: (request: RouteInsertRequest, place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onReorderRoutePlan: (routePlan: PlannedRouteDay[]) => void;
  onOrderEditingChange: (isEditing: boolean) => void;
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
  routePlan,
  baselineRoutePlan,
  tempo,
  dailyEndMinutes,
  candidatePlaces,
  hasPendingChanges,
  onChangeStayMinutes,
  onInsertPlace,
  onRemovePlace,
  onReorderRoutePlan,
  onOrderEditingChange,
  onRequestSearchPlace,
}: PlaceCartRouteResultStepProps) {
  const [isOrderEditing, setIsOrderEditing] = useState(false);
  const hasOverSchedule = routePlan.some((day) =>
    day.items.some((item) => item.isOverSchedule)
  );
  const hasEditableRoute = routePlan.some((day) => day.items.length > 0);
  const excludedPlaceIds = routePlan.flatMap((day) =>
    day.items.map((item) => item.place.id)
  );
  const getBaselineDay = (dayNumber: number) =>
    baselineRoutePlan.find((day) => day.day === dayNumber) ?? null;
  const startOrderEditing = () => {
    if (!hasEditableRoute || isOrderEditing) {
      return;
    }

    setIsOrderEditing(true);
    onOrderEditingChange(true);
  };
  const finishOrderEditing = () => {
    if (!isOrderEditing) {
      return;
    }

    setIsOrderEditing(false);
    onOrderEditingChange(false);
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
    onReorderRoutePlan(
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

    onReorderRoutePlan(nextRoutePlan);
  };

  useEffect(() => {
    if (!hasEditableRoute && isOrderEditing) {
      setIsOrderEditing(false);
      onOrderEditingChange(false);
    }
  }, [hasEditableRoute, isOrderEditing, onOrderEditingChange]);

  useEffect(() => {
    return () => onOrderEditingChange(false);
  }, [onOrderEditingChange]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">ROUTE RESULT</p>
            {hasPendingChanges ? (
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
          담은 장소가 많아 일부 일정이 희망 종료 시간 {formatClock(dailyEndMinutes)}을
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
            onChangeStayMinutes={onChangeStayMinutes}
            onInsertPlace={onInsertPlace}
            onRemovePlace={onRemovePlace}
            onReorderDayItems={handleReorderDayItems}
            onMovePlaceToDay={handleMovePlaceToDay}
            onRequestOrderEditing={startOrderEditing}
            onFinishOrderEditing={finishOrderEditing}
            onRequestSearchPlace={onRequestSearchPlace}
          />
        ))}
      </div>
    </div>
  );
}

export default PlaceCartRouteResultStep;
