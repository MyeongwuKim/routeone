import { useEffect, useRef } from "react";
import { IoAdd, IoCarSportOutline } from "react-icons/io5";
import type { UiText } from "@/lib/uiText";
import {
  ROUTE_COLUMNS,
  ROUTE_LINE_Y,
  ROUTE_NODE_EDGE_OFFSET_X,
  ROUTE_ROW_GAP,
  ROUTE_ROW_HEIGHT,
  ROUTE_STATIONS_PER_ROW,
  ROUTE_TURN_LEFT_X,
  ROUTE_TURN_RIGHT_X,
  formatRouteClock,
  getAverageStaySummaryLabel,
  getRouteDurationText,
  getRoutePointX,
  type DragStartPayload,
  type LongPressPointer,
  type PlaceStaySummaryPreview,
  type RouteRowEntry,
  type RouteStation,
} from "../../models/routeDayCardModel";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteInsertPoint,
  RouteInsertRequest,
} from "../../models/routePlanTypes";

type DropZoneRegistrar = (
  targetIndex: number,
  node: HTMLDivElement | null
) => void;

function RouteSegmentControl({
  x,
  y = ROUTE_LINE_Y,
  badgeOffsetY = 11,
  travelMinutes,
  text,
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
  text: UiText;
  insertIndex: number;
  isOrderEditing: boolean;
  isActiveDropZone: boolean;
  onRequestInsertPlace: () => void;
  onDropRouteItem: (targetIndex: number) => void;
  registerDropZone: DropZoneRegistrar;
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
              : "border-brand-400 bg-white text-brand-700 dark:border-brand-300 dark:bg-slate-950 dark:text-brand-200"
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
        aria-label={text.cart.addSegmentAria}
        onClick={onRequestInsertPlace}
        className="absolute left-1/2 top-0 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-700 shadow-sm transition active:scale-95 dark:border-brand-400/50 dark:bg-slate-950 dark:text-brand-200"
      >
        <IoAdd className="text-xs" />
      </button>
      <span
        className="absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:border-brand-400/40 dark:bg-slate-950 dark:text-slate-200"
        style={{ top: `${badgeOffsetY}px` }}
      >
        <IoCarSportOutline className="shrink-0 text-brand-600" />
        {getRouteDurationText(travelMinutes, text)}
      </span>
    </div>
  );
}

function buildRouteRowPath(row: RouteRowEntry[]) {
  if (row.length === 0) {
    return "";
  }

  const routeXs = row.map(({ sequenceIndex }) =>
    getRoutePointX(sequenceIndex)
  );
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
  text,
  onRequestInsertPlace,
  onDropRouteItem,
  activeDropIndex,
  registerDropZone,
}: {
  day: PlannedRouteDay;
  rows: RouteRowEntry[][];
  isOrderEditing: boolean;
  text: UiText;
  onRequestInsertPlace: (request: RouteInsertRequest) => void;
  onDropRouteItem: (targetIndex: number) => void;
  activeDropIndex: number | null;
  registerDropZone: DropZoneRegistrar;
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

        const connectorHeight =
          ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP + ROUTE_LINE_Y;
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
                text={text}
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

function StationNode({
  station,
  isOrderEditing,
  text,
  averageStaySummary,
  onRequestStayMinutesEdit,
  onSelectItem,
  onStartDragItem,
  onRequestOrderEditing,
}: {
  station: RouteStation;
  isOrderEditing: boolean;
  text: UiText;
  averageStaySummary?: PlaceStaySummaryPreview;
  onRequestStayMinutesEdit: (item: PlannedRouteItem) => void;
  onSelectItem: (item: PlannedRouteItem) => void;
  onStartDragItem: (payload: DragStartPayload) => void;
  onRequestOrderEditing: () => void;
}) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressPointerRef = useRef<LongPressPointer | null>(null);
  const didLongPressRef = useRef(false);
  const isOverSchedule = station.item?.isOverSchedule ?? false;
  const averageStaySummaryLabel =
    getAverageStaySummaryLabel(averageStaySummary, text);
  const orderLabel =
    station.type === "place" ? String(station.itemIndex + 1) : "S";
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPointerRef.current = null;
  };

  useEffect(() => clearLongPressTimer, []);

  const nodeContent = (
    <>
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-white text-base shadow-sm dark:bg-slate-950 dark:text-slate-100 ${
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
        className="mt-3 w-full max-w-[92px] truncate text-center text-[11px] font-bold text-slate-900 dark:text-slate-50"
        title={station.title}
      >
        {station.title}
      </p>
      {!isOrderEditing ? (
        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-300">
          {station.subtitle}
        </p>
      ) : null}
      {station.item && !isOrderEditing ? (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
          {formatRouteClock(station.item.startMinutes)}
        </p>
      ) : !isOrderEditing || station.type === "start" ? (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
          START
        </p>
      ) : (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
          {text.cart.drag}
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
              onStartDragItem({
                itemIndex: station.itemIndex,
                item: station.item as PlannedRouteItem,
                clientX: event.clientX,
                clientY: event.clientY,
                button: event.button,
                captureTarget: event.currentTarget,
                pointerId: event.pointerId,
              });
              return;
            }
            if (event.button !== 0) {
              return;
            }

            didLongPressRef.current = false;
            longPressPointerRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              currentX: event.clientX,
              currentY: event.clientY,
              button: event.button,
              captureTarget: event.currentTarget,
              pointerId: event.pointerId,
            };
            longPressTimerRef.current = window.setTimeout(() => {
              const pointer = longPressPointerRef.current;
              if (!pointer) {
                return;
              }

              didLongPressRef.current = true;
              clearLongPressTimer();
              onRequestOrderEditing();
              onStartDragItem({
                itemIndex: station.itemIndex,
                item: station.item as PlannedRouteItem,
                clientX: pointer.currentX,
                clientY: pointer.currentY,
                button: pointer.button,
                captureTarget: pointer.captureTarget,
                pointerId: pointer.pointerId,
              });
            }, 420);
          }}
          onPointerMove={(event) => {
            const pointer = longPressPointerRef.current;
            if (!pointer) {
              return;
            }

            pointer.currentX = event.clientX;
            pointer.currentY = event.clientY;
            if (
              Math.hypot(
                event.clientX - pointer.startX,
                event.clientY - pointer.startY
              ) > 8
            ) {
              clearLongPressTimer();
            }
          }}
          onPointerUp={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
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
        <>
          <button
            type="button"
            onClick={() =>
              onRequestStayMinutesEdit(station.item as PlannedRouteItem)
            }
            className="mt-1 flex w-[62px] max-w-full items-center justify-center gap-0.5 rounded-full border border-brand-100 bg-brand-50 px-1.5 py-1 text-[11px] font-bold text-slate-800 active:scale-95 dark:border-brand-400/35 dark:bg-slate-950 dark:text-slate-100"
          >
            <span>{station.item.stayMinutes}</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-300">
              {text.cart.minuteUnit}
            </span>
          </button>
          {averageStaySummaryLabel ? (
            <p className="mt-1 max-w-[92px] truncate text-center text-[9px] font-semibold text-slate-400 dark:text-slate-500">
              {averageStaySummaryLabel}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function RouteRowGroup({
  day,
  row,
  rowIndex,
  isOrderEditing,
  text,
  placeStaySummaryByPlaceId,
  onRequestStayMinutesEdit,
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
  text: UiText;
  placeStaySummaryByPlaceId: Map<string, PlaceStaySummaryPreview>;
  onRequestStayMinutesEdit: (item: PlannedRouteItem) => void;
  onSelectItem: (item: PlannedRouteItem) => void;
  onStartDragItem: (payload: DragStartPayload) => void;
  onRequestOrderEditing: () => void;
  onRequestInsertPlace: (request: RouteInsertRequest) => void;
  onDropRouteItem: (targetIndex: number) => void;
  activeDropIndex: number | null;
  registerDropZone: DropZoneRegistrar;
}) {
  const isReverseRow = rowIndex % 2 === 1;
  const cells: Array<RouteRowEntry | null> = Array.from(
    { length: ROUTE_STATIONS_PER_ROW },
    () => null
  );
  const visualStations = isReverseRow ? [...row].reverse() : row;
  const startColumn = isReverseRow ? ROUTE_STATIONS_PER_ROW - row.length : 0;
  const rowPath = buildRouteRowPath(row);
  visualStations.forEach((station, stationIndex) => {
    cells[startColumn + stationIndex] = station;
  });

  return (
    <div className="relative z-10" style={{ height: `${ROUTE_ROW_HEIGHT}px` }}>
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
        {cells.map((cell, cellIndex) =>
          cell ? (
            <div
              key={`${cell.station.id}-${cell.sequenceIndex}`}
              className="flex min-w-0 flex-col items-center"
            >
              <StationNode
                station={cell.station}
                isOrderEditing={isOrderEditing}
                text={text}
                averageStaySummary={
                  cell.station.item
                    ? placeStaySummaryByPlaceId.get(cell.station.item.place.id)
                    : undefined
                }
                onRequestStayMinutesEdit={onRequestStayMinutesEdit}
                onSelectItem={onSelectItem}
                onStartDragItem={onStartDragItem}
                onRequestOrderEditing={onRequestOrderEditing}
              />
            </div>
          ) : (
            <div key={`empty-${rowIndex}-${cellIndex}`} />
          )
        )}
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
            text={text}
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

export function RouteDayTimeline({
  day,
  rows,
  isOrderEditing,
  text,
  placeStaySummaryByPlaceId,
  onRequestStayMinutesEdit,
  onSelectItem,
  onStartDragItem,
  onRequestOrderEditing,
  onRequestInsertPlace,
  onDropRouteItem,
  activeDropIndex,
  registerDropZone,
}: {
  day: PlannedRouteDay;
  rows: RouteRowEntry[][];
  isOrderEditing: boolean;
  text: UiText;
  placeStaySummaryByPlaceId: Map<string, PlaceStaySummaryPreview>;
  onRequestStayMinutesEdit: (item: PlannedRouteItem) => void;
  onSelectItem: (item: PlannedRouteItem) => void;
  onStartDragItem: (payload: DragStartPayload) => void;
  onRequestOrderEditing: () => void;
  onRequestInsertPlace: (request: RouteInsertRequest) => void;
  onDropRouteItem: (targetIndex: number) => void;
  activeDropIndex: number | null;
  registerDropZone: DropZoneRegistrar;
}) {
  return (
    <div className="relative">
      <RouteConnectorLayer
        day={day}
        rows={rows}
        isOrderEditing={isOrderEditing}
        text={text}
        activeDropIndex={activeDropIndex}
        onRequestInsertPlace={onRequestInsertPlace}
        onDropRouteItem={onDropRouteItem}
        registerDropZone={registerDropZone}
      />
      <div
        className="relative z-10 flex flex-col"
        style={{ gap: `${ROUTE_ROW_GAP}px` }}
      >
        {rows.map((row, rowIndex) => (
          <RouteRowGroup
            key={`${day.day}-${rowIndex}`}
            day={day}
            row={row}
            rowIndex={rowIndex}
            isOrderEditing={isOrderEditing}
            text={text}
            placeStaySummaryByPlaceId={placeStaySummaryByPlaceId}
            onRequestStayMinutesEdit={onRequestStayMinutesEdit}
            onSelectItem={onSelectItem}
            onStartDragItem={onStartDragItem}
            onRequestOrderEditing={onRequestOrderEditing}
            onRequestInsertPlace={onRequestInsertPlace}
            onDropRouteItem={onDropRouteItem}
            activeDropIndex={activeDropIndex}
            registerDropZone={registerDropZone}
          />
        ))}
      </div>
    </div>
  );
}
