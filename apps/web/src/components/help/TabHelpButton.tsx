/**
 * 사용 위치: 지도·내 루트·공유 루트 상단
 * 각 탭의 안내 문구와 아이콘을 공통 사용법 버튼에 연결한다.
 */
import type { IconType } from "react-icons";
import {
  IoBagHandleOutline,
  IoCalendarOutline,
  IoCheckmark,
  IoHeartOutline,
  IoImagesOutline,
  IoMapOutline,
  IoSearch,
} from "react-icons/io5";
import { MdMyLocation } from "react-icons/md";
import { useUiText, type UiText } from "@/lib/uiText";
import HelpButton from "./HelpButton";

type TabHelpTopic = keyof UiText["tabHelp"]["guides"];
const STEP_ICONS: Record<TabHelpTopic, IconType[]> = {
  home: [IoSearch, IoBagHandleOutline, IoCalendarOutline, IoMapOutline],
  myRoute: [IoCalendarOutline, MdMyLocation, IoCheckmark, IoImagesOutline],
  sharedRoute: [IoSearch, IoMapOutline, IoHeartOutline, IoBagHandleOutline],
};

function TabHelpButton({ topic, className }: { topic: TabHelpTopic; className?: string }) {
  const text = useUiText();
  const guide = text.tabHelp.guides[topic];

  return (
    <HelpButton
      className={className}
      label={text.tabHelp.label}
      guide={{
        ...guide,
        steps: guide.steps.map((step, index) => ({
          ...step,
          icon: STEP_ICONS[topic][index],
        })),
      }}
    />
  );
}

export default TabHelpButton;
