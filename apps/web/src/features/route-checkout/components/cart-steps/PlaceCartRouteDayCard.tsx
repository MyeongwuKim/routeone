import { useState } from "react";
import { IoMapOutline } from "react-icons/io5";
import { useUiText } from "@/lib/uiText";
import type { MapSheetPlace } from "@/types/place";
import { PlaceCartRouteItemSheet, StayMinutesPopup } from "./RouteDayDialogs";
import { RouteDayTimeline } from "./RouteDayTimeline";
import PlaceCartRouteInsertSheet from "./PlaceCartRouteInsertSheet";
import PlaceCartRouteMapPopup from "./PlaceCartRouteMapPopup";
import {
  buildRouteStations,
  formatRouteDayDate,
  splitRouteRows,
  type PlaceStaySummaryPreview,
} from "../../models/routeDayCardModel";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteInsertRequest,
} from "../../models/routePlanTypes";
import { useRouteDayDrag } from "../../hooks/useRouteDayDrag";

type PlaceCartRouteDayCardProps = {
  day: PlannedRouteDay;
  routePlan: PlannedRouteDay[];
  isOrderEditing: boolean;
  comparisonDay?: PlannedRouteDay | null;
  candidatePlaces: MapSheetPlace[];
  excludedPlaceKeys: string[];
  placeStaySummaryByPlaceId: Map<string, PlaceStaySummaryPreview>;
  onChangeStayMinutes: (placeId: string, minutes: number) => void;
  onInsertPlace: (request: RouteInsertRequest, place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onReorderDayItems: (dayNumber: number, nextItems: PlannedRouteItem[]) => void;
  onMovePlaceToDay: (
    placeId: string,
    targetDayNumber: number,
    position: "first" | "last"
  ) => void;
  onRequestOrderEditing: () => void;
  onFinishOrderEditing: () => void;
  onRequestSearchPlace: () => void;
};

function PlaceCartRouteDayCard({
  day,
  routePlan,
  isOrderEditing,
  comparisonDay,
  candidatePlaces,
  excludedPlaceKeys,
  placeStaySummaryByPlaceId,
  onChangeStayMinutes,
  onInsertPlace,
  onRemovePlace,
  onReorderDayItems,
  onMovePlaceToDay,
  onRequestOrderEditing,
  onFinishOrderEditing,
  onRequestSearchPlace,
}: PlaceCartRouteDayCardProps) {
  const text = useUiText();
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const [insertRequest, setInsertRequest] =
    useState<RouteInsertRequest | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlannedRouteItem | null>(
    null
  );
  const [stayMinutesItem, setStayMinutesItem] =
    useState<PlannedRouteItem | null>(null);
  const routeStations = buildRouteStations(day, text);
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
  const {
    activeDropIndex,
    activeMoveDirection,
    draggedItem,
    handleDropAdjacentDay,
    handleDropRouteItem,
    nextDayDropZoneRef,
    previousDayDropZoneRef,
    registerDropZone,
    startDragItem: handleStartDragItem,
    stopCurrentDrag,
  } = useRouteDayDrag({
    day,
    previousDay,
    nextDay,
    isOrderEditing,
    onReorderDayItems,
    onMovePlaceToDay,
  });

  const hasRouteComparison = Boolean(comparisonDay);

  return (
    <section
      className="overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-sm dark:border-brand-400/30 dark:bg-slate-950/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/70 px-4 py-3 dark:border-brand-400/25 dark:bg-slate-900/70">
        <div>
          <p className="font-trip text-sm text-brand-700">DAY {day.day}</p>
          {day.date ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {formatRouteDayDate(day.date)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isOrderEditing ? (
            <button
              type="button"
              onPointerDown={stopCurrentDrag}
              onClick={() => {
                stopCurrentDrag();
                onFinishOrderEditing();
              }}
                className="rounded-full border border-brand-600 bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
              >
              {text.cart.done}
            </button>
          ) : null}
          {day.items.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsRouteMapOpen(true)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                hasRouteComparison
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-200"
              }`}
            >
              <IoMapOutline className="text-xs" />
              {hasRouteComparison ? text.cart.routeCompare : text.cart.routeView}
            </button>
          ) : null}
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-200">
            {text.cart.placeCount(day.items.length)}
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
                  : "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-400/50 dark:bg-slate-900/90 dark:text-brand-100"
              }`}
            >
              {text.cart.moveToPreviousDayEnd(previousDay.day)}
            </div>
          ) : null}
          <RouteDayTimeline
            day={day}
            rows={routeRows}
            isOrderEditing={isOrderEditing}
            text={text}
            placeStaySummaryByPlaceId={placeStaySummaryByPlaceId}
            onRequestStayMinutesEdit={setStayMinutesItem}
            onSelectItem={setSelectedItem}
            onStartDragItem={handleStartDragItem}
            onRequestOrderEditing={onRequestOrderEditing}
            onRequestInsertPlace={setInsertRequest}
            onDropRouteItem={handleDropRouteItem}
            activeDropIndex={activeDropIndex}
            registerDropZone={registerDropZone}
          />

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
                  : "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-400/50 dark:bg-slate-900/90 dark:text-brand-100"
              }`}
            >
              {text.cart.dropToEnd}
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-[10px] text-slate-500 dark:border-brand-400/30 dark:bg-slate-900/80 dark:text-slate-200">
              <span>{text.cart.sOrder}</span>
              <span>{text.cart.carTravelEstimate}</span>
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
                  : "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-400/50 dark:bg-slate-900/90 dark:text-brand-100"
              }`}
            >
              {text.cart.moveToNextDayStart(nextDay.day)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="m-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 py-4 text-center text-sm text-slate-500 dark:border-brand-400/40 dark:bg-slate-900/80 dark:text-slate-200">
          {text.cart.noPlacedPlaces}
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
          excludedPlaceKeys={excludedPlaceKeys}
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
          averageStaySummary={placeStaySummaryByPlaceId.get(
            selectedItem.place.id
          )}
          onClose={() => setSelectedItem(null)}
          onRemove={onRemovePlace}
          onMovePlaceToDay={onMovePlaceToDay}
        />
      ) : null}
      {stayMinutesItem ? (
        <StayMinutesPopup
          item={stayMinutesItem}
          onClose={() => setStayMinutesItem(null)}
          onApply={onChangeStayMinutes}
        />
      ) : null}
      {draggedItem?.isActive ? (
        <div
          className="pointer-events-none fixed z-[3000] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-2xl dark:border-brand-400/40 dark:bg-slate-950 dark:text-slate-50"
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
