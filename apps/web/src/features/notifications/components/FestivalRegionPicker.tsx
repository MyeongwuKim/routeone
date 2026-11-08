import { useId, useState } from "react";
import { MdCheck, MdClose } from "react-icons/md";
import { SERVICE_AREA_LIST, getServiceArea, type ServiceAreaId } from "@/data/serviceAreas";
import { resolveFestivalRegion } from "@/lib/festivalRegions";
import { useUiText } from "@/lib/uiText";

type Props = {
  initialAreaId: ServiceAreaId;
  selectedRegionCodes: readonly string[];
  onToggle: (regionCode: string) => void;
};

/**
 * 현재 서비스 권역을 기본으로 시도를 고르고 축제 알림을 받을 시군구를 편집한다.
 * 선택 제한과 저장은 부모에 맡기며, 다른 도에서 이미 고른 지역도 표시·해제할 수 있다.
 */
export default function FestivalRegionPicker({ initialAreaId, selectedRegionCodes, onToggle }: Props) {
  const text = useUiText();
  const selectId = useId();
  const [areaId, setAreaId] = useState(initialAreaId);
  const area = getServiceArea(areaId);
  return (
    <div className="space-y-3 pt-4">
      <label htmlFor={selectId} className="block text-xs font-bold text-slate-600 dark:text-slate-300">{text.serviceArea.selectAreaAria}</label>
      <select id={selectId} value={areaId} onChange={event => setAreaId(event.target.value as ServiceAreaId)}
        className="min-h-11 w-full rounded-xl border border-brand-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-100">
        {SERVICE_AREA_LIST.map(option => <option key={option.id} value={option.id}>{text.labels.regions[option.label] ?? option.label}</option>)}
      </select>
      {selectedRegionCodes.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedRegionCodes.map(code => {
            const selection = resolveFestivalRegion(code);
            if (!selection) return null;
            return (
              <button key={code} type="button" aria-pressed="true" onClick={() => onToggle(code)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-100 px-3 text-xs font-bold text-brand-800 dark:bg-brand-400/15 dark:text-brand-100">
                {text.labels.regions[selection.area.label] ?? selection.area.label} {text.labels.regions[selection.region.label] ?? selection.region.label}
                <MdClose aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}
      <div role="group" aria-label={text.serviceArea.selectRegionAria} className="grid grid-cols-3 gap-2">
        {[...area.regions].sort((left, right) => left.label.localeCompare(right.label, "ko-KR")).map(region => {
          const isSelected = selectedRegionCodes.includes(region.adminCode);
          return (
            <button key={region.adminCode} type="button" aria-pressed={isSelected} onClick={() => onToggle(region.adminCode)}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-sm font-bold transition ${isSelected
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-slate-700 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-100"}`}>
              {isSelected ? <MdCheck aria-hidden="true" /> : null}
              {text.labels.regions[region.label] ?? region.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
