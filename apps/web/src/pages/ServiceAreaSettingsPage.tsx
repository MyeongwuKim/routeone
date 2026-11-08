/**
 * 진입 경로: 내 정보 → 기본 지역 설정
 * 기본 시·도와 시군구를 저장하고 켜진 축제 알림을 해당 지역으로 맞춘다. 일시적인 지도 탐색은 기본 지역을 바꾸지 않는다.
 */
import { MdArrowBack, MdCheck, MdLocationOn } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { SERVICE_AREA_LIST, type ServiceAreaId } from "@/data/serviceAreas";
import DropdownSelect from "@/components/inputs/DropdownSelect";
import { useDefaultServiceAreaSelection } from "@/features/service-area/hooks/useDefaultServiceAreaSelection";
import { useUiText } from "@/lib/uiText";
import { useDefaultServiceArea, useServiceAreaStore } from "@/stores/serviceAreaStore";

function ServiceAreaSettingsPage() {
  const text = useUiText();
  const navigate = useNavigate();
  const serviceArea = useDefaultServiceArea();
  const savedRegionCode = useServiceAreaStore((state) => state.selectedRegionCode);
  const { selectDefaultRegion, isSaving } = useDefaultServiceAreaSelection();
  const selectedRegionCode = savedRegionCode ?? serviceArea.defaultRegion.sigunguCode;

  /** 권역을 바꾸면 기본 시군구를 적용하고, 시군구 선택 시에는 현재 권역을 유지한다. */
  const handleSelect = (areaId: ServiceAreaId, regionCode?: string) => {
    if (!isSaving) selectDefaultRegion({ areaId, regionCode });
  };

  return (
    <section aria-busy={isSaving} className="space-y-5 pb-4 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button type="button" aria-label={text.common.backToMyInfo} onClick={() => navigate("/me")}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200">
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black leading-4 text-brand-700 dark:text-brand-200">{text.routeShell.appSettings}</p>
          <h1 className="text-base font-bold leading-6">{text.routeShell.serviceAreaTitle}</h1>
        </div>
      </header>

      <div className="space-y-3">
        <h2 className="text-sm font-bold">{text.serviceArea.selectAreaAria}</h2>
        <div role="group" aria-label={text.serviceArea.selectAreaAria} className="grid grid-cols-3 gap-2">
          {SERVICE_AREA_LIST.map((area) => {
            const isSelected = serviceArea.id === area.id;
            return (
              <button key={area.id} type="button" aria-pressed={isSelected} disabled={isSaving}
                onClick={() => handleSelect(area.id, isSelected ? selectedRegionCode : undefined)}
                className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border px-2 py-3 text-sm font-bold transition ${isSelected
                  ? "border-brand-600 bg-brand-600 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-[#0b211f]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-brand-400/20 dark:bg-[#0b211f] dark:text-slate-200"}`}>
                {isSelected ? <MdCheck aria-hidden="true" className="shrink-0" /> : <MdLocationOn aria-hidden="true" className="shrink-0 text-brand-500" />}
                <span>{text.labels.regions[area.label] ?? area.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold">{text.serviceArea.selectRegionAria}</h2>
        <DropdownSelect disabled={isSaving} value={selectedRegionCode} onChange={(regionCode) => handleSelect(serviceArea.id, regionCode)}
          options={[...serviceArea.regions].sort((a, b) => a.label.localeCompare(b.label, "ko-KR")).map((region) => ({ value: region.sigunguCode, label: text.labels.regions[region.label] ?? region.label }))}
          ariaLabel={text.serviceArea.selectRegionAria}
          menuClassName="bottom-[calc(100%+0.5rem)] top-auto max-h-64 overflow-y-auto overscroll-contain"
        />
      </div>
      {isSaving ? <p role="status" className="text-xs font-bold text-brand-700 dark:text-brand-200">{text.serviceArea.saving}</p> : null}
      <p className="text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{text.serviceArea.note}</p>
      <a href="https://github.com/KnellBalm/kr-admin-geojson" target="_blank" rel="noreferrer" className="block text-xs text-slate-400 underline">{text.serviceArea.boundarySource}</a>
    </section>
  );
}

export default ServiceAreaSettingsPage;
