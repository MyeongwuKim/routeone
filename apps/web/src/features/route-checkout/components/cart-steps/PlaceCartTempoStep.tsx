import { useRouteCheckout } from "../../hooks/useRouteCheckout";
import { useUiText } from "@/lib/uiText";

function PlaceCartTempoStep() {
  const text = useUiText();
  const { tempo, setTempo } = useRouteCheckout();

  return (
    <div className="space-y-4">
      <div>
        <p className="font-trip text-sm text-brand-700">TRAVEL TEMPO</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {text.cart.tempoTitle}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setTempo("relaxed")}
        className={`w-full rounded-2xl border px-4 py-4 text-left ${
          tempo === "relaxed" ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-white"
        }`}
      >
        <p className="font-semibold text-slate-900">
          {text.cart.tempoRelaxedTitle}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {text.cart.tempoRelaxedDescription}
        </p>
      </button>

      <button
        type="button"
        onClick={() => setTempo("balanced")}
        className={`w-full rounded-2xl border px-4 py-4 text-left ${
          tempo === "balanced" ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-white"
        }`}
      >
        <p className="font-semibold text-slate-900">
          {text.cart.tempoBalancedTitle}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {text.cart.tempoBalancedDescription}
        </p>
      </button>

      <button
        type="button"
        onClick={() => setTempo("packed")}
        className={`w-full rounded-2xl border px-4 py-4 text-left ${
          tempo === "packed" ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-white"
        }`}
      >
        <p className="font-semibold text-slate-900">
          {text.cart.tempoPackedTitle}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {text.cart.tempoPackedDescription}
        </p>
      </button>
    </div>
  );
}

export default PlaceCartTempoStep;
