/** DAY 출발지 선택 팝업을 열고 순서 편집 draft 또는 저장된 경로에 선택 좌표를 적용한다. */
import { useState } from "react";
import { useEffectiveServiceArea } from "@/stores/serviceAreaStore";
import type { MyRoute, MyRouteDay } from "../types";
import {
  createDayRouteStartLocationTarget,
  type DayRouteStartLocationTarget,
} from "../utils/dayRouteStartLocation";
import type { RouteStopsByDayId } from "./useRouteStopDrag";
import { useRouteStartLocationMutation } from "./useRouteStartLocationMutation";

type UseDayRouteStartLocationEditorOptions = {

  route: MyRoute;

  days: MyRouteDay[];

  stopsByDayId: RouteStopsByDayId;

  isReadOnly: boolean;

  isOrderEditing: boolean;

  isSavingOrder: boolean;

  onDraftChange: (
    dayId: string,
    location: NonNullable<MyRoute["startLocation"]>
  ) => void;
};

/**
 * 내 경로이며 읽기 전용·저장 중이 아닐 때만 선택기를 연다. 순서 편집 중에는 서버 요청 없이
 * onDraftChange에 좌표를 전달하고, 일반 상태에서는 Mutation 성공 후에만 선택기를 닫는다.
 */
export function useDayRouteStartLocationEditor({
  route,
  days,
  stopsByDayId,
  isReadOnly,
  isOrderEditing,
  isSavingOrder,
  onDraftChange,
}: UseDayRouteStartLocationEditorOptions) {
  const serviceArea = useEffectiveServiceArea();
  const [target, setTarget] = useState<DayRouteStartLocationTarget | null>(null);
  const { isUpdatingRouteStartLocation, updateRouteStartLocation } =
    useRouteStartLocationMutation();
  const canEditStartLocation =
    route.isMine && !isReadOnly && !isSavingOrder && !isUpdatingRouteStartLocation;
  const startLocationPickerTarget =
    target?.routeId === route.id &&
    target.mode === (isOrderEditing ? "draft" : "saved") &&
    days.some((day) => day.id === target.dayId)
      ? target
      : null;

  const openStartLocationPicker = (day: MyRouteDay) => {
    const selectedDay = days.find((candidate) => candidate.id === day.id);

    if (!canEditStartLocation || !selectedDay) {
      return;
    }

    setTarget(
      createDayRouteStartLocationTarget({
        route,
        day: selectedDay,
        stops: stopsByDayId[selectedDay.id] ?? selectedDay.stops,
        isOrderEditing,
        fallbackLocation: serviceArea.center,
      })
    );
  };

  const closeStartLocationPicker = () => {
    if (!isUpdatingRouteStartLocation) {
      setTarget((current) => (current === target ? null : current));
    }
  };

  const handleApplyStartLocation = async (
    location: NonNullable<MyRoute["startLocation"]>
  ) => {
    if (!canEditStartLocation || !startLocationPickerTarget) {
      return false;
    }

    const selectedTarget = startLocationPickerTarget;

    if (selectedTarget.mode === "draft") {
      onDraftChange(selectedTarget.dayId, location);
      return true;
    }

    return updateRouteStartLocation(
      {
        routeId: selectedTarget.routeId,
        dayId: selectedTarget.dayId,
        startLocation: location,
      },
      selectedTarget.dayIndex
    );
  };

  return {
    startLocationPickerTarget,
    canEditStartLocation,
    isUpdatingRouteStartLocation,
    openStartLocationPicker,
    closeStartLocationPicker,
    resetStartLocationPicker: () => setTarget(null),
    handleApplyStartLocation,
  };
}
