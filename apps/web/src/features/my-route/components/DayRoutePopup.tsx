/**
 * 진입 경로: 내 루트 또는 다녀온 루트 → DAY 일정
 * 용도: 하루의 방문 기록과 일정별 동작을 보여준다.
 * 구조: 일정 헤더, 날짜별 방문 목록, 하단 동작과 팝업으로 구성한다.
 */
import { createPortal } from "react-dom";
import type { DayRoutePopupProps } from "../models/dayRoutePopupTypes";
import { useDayRoutePopupController } from "../hooks/useDayRoutePopupController";
import DayRoutePopupHeader from "./day-route/DayRoutePopupHeader";
import DayRouteScheduleList from "./day-route/DayRouteScheduleList";
import DayRoutePopupFooter from "./day-route/DayRoutePopupFooter";
import DayRoutePopupOverlays from "./day-route/DayRoutePopupOverlays";

function DayRoutePopupContent(props: DayRoutePopupProps) {
  const controller = useDayRoutePopupController(props);

  return createPortal(
    <div className="fixed inset-0 z-[2300] bg-white">
      <div className="flex h-full flex-col">
        <DayRoutePopupHeader controller={controller.header} />
        <DayRouteScheduleList controller={controller.schedule} />
        <DayRoutePopupFooter controller={controller.footer} />
      </div>
      <DayRoutePopupOverlays controller={controller.overlays} />
    </div>,
    document.body
  );
}

function DayRoutePopup(props: DayRoutePopupProps) {
  return (
    <DayRoutePopupContent
      key={`${props.route.id}:${props.day.id}`}
      {...props}
    />
  );
}

export default DayRoutePopup;
