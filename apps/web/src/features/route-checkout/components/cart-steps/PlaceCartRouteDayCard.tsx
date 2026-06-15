import {
  IoAdd,
  IoCarSportOutline,
  IoClose,
  IoLocationSharp,
  IoMapOutline,
  IoTimeOutline,
  IoTrashOutline,
} from "react-icons/io5";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import PlaceCartRouteMapPopup from "./PlaceCartRouteMapPopup";
import PlaceCartRouteInsertSheet from "./PlaceCartRouteInsertSheet";
import type { MapSheetPlace } from "@/stores/mapSheetStore";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteInsertPoint,
  RouteInsertRequest,
} from "./routePlanTypes";

type PlaceCartRouteDayCardProps = {
  day: PlannedRouteDay;
  routePlan: PlannedRouteDay[];
  isOrderEditing: boolean;
  comparisonDay?: PlannedRouteDay | null;
  candidatePlaces: MapSheetPlace[];
  excludedPlaceIds: string[];
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onInsertPlace: (request: RouteInsertRequest, place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onReorderDayItems: (
    dayNumber: number,
    nextItems: PlannedRouteItem[]
  ) => void;
  onMovePlaceToDay: (
    placeId: string,
    targetDayNumber: number,
    position: "first" | "last"
  ) => void;
  onRequestOrderEditing: () => void;
  onFinishOrderEditing: () => void;
  onRequestSearchPlace: () => void;
};

type DraggedDayItem = {
  itemIndex: number;
  item: PlannedRouteItem;
  startX: number;
  startY: number;
  x: number;
  y: number;
  isActive: boolean;
};

type AdjacentMoveDirection = "previous" | "next";

type RouteStation =
  | {
      id: "current-location";
      type: "start";
      icon: ReactNode;
      title: string;
      subtitle: string;
      location: RouteInsertPoint | null;
      incomingTravelMinutes: null;
      item: null;
    }
  | {
      id: string;
      type: "place";
      icon: string;
      title: string;
      subtitle: string;
      location: RouteInsertPoint;
      itemIndex: number;
      incomingTravelMinutes: number;
      item: PlannedRouteItem;
    };

const ROUTE_STATIONS_PER_ROW = 3;
const ROUTE_COLUMNS = [18, 50, 82] as const;
const ROUTE_TURN_LEFT_X = 6;
const ROUTE_TURN_RIGHT_X = 96;
const ROUTE_ROW_HEIGHT = 128;
const ROUTE_ROW_GAP = 18;
const ROUTE_LINE_Y = 20;
const ROUTE_NODE_EDGE_OFFSET_X = 6;

type RouteRowEntry = {
  station: RouteStation;
  sequenceIndex: number;
};

function formatClock(totalMinutes: number) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function getDurationText(minutes: number) {
  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hour = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hour}시간 ${restMinutes}분` : `${hour}시간`;
}

function clampStayMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return 30;
  }

  return Math.max(15, Math.min(360, Math.round(value)));
}

function moveDayItem(
  items: PlannedRouteItem[],
  sourceIndex: number,
  targetIndex: number
) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);

  if (!movedItem) {
    return items;
  }

  const adjustedTargetIndex =
    sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  nextItems.splice(
    Math.max(0, Math.min(adjustedTargetIndex, nextItems.length)),
    0,
    movedItem
  );

  return nextItems;
}

function buildRouteStations(day: PlannedRouteDay): RouteStation[] {
  const stations: RouteStation[] = day.startsFromCurrentLocation
    ? [
        {
          id: "current-location",
          type: "start",
          icon: <IoLocationSharp />,
          title: "내 위치",
          subtitle: "출발",
          location: day.startLocation
            ? {
                title: "내 위치",
                subtitle: "출발",
                lat: day.startLocation.lat,
                lng: day.startLocation.lng,
              }
            : null,
          incomingTravelMinutes: null,
          item: null,
        },
      ]
    : [];

  day.items.forEach((item, itemIndex) => {
    stations.push({
      id: item.id,
      type: "place",
      icon: item.place.icon,
      title: item.place.title,
      subtitle: item.place.contentTypeLabel,
      location: {
        title: item.place.title,
        subtitle: item.place.contentTypeLabel,
        lat: item.place.lat,
        lng: item.place.lng,
      },
      itemIndex,
      incomingTravelMinutes: item.travelMinutesFromPrevious,
      item,
    });
  });

  return stations;
}

function splitRouteRows(stations: RouteStation[]) {
  const rows: RouteRowEntry[][] = [];

  stations.forEach((station, sequenceIndex) => {
    const rowIndex = Math.floor(sequenceIndex / ROUTE_STATIONS_PER_ROW);
    rows[rowIndex] = rows[rowIndex] ?? [];
    rows[rowIndex].push({ station, sequenceIndex });
  });

  return rows;
}

function getRoutePointX(sequenceIndex: number) {
  const rowIndex = Math.floor(sequenceIndex / ROUTE_STATIONS_PER_ROW);
  const indexInRow = sequenceIndex % ROUTE_STATIONS_PER_ROW;
  const visualColumnIndex =
    rowIndex % 2 === 0 ? indexInRow : ROUTE_STATIONS_PER_ROW - 1 - indexInRow;

  return ROUTE_COLUMNS[visualColumnIndex];
}

function RouteSegmentControl({
  x,
  y = ROUTE_LINE_Y,
  badgeOffsetY = 11,
  travelMinutes,
  insertIndex,
  isOrderEditing,
  isActiveDropZone,
  onRequestInsertPlace,
  onDropRouteItem,
  registerDropZone,
}: {
  x: number;
  y?: number;
  badgeOffsetY?: number;
  travelMinutes: number;
  insertIndex: number;
  isOrderEditing: boolean;
  isActiveDropZone: boolean;
  onRequestInsertPlace: () => void;
  onDropRouteItem: (targetIndex: number) => void;
  registerDropZone: (
    targetIndex: number,
    node: HTMLDivElement | null
  ) => void;
}) {
  if (isOrderEditing) {
    return (
      <div
        ref={(node) => registerDropZone(insertIndex, node)}
        data-route-drop-zone-kind="segment"
        className="absolute z-30 h-14 w-20 -translate-x-1/2"
        style={{ left: `${x}%`, top: y }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropRouteItem(insertIndex);
        }}
      >
        <div
          className={`absolute left-1/2 top-0 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-black shadow-sm transition ${
            isActiveDropZone
              ? "scale-125 border-brand-600 bg-brand-600 text-white"
              : "border-brand-400 bg-white text-brand-700"
          }`}
        >
          ↓
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute z-30 h-12 w-16 -translate-x-1/2"
      style={{ left: `${x}%`, top: y }}
    >
      <button
        type="button"
        aria-label="이 구간에 장소 추가"
        onClick={onRequestInsertPlace}
        className="absolute left-1/2 top-0 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-700 shadow-sm transition active:scale-95"
      >
        <IoAdd className="text-xs" />
      </button>
      <span
        className="absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500"
        style={{ top: `${badgeOffsetY}px` }}
      >
        <IoCarSportOutline className="shrink-0 text-brand-600" />
        {getDurationText(travelMinutes)}
      </span>
    </div>
  );
}

function buildRouteRowPath({
  row,
}: {
  row: RouteRowEntry[];
}) {
  if (row.length === 0) {
    return "";
  }

  const routeXs = row.map(({ sequenceIndex }) => getRoutePointX(sequenceIndex));
  const [firstX] = routeXs;
  const pathCommands = [`M ${firstX} ${ROUTE_LINE_Y}`];

  routeXs.forEach((x) => {
    pathCommands.push(`L ${x} ${ROUTE_LINE_Y}`);
  });

  return pathCommands.join(" ");
}

function buildRouteConnectorPath(rowIndex: number) {
  const isRightTurn = rowIndex % 2 === 0;
  const endpointX = isRightTurn
    ? ROUTE_COLUMNS[2] + ROUTE_NODE_EDGE_OFFSET_X
    : ROUTE_COLUMNS[0] - ROUTE_NODE_EDGE_OFFSET_X;
  const turnX = isRightTurn ? ROUTE_TURN_RIGHT_X : ROUTE_TURN_LEFT_X;
  const bendX = isRightTurn ? 103 : -1;
  const nextLineY = ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP + ROUTE_LINE_Y;

  return [
    `M ${endpointX} ${ROUTE_LINE_Y}`,
    `H ${turnX}`,
    `C ${bendX} ${ROUTE_LINE_Y + 24} ${bendX} ${nextLineY - 24} ${turnX} ${nextLineY}`,
    `H ${endpointX}`,
  ].join(" ");
}

function getRouteConnectorControlPoint(rowIndex: number) {
  const isRightTurn = rowIndex % 2 === 0;
  const turnX = isRightTurn ? ROUTE_TURN_RIGHT_X : ROUTE_TURN_LEFT_X;
  const bendX = isRightTurn ? 103 : -1;
  const nextLineY = ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP + ROUTE_LINE_Y;

  return {
    x: turnX * 0.25 + bendX * 0.75,
    y: (ROUTE_LINE_Y + nextLineY) / 2,
  };
}

function RouteConnectorLayer({
  day,
  rows,
  isOrderEditing,
  onRequestInsertPlace,
  onDropRouteItem,
  activeDropIndex,
  registerDropZone,
}: {
  day: PlannedRouteDay;
  rows: RouteRowEntry[][];
  isOrderEditing: boolean;
  onRequestInsertPlace: (request: RouteInsertRequest) => void;
  onDropRouteItem: (targetIndex: number) => void;
  activeDropIndex: number | null;
  registerDropZone: (
    targetIndex: number,
    node: HTMLDivElement | null
  ) => void;
}) {
  return (
    <>
      {rows.slice(0, -1).map((row, rowIndex) => {
        const travelMinutes =
          rows[rowIndex + 1]?.[0]?.station.incomingTravelMinutes ?? null;
        const fromStation = row[row.length - 1]?.station;
        const toStation = rows[rowIndex + 1]?.[0]?.station;

        if (
          travelMinutes == null ||
          !fromStation?.location ||
          !toStation?.location ||
          toStation.type !== "place"
        ) {
          return null;
        }

        const connectorHeight = ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP + ROUTE_LINE_Y;
        const controlPoint = getRouteConnectorControlPoint(rowIndex);

        return (
          <div
            key={`connector-${row[0]?.station.id}-${rowIndex}`}
            className="pointer-events-none absolute inset-x-0"
            style={{
              top: `${rowIndex * (ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP)}px`,
              height: `${connectorHeight}px`,
            }}
          >
            <svg
              aria-hidden="true"
              className="absolute inset-0 z-0 h-full w-full overflow-visible"
              viewBox={`0 0 100 ${connectorHeight}`}
              preserveAspectRatio="none"
            >
              <path
                d={buildRouteConnectorPath(rowIndex)}
                fill="none"
                stroke="rgb(45 212 191)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="pointer-events-auto relative z-30">
              <RouteSegmentControl
                x={controlPoint.x}
                y={controlPoint.y}
                badgeOffsetY={20}
                travelMinutes={travelMinutes}
                insertIndex={toStation.itemIndex}
                isOrderEditing={isOrderEditing}
                isActiveDropZone={activeDropIndex === toStation.itemIndex}
                onDropRouteItem={onDropRouteItem}
                registerDropZone={registerDropZone}
                onRequestInsertPlace={() =>
                  onRequestInsertPlace({
                    day: day.day,
                    insertIndex: toStation.itemIndex,
                    from: fromStation.location as RouteInsertPoint,
                    to: toStation.location,
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

function RouteRowGroup({
  day,
  row,
  rowIndex,
  isOrderEditing,
  onChangeStayMinutes,
  onSelectItem,
  onStartDragItem,
  onRequestOrderEditing,
  onRequestInsertPlace,
  onDropRouteItem,
  activeDropIndex,
  registerDropZone,
}: {
  day: PlannedRouteDay;
  row: RouteRowEntry[];
  rowIndex: number;
  isOrderEditing: boolean;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onSelectItem: (item: PlannedRouteItem) => void;
  onStartDragItem: (
    itemIndex: number,
    item: PlannedRouteItem,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  onRequestOrderEditing: () => void;
  onRequestInsertPlace: (request: RouteInsertRequest) => void;
  onDropRouteItem: (targetIndex: number) => void;
  activeDropIndex: number | null;
  registerDropZone: (
    targetIndex: number,
    node: HTMLDivElement | null
  ) => void;
}) {
  const isReverseRow = rowIndex % 2 === 1;
  const cells: Array<RouteRowEntry | null> = Array.from(
    { length: ROUTE_STATIONS_PER_ROW },
    () => null
  );
  const visualStations = isReverseRow ? [...row].reverse() : row;
  const startColumn = isReverseRow ? ROUTE_STATIONS_PER_ROW - row.length : 0;
  const rowPath = buildRouteRowPath({
    row,
  });

  visualStations.forEach((station, stationIndex) => {
    cells[startColumn + stationIndex] = station;
  });

  return (
    <div
      className="relative z-10"
      style={{ height: `${ROUTE_ROW_HEIGHT}px` }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 100 ${ROUTE_ROW_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path
          d={rowPath}
          fill="none"
          stroke="rgb(45 212 191)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="relative z-10 grid h-full grid-cols-3">
        {cells.map((cell, cellIndex) => {
          if (!cell) {
            return <div key={`empty-${rowIndex}-${cellIndex}`} />;
          }

          return (
            <div
              key={`${cell.station.id}-${cell.sequenceIndex}`}
              className="flex min-w-0 flex-col items-center"
            >
              <StationNode
                station={cell.station}
                isOrderEditing={isOrderEditing}
                onChangeStayMinutes={onChangeStayMinutes}
                onSelectItem={onSelectItem}
                onStartDragItem={onStartDragItem}
                onRequestOrderEditing={onRequestOrderEditing}
              />
            </div>
          );
        })}
      </div>

      {row.slice(1).map((entry, entryIndex) => {
        const previousEntry = row[entryIndex];
        const previousStation = previousEntry.station;
        const nextStation = entry.station;
        const x =
          (getRoutePointX(previousEntry.sequenceIndex) +
            getRoutePointX(entry.sequenceIndex)) /
          2;

        if (
          !previousStation.location ||
          !nextStation.location ||
          nextStation.type !== "place"
        ) {
          return null;
        }

        return (
          <RouteSegmentControl
            key={`${previousEntry.station.id}-${entry.station.id}`}
            x={x}
            travelMinutes={entry.station.incomingTravelMinutes ?? 0}
            insertIndex={nextStation.itemIndex}
            isOrderEditing={isOrderEditing}
            isActiveDropZone={activeDropIndex === nextStation.itemIndex}
            onDropRouteItem={onDropRouteItem}
            registerDropZone={registerDropZone}
            onRequestInsertPlace={() =>
              onRequestInsertPlace({
                day: day.day,
                insertIndex: nextStation.itemIndex,
                from: previousStation.location as RouteInsertPoint,
                to: nextStation.location,
              })
            }
          />
        );
      })}
    </div>
  );
}

function StationNode({
  station,
  isOrderEditing,
  onChangeStayMinutes,
  onSelectItem,
  onStartDragItem,
  onRequestOrderEditing,
}: {
  station: RouteStation;
  isOrderEditing: boolean;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onSelectItem: (item: PlannedRouteItem) => void;
  onStartDragItem: (
    itemIndex: number,
    item: PlannedRouteItem,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  onRequestOrderEditing: () => void;
}) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);
  const isOverSchedule = station.item?.isOverSchedule ?? false;
  const orderLabel =
    station.type === "place" ? String(station.itemIndex + 1) : "S";
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  useEffect(() => clearLongPressTimer, []);

  const nodeContent = (
    <>
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-white text-base shadow-sm ${
          station.type === "start"
            ? "border-slate-300 text-brand-700"
            : isOrderEditing
              ? "cursor-grab border-brand-600 ring-4 ring-brand-100 active:cursor-grabbing"
              : isOverSchedule
              ? "border-amber-300"
              : "border-brand-500"
        }`}
      >
        {station.icon}
        {isOrderEditing ? (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-black text-white shadow-sm">
            {orderLabel}
          </span>
        ) : null}
      </div>

      <p
        className="mt-3 w-full max-w-[92px] truncate text-center text-[11px] font-bold text-slate-900"
        title={station.title}
      >
        {station.title}
      </p>
      {isOrderEditing ? null : (
        <p className="mt-0.5 text-[10px] text-slate-500">{station.subtitle}</p>
      )}
      {station.item && !isOrderEditing ? (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
          {formatClock(station.item.startMinutes)}
        </p>
      ) : !isOrderEditing ? (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">START</p>
      ) : station.type === "start" ? (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">START</p>
      ) : (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
          드래그
        </p>
      )}
    </>
  );

  return (
    <div className="relative z-20 flex min-w-0 flex-col items-center px-1">
      {station.item ? (
        <button
          type="button"
          data-route-drag-index={station.itemIndex}
          draggable={false}
          onPointerDown={(event) => {
            if (isOrderEditing) {
              onStartDragItem(
                station.itemIndex,
                station.item as PlannedRouteItem,
                event
              );
              return;
            }

            if (event.button !== 0) {
              return;
            }

            didLongPressRef.current = false;
            longPressStartRef.current = {
              x: event.clientX,
              y: event.clientY,
            };
            longPressTimerRef.current = window.setTimeout(() => {
              didLongPressRef.current = true;
              clearLongPressTimer();
              onRequestOrderEditing();
            }, 420);
          }}
          onPointerMove={(event) => {
            const startPoint = longPressStartRef.current;
            if (!startPoint) {
              return;
            }

            const moveDistance = Math.hypot(
              event.clientX - startPoint.x,
              event.clientY - startPoint.y
            );

            if (moveDistance > 8) {
              clearLongPressTimer();
            }
          }}
          onPointerUp={() => {
            clearLongPressTimer();
          }}
          onPointerCancel={() => {
            clearLongPressTimer();
          }}
          onClick={() => {
            if (didLongPressRef.current) {
              didLongPressRef.current = false;
              return;
            }

            if (!isOrderEditing) {
              onSelectItem(station.item as PlannedRouteItem);
            }
          }}
          className={`flex min-w-0 flex-col items-center ${
            isOrderEditing ? "route-order-drag-node" : ""
          }`}
        >
          {nodeContent}
        </button>
      ) : (
        nodeContent
      )}

      {station.item && !isOrderEditing ? (
        <label className="mt-1 flex w-[58px] max-w-full items-center justify-center gap-0.5 rounded-full border border-brand-100 bg-brand-50 px-1.5 py-1">
          <input
            aria-label="체류 시간(분)"
            type="number"
            min={15}
            max={360}
            step={5}
            value={station.item.stayMinutes}
            onChange={(event) =>
              onChangeStayMinutes(
                station.item.id,
                clampStayMinutes(Number(event.target.value))
              )
            }
            className="w-6 bg-transparent text-center text-[11px] font-bold text-slate-800 outline-none"
          />
          <span className="text-[9px] text-slate-500">분</span>
        </label>
      ) : null}
    </div>
  );
}

function PlaceCartRouteItemSheet({
  item,
  currentDay,
  routePlan,
  onClose,
  onRemove,
  onMovePlaceToDay,
}: {
  item: PlannedRouteItem;
  currentDay: number;
  routePlan: PlannedRouteDay[];
  onClose: () => void;
  onRemove: (placeId: string) => void;
  onMovePlaceToDay: (
    placeId: string,
    targetDayNumber: number,
    position: "first" | "last"
  ) => void;
}) {
  const movableDays = routePlan.filter((day) => day.day !== currentDay);

  return (
    <div className="fixed inset-0 z-[2600] flex items-end bg-slate-950/30">
      <button
        type="button"
        aria-label="장소 편집 닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="route-checkout-bottom-sheet-enter relative w-full rounded-t-[28px] border border-brand-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">장소 편집</p>
            <h3 className="mt-2 truncate text-lg font-bold text-slate-900">
              {item.place.title}
            </h3>
            <p className="mt-1 text-sm font-semibold text-brand-700">
              {item.place.icon} {item.place.contentTypeLabel}
              {item.place.categoryName !== item.place.contentTypeLabel
                ? ` · ${item.place.categoryName}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            <IoClose />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/70 px-3 py-3">
          <p className="line-clamp-2 text-xs leading-5 text-slate-500">
            {item.place.address || "주소 정보가 없습니다"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <IoTimeOutline className="text-brand-600" />
                도착 시간
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {formatClock(item.startMinutes)}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <IoCarSportOutline className="text-brand-600" />
                이동 시간
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {getDurationText(item.travelMinutesFromPrevious)}
              </p>
            </div>
          </div>
        </div>

        {movableDays.length > 0 ? (
          <section className="mt-4 rounded-2xl border border-brand-100 bg-white p-3">
            <p className="text-xs font-bold text-slate-500">
              다른 날짜로 이동
            </p>
            <div className="mt-3 space-y-2">
              {movableDays.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-brand-50/70 px-3 py-2"
                >
                  <span className="font-trip text-sm text-brand-700">
                    DAY {day.day}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onMovePlaceToDay(item.id, day.day, "first");
                        onClose();
                      }}
                      className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700"
                    >
                      맨 앞
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onMovePlaceToDay(item.id, day.day, "last");
                        onClose();
                      }}
                      className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700"
                    >
                      맨 뒤
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => {
            onRemove(item.id);
            onClose();
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
        >
          <IoTrashOutline />
          이 루트에서 빼기
        </button>
      </section>
    </div>
  );
}

function PlaceCartRouteDayCard({
  day,
  routePlan,
  isOrderEditing,
  comparisonDay,
  candidatePlaces,
  excludedPlaceIds,
  onChangeStayMinutes,
  onInsertPlace,
  onRemovePlace,
  onReorderDayItems,
  onMovePlaceToDay,
  onRequestOrderEditing,
  onFinishOrderEditing,
  onRequestSearchPlace,
}: PlaceCartRouteDayCardProps) {
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DraggedDayItem | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [activeMoveDirection, setActiveMoveDirection] =
    useState<AdjacentMoveDirection | null>(null);
  const dropZoneRefs = useRef(new Map<number, HTMLDivElement>());
  const previousDayDropZoneRef = useRef<HTMLDivElement | null>(null);
  const nextDayDropZoneRef = useRef<HTMLDivElement | null>(null);
  const draggedItemRef = useRef<DraggedDayItem | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [insertRequest, setInsertRequest] =
    useState<RouteInsertRequest | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlannedRouteItem | null>(
    null
  );
  const routeStations = buildRouteStations(day);
  const routeRows = splitRouteRows(routeStations);
  const currentDayIndex = routePlan.findIndex(
    (routeDay) => routeDay.day === day.day
  );
  const previousDay =
    currentDayIndex > 0 ? routePlan[currentDayIndex - 1] : null;
  const nextDay =
    currentDayIndex >= 0 && currentDayIndex < routePlan.length - 1
      ? routePlan[currentDayIndex + 1]
      : null;
  const stopCurrentDrag = () => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    draggedItemRef.current = null;
    setDraggedItem(null);
    setActiveDropIndex(null);
    setActiveMoveDirection(null);
  };
  const registerDropZone = (
    targetIndex: number,
    node: HTMLDivElement | null
  ) => {
    if (node) {
      dropZoneRefs.current.set(targetIndex, node);
      return;
    }

    dropZoneRefs.current.delete(targetIndex);
  };
  const getDropIndexAtPoint = (x: number, y: number) => {
    let matchedIndex: number | null = null;
    let matchedDistance = Number.POSITIVE_INFINITY;

    dropZoneRefs.current.forEach((node, targetIndex) => {
      const rect = node.getBoundingClientRect();
      const isSegmentDropZone =
        node.dataset.routeDropZoneKind === "segment";
      const centerX = rect.left + rect.width / 2;
      const centerY = isSegmentDropZone
        ? rect.top
        : rect.top + rect.height / 2;
      const distance = Math.hypot(centerX - x, centerY - y);
      const isInside = isSegmentDropZone
        ? distance <= 24
        : x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom;

      if (
        isInside &&
        distance < matchedDistance
      ) {
        matchedIndex = targetIndex;
        matchedDistance = distance;
      }
    });

    return matchedIndex;
  };
  const getAdjacentMoveDirectionAtPoint = (
    x: number,
    y: number
  ): AdjacentMoveDirection | null => {
    const adjacentZones: Array<{
      direction: AdjacentMoveDirection;
      node: HTMLDivElement | null;
    }> = [
      { direction: "previous", node: previousDayDropZoneRef.current },
      { direction: "next", node: nextDayDropZoneRef.current },
    ];

    for (const zone of adjacentZones) {
      if (!zone.node) {
        continue;
      }

      const rect = zone.node.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return zone.direction;
      }
    }

    return null;
  };
  const moveDraggedItemToAdjacentDay = (
    item: PlannedRouteItem,
    direction: AdjacentMoveDirection
  ) => {
    const targetDay = direction === "previous" ? previousDay : nextDay;

    if (!targetDay) {
      return false;
    }

    onMovePlaceToDay(
      item.place.id,
      targetDay.day,
      direction === "previous" ? "last" : "first"
    );
    return true;
  };
  const handleDropRouteItem = (targetIndex: number) => {
    if (!draggedItem) {
      return;
    }

    onReorderDayItems(
      day.day,
      moveDayItem(day.items, draggedItem.itemIndex, targetIndex)
    );
    stopCurrentDrag();
  };
  const handleDropAdjacentDay = (direction: AdjacentMoveDirection) => {
    if (!draggedItem) {
      return;
    }

    moveDraggedItemToAdjacentDay(draggedItem.item, direction);
    stopCurrentDrag();
  };

  const startDragItem = ({
    itemIndex,
    item,
    clientX,
    clientY,
    button,
    captureTarget,
    pointerId,
  }: {
    itemIndex: number;
    item: PlannedRouteItem;
    clientX: number;
    clientY: number;
    button: number;
    captureTarget: HTMLElement;
    pointerId?: number;
  }) => {
    if (button !== 0) {
      return;
    }

    let pointerCaptureTarget: HTMLElement | null = null;
    if (pointerId != null && captureTarget.setPointerCapture) {
      try {
        captureTarget.setPointerCapture(pointerId);
        pointerCaptureTarget = captureTarget;
      } catch {
        pointerCaptureTarget = null;
      }
    }
    dragCleanupRef.current?.();

    const initialDraggedItem: DraggedDayItem = {
      itemIndex,
      item,
      startX: clientX,
      startY: clientY,
      x: clientX,
      y: clientY,
      isActive: false,
    };
    draggedItemRef.current = initialDraggedItem;
    setDraggedItem(initialDraggedItem);
    setActiveDropIndex(null);
    setActiveMoveDirection(null);

    const handleDragMove = (moveEvent: PointerEvent) => {
      const currentDraggedItem = draggedItemRef.current;
      if (!currentDraggedItem) {
        return;
      }

      const deltaX = moveEvent.clientX - currentDraggedItem.startX;
      const deltaY = moveEvent.clientY - currentDraggedItem.startY;
      const moveDistance = Math.hypot(deltaX, deltaY);

      if (!currentDraggedItem.isActive) {
        if (moveDistance < 6) {
          return;
        }
      }

      moveEvent.preventDefault();
      const nextDraggedItem = {
        ...currentDraggedItem,
        x: moveEvent.clientX,
        y: moveEvent.clientY,
        isActive: true,
      };
      draggedItemRef.current = nextDraggedItem;
      setDraggedItem(nextDraggedItem);
      const moveDirection = getAdjacentMoveDirectionAtPoint(
        moveEvent.clientX,
        moveEvent.clientY
      );
      setActiveMoveDirection(moveDirection);
      setActiveDropIndex(
        moveDirection
          ? null
          : getDropIndexAtPoint(moveEvent.clientX, moveEvent.clientY)
      );
    };

    const handleDragEnd = (upEvent: PointerEvent) => {
      const currentDraggedItem = draggedItemRef.current;
      if (!currentDraggedItem) {
        stopCurrentDrag();
        return;
      }

      if (!currentDraggedItem.isActive) {
        stopCurrentDrag();
        return;
      }

      upEvent.preventDefault();
      const moveDirection = getAdjacentMoveDirectionAtPoint(
        upEvent.clientX,
        upEvent.clientY
      );
      const didMoveToAdjacentDay = moveDirection
        ? moveDraggedItemToAdjacentDay(currentDraggedItem.item, moveDirection)
        : false;
      const targetIndex = didMoveToAdjacentDay
        ? null
        : getDropIndexAtPoint(upEvent.clientX, upEvent.clientY);

      if (targetIndex != null) {
        onReorderDayItems(
          day.day,
          moveDayItem(day.items, currentDraggedItem.itemIndex, targetIndex)
        );
      }
      stopCurrentDrag();
    };

    window.addEventListener("pointermove", handleDragMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handleDragEnd, { once: true });
    window.addEventListener("pointercancel", handleDragEnd, { once: true });

    dragCleanupRef.current = () => {
      if (
        pointerId != null &&
        pointerCaptureTarget?.hasPointerCapture?.(pointerId)
      ) {
        try {
          pointerCaptureTarget.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture can already be released by the browser.
        }
      }
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
    };
  };

  const handleStartDragItem = (
    itemIndex: number,
    item: PlannedRouteItem,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    startDragItem({
      itemIndex,
      item,
      clientX: event.clientX,
      clientY: event.clientY,
      button: "button" in event ? event.button : 0,
      captureTarget: event.currentTarget,
      pointerId: "pointerId" in event ? event.pointerId : undefined,
    });
  };

  useEffect(() => {
    if (!isOrderEditing) {
      stopCurrentDrag();
    }
  }, [isOrderEditing]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const hasRouteComparison = Boolean(comparisonDay);

  return (
    <section
      className="overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/70 px-4 py-3">
        <div>
          <p className="font-trip text-sm text-brand-700">DAY {day.day}</p>
          {day.date ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDateLabel(day.date)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isOrderEditing ? (
            <button
              type="button"
              onClick={onFinishOrderEditing}
              className="rounded-full border border-brand-600 bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
            >
              완료
            </button>
          ) : null}
          {day.items.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsRouteMapOpen(true)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                hasRouteComparison
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-brand-700"
              }`}
            >
              <IoMapOutline className="text-xs" />
              {hasRouteComparison ? "루트비교" : "루트보기"}
            </button>
          ) : null}
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 shadow-sm">
            {day.items.length}곳
          </span>
        </div>
      </div>

      {day.items.length > 0 ? (
        <div className="px-6 py-4">
          {isOrderEditing && previousDay ? (
            <div
              ref={previousDayDropZoneRef}
              data-route-drop-zone-kind="previous-day"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDropAdjacentDay("previous");
              }}
              className={`mb-3 rounded-2xl border border-dashed px-3 py-3 text-center text-xs font-bold transition ${
                activeMoveDirection === "previous"
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-300 bg-brand-50/80 text-brand-700"
              }`}
            >
              DAY {previousDay.day} 맨 뒤로 이동
            </div>
          ) : null}
          <div className="relative">
            <RouteConnectorLayer
              day={day}
              rows={routeRows}
              isOrderEditing={isOrderEditing}
              activeDropIndex={activeDropIndex}
              onRequestInsertPlace={setInsertRequest}
              onDropRouteItem={handleDropRouteItem}
              registerDropZone={registerDropZone}
            />
            <div
              className="relative z-10 flex flex-col"
              style={{ gap: `${ROUTE_ROW_GAP}px` }}
            >
              {routeRows.map((row, rowIndex) => (
                <RouteRowGroup
                  key={`${day.day}-${rowIndex}`}
                  day={day}
                  row={row}
                  rowIndex={rowIndex}
                  isOrderEditing={isOrderEditing}
                  onChangeStayMinutes={onChangeStayMinutes}
                  onSelectItem={setSelectedItem}
                  onStartDragItem={handleStartDragItem}
                  onRequestOrderEditing={onRequestOrderEditing}
                  onRequestInsertPlace={setInsertRequest}
                  onDropRouteItem={handleDropRouteItem}
                  activeDropIndex={activeDropIndex}
                  registerDropZone={registerDropZone}
                />
              ))}
            </div>
          </div>

          {isOrderEditing ? (
            <div
              ref={(node) => registerDropZone(day.items.length, node)}
              data-route-drop-zone-kind="tail"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDropRouteItem(day.items.length);
              }}
              className={`mt-3 rounded-2xl border border-dashed px-3 py-3 text-center text-xs font-bold transition ${
                activeDropIndex === day.items.length
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-300 bg-brand-50/80 text-brand-700"
              }`}
            >
              맨 뒤로 옮기려면 여기에 놓기
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-[10px] text-slate-500">
              <span>S자 순서</span>
              <span>차량 이동 추정</span>
            </div>
          )}
          {isOrderEditing && nextDay ? (
            <div
              ref={nextDayDropZoneRef}
              data-route-drop-zone-kind="next-day"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDropAdjacentDay("next");
              }}
              className={`mt-3 rounded-2xl border border-dashed px-3 py-3 text-center text-xs font-bold transition ${
                activeMoveDirection === "next"
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-300 bg-brand-50/80 text-brand-700"
              }`}
            >
              DAY {nextDay.day} 맨 앞으로 이동
            </div>
          ) : null}
        </div>
      ) : (
        <div className="m-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 py-4 text-center text-sm text-slate-500">
          배치된 장소가 없습니다
        </div>
      )}
      {isRouteMapOpen ? (
        <PlaceCartRouteMapPopup
          day={day}
          comparisonDay={comparisonDay ?? null}
          onClose={() => setIsRouteMapOpen(false)}
        />
      ) : null}
      {insertRequest ? (
        <PlaceCartRouteInsertSheet
          request={insertRequest}
          candidatePlaces={candidatePlaces}
          excludedPlaceIds={excludedPlaceIds}
          onClose={() => setInsertRequest(null)}
          onSelectPlace={(place, request) => {
            onInsertPlace(request, place);
            setInsertRequest(null);
          }}
          onRequestSearchPlace={() => {
            setInsertRequest(null);
            onRequestSearchPlace();
          }}
        />
      ) : null}
      {selectedItem ? (
        <PlaceCartRouteItemSheet
          item={selectedItem}
          currentDay={day.day}
          routePlan={routePlan}
          onClose={() => setSelectedItem(null)}
          onRemove={onRemovePlace}
          onMovePlaceToDay={onMovePlaceToDay}
        />
      ) : null}
      {draggedItem?.isActive ? (
        <div
          className="pointer-events-none fixed z-[3000] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-2xl"
          style={{
            left: draggedItem.x,
            top: draggedItem.y,
          }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50">
            {draggedItem.item.place.icon}
          </span>
          <span className="max-w-[150px] truncate">
            {draggedItem.item.place.title}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export default PlaceCartRouteDayCard;
