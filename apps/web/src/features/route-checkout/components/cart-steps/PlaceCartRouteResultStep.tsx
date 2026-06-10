import PlaceCartRouteDayCard from "./PlaceCartRouteDayCard";
import type { TravelTempo } from "./PlaceCartTempoStep";
import type { PlannedRouteDay } from "./routePlanTypes";

type PlaceCartRouteResultStepProps = {
  routePlan: PlannedRouteDay[];
  tempo: TravelTempo;
  dailyEndMinutes: number;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onRequestAddPlace: () => void;
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

function PlaceCartRouteResultStep({
  routePlan,
  tempo,
  dailyEndMinutes,
  onChangeStayMinutes,
  onRequestAddPlace,
}: PlaceCartRouteResultStepProps) {
  const hasOverSchedule = routePlan.some((day) =>
    day.items.some((item) => item.isOverSchedule)
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="font-trip text-sm text-brand-700">ROUTE RESULT</p>
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
            onChangeStayMinutes={onChangeStayMinutes}
            onRequestAddPlace={onRequestAddPlace}
          />
        ))}
      </div>
    </div>
  );
}

export default PlaceCartRouteResultStep;
