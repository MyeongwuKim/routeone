/**
 * 사용 위치: 일정 만들기 상단 오른쪽
 * 현재 단계의 설정이 일정에 미치는 영향과 다음 동작을 안내한다.
 */
import type { IconType } from "react-icons";
import {
  IoBagHandleOutline,
  IoCalendarOutline,
  IoCheckmark,
  IoFlagOutline,
  IoLocationOutline,
  IoMapOutline,
  IoOptionsOutline,
  IoReorderThreeOutline,
  IoSearch,
  IoTimeOutline,
  IoTrashOutline,
} from "react-icons/io5";
import HelpButton from "@/components/help/HelpButton";
import { useUiText } from "@/lib/uiText";
import type { CartFlowStep } from "../models/routeCheckoutFlow";

const STEP_ICONS: Record<CartFlowStep, IconType[]> = {
  cart: [IoSearch, IoTrashOutline, IoBagHandleOutline],
  schedule: [IoCalendarOutline, IoTimeOutline, IoFlagOutline],
  tempo: [IoTimeOutline, IoOptionsOutline, IoReorderThreeOutline],
  "start-location": [IoLocationOutline, IoMapOutline, IoFlagOutline],
  result: [IoSearch, IoReorderThreeOutline, IoCheckmark],
};

function RouteCheckoutHelpButton({ step, disabled }: { step: CartFlowStep; disabled: boolean }) {
  const text = useUiText();
  const guide = text.checkoutHelp.guides[step];

  return (
    <HelpButton
      key={step}
      disabled={disabled}
      label={text.checkoutHelp.label}
      guide={{
        ...guide,
        steps: guide.steps.map((item, index) => ({
          ...item,
          icon: STEP_ICONS[step][index],
        })),
      }}
    />
  );
}

export default RouteCheckoutHelpButton;
