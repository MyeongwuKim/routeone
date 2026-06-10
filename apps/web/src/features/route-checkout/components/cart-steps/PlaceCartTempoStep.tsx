export type TravelTempo = "relaxed" | "balanced" | "packed";

type PlaceCartTempoStepProps = {
  tempo: TravelTempo | null;
  onSelectTempo: (value: TravelTempo) => void;
};

function PlaceCartTempoStep({ tempo, onSelectTempo }: PlaceCartTempoStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-trip text-sm text-brand-700">TRAVEL TEMPO</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">여행 템포를 골라주세요</p>
      </div>

      <button
        type="button"
        onClick={() => onSelectTempo("relaxed")}
        className={`w-full rounded-2xl border px-4 py-4 text-left ${
          tempo === "relaxed" ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-white"
        }`}
      >
        <p className="font-semibold text-slate-900">여유롭게</p>
        <p className="mt-1 text-xs text-slate-500">장소당 체류시간을 길게 배치</p>
      </button>

      <button
        type="button"
        onClick={() => onSelectTempo("balanced")}
        className={`w-full rounded-2xl border px-4 py-4 text-left ${
          tempo === "balanced" ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-white"
        }`}
      >
        <p className="font-semibold text-slate-900">보통</p>
        <p className="mt-1 text-xs text-slate-500">체류시간을 적당하게 배치</p>
      </button>

      <button
        type="button"
        onClick={() => onSelectTempo("packed")}
        className={`w-full rounded-2xl border px-4 py-4 text-left ${
          tempo === "packed" ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-white"
        }`}
      >
        <p className="font-semibold text-slate-900">촘촘하게</p>
        <p className="mt-1 text-xs text-slate-500">많이 둘러보는 밀도 높은 일정</p>
      </button>
    </div>
  );
}

export default PlaceCartTempoStep;
