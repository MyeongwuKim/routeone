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
