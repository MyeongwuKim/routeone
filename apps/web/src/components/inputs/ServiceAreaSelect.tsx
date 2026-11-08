import { SERVICE_AREA_LIST, type ServiceAreaId } from "@/data/serviceAreas";
import { useUiText } from "@/lib/uiText";
import DropdownSelect from "./DropdownSelect";

type Props = {
  value: ServiceAreaId | null;
  onChange: (areaId: ServiceAreaId) => void;
  /** 지정하면 전체 지역을 선택할 수 있으며, value가 null일 때 선택 상태로 표시한다. */
  onSelectAll?: () => void;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

/** 홈과 공유 루트에서 사용할 시·도 선택 메뉴. 목록이 화면 밖으로 길어지면 메뉴 안에서 스크롤한다. */
export default function ServiceAreaSelect({
  value,
  onChange,
  onSelectAll,
  className,
  buttonClassName = "min-h-9 rounded-full px-3 py-1.5 text-xs",
  menuClassName = "max-h-[min(24rem,55dvh)]",
}: Props) {
  const text = useUiText();
  const areaOptions = SERVICE_AREA_LIST.map((area) => ({
    value: area.id,
    label: text.labels.regions[area.label] ?? area.label,
  }));

  return (
    <DropdownSelect<ServiceAreaId | "all">
      options={
        onSelectAll
          ? [{ value: "all", label: text.serviceArea.allAreas }, ...areaOptions]
          : areaOptions
      }
      value={value ?? "all"}
      onChange={(nextValue) => {
        if (nextValue === "all") {
          onSelectAll?.();
        } else {
          onChange(nextValue);
        }
      }}
      ariaLabel={text.serviceArea.selectAreaAria}
      className={className}
      buttonClassName={buttonClassName}
      menuClassName={`left-0 right-auto overflow-y-auto overscroll-contain ${menuClassName}`}
    />
  );
}
