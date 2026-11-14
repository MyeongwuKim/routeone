import { useMemo, useState, type SetStateAction } from "react";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";
import {
  createRouteLayoutInput,
  createRouteLayoutSignature,
  createRouteStopsByDayId,
} from "../utils/dayRouteLayout";
import {
  updateDayRouteStartLocationDraft,
  type DayRouteStartLocations,
} from "../utils/dayRouteStartLocation";
import { getSortedRouteDays } from "../routeDisplay";
import { useDayRouteStartLocationEditor } from "./useDayRouteStartLocationEditor";
import { useRouteLayoutMutation } from "./useRouteLayoutMutation";
import { useRouteStopDrag, type RouteStopsByDayId } from "./useRouteStopDrag";

type LayoutEditSession = {
  /** true인 동안만 draft를 표시하고 변경한다. 성공 저장·취소는 false로 초기화한다. */
  isOrderEditing: boolean;
  /** DAY ID별 편집 장소 순서와 체류시간. 서버 재조회로 교체하지 않는다. */
  draftStopsByDayId: RouteStopsByDayId;
  /** 저장된 DAY·루트 출발지와 다른 좌표만 보관한다. */
  draftStartLocationsByDayId: DayRouteStartLocations;
  /** 저장할 때 함께 삭제할 DAY. 해당 DAY의 draft 데이터는 세션이 끝날 때까지 유지한다. */
  deletedDayIds: Set<string>;
  /** 편집 시작 당시 배치. 현재 draft와 비교해 저장할 변경이 있는지 판단한다. */
  baseLayoutSignature: string;
};

type UseDayRouteLayoutEditorOptions = {
  route: MyRoute;
  days: MyRouteDay[];
  activeDayId: string;
  orderedStops: MyRouteStop[];
  isReadOnly: boolean;
  /** 저장 응답을 받은 뒤 선택·펼침 등 팝업 표시 상태를 갱신한다. */
  onSaved: (route: MyRoute) => void;
};

function createLayoutEditSession(
  days: MyRouteDay[],
  stopsByDayId = createRouteStopsByDayId(days),
  isOrderEditing = false
): LayoutEditSession {
  return {
    isOrderEditing,
    draftStopsByDayId: stopsByDayId,
    draftStartLocationsByDayId: {},
    deletedDayIds: new Set(),
    baseLayoutSignature: createRouteLayoutSignature(days, stopsByDayId, new Set()),
  };
}

/**
 * DAY 상세의 순서·체류시간·출발지·DAY 삭제를 하나의 편집 세션으로 관리한다.
 * 시작과 취소는 현재 서버 DAY와 활성 DAY의 확인된 장소 목록을 기준으로 삼고, 편집 중 서버 재조회는
 * draft를 바꾸지 않는다. 저장은 기존 Mutation에 맡기며 실패하면 세션을 유지하고 성공할 때만 초기화한다.
 * 선택·펼침·확인 모달과 방문 요청 중 편집 시작 제한은 팝업 controller가 담당한다.
 */
export function useDayRouteLayoutEditor({
  route,
  days,
  activeDayId,
  orderedStops,
  isReadOnly,
  onSaved,
}: UseDayRouteLayoutEditorOptions) {
  const [session, setSession] = useState(() => createLayoutEditSession(days));
  const {
    isOrderEditing,
    draftStopsByDayId,
    draftStartLocationsByDayId,
    deletedDayIds,
    baseLayoutSignature,
  } = session;
  const drag = useRouteStopDrag({
    isOrderEditing,
    stopsByDayId: draftStopsByDayId,
    setStopsByDayId: (value: SetStateAction<RouteStopsByDayId>) => {
      setSession((current) => {
        const nextStops = typeof value === "function"
          ? value(current.draftStopsByDayId)
          : value;
        return nextStops === current.draftStopsByDayId
          ? current
          : { ...current, draftStopsByDayId: nextStops };
      });
    },
  });
  const visibleDays = useMemo(
    () =>
      isOrderEditing
        ? days
            .filter((day) => !deletedDayIds.has(day.id))
            .map((day) =>
              draftStartLocationsByDayId[day.id]
                ? { ...day, startLocation: draftStartLocationsByDayId[day.id] }
                : day
            )
        : days,
    [days, deletedDayIds, draftStartLocationsByDayId, isOrderEditing]
  );
  const displayedStopsByDayId = useMemo(
    () =>
      isOrderEditing
        ? draftStopsByDayId
        : createRouteStopsByDayId(days, activeDayId, orderedStops),
    [activeDayId, days, draftStopsByDayId, isOrderEditing, orderedStops]
  );
  const isOrderDirty = createRouteLayoutSignature(
    days,
    draftStopsByDayId,
    deletedDayIds,
    draftStartLocationsByDayId
  ) !== baseLayoutSignature;
  const { isSavingLayout: isSavingOrder, saveLayout } = useRouteLayoutMutation({
    onSuccess: (nextRoute) => {
      drag.stopCurrentDrag();
      setSession(createLayoutEditSession(getSortedRouteDays(nextRoute)));
      startLocationEditor.resetStartLocationPicker();
      onSaved(nextRoute);
    },
  });
  const startLocationEditor = useDayRouteStartLocationEditor({
    route,
    days: visibleDays,
    stopsByDayId: displayedStopsByDayId,
    isReadOnly,
    isOrderEditing,
    isSavingOrder,
    onDraftChange: (dayId, location) => {
      const savedDay = days.find((day) => day.id === dayId);
      if (!savedDay) return;
      setSession((current) => ({
        ...current,
        draftStartLocationsByDayId: updateDayRouteStartLocationDraft(
          current.draftStartLocationsByDayId,
          savedDay,
          route.startLocation,
          location
        ),
      }));
    },
  });

  /** 현재 표시 순서로 새 draft를 만든다. 시작할 수 있을 때만 true를 반환한다. */
  const beginEditing = () => {
    if (
      isReadOnly || isOrderEditing || isSavingOrder ||
      startLocationEditor.isUpdatingRouteStartLocation
    ) return false;
    setSession(
      createLayoutEditSession(
        days,
        createRouteStopsByDayId(days, activeDayId, orderedStops),
        true
      )
    );
    startLocationEditor.resetStartLocationPicker();
    return true;
  };

  /** 저장 중에는 유지하고, 그 외에는 draft와 picker·드래그를 버려 확인된 장소 표시로 돌아간다. */
  const cancelEditing = () => {
    if (isSavingOrder) return;
    drag.stopCurrentDrag();
    setSession(
      createLayoutEditSession(days, createRouteStopsByDayId(days, activeDayId, orderedStops))
    );
    startLocationEditor.resetStartLocationPicker();
  };

  /** 변경된 세션만 DAY ID·장소 순서·체류시간·출발지·삭제 DAY 입력으로 저장한다. */
  const saveEditing = () => {
    if (
      !isOrderEditing || !isOrderDirty || isSavingOrder ||
      startLocationEditor.isUpdatingRouteStartLocation
    ) return;
    saveLayout(
      createRouteLayoutInput({
        routeId: route.id,
        days,
        stopsByDayId: draftStopsByDayId,
        deletedDayIds,
        startLocationsByDayId: draftStartLocationsByDayId,
      })
    );
  };

  /** 편집 중 다른 DAY의 끝으로 장소를 옮긴다. 이동 대상 DAY를 펼칠 수 있으면 true를 반환한다. */
  const moveStopToDay = (stopId: string, fromDayId: string, targetDayId: string) => {
    if (!isOrderEditing || fromDayId === targetDayId) return false;
    setSession((current) => {
      const sourceStops = current.draftStopsByDayId[fromDayId] ?? [];
      const movedStop = sourceStops.find((stop) => stop.id === stopId);
      if (!movedStop) return current;
      return {
        ...current,
        draftStopsByDayId: {
          ...current.draftStopsByDayId,
          [fromDayId]: sourceStops.filter((stop) => stop.id !== stopId),
          [targetDayId]: [...(current.draftStopsByDayId[targetDayId] ?? []), movedStop],
        },
      };
    });
    return true;
  };

  /** 편집 중 지정 DAY의 장소를 draft에서 제거하며 서버 요청은 저장할 때 보낸다. */
  const removeStop = (dayId: string, stopId: string) => {
    if (!isOrderEditing) return;
    setSession((current) => ({
      ...current,
      draftStopsByDayId: {
        ...current.draftStopsByDayId,
        [dayId]: (current.draftStopsByDayId[dayId] ?? []).filter((stop) => stop.id !== stopId),
      },
    }));
  };

  /** 지정한 장소의 편집 체류시간(분)만 바꾼다. 일반 상태의 즉시 저장은 호출자가 처리한다. */
  const changeDraftStayMinutes = (dayId: string, stopId: string, stayMinutes: number) => {
    if (!isOrderEditing) return;
    setSession((current) => ({
      ...current,
      draftStopsByDayId: {
        ...current.draftStopsByDayId,
        [dayId]: (current.draftStopsByDayId[dayId] ?? []).map((stop) =>
          stop.id === stopId ? { ...stop, stayMinutes } : stop
        ),
      },
    }));
  };

  /** 확인된 DAY 삭제를 draft에 표시하고 열린 출발지 picker를 지운다. 확인·마지막 DAY 제한은 호출자가 처리한다. */
  const deleteDay = (dayId: string) => {
    startLocationEditor.resetStartLocationPicker();
    setSession((current) => ({
      ...current,
      deletedDayIds: new Set(current.deletedDayIds).add(dayId),
    }));
  };

  return {
    isOrderEditing,
    isOrderDirty,
    isSavingOrder,
    visibleDays,
    displayedStopsByDayId,
    ...drag,
    startLocationPickerTarget: startLocationEditor.startLocationPickerTarget,
    canEditStartLocation: startLocationEditor.canEditStartLocation,
    isUpdatingRouteStartLocation: startLocationEditor.isUpdatingRouteStartLocation,
    openStartLocationPicker: startLocationEditor.openStartLocationPicker,
    closeStartLocationPicker: startLocationEditor.closeStartLocationPicker,
    handleApplyStartLocation: startLocationEditor.handleApplyStartLocation,
    beginEditing,
    cancelEditing,
    saveEditing,
    moveStopToDay,
    removeStop,
    changeDraftStayMinutes,
    deleteDay,
  };
}
