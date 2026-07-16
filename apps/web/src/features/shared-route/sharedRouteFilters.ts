import {
  getDisplayPlaceOptions,
  getDisplayShareTags,
  type SharedRoute,
  type SharedRouteFilterCandidate,
  type SharedRoutePlaceFilterOption,
} from "./sharedRouteCardModel";
import {
  DEFAULT_GANGWON_REGION,
  GANGWON_REGION_CENTER_BY_LABEL,
  GANGWON_REGION_LABELS,
  GANGWON_SIGUNGU_CODE_BY_LABEL,
  type GangwonRegionLabel,
} from "@/data/gangwonRegions";
import {
  cacheTourCategoryLocalizationMap,
  localizeTourPlaces,
  readCachedTourCategoryLocalizationMap,
} from "@/lib/placeLocalization";
import {
  CAFE_LCLS_CODE,
  getPlaceCategoryLabel,
} from "@/lib/placeCategory";
import {
  fetchGangwonAttractions,
  fetchGangwonFestivals,
  fetchLclsSystemNameMap,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import {
  localizePlaceCategoryLabel,
  type UiText,
} from "@/lib/uiText";
import type { AppLanguage } from "@/stores/appLanguageStore";

const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;

export type SharedRouteFilters = {
  tags: string[];
  places: SharedRoutePlaceFilterOption[];
};

export type SharedRouteFilterOptions = {
  tags: string[];
  placeRegions: Array<{
    region: string;
    categories: Array<{
      category: string;
      places: string[];
    }>;
  }>;
};

export const EMPTY_SHARED_ROUTE_FILTERS: SharedRouteFilters = {
  tags: [],
  places: [],
};

export const DEFAULT_FILTER_REGION: GangwonRegionLabel =
  DEFAULT_GANGWON_REGION.label;

export const SHARED_ROUTE_FILTER_PLACE_SOURCE_ENABLED = Boolean(
  TOUR_API_SERVICE_KEY
);

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

export function getNearestGangwonRegion(location: {
  lat: number;
  lng: number;
}) {
  return GANGWON_REGION_LABELS.reduce((nearestRegion, region) => {
    const nearestDistance = calculateDistanceMeters(
      location,
      GANGWON_REGION_CENTER_BY_LABEL[nearestRegion]
    );
    const regionDistance = calculateDistanceMeters(
      location,
      GANGWON_REGION_CENTER_BY_LABEL[region]
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
  return GANGWON_SIGUNGU_CODE_BY_LABEL[region as GangwonRegionLabel];
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

export function mergePlaceCategories(
  ...categoryGroups: Array<
    SharedRouteFilterOptions["placeRegions"][number]["categories"]
  >
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

export async function fetchRegionFilterPlaceCategories(
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
    fetchGangwonAttractions(
      TOUR_API_SERVICE_KEY,
      {
        sigunguCode,
        contentTypeIds: ["12", "39"],
      },
      "ko"
    ),
    fetchGangwonFestivals(
      TOUR_API_SERVICE_KEY,
      {
        sigunguCode,
        lookAheadDays: 90,
      },
      "ko"
    ).catch(() => [] as GangwonAttraction[]),
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

export function getFilterLabel(
  filter: SharedRouteFilterCandidate,
  text: UiText
) {
  if (filter.type === "tag") {
    return text.sharedRoute.filterTagLabel(filter.value);
  }

  return text.sharedRoute.filterPlaceLabel(filter.value);
}

export function getLocalizedRegionName(regionName: string, text: UiText) {
  return text.labels.regions[regionName] ?? regionName;
}

export function getLocalizedPlaceCategory(category: string, text: UiText) {
  return localizePlaceCategoryLabel(category, text);
}

function isSamePlaceFilter(
  left: Pick<SharedRoutePlaceFilterOption, "name" | "region">,
  right: Pick<SharedRoutePlaceFilterOption, "name" | "region">
) {
  return left.name === right.name && left.region === right.region;
}

export function hasFilterCandidate(
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

export function addFilterCandidate(
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

export function removeFilterCandidate(
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

export function toggleFilterCandidate(
  filters: SharedRouteFilters,
  filter: SharedRouteFilterCandidate
): SharedRouteFilters {
  return hasFilterCandidate(filters, filter)
    ? removeFilterCandidate(filters, filter)
    : addFilterCandidate(filters, filter);
}

export function getActiveFilterCount(filters: SharedRouteFilters) {
  return filters.tags.length + filters.places.length;
}

export function routeMatchesFilters(
  route: SharedRoute,
  filters: SharedRouteFilters,
  text: UiText
) {
  if (getActiveFilterCount(filters) === 0) {
    return true;
  }

  const routeTags = getDisplayShareTags(route, text);
  const routePlaces = getDisplayPlaceOptions(route, text);
  const matchesTags =
    filters.tags.length === 0 ||
    filters.tags.every((tag) => routeTags.includes(tag));
  const matchesPlaces =
    filters.places.length === 0 ||
    filters.places.some((selectedPlace) =>
      routePlaces.some((routePlace) =>
        isSamePlaceFilter(routePlace, selectedPlace)
      )
    );

  return matchesTags && matchesPlaces;
}

export function getSharedRouteFilterOptions(
  routes: SharedRoute[],
  text: UiText
): SharedRouteFilterOptions {
  const tagOptions = new Set<string>();
  const placeOptionsByRegion = new Map<string, Map<string, Set<string>>>();

  routes.forEach((route) => {
    getDisplayShareTags(route, text).forEach((tag) => tagOptions.add(tag));
    getDisplayPlaceOptions(route, text).forEach((place) => {
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
          region as GangwonRegionLabel
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
          })),
      };
    }),
  };
}
