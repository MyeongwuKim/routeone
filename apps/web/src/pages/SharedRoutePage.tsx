import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import {
  MdArrowBack,
  MdClose,
  MdFilterAlt,
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
import {
  cacheTourCategoryLocalizationMap,
  localizeTourPlaces,
  readCachedTourCategoryLocalizationMap,
} from "@/lib/placeLocalization";
import type {
  LikedSharedRouteConnectionQuery,
  RouteByIdQuery,
  RouteSummaryFieldsFragment,
  SharedRouteConnectionQuery,
} from "@/generated/graphql";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import {
  useAppLanguageStore,
  type AppLanguage,
} from "@/stores/appLanguageStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  localizePlaceCategoryLabel,
  useUiText,
  type UiText,
} from "@/lib/uiText";

const getRouteDetailQueryKey = (routeId: string) =>
  ["route-detail", routeId] as const;
const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;

type SharedRoutePageMode = "feed" | "liked";

type SharedRoutePageProps = {
  mode?: SharedRoutePageMode;
};

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
function getSharedRouteSortOptions(
  text: UiText
): ReadonlyArray<DropdownSelectOption<SharedRouteSortKey>> {
  return [
    {
      value: "shared-desc",
      label: text.sharedRoute.sortSharedDescLabel,
      description: text.sharedRoute.sortSharedDescDescription,
    },
    {
      value: "shared-asc",
      label: text.sharedRoute.sortSharedAscLabel,
      description: text.sharedRoute.sortSharedAscDescription,
    },
    {
      value: "likes-desc",
      label: text.sharedRoute.sortLikesDescLabel,
      description: text.sharedRoute.sortLikesDescDescription,
    },
    {
      value: "likes-asc",
      label: text.sharedRoute.sortLikesAscLabel,
      description: text.sharedRoute.sortLikesAscDescription,
    },
  ];
}
const DEFAULT_FILTER_REGION: (typeof GANGWON_REGION_LABELS)[number] = "강릉";
const SHARED_ROUTE_PAGE_SIZE = 20;
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

function getSharedRoutePageCopy(text: UiText, mode: SharedRoutePageMode) {
  return mode === "liked"
    ? {
        title: text.sharedRoute.likedTitle,
        description: text.sharedRoute.likedDescription,
        error: text.sharedRoute.likedError,
        empty: text.sharedRoute.likedEmpty,
      }
    : {
        title: text.sharedRoute.feedTitle,
        description: text.sharedRoute.feedDescription,
        error: text.sharedRoute.feedError,
        empty: text.sharedRoute.feedEmpty,
      };
}

type SharedRouteConnectionPage =
  | SharedRouteConnectionQuery
  | LikedSharedRouteConnectionQuery;
type SharedRouteInfiniteData = InfiniteData<
  SharedRouteConnectionPage,
  string | null
>;

function getSharedRouteConnection(
  page: SharedRouteConnectionPage,
  mode: SharedRoutePageMode
) {
  return mode === "liked"
    ? (page as LikedSharedRouteConnectionQuery).likedRouteConnection
    : (page as SharedRouteConnectionQuery).sharedRouteConnection;
}

function getSharedRouteInfiniteList(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode
) {
  return (
    data?.pages.flatMap((page) => getSharedRouteConnection(page, mode).nodes) ??
    []
  );
}

function mapSharedRouteConnectionPage(
  page: SharedRouteConnectionPage,
  mode: SharedRoutePageMode,
  mapper: (routes: SharedRoute[]) => SharedRoute[]
): SharedRouteConnectionPage {
  if (mode === "liked") {
    const likedPage = page as LikedSharedRouteConnectionQuery;

    return {
      ...likedPage,
      likedRouteConnection: {
        ...likedPage.likedRouteConnection,
        nodes: mapper(likedPage.likedRouteConnection.nodes),
      },
    };
  }

  const sharedPage = page as SharedRouteConnectionQuery;

  return {
    ...sharedPage,
    sharedRouteConnection: {
      ...sharedPage.sharedRouteConnection,
      nodes: mapper(sharedPage.sharedRouteConnection.nodes),
    },
  };
}

function updateSharedRouteInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  mapper: (routes: SharedRoute[]) => SharedRoute[]
) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) =>
      mapSharedRouteConnectionPage(page, mode, mapper)
    ),
  };
}

function upsertSharedRouteInInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  nextRoute: RouteSummaryFieldsFragment,
  options: {
    liked?: boolean;
    keepUnlikedRoute?: boolean;
    likeCount?: number;
  } = {}
) {
  if (!data || nextRoute.visibility !== "PUBLIC") {
    return data;
  }

  const nextLiked = options.liked ?? nextRoute.likedByMe;
  const routeForCache = {
    ...nextRoute,
    likedByMe: nextLiked,
    likeCount: options.likeCount ?? nextRoute.likeCount,
  };
  const hasRoute = data.pages.some((page) =>
    getSharedRouteConnection(page, mode).nodes.some(
      (route) => route.id === nextRoute.id
    )
  );

  if (mode === "liked" && !nextLiked && !options.keepUnlikedRoute) {
    return updateSharedRouteInfiniteData(data, mode, (routes) =>
      routes.filter((route) => route.id !== nextRoute.id)
    );
  }

  if (hasRoute) {
    return updateSharedRouteInfiniteData(data, mode, (routes) =>
      routes.map((route) =>
        route.id === nextRoute.id ? { ...route, ...routeForCache } : route
      )
    );
  }

  if (data.pages.length === 0) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page, index) =>
      index === 0
        ? mapSharedRouteConnectionPage(page, mode, (routes) => [
            { ...routeForCache, stops: [] },
            ...routes,
          ])
        : page
    ),
  };
}

function optimisticUpdateSharedRouteInfiniteLike({
  data,
  mode,
  route,
  liked,
  likeCount,
  keepUnlikedRoute = false,
}: {
  data: SharedRouteInfiniteData | undefined;
  mode: SharedRoutePageMode;
  route: RouteSummaryFieldsFragment;
  liked: boolean;
  likeCount?: number;
  keepUnlikedRoute?: boolean;
}) {
  const nextLikeCount =
    likeCount ??
    Math.max(0, route.likeCount + (liked ? (route.likedByMe ? 0 : 1) : -1));

  return upsertSharedRouteInInfiniteData(
    data,
    mode,
    {
      ...route,
      likedByMe: liked,
      likeCount: nextLikeCount,
    },
    {
      liked,
      keepUnlikedRoute,
      likeCount: nextLikeCount,
    }
  );
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
    getPlaceCategoryLabel(attraction)
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

async function fetchRegionFilterPlaceCategories(
  region: string,
  language: AppLanguage
) {
  const sigunguCode = getRegionSigunguCode(region);

  if (!TOUR_API_SERVICE_KEY || !sigunguCode) {
    return [];
  }

  const lclsNameByCode = await fetchLclsSystemNameMap(
    TOUR_API_SERVICE_KEY,
    language
  )
    .then((codeNameMap) => {
      void cacheTourCategoryLocalizationMap(codeNameMap, language);
      return codeNameMap;
    })
    .catch(async (error) => {
      const cachedCodeNameMap =
        await readCachedTourCategoryLocalizationMap(language);

      if (Object.keys(cachedCodeNameMap).length > 0) {
        return cachedCodeNameMap;
      }

      throw error;
    });
  lclsNameByCode[CAFE_LCLS_CODE] =
    lclsNameByCode[CAFE_LCLS_CODE] || (language === "en" ? "Cafe" : "카페");
  void cacheTourCategoryLocalizationMap(lclsNameByCode, language);

  const [attractions, festivals] = await Promise.all([
    fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
      sigunguCode,
      contentTypeIds: ["12", "39"],
    }, "ko"),
    fetchGangwonFestivals(TOUR_API_SERVICE_KEY, {
      sigunguCode,
      lookAheadDays: 90,
    }, "ko").catch(() => [] as GangwonAttraction[]),
  ]);

  const filteredAttractions = dedupeAttractionsByPlace([
    ...attractions,
    ...festivals,
  ]).filter(
    (attraction) => !shouldHideFilterAttraction(attraction, lclsNameByCode)
  );
  const displayAttractions = await localizeTourPlaces(
    filteredAttractions,
    language
  );

  return groupPlaceOptionsByCategory(
    displayAttractions.map((attraction) =>
        createFilterPlaceOptionFromAttraction(
          attraction,
          region,
          lclsNameByCode
        )
      )
  );
}

function getFilterLabel(filter: SharedRouteFilterCandidate, text: UiText) {
  if (filter.type === "tag") {
    return text.sharedRoute.filterTagLabel(filter.value);
  }

  return text.sharedRoute.filterPlaceLabel(filter.value);
}

function getLocalizedRegionName(regionName: string, text: UiText) {
  return text.labels.regions[regionName] ?? regionName;
}

function getLocalizedPlaceCategory(category: string, text: UiText) {
  return localizePlaceCategoryLabel(category, text);
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
  filters: SharedRouteFilters,
  text: UiText
) {
  if (getActiveFilterCount(filters) === 0) {
    return true;
  }

  const routeTags = getDisplayShareTags(route, text);
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

function getSharedRouteFilterOptions(
  routes: SharedRoute[],
  text: UiText
): SharedRouteFilterOptions {
  const tagOptions = new Set<string>();
  const placeOptionsByRegion = new Map<string, Map<string, Set<string>>>();

  routes.forEach((route) => {
    getDisplayShareTags(route, text).forEach((tag) => tagOptions.add(tag));
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
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
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
    queryKey: ["shared-route-filter-places", focusedRegion, appLanguage],
    enabled: Boolean(focusedRegion && TOUR_API_SERVICE_KEY),
    queryFn: () =>
      fetchRegionFilterPlaceCategories(focusedRegion, appLanguage),
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
                {text.sharedRoute.filterTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {text.sharedRoute.filterDescription}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={text.sharedRoute.filterClose}
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
                {text.sharedRoute.tagFilter}
              </p>
              <p className="text-xs font-bold text-slate-400">
                {text.myRoute.count(filters.tags.length)}
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
                {text.sharedRoute.noTags}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-800 dark:text-white">
                {text.sharedRoute.placeFilter}
              </p>
              <p className="text-xs font-bold text-slate-400">
                {text.myRoute.count(filters.places.length)}
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
                        <span className="min-w-0 truncate">
                          {getLocalizedRegionName(region, text)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-brand-400/20 dark:bg-[#0b211f]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-black text-slate-700 dark:text-slate-100">
                      {focusedRegion
                        ? text.sharedRoute.regionPlaces(
                            getLocalizedRegionName(focusedRegion, text)
                          )
                        : text.sharedRoute.chooseRegion}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400">
                      {text.sharedRoute.selectedCount(
                        focusedRegionSelectedCount
                      )}
                    </p>
                  </div>
                  {focusedRegion && focusedRegionCategories.length > 0 ? (
                    <div className="space-y-4">
                      {focusedRegionCategories.map(({ category, places }) => (
                        <div key={`${focusedRegion}:${category}`} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="shrink-0 text-xs font-black text-slate-700 dark:text-slate-100">
                              {getLocalizedPlaceCategory(category, text)}
                            </p>
                            <span className="h-px flex-1 bg-slate-200 dark:bg-brand-400/20" />
                            <p className="shrink-0 text-[11px] font-bold text-slate-400">
                              {text.sharedRoute.placeCount(places.length)}
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
                  ) : shouldShowFocusedRegionLoading ? null : (
                    <p className="px-1 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {text.sharedRoute.noRegionPlaces}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500 dark:border-brand-400/20 dark:bg-[#0b211f] dark:text-slate-300">
                {text.sharedRoute.noPlaces}
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
            {text.common.reset}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            {text.sharedRoute.apply(activeFilterCount)}
          </button>
        </div>
      </section>
    </div>
  );
}

function SharedRoutePage({ mode = "feed" }: SharedRoutePageProps) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
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
  const routeListScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const pendingLikeRouteIdsRef = useRef<Set<string>>(new Set());
  const [pendingLikeRouteIds, setPendingLikeRouteIds] = useState<Set<string>>(
    new Set()
  );
  const pageCopy = getSharedRoutePageCopy(text, mode);
  const sortOptions = useMemo(() => getSharedRouteSortOptions(text), [text]);
  const routeListQueryKey =
    mode === "liked" ? LIKED_SHARED_ROUTES_QUERY_KEY : SHARED_ROUTES_QUERY_KEY;
  const routeListQuery = useInfiniteQuery({
    queryKey: routeListQueryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      mode === "liked"
        ? routeApi.likedSharedRouteConnection({
            limit: SHARED_ROUTE_PAGE_SIZE,
            cursor: pageParam,
          })
        : routeApi.sharedRouteConnection({
            limit: SHARED_ROUTE_PAGE_SIZE,
            cursor: pageParam,
          }),
    getNextPageParam: (lastPage) => {
      const pageInfo = getSharedRouteConnection(lastPage, mode).pageInfo;

      return pageInfo.hasNextPage ? pageInfo.endCursor : undefined;
    },
  });
  const routes = useMemo(
    () =>
      getSharedRouteInfiniteList(
        routeListQuery.data as SharedRouteInfiniteData | undefined,
        mode
      ),
    [routeListQuery.data, mode]
  );
  const filterOptions = useMemo(
    () => getSharedRouteFilterOptions(routes, text),
    [routes, text]
  );
  const activeFilterCount = getActiveFilterCount(activeFilters);
  const filteredRoutes = useMemo(() => {
    return routes
      .filter((route) => routeMatchesFilters(route, activeFilters, text))
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
  }, [activeFilters, routes, sortKey, text]);
  const canShowEmptyRoutes =
    !routeListQuery.isLoading &&
    !routeListQuery.isError &&
    !routeListQuery.hasNextPage &&
    !routeListQuery.isFetchingNextPage;
  const shouldSearchMoreForActiveFilters =
    activeFilterCount > 0 &&
    routes.length > 0 &&
    filteredRoutes.length === 0 &&
    Boolean(routeListQuery.hasNextPage) &&
    !routeListQuery.isFetchingNextPage;
  const shouldShowBottomLoadingCard =
    routeListQuery.isFetchingNextPage ||
    shouldSearchMoreForActiveFilters;
  const selectedRouteQuery = useQuery({
    queryKey: ["route-detail", selectedRouteId],
    enabled: Boolean(selectedRouteId),
    queryFn: async () => {
      if (!selectedRouteId) {
        throw new Error(text.sharedRoute.selectedRouteMissing);
      }

      const result = await routeApi.routeById(selectedRouteId);

      if (!result.route) {
        throw new Error(text.sharedRoute.routeNotFound);
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
    setActiveFilters(EMPTY_SHARED_ROUTE_FILTERS);
    setDraftFilters(EMPTY_SHARED_ROUTE_FILTERS);
    setIsFilterDialogOpen(false);
  }, [appLanguage]);

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

  useEffect(() => {
    const root = routeListScrollRef.current;
    const target = loadMoreTriggerRef.current;

    if (!target || !routeListQuery.hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (
          isVisible &&
          routeListQuery.hasNextPage &&
          !routeListQuery.isFetchingNextPage
        ) {
          void routeListQuery.fetchNextPage();
        }
      },
      {
        root,
        rootMargin: "180px 0px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [
    routeListQuery.fetchNextPage,
    routeListQuery.hasNextPage,
    routeListQuery.isFetchingNextPage,
  ]);

  useEffect(() => {
    if (!shouldSearchMoreForActiveFilters) {
      return;
    }

    void routeListQuery.fetchNextPage();
  }, [routeListQuery.fetchNextPage, shouldSearchMoreForActiveFilters]);

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
      queryClient.getQueryData<SharedRouteInfiniteData>(
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
    queryClient.setQueriesData<SharedRouteInfiniteData>(
      {
        queryKey: SHARED_ROUTES_QUERY_KEY,
      },
      (currentData) =>
        optimisticUpdateSharedRouteInfiniteLike({
          data: currentData,
          mode: "feed",
          route,
          liked: nextLiked,
        })
    );
    queryClient.setQueryData<SharedRouteInfiniteData>(
      LIKED_SHARED_ROUTES_QUERY_KEY,
      (currentData) =>
        optimisticUpdateSharedRouteInfiniteLike({
          data: currentData,
          mode: "liked",
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
      queryClient.setQueriesData<SharedRouteInfiniteData>(
        {
          queryKey: SHARED_ROUTES_QUERY_KEY,
        },
        (currentData) =>
          upsertSharedRouteInInfiniteData(
            currentData,
            "feed",
            interaction.route,
            {
              liked: interaction.liked,
            }
          )
      );
      queryClient.setQueryData<SharedRouteInfiniteData>(
        LIKED_SHARED_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertSharedRouteInInfiniteData(
            currentData,
            "liked",
            interaction.route,
            {
              liked: interaction.liked,
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
      queryClient.setQueriesData<SharedRouteInfiniteData>(
        {
          queryKey: SHARED_ROUTES_QUERY_KEY,
        },
        (currentData) =>
          optimisticUpdateSharedRouteInfiniteLike({
            data: currentData,
            mode: "feed",
            route,
            liked: wasLiked,
            likeCount: previousLikeCount,
          })
      );
      if (previousLikedRoutes) {
        queryClient.setQueryData<SharedRouteInfiniteData>(
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
        error instanceof Error ? error.message : text.sharedRoute.likeError,
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
            aria-label={text.sharedRoute.likedBackAria}
            onClick={() => navigate("/me")}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdArrowBack />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black text-brand-700">
              {text.routeShell.myInfoTitle}
            </p>
            <h1 className="truncate text-lg font-bold text-slate-900">
              {text.sharedRoute.likedTitle}
            </h1>
          </div>
        </header>
      ) : null}

      {mode === "liked" ? (
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
              <FaHeart />
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
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DropdownSelect
            ariaLabel={text.sharedRoute.sortAria}
            options={sortOptions}
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
              {text.sharedRoute.filterButton(activeFilterCount)}
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
                  {getFilterLabel({ type: "tag", value: tag }, text)}
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
                  {getFilterLabel(
                    {
                      type: "place",
                      value: place.name,
                      region: place.region,
                    },
                    text
                  )}
                </span>
                <MdClose className="shrink-0 text-xs" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearActiveFilters}
              className="inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-black text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
            >
              {text.sharedRoute.clearActiveFilters}
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={routeListScrollRef}
        className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto px-px pb-4 pt-1"
      >
        {routeListQuery.isError ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
            {pageCopy.error}
          </div>
        ) : null}

        {routeListQuery.isLoading && routes.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <PotatoLoadingCard
              title={
                mode === "liked"
                  ? text.sharedRoute.loadingLiked
                  : text.sharedRoute.loadingFeed
              }
              animation="running"
              compact
              className="shadow-sm"
            />
          </div>
        ) : null}

        {canShowEmptyRoutes && routes.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <PotatoLoadingCard
              title={pageCopy.empty}
              description={
                mode === "liked"
                  ? text.sharedRoute.emptyLikedDescription
                  : text.sharedRoute.emptyFeedDescription
              }
              footerText={
                mode === "liked"
                  ? text.sharedRoute.emptyLikedFooter
                  : text.sharedRoute.emptyFeedFooter
              }
              animation="empty"
              compact
              className="shadow-sm"
            />
          </div>
        ) : null}

        {canShowEmptyRoutes && routes.length > 0 && filteredRoutes.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <PotatoLoadingCard
              title={text.sharedRoute.noFilteredTitle}
              description={text.sharedRoute.noFilteredDescription}
              footerText={text.sharedRoute.noFilteredFooter}
              animation="empty"
              compact
              className="shadow-sm"
            />
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

        {routeListQuery.hasNextPage ? (
          <div ref={loadMoreTriggerRef} className="h-8" aria-hidden="true" />
        ) : null}

        {shouldShowBottomLoadingCard ? (
          <div className="py-2">
            <PotatoLoadingCard
              title={
                activeFilterCount > 0 && filteredRoutes.length === 0
                  ? text.sharedRoute.searchingConditions
                  : text.sharedRoute.loadingNext
              }
              animation="running"
              compact
              className="shadow-sm"
            />
          </div>
        ) : null}
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
              {text.sharedRoute.detailError}
            </p>
            <button
              type="button"
              onClick={() => setSelectedRouteId(null)}
              className="mt-3 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white"
            >
              {text.common.close}
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
          headerBadge={selectedRoute.isMine ? text.sharedRoute.mineBadge : undefined}
          enableStartPreview
          enableVerificationPhotoPreview
          onRequestCheckout={handleRequestCheckoutFromSharedRoute}
          readOnlyFooterAction={
            selectedRoute.isMine
              ? {
                  label: String(selectedRoute.likeCount),
                  ariaLabel: text.sharedRoute.ownRouteLikeAria(
                    selectedRoute.likeCount
                  ),
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
                      ? text.sharedRoute.unlikeAria(selectedRoute.likeCount)
                      : text.sharedRoute.likeAria(selectedRoute.likeCount),
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
