import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import {
  MdArrowBack,
  MdClose,
  MdFilterAlt,
  MdOutlineHub,
  MdOutlinePlace,
  MdSell,
} from "react-icons/md";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import {
  DropdownSelect,
  type DropdownSelectOption,
} from "@/components/inputs";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "@/features/route-checkout/components/cart-steps/routePlanTypes";
import SharedRouteCard, {
  GANGWON_REGION_LABELS,
  getDisplayPlaceOptions,
  getDisplayShareTags,
  type SharedRoute,
  type SharedRouteFilterCandidate,
  type SharedRoutePlaceFilterOption,
} from "@/features/shared-route/components/SharedRouteCard";
import SharedRouteDetailSkeleton from "@/features/shared-route/components/SharedRouteDetailSkeleton";
import {
  LIKED_SHARED_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
  optimisticUpdateLikedSharedRouteLikeCache,
  optimisticUpdateSharedRouteLikeCache,
  upsertLikedSharedRouteSummaryCache,
  upsertSharedRouteSummaryCache,
} from "@/features/my-route/myRouteCache";
import { getSortedRouteDays } from "@/features/my-route/routeDisplay";
import {
  CAFE_LCLS_CODE,
  getPlaceCategoryLabel,
} from "@/lib/placeCategory";
import { getCurrentPosition } from "@/lib/currentPosition";
import {
  fetchGangwonAttractions,
  fetchGangwonFestivals,
  fetchLclsSystemNameMap,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import type {
  LikedSharedRoutesQuery,
  RouteByIdQuery,
  RouteSummaryFieldsFragment,
  SharedRoutesQuery,
} from "@/generated/graphql";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useUiToastStore } from "@/stores/uiToastStore";

const getRouteDetailQueryKey = (routeId: string) =>
  ["route-detail", routeId] as const;
const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;

type SharedRoutePageMode = "feed" | "liked";

type SharedRoutePageProps = {
  mode?: SharedRoutePageMode;
};

type SharedRouteListData = SharedRoutesQuery | LikedSharedRoutesQuery;
type SharedRouteSortKey =
  | "shared-desc"
  | "shared-asc"
  | "likes-desc"
  | "likes-asc";
type SharedRouteFilters = {
  tags: string[];
  places: SharedRoutePlaceFilterOption[];
};
type SharedRouteFilterOptions = {
  tags: string[];
  placeRegions: Array<{
    region: string;
    categories: Array<{
      category: string;
      places: string[];
    }>;
  }>;
};

const EMPTY_SHARED_ROUTE_FILTERS: SharedRouteFilters = {
  tags: [],
  places: [],
};
const SHARED_ROUTE_SORT_OPTIONS: ReadonlyArray<
  DropdownSelectOption<SharedRouteSortKey>
> = [
  {
    value: "shared-desc",
    label: "최근 공유순",
    description: "최근 공유된 루트 먼저",
  },
  {
    value: "shared-asc",
    label: "오래된 공유순",
    description: "오래전에 공유된 루트 먼저",
  },
  {
    value: "likes-desc",
    label: "하트 많은순",
    description: "하트가 많은 루트 먼저",
  },
  {
    value: "likes-asc",
    label: "하트 적은순",
    description: "하트가 적은 루트 먼저",
  },
];
const DEFAULT_FILTER_REGION: (typeof GANGWON_REGION_LABELS)[number] = "강릉";
const GANGWON_REGION_CENTERS: Record<
  (typeof GANGWON_REGION_LABELS)[number],
  { lat: number; lng: number }
> = {
  강릉: { lat: 37.7519, lng: 128.8761 },
  고성: { lat: 38.3804, lng: 128.4677 },
  동해: { lat: 37.5247, lng: 129.1143 },
  삼척: { lat: 37.4499, lng: 129.1652 },
  속초: { lat: 38.207, lng: 128.5918 },
  양구: { lat: 38.1057, lng: 127.99 },
  양양: { lat: 38.0754, lng: 128.6191 },
  영월: { lat: 37.1836, lng: 128.4617 },
  원주: { lat: 37.3422, lng: 127.9202 },
  인제: { lat: 38.0697, lng: 128.1704 },
  정선: { lat: 37.3807, lng: 128.6611 },
  철원: { lat: 38.1466, lng: 127.3134 },
  춘천: { lat: 37.8813, lng: 127.7298 },
  태백: { lat: 37.1641, lng: 128.9856 },
  평창: { lat: 37.3704, lng: 128.3906 },
  홍천: { lat: 37.6972, lng: 127.8886 },
  화천: { lat: 38.1062, lng: 127.7082 },
  횡성: { lat: 37.4918, lng: 127.985 },
};
const GANGWON_SIGUNGU_CODE_BY_REGION: Record<
  (typeof GANGWON_REGION_LABELS)[number],
  string
> = {
  강릉: "1",
  고성: "2",
  동해: "3",
  삼척: "4",
  속초: "5",
  양구: "6",
  양양: "7",
  영월: "8",
  원주: "9",
  인제: "10",
  정선: "11",
  철원: "12",
  춘천: "13",
  태백: "14",
  평창: "15",
  홍천: "16",
  화천: "17",
  횡성: "18",
};
const TOUR_CONTENT_TYPE_CATEGORY_BY_ID: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "15": "축제/공연",
  "28": "레포츠",
  "38": "쇼핑",
  "39": "음식점",
};
const PLACE_CATEGORY_ORDER = [
  "관광지",
  "카페",
  "음식점",
  "축제",
  "문화시설",
  "레포츠",
  "쇼핑",
  "기타",
] as const;

const PAGE_COPY: Record<
  SharedRoutePageMode,
  {
    title: string;
    description: string;
    loadingTitle: string;
    loadingDescription: string;
    error: string;
    empty: string;
  }
> = {
  feed: {
    title: "공유 루트",
    description: "완료한 여행 루트를 모아보는 피드",
    loadingTitle: "공유 루트를 불러오는 중",
    loadingDescription: "다녀온 사람들의 루트를 확인하고 있어요.",
    error: "공유 루트를 불러오지 못했어요.",
    empty: "아직 공유된 루트가 없어요.",
  },
  liked: {
    title: "좋아요한 공유 루트",
    description: "내가 좋아요한 공유 루트 모아보기",
    loadingTitle: "좋아요한 루트를 불러오는 중",
    loadingDescription: "하트를 눌렀던 공유 루트를 모으고 있어요.",
    error: "좋아요한 공유 루트를 불러오지 못했어요.",
    empty: "아직 좋아요한 공유 루트가 없어요.",
  },
};

function getSharedRouteList(
  data: SharedRouteListData | undefined,
  mode: SharedRoutePageMode
) {
  if (!data) {
    return [];
  }

  return mode === "liked"
    ? (data as LikedSharedRoutesQuery).likedRoutes
    : (data as SharedRoutesQuery).sharedRoutes;
}

function createSavedPlacesFromRoutePlan(routePlan: PlannedRouteDay[]) {
  const seenPlaceIds = new Set<string>();
  const savedPlaces: SavedPlaceItem[] = [];

  routePlan.forEach((day) => {
    day.items.forEach((item) => {
      if (seenPlaceIds.has(item.place.id)) {
        return;
      }

      seenPlaceIds.add(item.place.id);
      savedPlaces.push({
        id: item.place.id,
        place: item.place,
        thumbnailUrl: item.place.images[0] ?? "",
        savedAt: Date.now() - savedPlaces.length,
      });
    });
  });

  return savedPlaces;
}

function getRoutePlanStartLocation(
  routePlan: PlannedRouteDay[]
): RouteStartLocation | null {
  return routePlan.find((day) => day.startLocation)?.startLocation ?? null;
}

function getRoutePlanTripDays(routePlan: PlannedRouteDay[]) {
  return Math.max(1, routePlan.length);
}

function getRouteSortTime(route: SharedRoute) {
  return new Date(route.sharedAt ?? route.updatedAt ?? route.createdAt).getTime();
}

function calculateDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function getNearestGangwonRegion(location: { lat: number; lng: number }) {
  return GANGWON_REGION_LABELS.reduce((nearestRegion, region) => {
    const nearestDistance = calculateDistanceMeters(
      location,
      GANGWON_REGION_CENTERS[nearestRegion]
    );
    const regionDistance = calculateDistanceMeters(
      location,
      GANGWON_REGION_CENTERS[region]
    );

    return regionDistance < nearestDistance ? region : nearestRegion;
  }, DEFAULT_FILTER_REGION);
}

function getPlaceCategorySortRank(category: string) {
  const matchedIndex = PLACE_CATEGORY_ORDER.findIndex((orderedCategory) =>
    category.includes(orderedCategory)
  );

  return matchedIndex === -1 ? PLACE_CATEGORY_ORDER.length : matchedIndex;
}

function getRegionSigunguCode(region: string) {
  return GANGWON_SIGUNGU_CODE_BY_REGION[
    region as (typeof GANGWON_REGION_LABELS)[number]
  ];
}

function getAttractionCategoryName(
  attraction: GangwonAttraction,
  lclsNameByCode: Record<string, string>
) {
  return (
    lclsNameByCode[attraction.lclsSystm3] ||
    lclsNameByCode[attraction.lclsSystm2] ||
    lclsNameByCode[attraction.lclsSystm1] ||
    TOUR_CONTENT_TYPE_CATEGORY_BY_ID[attraction.contentTypeId] ||
    "장소"
  );
}

function shouldHideFilterAttraction(
  attraction: GangwonAttraction,
  lclsNameByCode: Record<string, string>
) {
  const categoryText = [
    lclsNameByCode[attraction.lclsSystm1] || "",
    lclsNameByCode[attraction.lclsSystm2] || "",
    lclsNameByCode[attraction.lclsSystm3] || "",
  ].join(" ");
  const targetText = `${attraction.title} ${categoryText}`;

  return /화장실|공중.?화장실|주차장|공영주차장|parking|교회|성당|대성당|사찰|절|암자|성지|성지순례|cathedral|church|temple/i.test(
    targetText
  );
}

function dedupeAttractionsByPlace(attractions: GangwonAttraction[]) {
  const unique = new Map<string, GangwonAttraction>();

  attractions.forEach((attraction) => {
    const key = `${attraction.title.trim().toLowerCase()}|${attraction.address
      .trim()
      .toLowerCase()}`;

    if (!unique.has(key)) {
      unique.set(key, attraction);
    }
  });

  return [...unique.values()];
}

function createFilterPlaceOptionFromAttraction(
  attraction: GangwonAttraction,
  region: string,
  lclsNameByCode: Record<string, string>
): SharedRoutePlaceFilterOption {
  const categoryName = getAttractionCategoryName(attraction, lclsNameByCode);

  return {
    name: attraction.title,
    region,
    category: getPlaceCategoryLabel(attraction, categoryName),
  };
}

function groupPlaceOptionsByCategory(
  placeOptions: SharedRoutePlaceFilterOption[]
) {
  const placeOptionsByCategory = new Map<string, Set<string>>();

  placeOptions.forEach((placeOption) => {
    const places =
      placeOptionsByCategory.get(placeOption.category) ?? new Set<string>();

    places.add(placeOption.name);
    placeOptionsByCategory.set(placeOption.category, places);
  });

  return Array.from(placeOptionsByCategory.entries())
    .sort(
      ([leftCategory], [rightCategory]) =>
        getPlaceCategorySortRank(leftCategory) -
          getPlaceCategorySortRank(rightCategory) ||
        leftCategory.localeCompare(rightCategory, "ko")
    )
    .map(([category, places]) => ({
      category,
      places: Array.from(places).sort((left, right) =>
        left.localeCompare(right, "ko")
      ),
    }));
}

function mergePlaceCategories(
  ...categoryGroups: Array<SharedRouteFilterOptions["placeRegions"][number]["categories"]>
) {
  const mergedPlaceOptionsByCategory = new Map<string, Set<string>>();

  categoryGroups.flat().forEach(({ category, places }) => {
    const mergedPlaces =
      mergedPlaceOptionsByCategory.get(category) ?? new Set<string>();

    places.forEach((place) => mergedPlaces.add(place));
    mergedPlaceOptionsByCategory.set(category, mergedPlaces);
  });

  return Array.from(mergedPlaceOptionsByCategory.entries())
    .sort(
      ([leftCategory], [rightCategory]) =>
        getPlaceCategorySortRank(leftCategory) -
          getPlaceCategorySortRank(rightCategory) ||
        leftCategory.localeCompare(rightCategory, "ko")
    )
    .map(([category, places]) => ({
      category,
      places: Array.from(places).sort((left, right) =>
        left.localeCompare(right, "ko")
      ),
    }));
}

async function fetchRegionFilterPlaceCategories(region: string) {
  const sigunguCode = getRegionSigunguCode(region);

  if (!TOUR_API_SERVICE_KEY || !sigunguCode) {
    return [];
  }

  const lclsNameByCode = await fetchLclsSystemNameMap(TOUR_API_SERVICE_KEY);
  lclsNameByCode[CAFE_LCLS_CODE] = lclsNameByCode[CAFE_LCLS_CODE] || "카페";

  const [attractions, festivals] = await Promise.all([
    fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
      sigunguCode,
      contentTypeIds: ["12", "39"],
    }),
    fetchGangwonFestivals(TOUR_API_SERVICE_KEY, {
      sigunguCode,
      lookAheadDays: 90,
    }).catch(() => [] as GangwonAttraction[]),
  ]);

  return groupPlaceOptionsByCategory(
    dedupeAttractionsByPlace([...attractions, ...festivals])
      .filter(
        (attraction) => !shouldHideFilterAttraction(attraction, lclsNameByCode)
      )
      .map((attraction) =>
        createFilterPlaceOptionFromAttraction(
          attraction,
          region,
          lclsNameByCode
        )
      )
  );
}

function getFilterLabel(filter: SharedRouteFilterCandidate) {
  if (filter.type === "tag") {
    return `태그: ${filter.value}`;
  }

  return `장소: ${filter.value}`;
}

function isSamePlaceFilter(
  left: Pick<SharedRoutePlaceFilterOption, "name" | "region">,
  right: Pick<SharedRoutePlaceFilterOption, "name" | "region">
) {
  return left.name === right.name && left.region === right.region;
}

function hasFilterCandidate(
  filters: SharedRouteFilters,
  filter: SharedRouteFilterCandidate
) {
  if (filter.type === "tag") {
    return filters.tags.includes(filter.value);
  }

  return filters.places.some((place) =>
    isSamePlaceFilter(place, {
      name: filter.value,
      region: filter.region,
    })
  );
}

function addFilterCandidate(
  filters: SharedRouteFilters,
  filter: SharedRouteFilterCandidate
): SharedRouteFilters {
  if (hasFilterCandidate(filters, filter)) {
    return filters;
  }

  return filter.type === "tag"
    ? {
        ...filters,
        tags: [...filters.tags, filter.value],
      }
    : {
        ...filters,
        places: [
          ...filters.places,
          {
            name: filter.value,
            region: filter.region,
            category: "기타",
          },
        ],
      };
}

function removeFilterCandidate(
  filters: SharedRouteFilters,
  filter: SharedRouteFilterCandidate
): SharedRouteFilters {
  return filter.type === "tag"
    ? {
        ...filters,
        tags: filters.tags.filter((tag) => tag !== filter.value),
      }
    : {
        ...filters,
        places: filters.places.filter(
          (place) =>
            !isSamePlaceFilter(place, {
              name: filter.value,
              region: filter.region,
            })
        ),
      };
}

function toggleFilterCandidate(
  filters: SharedRouteFilters,
  filter: SharedRouteFilterCandidate
): SharedRouteFilters {
  return hasFilterCandidate(filters, filter)
    ? removeFilterCandidate(filters, filter)
    : addFilterCandidate(filters, filter);
}

function getActiveFilterCount(filters: SharedRouteFilters) {
  return filters.tags.length + filters.places.length;
}

function routeMatchesFilters(
  route: SharedRoute,
  filters: SharedRouteFilters
) {
  if (getActiveFilterCount(filters) === 0) {
    return true;
  }

  const routeTags = getDisplayShareTags(route);
  const routePlaces = getDisplayPlaceOptions(route);
  const matchesTags =
    filters.tags.length === 0 ||
    filters.tags.every((tag) => routeTags.includes(tag));
  const matchesPlaces =
    filters.places.length === 0 ||
    filters.places.some((selectedPlace) =>
      routePlaces.some((routePlace) => isSamePlaceFilter(routePlace, selectedPlace))
    );

  return matchesTags && matchesPlaces;
}

function getSharedRouteFilterOptions(routes: SharedRoute[]): SharedRouteFilterOptions {
  const tagOptions = new Set<string>();
  const placeOptionsByRegion = new Map<string, Map<string, Set<string>>>();

  routes.forEach((route) => {
    getDisplayShareTags(route).forEach((tag) => tagOptions.add(tag));
    getDisplayPlaceOptions(route).forEach((place) => {
      const categoryOptionsByRegion =
        placeOptionsByRegion.get(place.region) ?? new Map<string, Set<string>>();
      const categoryPlaces =
        categoryOptionsByRegion.get(place.category) ?? new Set<string>();

      categoryPlaces.add(place.name);
      categoryOptionsByRegion.set(place.category, categoryPlaces);
      placeOptionsByRegion.set(place.region, categoryOptionsByRegion);
    });
  });

  const placeRegionNames = Array.from(placeOptionsByRegion.keys());
  const orderedRegionNames = [
    ...GANGWON_REGION_LABELS,
    ...placeRegionNames.filter(
      (region) =>
        !GANGWON_REGION_LABELS.includes(
          region as (typeof GANGWON_REGION_LABELS)[number]
        )
    ),
  ];

  return {
    tags: Array.from(tagOptions).sort((left, right) =>
      left.localeCompare(right, "ko")
    ),
    placeRegions: orderedRegionNames.map((region) => {
      const categories =
        placeOptionsByRegion.get(region) ?? new Map<string, Set<string>>();

      return {
        region,
        categories: Array.from(categories.entries())
          .sort(([leftCategory], [rightCategory]) =>
            getPlaceCategorySortRank(leftCategory) -
              getPlaceCategorySortRank(rightCategory) ||
            leftCategory.localeCompare(rightCategory, "ko")
          )
          .map(([category, places]) => ({
            category,
            places: Array.from(places).sort((left, right) =>
              left.localeCompare(right, "ko")
            ),
          })),
      };
    }),
  };
}

function SharedRouteFilterDialog({
  filters,
  tagOptions,
  placeRegions,
  defaultRegion,
  onToggle,
  onClear,
  onClose,
  onConfirm,
}: {
  filters: SharedRouteFilters;
  tagOptions: string[];
  placeRegions: SharedRouteFilterOptions["placeRegions"];
  defaultRegion: string;
  onToggle: (filter: SharedRouteFilterCandidate) => void;
  onClear: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const activeFilterCount = getActiveFilterCount(filters);
  const getInitialFocusedRegion = () =>
    filters.places[0]?.region ??
    (placeRegions.some((placeRegion) => placeRegion.region === defaultRegion)
      ? defaultRegion
      : (placeRegions[0]?.region ?? defaultRegion));
  const [focusedRegion, setFocusedRegion] = useState(getInitialFocusedRegion);
  const focusedRegionOption = placeRegions.find(
    (placeRegion) => placeRegion.region === focusedRegion
  );
  const focusedRegionPlaceCategoriesQuery = useQuery({
    queryKey: ["shared-route-filter-places", focusedRegion],
    enabled: Boolean(focusedRegion && TOUR_API_SERVICE_KEY),
    queryFn: () => fetchRegionFilterPlaceCategories(focusedRegion),
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const focusedRegionCategories = mergePlaceCategories(
    focusedRegionOption?.categories ?? [],
    focusedRegionPlaceCategoriesQuery.data ?? []
  );
  const focusedRegionSelectedCount = filters.places.filter(
    (place) => place.region === focusedRegion
  ).length;
  const shouldShowFocusedRegionLoading =
    Boolean(focusedRegion && TOUR_API_SERVICE_KEY) &&
    focusedRegionPlaceCategoriesQuery.isFetching &&
    focusedRegionCategories.length === 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    setFocusedRegion((currentRegion) => {
      if (
        currentRegion &&
        placeRegions.some((placeRegion) => placeRegion.region === currentRegion)
      ) {
        return currentRegion;
      }

      return getInitialFocusedRegion();
    });
  }, [defaultRegion, filters.places, placeRegions]);

  const renderFilterButton = (filter: SharedRouteFilterCandidate) => {
    const isSelected = hasFilterCandidate(filters, filter);
    const Icon = filter.type === "tag" ? MdSell : MdOutlinePlace;

    return (
      <button
        key={
          filter.type === "place"
            ? `${filter.type}:${filter.region}:${filter.value}`
            : `${filter.type}:${filter.value}`
        }
        type="button"
        aria-pressed={isSelected}
        onClick={() => onToggle(filter)}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
          isSelected
            ? "border-brand-500 bg-brand-600 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
        }`}
      >
        <Icon className="shrink-0 text-sm" />
        <span className="min-w-0 truncate">{filter.value}</span>
      </button>
    );
  };

  return (
    <div
      className="shared-route-filter-backdrop-enter fixed inset-0 z-[2700] flex items-end justify-center bg-slate-950/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-route-filter-title"
        className="shared-route-filter-panel-enter max-h-[min(82vh,42rem)] w-full max-w-sm overflow-hidden rounded-[1.4rem] border border-brand-200 bg-white shadow-2xl dark:border-brand-400/30 dark:bg-[#102a27]"
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
              <MdFilterAlt />
            </span>
            <div className="min-w-0">
              <h2
                id="shared-route-filter-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                필터 옵션
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                태그를 고르거나, 지역을 누른 뒤 해당 지역의 장소를 선택해요.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="필터 닫기"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200"
          >
            <MdClose />
          </button>
        </div>

        <div className="max-h-[52vh] space-y-5 overflow-y-auto px-4 pb-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-800 dark:text-white">
                태그 필터
              </p>
              <p className="text-xs font-bold text-slate-400">
                {filters.tags.length}개
              </p>
            </div>
            {tagOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) =>
                  renderFilterButton({ type: "tag", value: tag })
                )}
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500 dark:border-brand-400/20 dark:bg-[#0b211f] dark:text-slate-300">
                선택할 태그가 없어요.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-800 dark:text-white">
                장소 필터
              </p>
              <p className="text-xs font-bold text-slate-400">
                {filters.places.length}개
              </p>
            </div>
            {placeRegions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {placeRegions.map(({ region }) => {
                    const isFocused = region === focusedRegion;

                    return (
                      <button
                        key={region}
                        type="button"
                        aria-pressed={isFocused}
                        onClick={() => setFocusedRegion(region)}
                        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                          isFocused
                            ? "border-brand-500 bg-brand-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
                        }`}
                      >
                        <MdOutlinePlace className="shrink-0 text-sm" />
                        <span className="min-w-0 truncate">{region}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-brand-400/20 dark:bg-[#0b211f]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-black text-slate-700 dark:text-slate-100">
                      {focusedRegion ? `${focusedRegion} 장소` : "지역 선택"}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400">
                      {focusedRegionSelectedCount}개 선택
                    </p>
                  </div>
                  {focusedRegion && focusedRegionCategories.length > 0 ? (
                    <div className="space-y-4">
                      {focusedRegionCategories.map(({ category, places }) => (
                        <div key={`${focusedRegion}:${category}`} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="shrink-0 text-xs font-black text-slate-700 dark:text-slate-100">
                              {category}
                            </p>
                            <span className="h-px flex-1 bg-slate-200 dark:bg-brand-400/20" />
                            <p className="shrink-0 text-[11px] font-bold text-slate-400">
                              {places.length}곳
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {places.map((placeName) =>
                              renderFilterButton({
                                type: "place",
                                value: placeName,
                                region: focusedRegion,
                              })
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : shouldShowFocusedRegionLoading ? (
                    <p className="px-1 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      이 지역의 명소를 불러오는 중이에요.
                    </p>
                  ) : (
                    <p className="px-1 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      이 지역의 명소를 찾지 못했어요.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500 dark:border-brand-400/20 dark:bg-[#0b211f] dark:text-slate-300">
                선택할 장소가 없어요.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[auto,1fr] gap-2 border-t border-slate-100 p-4 dark:border-brand-400/20">
          <button
            type="button"
            onClick={onClear}
            disabled={activeFilterCount === 0}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-500 disabled:opacity-40 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            확인{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
          </button>
        </div>
      </section>
    </div>
  );
}

function SharedRoutePage({ mode = "feed" }: SharedRoutePageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const [likedRouteIds, setLikedRouteIds] = useState<Set<string>>(new Set());
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [checkoutRoutePlan, setCheckoutRoutePlan] = useState<
    PlannedRouteDay[] | null
  >(null);
  const [sortKey, setSortKey] = useState<SharedRouteSortKey>("shared-desc");
  const [activeFilters, setActiveFilters] = useState<SharedRouteFilters>(
    EMPTY_SHARED_ROUTE_FILTERS
  );
  const [draftFilters, setDraftFilters] = useState<SharedRouteFilters>(
    EMPTY_SHARED_ROUTE_FILTERS
  );
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [defaultFilterRegion, setDefaultFilterRegion] = useState<
    (typeof GANGWON_REGION_LABELS)[number]
  >(DEFAULT_FILTER_REGION);
  const pendingLikeRouteIdsRef = useRef<Set<string>>(new Set());
  const [pendingLikeRouteIds, setPendingLikeRouteIds] = useState<Set<string>>(
    new Set()
  );
  const pageCopy = PAGE_COPY[mode];
  const routeListQueryKey =
    mode === "liked" ? LIKED_SHARED_ROUTES_QUERY_KEY : SHARED_ROUTES_QUERY_KEY;
  const routeListQuery = useQuery<SharedRouteListData>({
    queryKey: routeListQueryKey,
    queryFn: async () =>
      mode === "liked"
        ? routeApi.likedSharedRoutes()
        : routeApi.sharedRoutes(),
  });
  const routes = useMemo(
    () => getSharedRouteList(routeListQuery.data, mode),
    [routeListQuery.data, mode]
  );
  const filterOptions = useMemo(
    () => getSharedRouteFilterOptions(routes),
    [routes]
  );
  const activeFilterCount = getActiveFilterCount(activeFilters);
  const filteredRoutes = useMemo(() => {
    return routes
      .filter((route) => routeMatchesFilters(route, activeFilters))
      .sort((left, right) => {
        if (sortKey === "likes-desc" || sortKey === "likes-asc") {
          const likeCountDifference =
            sortKey === "likes-desc"
              ? right.likeCount - left.likeCount
              : left.likeCount - right.likeCount;

          return (
            likeCountDifference ||
            getRouteSortTime(right) - getRouteSortTime(left)
          );
        }

        const sharedTimeDifference =
          sortKey === "shared-desc"
            ? getRouteSortTime(right) - getRouteSortTime(left)
            : getRouteSortTime(left) - getRouteSortTime(right);

        return sharedTimeDifference || right.likeCount - left.likeCount;
      });
  }, [activeFilters, routes, sortKey]);
  const selectedRouteQuery = useQuery({
    queryKey: ["route-detail", selectedRouteId],
    enabled: Boolean(selectedRouteId),
    queryFn: async () => {
      if (!selectedRouteId) {
        throw new Error("선택한 공유 루트가 없습니다.");
      }

      const result = await routeApi.routeById(selectedRouteId);

      if (!result.route) {
        throw new Error("공유 루트를 찾지 못했어요.");
      }

      return result;
    },
  });
  const selectedRoute = selectedRouteQuery.data?.route ?? null;
  const selectedRouteDay = selectedRoute
    ? (getSortedRouteDays(selectedRoute)[0] ?? null)
    : null;
  const checkoutSavedPlaces = useMemo(
    () => (checkoutRoutePlan ? createSavedPlacesFromRoutePlan(checkoutRoutePlan) : []),
    [checkoutRoutePlan]
  );
  const checkoutCandidatePlaces = useMemo(
    () => checkoutSavedPlaces.map((item) => item.place),
    [checkoutSavedPlaces]
  );
  const checkoutStartLocation = useMemo(
    () => (checkoutRoutePlan ? getRoutePlanStartLocation(checkoutRoutePlan) : null),
    [checkoutRoutePlan]
  );
  const checkoutTripDays = useMemo(
    () => (checkoutRoutePlan ? getRoutePlanTripDays(checkoutRoutePlan) : 1),
    [checkoutRoutePlan]
  );

  useEffect(() => {
    let isMounted = true;

    getCurrentPosition()
      .then((position) => {
        if (!isMounted) {
          return;
        }

        setDefaultFilterRegion(
          getNearestGangwonRegion({
            lat: position.lat,
            lng: position.lng,
          })
        );
      })
      .catch(() => {
        if (isMounted) {
          setDefaultFilterRegion(DEFAULT_FILTER_REGION);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!routeListQuery.data) {
      return;
    }

    setLikedRouteIds((currentIds) => {
      const nextIds = new Set(currentIds);

      routes.forEach((route) => {
        if (route.likedByMe) {
          nextIds.add(route.id);
        } else {
          nextIds.delete(route.id);
        }
      });

      return nextIds;
    });
  }, [routeListQuery.data, routes]);

  const setLikePending = (routeId: string, pending: boolean) => {
    const nextIds = new Set(pendingLikeRouteIdsRef.current);

    if (pending) {
      nextIds.add(routeId);
    } else {
      nextIds.delete(routeId);
    }

    pendingLikeRouteIdsRef.current = nextIds;
    setPendingLikeRouteIds(nextIds);
  };

  const handleToggleLike = async (route: RouteSummaryFieldsFragment) => {
    if (route.isMine || pendingLikeRouteIdsRef.current.has(route.id)) {
      return;
    }

    const wasLiked = likedRouteIds.has(route.id) || route.likedByMe;
    const nextLiked = !wasLiked;
    const previousLikeCount = route.likeCount;
    const keepUnlikedRoute = mode === "liked";
    const previousLikedRoutes =
      queryClient.getQueryData<LikedSharedRoutesQuery>(
        LIKED_SHARED_ROUTES_QUERY_KEY
      );

    setLikePending(route.id, true);
    await Promise.all([
      queryClient.cancelQueries({
        queryKey: SHARED_ROUTES_QUERY_KEY,
      }),
      queryClient.cancelQueries({
        queryKey: LIKED_SHARED_ROUTES_QUERY_KEY,
      }),
    ]);

    setLikedRouteIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextLiked) {
        nextIds.add(route.id);
      } else {
        nextIds.delete(route.id);
      }

      return nextIds;
    });
    queryClient.setQueriesData<SharedRoutesQuery>(
      {
        queryKey: SHARED_ROUTES_QUERY_KEY,
      },
      (currentData) =>
        optimisticUpdateSharedRouteLikeCache({
          data: currentData,
          routeId: route.id,
          liked: nextLiked,
        })
    );
    queryClient.setQueryData<LikedSharedRoutesQuery>(
      LIKED_SHARED_ROUTES_QUERY_KEY,
      (currentData) =>
        optimisticUpdateLikedSharedRouteLikeCache({
          data: currentData,
          route,
          liked: nextLiked,
          keepUnlikedRoute,
        })
    );
    queryClient.setQueryData<RouteByIdQuery>(
      getRouteDetailQueryKey(route.id),
      (currentData) =>
        currentData?.route
          ? {
              ...currentData,
              route: {
                ...currentData.route,
                likedByMe: nextLiked,
                likeCount: Math.max(
                  0,
                  currentData.route.likeCount + (nextLiked ? 1 : -1)
                ),
              },
            }
          : currentData
    );

    try {
      const interaction = nextLiked
        ? (await routeApi.likeRoute(route.id)).likeRoute
        : (await routeApi.unlikeRoute(route.id)).unlikeRoute;

      setLikedRouteIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (interaction.liked) {
          nextIds.add(route.id);
        } else {
          nextIds.delete(route.id);
        }

        return nextIds;
      });
      queryClient.setQueriesData<SharedRoutesQuery>(
        {
          queryKey: SHARED_ROUTES_QUERY_KEY,
        },
        (currentData) =>
          upsertSharedRouteSummaryCache(currentData, interaction.route)
      );
      queryClient.setQueryData<LikedSharedRoutesQuery>(
        LIKED_SHARED_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertLikedSharedRouteSummaryCache(
            currentData,
            interaction.route,
            interaction.liked,
            {
              keepUnlikedRoute,
            }
          )
      );
      queryClient.setQueryData<RouteByIdQuery>(
        getRouteDetailQueryKey(route.id),
        (currentData) =>
          currentData?.route
            ? {
                ...currentData,
                route: {
                  ...currentData.route,
                  ...interaction.route,
                  likedByMe: interaction.liked,
                },
              }
            : currentData
      );
    } catch (error) {
      setLikedRouteIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (wasLiked) {
          nextIds.add(route.id);
        } else {
          nextIds.delete(route.id);
        }

        return nextIds;
      });
      queryClient.setQueriesData<SharedRoutesQuery>(
        {
          queryKey: SHARED_ROUTES_QUERY_KEY,
        },
        (currentData) =>
          optimisticUpdateSharedRouteLikeCache({
            data: currentData,
            routeId: route.id,
            liked: wasLiked,
            likeCount: previousLikeCount,
          })
      );
      if (previousLikedRoutes) {
        queryClient.setQueryData<LikedSharedRoutesQuery>(
          LIKED_SHARED_ROUTES_QUERY_KEY,
          previousLikedRoutes
        );
      }
      queryClient.setQueryData<RouteByIdQuery>(
        getRouteDetailQueryKey(route.id),
        (currentData) =>
          currentData?.route
            ? {
                ...currentData,
                route: {
                  ...currentData.route,
                  likedByMe: wasLiked,
                  likeCount: previousLikeCount,
                },
              }
            : currentData
      );
      showToast(
        error instanceof Error ? error.message : "좋아요를 반영하지 못했어요.",
        2400
      );
    } finally {
      setLikePending(route.id, false);
    }
  };
  const handleRequestCheckoutFromSharedRoute = (
    routePlan: PlannedRouteDay[]
  ) => {
    setCheckoutRoutePlan(routePlan);
  };
  const handleCloseCheckout = () => {
    setCheckoutRoutePlan(null);
  };
  const openFilterDialog = () => {
    setDraftFilters(activeFilters);
    setIsFilterDialogOpen(true);
  };
  const openFilterDialogWithCandidate = (
    filter: SharedRouteFilterCandidate
  ) => {
    setDraftFilters(addFilterCandidate(activeFilters, filter));
    setIsFilterDialogOpen(true);
  };
  const handleToggleDraftFilter = (filter: SharedRouteFilterCandidate) => {
    setDraftFilters((currentFilters) =>
      toggleFilterCandidate(currentFilters, filter)
    );
  };
  const handleApplyFilters = () => {
    setActiveFilters(draftFilters);
    setIsFilterDialogOpen(false);
  };
  const handleClearDraftFilters = () => {
    setDraftFilters(EMPTY_SHARED_ROUTE_FILTERS);
  };
  const handleRemoveActiveFilter = (filter: SharedRouteFilterCandidate) => {
    setActiveFilters((currentFilters) =>
      removeFilterCandidate(currentFilters, filter)
    );
  };
  const handleClearActiveFilters = () => {
    setActiveFilters(EMPTY_SHARED_ROUTE_FILTERS);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      {mode === "liked" ? (
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label="내 정보로 돌아가기"
            onClick={() => navigate("/me")}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdArrowBack />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black text-brand-700">내 정보</p>
            <h1 className="truncate text-lg font-bold text-slate-900">
              좋아요한 공유 루트
            </h1>
          </div>
        </header>
      ) : null}

      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
            {mode === "liked" ? <FaHeart /> : <MdOutlineHub />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {pageCopy.title}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {pageCopy.description}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DropdownSelect
            ariaLabel="공유 루트 정렬"
            options={SHARED_ROUTE_SORT_OPTIONS}
            value={sortKey}
            onChange={setSortKey}
            className="w-40 shrink-0"
            buttonClassName="min-h-10 rounded-full px-3 py-2 text-xs"
            menuClassName="left-0 right-auto"
          />
          <button
            type="button"
            onClick={openFilterDialog}
            className={`inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
              activeFilterCount > 0
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
            }`}
          >
            <MdFilterAlt className="shrink-0 text-sm" />
            <span className="truncate">
              필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
            </span>
          </button>
        </div>

        {activeFilterCount > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.tags.map((tag) => (
              <button
                key={`tag:${tag}`}
                type="button"
                onClick={() =>
                  handleRemoveActiveFilter({ type: "tag", value: tag })
                }
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-black text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
              >
                <MdSell className="shrink-0 text-xs" />
                <span className="min-w-0 truncate">
                  {getFilterLabel({ type: "tag", value: tag })}
                </span>
                <MdClose className="shrink-0 text-xs" />
              </button>
            ))}
            {activeFilters.places.map((place) => (
              <button
                key={`place:${place.region}:${place.name}`}
                type="button"
                onClick={() =>
                  handleRemoveActiveFilter({
                    type: "place",
                    value: place.name,
                    region: place.region,
                  })
                }
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
              >
                <MdOutlinePlace className="shrink-0 text-xs" />
                <span className="min-w-0 truncate">
                  {getFilterLabel({
                    type: "place",
                    value: place.name,
                    region: place.region,
                  })}
                </span>
                <MdClose className="shrink-0 text-xs" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearActiveFilters}
              className="inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-black text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
            >
              전체 해제
            </button>
          </div>
        ) : null}
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto px-px pb-4 pt-1">
        {routeListQuery.isLoading ? (
          <div className="flex min-h-full flex-col justify-center">
            <PotatoLoadingCard
              title={pageCopy.loadingTitle}
              description={pageCopy.loadingDescription}
              animation="map-thinking"
              compact
              className="shadow-sm"
            />
          </div>
        ) : null}

        {routeListQuery.isError ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
            {pageCopy.error}
          </div>
        ) : null}

        {!routeListQuery.isLoading &&
        !routeListQuery.isError &&
        routes.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <div className="rounded-2xl border border-brand-100 bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40 dark:text-slate-300">
              {pageCopy.empty}
            </div>
          </div>
        ) : null}

        {!routeListQuery.isLoading &&
        !routeListQuery.isError &&
        routes.length > 0 &&
        filteredRoutes.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <div className="rounded-2xl border border-brand-100 bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40 dark:text-slate-300">
              조건에 맞는 공유 루트가 없어요.
            </div>
          </div>
        ) : null}

        {filteredRoutes.map((route) => (
          <SharedRouteCard
            key={route.id}
            route={route}
            isLiked={likedRouteIds.has(route.id) || route.likedByMe}
            isLikePending={pendingLikeRouteIds.has(route.id)}
            onToggleLike={handleToggleLike}
            onOpen={(route) => setSelectedRouteId(route.id)}
            onRequestFilter={openFilterDialogWithCandidate}
          />
        ))}
      </div>
      {isFilterDialogOpen ? (
        <SharedRouteFilterDialog
          filters={draftFilters}
          tagOptions={filterOptions.tags}
          placeRegions={filterOptions.placeRegions}
          defaultRegion={defaultFilterRegion}
          onToggle={handleToggleDraftFilter}
          onClear={handleClearDraftFilters}
          onClose={() => setIsFilterDialogOpen(false)}
          onConfirm={handleApplyFilters}
        />
      ) : null}
      {selectedRouteId && selectedRouteQuery.isLoading ? (
        <SharedRouteDetailSkeleton onClose={() => setSelectedRouteId(null)} />
      ) : null}
      {selectedRouteId && selectedRouteQuery.isError ? (
        <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-white px-4 dark:bg-[#071718]">
          <div className="w-full max-w-sm rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center shadow-sm dark:border-rose-400/30 dark:bg-rose-950/30">
            <p className="text-sm font-bold text-rose-700 dark:text-rose-200">
              공유 루트 상세를 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={() => setSelectedRouteId(null)}
              className="mt-3 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
      {selectedRoute && selectedRouteDay ? (
        <DayRoutePopup
          route={selectedRoute}
          day={selectedRouteDay}
          isReadOnly
          headerLabel="SHARED ROUTE"
          headerBadge={selectedRoute.isMine ? "내 공유 루트" : undefined}
          enableStartPreview
          enableVerificationPhotoPreview
          onRequestCheckout={handleRequestCheckoutFromSharedRoute}
          readOnlyFooterAction={
            selectedRoute.isMine
              ? {
                  label: String(selectedRoute.likeCount),
                  ariaLabel: `내가 공유한 루트, 하트 ${selectedRoute.likeCount}개`,
                  icon: <FaHeart className="text-lg" />,
                  isActive: true,
                  disabled: true,
                  onClick: () => undefined,
                }
              : {
                  label: String(selectedRoute.likeCount),
                  ariaLabel:
                    likedRouteIds.has(selectedRoute.id) ||
                    selectedRoute.likedByMe
                      ? `좋아요 취소, 하트 ${selectedRoute.likeCount}개`
                      : `좋아요, 하트 ${selectedRoute.likeCount}개`,
                  icon:
                    likedRouteIds.has(selectedRoute.id) ||
                    selectedRoute.likedByMe ? (
                      <FaHeart className="text-lg" />
                    ) : (
                      <FaRegHeart className="text-lg" />
                    ),
                  isActive:
                    likedRouteIds.has(selectedRoute.id) ||
                    selectedRoute.likedByMe,
                  disabled: pendingLikeRouteIds.has(selectedRoute.id),
                  onClick: () => void handleToggleLike(selectedRoute),
                }
          }
          onClose={() => setSelectedRouteId(null)}
        />
      ) : null}
      <RouteCheckoutModal
        isOpen={Boolean(checkoutRoutePlan)}
        savedPlaces={checkoutSavedPlaces}
        insertCandidatePlaces={checkoutCandidatePlaces}
        currentLocation={checkoutStartLocation}
        initialStep="schedule"
        initialTripDays={checkoutTripDays}
        initialRoutePlan={checkoutRoutePlan}
        onClose={handleCloseCheckout}
        onSelectPlace={() => undefined}
        onRemovePlace={() => undefined}
        onClearPlaces={handleCloseCheckout}
        onRequestSearchPlace={() => {
          handleCloseCheckout();
          navigate("/");
        }}
      />
    </section>
  );
}

export default SharedRoutePage;
