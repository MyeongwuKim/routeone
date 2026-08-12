import { useQueryClient } from "@tanstack/react-query";
import { MdArrowBack, MdCheck, MdLocationOn } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import {
  SERVICE_AREAS,
  type ServiceAreaId,
} from "@/data/serviceAreas";
import { useUiText } from "@/lib/uiText";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useServiceAreaStore } from "@/stores/serviceAreaStore";
import { useUiToastStore } from "@/stores/uiToastStore";

const SERVICE_AREA_OPTION_VALUES: ServiceAreaId[] = ["seoul", "gangwon"];

function ServiceAreaSettingsPage() {
  const text = useUiText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedAreaId = useServiceAreaStore(
    (state) => state.selectedAreaId
  );
  const setSelectedAreaId = useServiceAreaStore(
    (state) => state.setSelectedAreaId
  );
  const resetForArea = useHomeExploreStore((state) => state.resetForArea);
  const resetSheet = useMapSheetStore((state) => state.resetSheet);
  const showToast = useUiToastStore((state) => state.showToast);

  const handleSelectArea = (nextAreaId: ServiceAreaId) => {
    if (nextAreaId === selectedAreaId) {
      return;
    }

    const nextArea = SERVICE_AREAS[nextAreaId];
    const nextAreaLabel =
      text.labels.regions[nextArea.label] ?? nextArea.label;
    setSelectedAreaId(nextAreaId);
    resetForArea(nextArea.defaultRegion.sigunguCode);
    resetSheet();
    void queryClient.invalidateQueries({ queryKey: ["tour-attractions"] });
    void queryClient.invalidateQueries({ queryKey: ["gangwon-attractions"] });
    void queryClient.invalidateQueries({ queryKey: ["gangwon-festivals"] });
    void queryClient.invalidateQueries({ queryKey: ["nearby-tourist"] });
    showToast(text.serviceArea.changedToast(nextAreaLabel));
  };

  return (
    <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.routeShell.appSettings}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {text.routeShell.serviceAreaTitle}
          </h1>
        </div>
      </header>

      <section
        className="space-y-3"
        aria-label={text.serviceArea.selectAreaAria}
      >
        {SERVICE_AREA_OPTION_VALUES.map((areaId) => {
          const area = SERVICE_AREAS[areaId];
          const areaLabel = text.labels.regions[area.label] ?? area.label;
          const isSelected = selectedAreaId === areaId;

          return (
            <button
              key={areaId}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelectArea(areaId)}
              className={`flex min-h-24 w-full items-center gap-3 rounded-lg border bg-white px-4 py-4 text-left shadow-sm transition active:scale-[0.99] dark:bg-[#0b211f] ${
                isSelected
                  ? "border-brand-500 ring-1 ring-brand-500/20 dark:border-brand-300"
                  : "border-slate-200 hover:border-brand-300 dark:border-brand-400/20 dark:hover:border-brand-300/60"
              }`}
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-xl ${
                  isSelected
                    ? "bg-brand-600 text-white"
                    : "bg-brand-50 text-brand-700 dark:bg-brand-400/10 dark:text-brand-200"
                }`}
              >
                <MdLocationOn />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
                  {areaLabel}
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
                  {text.serviceArea.optionDescription(areaLabel)}
                </span>
              </span>
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-lg transition ${
                  isSelected
                    ? "border-brand-600 bg-brand-600 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-[#0b211f]"
                    : "border-slate-200 text-transparent dark:border-brand-400/25"
                }`}
                aria-hidden="true"
              >
                <MdCheck />
              </span>
            </button>
          );
        })}
      </section>

      <p className="px-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
        {text.serviceArea.note}
      </p>
    </section>
  );
}

export default ServiceAreaSettingsPage;
