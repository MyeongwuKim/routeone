import { MdPlace } from "react-icons/md";
import { DropdownSelect } from "@/components/inputs";
import ServiceAreaSelect from "@/components/inputs/ServiceAreaSelect";
import type { ServiceArea, ServiceAreaId } from "@/data/serviceAreas";
import { useUiText } from "@/lib/uiText";
import { ALL_HOME_REGIONS, type HomeSelection } from "./homeRecommendations";
import type { HomeRecommendationText } from "./homeRecommendationText";

type Props = {
  selection: HomeSelection;
  area: ServiceArea;
  text: HomeRecommendationText;
  onAreaChange: (areaId: ServiceAreaId) => void;
  onRegionsChange: (regionCodes: string[]) => void;
};

const MENU_HEIGHT_CLASS = "max-h-[min(20rem,40dvh)]";

/** 시·도를 바꾸거나 시·군·구를 여러 개 골라 코스 조회 범위를 즉시 바꾼다. */
export default function HomeRecommendationForm({ selection, area, text, onAreaChange, onRegionsChange }: Props) {
  const ui = useUiText();
  const { regionCodes } = selection;
  const regionOptions = [
    { value: ALL_HOME_REGIONS, label: text.allRegions },
    ...area.regions.map((region) => ({
      value: region.sigunguCode,
      label: ui.labels.regions[region.label] ?? region.label,
    })),
  ];
  const selectedLabel = regionCodes.length > 1
    ? text.selectedDistrictCount(regionCodes.length)
    : regionOptions.find(({ value }) => value === regionCodes[0])?.label ?? text.allRegions;

  const toggleRegion = (code: string) => {
    if (code === ALL_HOME_REGIONS) onRegionsChange([]);
    else if (regionCodes.includes(code)) onRegionsChange(regionCodes.filter((selected) => selected !== code));
    else onRegionsChange([...regionCodes, code]);
  };

  return (
    <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-[0_12px_40px_-20px_rgba(15,118,110,0.25)] sm:p-6 dark:border-brand-400/20 dark:bg-[#0b211f]">
      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100"><MdPlace className="text-lg text-brand-600 dark:text-brand-300" />{text.regionTitle}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">{text.area}</span>
            <ServiceAreaSelect
              value={selection.areaId}
              onChange={onAreaChange}
              buttonClassName="min-h-12"
              menuClassName={MENU_HEIGHT_CLASS}
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">{text.region}</span>
            <DropdownSelect
              multiple
              ariaLabel={ui.serviceArea.selectRegionAria}
              options={regionOptions}
              value={regionCodes.length ? regionCodes : [ALL_HOME_REGIONS]}
              selectedLabel={selectedLabel}
              onChange={toggleRegion}
              buttonClassName="min-h-12"
              menuClassName={`${MENU_HEIGHT_CLASS} overflow-y-auto overscroll-contain`}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
