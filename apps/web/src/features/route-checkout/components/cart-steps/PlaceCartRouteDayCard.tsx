import { IoAdd, IoCarSportOutline, IoLocationSharp } from "react-icons/io5";
import type { ReactNode } from "react";
import type { PlannedRouteDay, PlannedRouteItem } from "./routePlanTypes";

type PlaceCartRouteDayCardProps = {
  day: PlannedRouteDay;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onRequestAddPlace: () => void;
};

type RouteStation =
  | {
      id: "current-location";
      type: "start";
      icon: ReactNode;
      title: string;
      subtitle: string;
      incomingTravelMinutes: null;
      item: null;
    }
  | {
      id: string;
      type: "place";
      icon: string;
      title: string;
      subtitle: string;
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

function buildRouteStations(day: PlannedRouteDay): RouteStation[] {
  const stations: RouteStation[] = day.startsFromCurrentLocation
    ? [
        {
          id: "current-location",
          type: "start",
          icon: <IoLocationSharp />,
          title: "내 위치",
          subtitle: "출발",
          incomingTravelMinutes: null,
          item: null,
        },
      ]
    : [];

  day.items.forEach((item) => {
    stations.push({
      id: item.id,
      type: "place",
      icon: item.place.icon,
      title: item.place.title,
      subtitle: item.place.contentTypeLabel,
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
  travelMinutes,
  onRequestAddPlace,
}: {
  x: number;
  y?: number;
  travelMinutes: number;
  onRequestAddPlace: () => void;
}) {
  return (
    <div
      className="absolute z-30 h-12 w-16 -translate-x-1/2"
      style={{ left: `${x}%`, top: y }}
    >
      <button
        type="button"
        aria-label="이 구간에 장소 추가"
        onClick={onRequestAddPlace}
        className="absolute left-1/2 top-0 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-700 shadow-sm transition active:scale-95"
      >
        <IoAdd className="text-sm" />
      </button>
      <span className="absolute left-1/2 top-5 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
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

function getRouteConnectorControlX(rowIndex: number) {
  return rowIndex % 2 === 0 ? ROUTE_TURN_RIGHT_X + 4 : ROUTE_TURN_LEFT_X - 4;
}

function RouteConnectorLayer({
  rows,
  onRequestAddPlace,
}: {
  rows: RouteRowEntry[][];
  onRequestAddPlace: () => void;
}) {
  return (
    <>
      {rows.slice(0, -1).map((row, rowIndex) => {
        const travelMinutes =
          rows[rowIndex + 1]?.[0]?.station.incomingTravelMinutes ?? null;

        if (travelMinutes == null) {
          return null;
        }

        const connectorHeight = ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP + ROUTE_LINE_Y;

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
                x={getRouteConnectorControlX(rowIndex)}
                y={connectorHeight / 2}
                travelMinutes={travelMinutes}
                onRequestAddPlace={onRequestAddPlace}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

function RouteRowGroup({
  row,
  rowIndex,
  onChangeStayMinutes,
  onRequestAddPlace,
}: {
  row: RouteRowEntry[];
  rowIndex: number;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onRequestAddPlace: () => void;
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
                onChangeStayMinutes={onChangeStayMinutes}
              />
            </div>
          );
        })}
      </div>

      {row.slice(1).map((entry, entryIndex) => {
        const previousEntry = row[entryIndex];
        const x =
          (getRoutePointX(previousEntry.sequenceIndex) +
            getRoutePointX(entry.sequenceIndex)) /
          2;

        return (
          <RouteSegmentControl
            key={`${previousEntry.station.id}-${entry.station.id}`}
            x={x}
            travelMinutes={entry.station.incomingTravelMinutes ?? 0}
            onRequestAddPlace={onRequestAddPlace}
          />
        );
      })}
    </div>
  );
}

function StationNode({
  station,
  onChangeStayMinutes,
}: {
  station: RouteStation;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
}) {
  const isOverSchedule = station.item?.isOverSchedule ?? false;

  return (
    <div className="relative z-20 flex min-w-0 flex-col items-center px-1">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-white text-base shadow-sm ${
          station.type === "start"
            ? "border-slate-300 text-brand-700"
            : isOverSchedule
              ? "border-amber-300"
              : "border-brand-500"
        }`}
      >
        {station.icon}
      </div>

      <p className="mt-3 w-full truncate text-center text-[11px] font-bold text-slate-900">
        {station.title}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">{station.subtitle}</p>

      {station.item ? (
        <>
          <p className="mt-0.5 text-[10px] font-semibold text-brand-700">
            {formatClock(station.item.startMinutes)}
          </p>
          <label className="mt-1 flex w-[72px] max-w-full items-center justify-center gap-0.5 rounded-full border border-brand-100 bg-brand-50 px-2 py-1">
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
              className="w-7 bg-transparent text-center text-[11px] font-bold text-slate-800 outline-none"
            />
            <span className="text-[9px] text-slate-500">분</span>
          </label>
        </>
      ) : (
        <p className="mt-0.5 text-[10px] font-semibold text-brand-700">START</p>
      )}
    </div>
  );
}

function PlaceCartRouteDayCard({
  day,
  onChangeStayMinutes,
  onRequestAddPlace,
}: PlaceCartRouteDayCardProps) {
  const routeStations = buildRouteStations(day);
  const routeRows = splitRouteRows(routeStations);

  return (
    <section className="overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/70 px-4 py-3">
        <div>
          <p className="font-trip text-sm text-brand-700">DAY {day.day}</p>
          {day.date ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDateLabel(day.date)}
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 shadow-sm">
          {day.items.length}곳
        </span>
      </div>

      {day.items.length > 0 ? (
        <div className="px-6 py-4">
          <div className="relative">
            <RouteConnectorLayer
              rows={routeRows}
              onRequestAddPlace={onRequestAddPlace}
            />
            <div
              className="relative z-10 flex flex-col"
              style={{ gap: `${ROUTE_ROW_GAP}px` }}
            >
              {routeRows.map((row, rowIndex) => (
                <RouteRowGroup
                  key={`${day.day}-${rowIndex}`}
                  row={row}
                  rowIndex={rowIndex}
                  onChangeStayMinutes={onChangeStayMinutes}
                  onRequestAddPlace={onRequestAddPlace}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-[10px] text-slate-500">
            <span>S자 순서</span>
            <span>차량 이동 추정</span>
          </div>
        </div>
      ) : (
        <div className="m-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 py-4 text-center text-sm text-slate-500">
          배치된 장소가 없습니다
        </div>
      )}
    </section>
  );
}

export default PlaceCartRouteDayCard;
