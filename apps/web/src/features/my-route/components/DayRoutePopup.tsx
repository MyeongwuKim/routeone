/**
 * 사용 위치: 내 루트·다녀온 루트·공유 루트 → DAY 일정
 *
 * 선택한 DAY의 출발지, 장소 순서와 방문·인증 상태를 표시하고 편집 권한에 맞는 장소 이동·방문·사진 동작을 연결한다.
 * 상태와 서버 변경은 useDayRoutePopupController에 맡기며, 이 컴포넌트는 헤더·일정 목록·하단 액션·팝업을 포털로 조합한다.
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
