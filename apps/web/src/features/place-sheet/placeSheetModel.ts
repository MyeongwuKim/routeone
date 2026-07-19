import {
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
  getReadablePlaceCategoryName,
} from "@/lib/placeCategory";
import type { UiText } from "@/lib/uiText";
import type { NearbyTouristPlace } from "@/lib/visitKoreaTourApi";
import type { MapSheetPlace } from "@/types/place";

export type PlaceSheetCoordinates = {
  lat: number;
  lng: number;
};

export type PlaceImageViewerTarget = {
  imageUrls: string[];
  index: number;
  title: string;
};

export function getTopRankBadgeStyle(rank: number, text: UiText) {
  if (rank === 1) {
    return {
      label: `🥇 ${text.placeSheet.rankBadge(rank)}`,
      className:
        "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-200",
    };
  }
  if (rank === 2) {
    return {
      label: `🥈 ${text.placeSheet.rankBadge(rank)}`,
      className:
        "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/70 dark:bg-slate-300/10 dark:text-slate-100",
    };
  }
  if (rank === 3) {
    return {
      label: `🥉 ${text.placeSheet.rankBadge(rank)}`,
      className:
        "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-400/60 dark:bg-orange-400/15 dark:text-orange-200",
    };
  }
  return {
    label: text.placeSheet.rankBadge(rank),
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/60 dark:bg-rose-400/15 dark:text-rose-200",
  };
}

export function formatDurationMinutes(durationMs: number, text: UiText) {
  const minutes = Math.max(1, Math.round(durationMs / 60000));
  return text.placeSheet.durationMinutes(minutes);
}

export function formatStayMinutes(
  minutes: number | null | undefined,
  text: UiText
) {
  if (!minutes) {
    return null;
  }

  if (minutes < 60) {
    return text.placeSheet.durationMinutes(minutes);
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes > 0
    ? text.placeSheet.durationHoursMinutes(hours, restMinutes)
    : text.placeSheet.durationHours(hours);
}

export function formatDistance(distanceM: number) {
  return `${(Math.max(1, distanceM) / 1000).toFixed(1)}km`;
}

function preloadImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      resolve(false);
    }, 4_000);

    const finish = (loaded: boolean) => {
      window.clearTimeout(timeoutId);
      resolve(loaded);
    };

    image.onerror = () => finish(false);
    image.onload = () => finish(true);
    image.src = url;
  });
}

export async function preloadImageUrls(urls: string[]) {
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      loaded: await preloadImage(url),
    }))
  );

  return results.filter((result) => result.loaded).map((result) => result.url);
}

function getPlaceImageDedupeKey(rawUrl: string) {
  const normalizePath = (path: string) =>
    path
      .split("?")[0]
      .split("#")[0]
      .replace(/_image[23]_(\d+)(?=\.[^./]+$)/i, "_image_$1");

  try {
    const url = new URL(rawUrl);
    return `${url.hostname}${normalizePath(url.pathname)}`;
  } catch {
    return normalizePath(rawUrl);
  }
}

export function dedupePlaceImageUrls(urls: string[]) {
  const uniqueUrls = new Map<string, string>();

  urls.forEach((url) => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return;
    }

    const key = getPlaceImageDedupeKey(trimmedUrl);

    if (!uniqueUrls.has(key)) {
      uniqueUrls.set(key, trimmedUrl);
    }
  });

  return [...uniqueUrls.values()];
}

export function buildGoogleImageSearchUrl(keyword: string, text: UiText) {
  const query = text.placeSheet.googleImageQuery(keyword);
  const params = new URLSearchParams({
    tbm: "isch",
    q: query,
  });
  return `https://www.google.com/search?${params.toString()}`;
}

export function localizeTourDetailValue(value: string, text: UiText) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const translations = Object.entries(
    text.placeSheet.detailValueTranslations
  ).sort(([sourceA], [sourceB]) => sourceB.length - sourceA.length);
  const exactValue = text.placeSheet.detailValueTranslations[trimmedValue];

  if (exactValue) {
    return exactValue;
  }

  const compactValue = trimmedValue.replace(/\s+/g, "");
  const compactMatch = translations.find(
    ([source]) => source.replace(/\s+/g, "") === compactValue
  );

  if (compactMatch) {
    return compactMatch[1];
  }

  return translations.reduce(
    (result, [source, target]) => result.replaceAll(source, target),
    trimmedValue
  );
}

export function getOfficialEnglishDetailValue(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue && !/[가-힣]/u.test(trimmedValue) ? trimmedValue : "";
}

const EXCLUDED_NEARBY_PLACE_PATTERN =
  /(버스정류장|정류장|매표소|주차장|화장실|터미널|관리사무소|안내소|입구|출구|승강장|휴게소|매점)/;

export function isExcludedNearbyPlace(title: string) {
  return EXCLUDED_NEARBY_PLACE_PATTERN.test(title);
}

export function formatNearbyDistance(distanceM: number | null) {
  if (distanceM == null || !Number.isFinite(distanceM)) {
    return null;
  }

  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(1)}km`;
  }

  return `${Math.round(distanceM)}m`;
}

export function getNearbyPlaceCategoryLabel(place: NearbyTouristPlace) {
  return getPlaceCategoryLabel(place);
}

export function getNearbyPlaceCategoryIcon(place: NearbyTouristPlace) {
  const categoryLabel = getNearbyPlaceCategoryLabel(place);
  return getPlaceCategoryIcon(categoryLabel);
}

type NearbyMapSheetPlaceInput = {
  place: NearbyTouristPlace;
  areaCode: string;
  signguCode: string;
};

export function createMapSheetPlaceFromNearbyPlace({
  place,
  areaCode,
  signguCode,
}: NearbyMapSheetPlaceInput): MapSheetPlace {
  const categoryLabel = getNearbyPlaceCategoryLabel(place);
  const categoryIcon = getNearbyPlaceCategoryIcon(place);
  const categoryName = getReadablePlaceCategoryName(
    [place.lclsSystm3, place.lclsSystm2, place.lclsSystm1],
    categoryLabel
  );

  return {
    id: `${place.id}-${place.contentTypeId}`,
    contentId: place.id,
    contentTypeId: place.contentTypeId,
    areaCode,
    signguCode,
    touristTrendName: place.title,
    topRank: null,
    title: place.title,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    contentTypeLabel: categoryLabel,
    categoryName,
    icon: categoryIcon,
    images: dedupePlaceImageUrls([place.firstImage, place.secondImage]),
  };
}
