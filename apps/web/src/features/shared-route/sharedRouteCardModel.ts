import type {
  LikedSharedRouteConnectionQuery,
  LikedSharedRoutesQuery,
  RouteSummaryFieldsFragment,
  SharedRouteConnectionQuery,
  SharedRoutesQuery,
} from "@/generated/graphql";
import {
  GANGWON_REGION_LABEL_BY_CODE,
  GANGWON_REGION_LABELS,
} from "@/data/gangwonRegions";
import { getUiText, type UiText } from "@/lib/uiText";

const REGION_SHARE_TAGS = new Set(["강원", ...GANGWON_REGION_LABELS]);

export type SharedRoute =
  | SharedRoutesQuery["sharedRoutes"][number]
  | LikedSharedRoutesQuery["likedRoutes"][number]
  | SharedRouteConnectionQuery["sharedRouteConnection"]["nodes"][number]
  | LikedSharedRouteConnectionQuery["likedRouteConnection"]["nodes"][number];

export type SharedRouteFilterCandidate =
  | {
      type: "tag";
      value: string;
    }
  | {
      type: "place";
      value: string;
      region: string;
    };

export type SharedRoutePlaceFilterOption = {
  name: string;
  region: string;
  category: string;
};

function getLocalizedPlanTagLabel(tag: string, text: UiText) {
  const planTagLabels: Record<string, string> = {
    "가볍게 보기": text.sharedRouteCard.lightPlan,
    "가벼운 플랜": text.sharedRouteCard.lightPlan,
    "촘촘한 루트": text.sharedRouteCard.densePlan,
    "촘촘 플랜": text.sharedRouteCard.densePlan,
    "여유로운 루트": text.sharedRouteCard.relaxedPlan,
    "여유 플랜": text.sharedRouteCard.relaxedPlan,
    "균형 잡힌 루트": text.sharedRouteCard.balancedPlan,
    "균형 플랜": text.sharedRouteCard.balancedPlan,
    "해변 루트": text.sharedRouteCard.beachRoute,
    "카페 산책": text.sharedRouteCard.cafeWalk,
  };

  return planTagLabels[tag] ?? null;
}

function getLocalizedRegionName(regionName: string, text: UiText) {
  return text.labels.regions[regionName] ?? regionName;
}

function getLocalizedShareTagLabel(tag: string, text: UiText) {
  const planTag = getLocalizedPlanTagLabel(tag, text);

  if (planTag) {
    return planTag;
  }

  if (REGION_SHARE_TAGS.has(tag)) {
    return getLocalizedRegionName(tag, text);
  }

  if (tag === "당일치기") {
    return text.sharedRouteCard.dayTrip;
  }

  const durationMatch = tag.match(/^(\d+)박\s+(\d+)일$/);
  if (durationMatch) {
    return text.sharedRouteCard.nightTrip(
      Number(durationMatch[1]),
      Number(durationMatch[2])
    );
  }

  const verificationMatch = tag.match(/^인증\s+(\d+)\/(\d+)곳$/);
  if (verificationMatch) {
    return text.sharedRouteCard.verificationTag(
      Number(verificationMatch[1]),
      Number(verificationMatch[2])
    );
  }

  if (tag === "미인증 루트") {
    return text.sharedRouteCard.unverifiedRoute;
  }

  if (tag === "골고루 담은 루트") {
    return text.sharedRouteCard.mixedRoute;
  }

  const focusMatch = tag.match(/^(.+)\s+위주$/);
  if (focusMatch) {
    const focus =
      text.sharedRouteCard.focusCategories[focusMatch[1]] ?? focusMatch[1];

    return text.sharedRouteCard.focusedRoute(focus);
  }

  return tag;
}

function formatRouteDate(value: string | null) {
  const dateKey = value?.slice(0, 10);

  if (!dateKey) {
    return null;
  }

  const [, month, day] = dateKey.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function getRouteDateTitle(route: RouteSummaryFieldsFragment) {
  const startDate = formatRouteDate(route.travelStartDate);
  const endDate = formatRouteDate(route.travelEndDate);

  if (!startDate) {
    return null;
  }

  if (!endDate || startDate === endDate) {
    return startDate;
  }

  return `${startDate} ~ ${endDate}`;
}

function getRegionCode(
  regionLabelKey?: string | null,
  regionCode?: string | null
) {
  const [areaCodeOrSigunguCode, sigunguCode] = regionLabelKey?.split(":") ?? [];

  return (
    sigunguCode ??
    regionCode ??
    (areaCodeOrSigunguCode &&
    GANGWON_REGION_LABEL_BY_CODE[areaCodeOrSigunguCode]
      ? areaCodeOrSigunguCode
      : null)
  );
}

function getRegionName(
  regionLabelKey?: string | null,
  regionCode?: string | null
) {
  const code = getRegionCode(regionLabelKey, regionCode);

  return code ? GANGWON_REGION_LABEL_BY_CODE[code] : null;
}

export function getDisplayRegionNames(route: SharedRoute) {
  const regionNames: string[] = [];
  const appendRegionName = (regionName: string | null) => {
    if (regionName && !regionNames.includes(regionName)) {
      regionNames.push(regionName);
    }
  };

  (route.stops ?? []).forEach((stop) => {
    appendRegionName(
      getRegionName(stop.place.regionLabelKey, stop.place.regionCode)
    );
  });

  if (regionNames.length === 0) {
    appendRegionName(
      getRegionName(route.primaryRegionLabelKey, route.primaryRegionCode)
    );
  }

  return regionNames;
}

export function getDisplayPlaceOptions(
  route: SharedRoute,
  text = getUiText("ko")
) {
  const placeOptions: SharedRoutePlaceFilterOption[] = [];
  const fallbackRegionName =
    getRegionName(route.primaryRegionLabelKey, route.primaryRegionCode) ??
    text.sharedRouteCard.unknownRegion;

  (route.stops ?? []).forEach((stop) => {
    const name = stop.place.title?.trim();
    const region =
      getRegionName(stop.place.regionLabelKey, stop.place.regionCode) ??
      fallbackRegionName;
    const category =
      text.labels.placeCategories[stop.place.categoryLabel?.trim() ?? ""] ||
      text.labels.placeCategories[stop.place.categoryName?.trim() ?? ""] ||
      stop.place.categoryLabel?.trim() ||
      stop.place.categoryName?.trim() ||
      text.sharedRouteCard.etcCategory;

    if (!name) {
      return;
    }

    const hasPlace = placeOptions.some(
      (placeOption) =>
        placeOption.name === name && placeOption.region === region
    );

    if (!hasPlace) {
      placeOptions.push({ name, region, category });
    }
  });

  return placeOptions;
}

function getRouteRegionTitle(route: SharedRoute, text: UiText) {
  const regionNames = getDisplayRegionNames(route);

  if (regionNames.length === 0) {
    return text.sharedRouteCard.shared;
  }

  const visibleRegionNames = regionNames
    .slice(0, 2)
    .map((regionName) => getLocalizedRegionName(regionName, text))
    .join("+");

  return regionNames.length > 2
    ? `${visibleRegionNames} ${text.sharedRouteCard.otherRegions(
        regionNames.length - 2
      )}`
    : visibleRegionNames;
}

export function getSharedRouteTitle(route: SharedRoute, text: UiText) {
  const dateTitle = getRouteDateTitle(route);
  const regionTitle = getRouteRegionTitle(route, text);

  return dateTitle
    ? `${dateTitle} ${regionTitle} ${text.sharedRouteCard.routeSuffix}`
    : `${regionTitle} ${text.sharedRouteCard.routeSuffix}`;
}

export function getSharedRouteSubtitle(
  route: RouteSummaryFieldsFragment,
  text: UiText
) {
  const durationText =
    route.tripDays <= 1
      ? text.sharedRouteCard.dayTrip
      : text.sharedRouteCard.nightTrip(route.tripDays - 1, route.tripDays);

  return `${durationText} · ${text.sharedRouteCard.completed(
    route.completedStopCount,
    route.totalStopCount
  )}`;
}

function getFallbackShareTags(route: RouteSummaryFieldsFragment, text: UiText) {
  const tags = [
    route.tripDays <= 1
      ? text.sharedRouteCard.dayTrip
      : text.sharedRouteCard.nightTrip(route.tripDays - 1, route.tripDays),
  ];

  if (route.totalStopCount > 0) {
    tags.push(
      route.totalStopCount / Math.max(1, route.tripDays) >= 4
        ? text.sharedRouteCard.densePlan
        : text.sharedRouteCard.relaxedPlan
    );
  }

  return tags;
}

export function getDisplayShareTags(
  route: RouteSummaryFieldsFragment,
  text = getUiText("ko")
) {
  const sourceTags = route.shareTags.length
    ? route.shareTags
    : getFallbackShareTags(route, text);
  const displayTags = sourceTags.reduce<string[]>((tags, sourceTag) => {
    if (REGION_SHARE_TAGS.has(sourceTag)) {
      return tags;
    }

    const tag = getLocalizedShareTagLabel(sourceTag, text);
    return tags.includes(tag) ? tags : [...tags, tag];
  }, []);

  return displayTags.length
    ? displayTags
    : getFallbackShareTags(route, text).filter(
        (tag) => !REGION_SHARE_TAGS.has(tag)
      );
}
