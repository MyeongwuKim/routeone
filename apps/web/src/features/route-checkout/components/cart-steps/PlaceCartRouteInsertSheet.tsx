import { useMemo, useState } from "react";
import {
  IoCafeOutline,
  IoClose,
  IoLocationSharp,
  IoRestaurantOutline,
  IoSearch,
} from "react-icons/io5";
import SelectablePillButton from "@/components/inputs/SelectablePillButton";
import {
  getRoutePlaceCategory,
  type RoutePlaceCategory,
} from "@/lib/placeCategory";
import { hasDuplicatePlace } from "@/lib/placeDuplicate";
import { localizePlaceCategoryLabel, useUiText } from "@/lib/uiText";
import type { MapSheetPlace } from "@/types/place";
import type { RouteInsertRequest } from "./routePlanTypes";

type InsertFilter = "all" | RoutePlaceCategory;

type PlaceCartRouteInsertSheetProps = {
  request: RouteInsertRequest;
  candidatePlaces: MapSheetPlace[];
  excludedPlaceKeys: string[];
  onClose: () => void;
  onSelectPlace: (place: MapSheetPlace, request: RouteInsertRequest) => void;
  onRequestSearchPlace: () => void;
};

const FILTERS: Array<{ key: InsertFilter }> = [
  { key: "all" },
  { key: "tourist" },
  { key: "food" },
  { key: "cafe" },
];

function getFilterIcon(filter: InsertFilter) {
  if (filter === "food") {
    return <IoRestaurantOutline />;
  }

  if (filter === "cafe") {
    return <IoCafeOutline />;
  }

  return <IoLocationSharp />;
}

function calculateDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm: number) {
  if (distanceKm >= 10) {
    return `${Math.round(distanceKm)}km`;
  }

  return `${distanceKm.toFixed(1)}km`;
}

function getSegmentFitScore(place: MapSheetPlace, request: RouteInsertRequest) {
  const fromDistance = calculateDistanceKm(request.from, place);
  const toDistance = calculateDistanceKm(place, request.to);
  const directDistance = calculateDistanceKm(request.from, request.to);
  const detourDistance = Math.max(0, fromDistance + toDistance - directDistance);

  return {
    fromDistance,
    toDistance,
    detourDistance,
    score: detourDistance * 1.4 + Math.min(fromDistance, toDistance) * 0.25,
  };
}

function PlaceCartRouteInsertSheet({
  request,
  candidatePlaces,
  excludedPlaceKeys,
  onClose,
  onSelectPlace,
  onRequestSearchPlace,
}: PlaceCartRouteInsertSheetProps) {
  const text = useUiText();
  const [activeFilter, setActiveFilter] = useState<InsertFilter>("all");
  const [keyword, setKeyword] = useState("");
  const excludedKeySet = useMemo(
    () => new Set(excludedPlaceKeys),
    [excludedPlaceKeys]
  );
  const keywordText = keyword.trim().toLowerCase();
  const recommendedPlaces = useMemo(
    () =>
      candidatePlaces
        .filter((place) => !hasDuplicatePlace(place, excludedKeySet))
        .filter((place) => {
          if (activeFilter === "all") {
            return true;
          }

          return getRoutePlaceCategory(place) === activeFilter;
        })
        .filter((place) => {
          if (!keywordText) {
            return true;
          }

          return `${place.title} ${place.address} ${place.contentTypeLabel} ${place.categoryName}`
            .toLowerCase()
            .includes(keywordText);
        })
        .map((place) => ({
          place,
          fit: getSegmentFitScore(place, request),
        }))
        .sort((a, b) => a.fit.score - b.fit.score)
        .slice(0, 8),
    [activeFilter, candidatePlaces, excludedKeySet, keywordText, request]
  );

  return (
    <div className="fixed inset-0 z-[2600] flex items-end bg-slate-950/30">
      <button
        type="button"
        aria-label="구간 장소 추가 닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="route-checkout-bottom-sheet-enter relative flex h-[min(72dvh,780px)] max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-brand-400/25 dark:bg-[#102a27]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-brand-400/25" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700 dark:text-brand-200">
              이 구간에 장소 추가
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <span className="min-w-0 truncate">{request.from.title}</span>
              <span className="text-brand-500 dark:text-brand-200">→</span>
              <span className="min-w-0 truncate">{request.to.title}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              경로에서 크게 벗어나지 않는 후보를 먼저 보여줘요.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
          >
            <IoClose />
          </button>
        </div>

        <div className="mt-4 flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 dark:border-brand-400/25 dark:bg-slate-950/40">
          <IoSearch className="shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="이 구간에 넣을 장소 검색"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;

            return (
              <SelectablePillButton
                key={filter.key}
                selected={isActive}
                icon={getFilterIcon(filter.key)}
                selectedClassName="border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-100 dark:border-brand-300 dark:bg-brand-400/15 dark:text-brand-100 dark:shadow-brand-950/30"
                idleClassName="border-slate-200 bg-white text-slate-600 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
                onClick={() => setActiveFilter(filter.key)}
              >
                {text.search.filters[filter.key]}
              </SelectablePillButton>
            );
          })}
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pb-2 pr-1">
          {recommendedPlaces.length > 0 ? (
            recommendedPlaces.map(({ place, fit }) => (
              <button
                key={place.id}
                type="button"
                onClick={() => onSelectPlace(place, request)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[0.99] dark:border-brand-400/25 dark:bg-slate-950/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-lg dark:bg-brand-400/15">
                  {place.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {place.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-brand-700 dark:text-brand-200">
                    {localizePlaceCategoryLabel(place.contentTypeLabel, text)}
                    {place.categoryName !== place.contentTypeLabel
                      ? ` · ${localizePlaceCategoryLabel(place.categoryName, text)}`
                      : ""}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {place.address}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-brand-700 dark:text-brand-200">
                    +{formatDistance(fit.detourDistance)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    우회
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center dark:border-brand-400/25 dark:bg-slate-950/40">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-100">
                이 조건에 맞는 추천 후보가 없어요
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                검색어를 바꾸거나 전체 검색에서 직접 찾아볼 수 있어요.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRequestSearchPlace}
          className="mt-2 w-full shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-100 dark:hover:border-brand-300/60 dark:hover:text-brand-100"
        >
          전체 검색에서 직접 찾기
        </button>
      </section>
    </div>
  );
}

export default PlaceCartRouteInsertSheet;
