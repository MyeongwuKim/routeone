/** 공유 경로의 장소를 번역 요청용 후보로 중복 제거하고 응답 제목·주소를 목록 또는 상세 경로 구조에 다시 합친다. */
import type { SharedRouteByIdQuery } from "@/generated/graphql";
import { getPlaceLocalizationId } from "@/lib/placeLocalization";
import type { MyRouteStop } from "@/features/my-route/types";
import type { SharedRoute } from "./sharedRouteCardModel";

/** 번역 요청에서 같은 장소를 합치는 ID와 서버에 전달할 원문 장소 정보를 묶는다. */
export type SharedRoutePlaceLocalizationCandidate = {
  id: string;
  contentTypeId: string;
  title: string;
  address: string;
};

type RouteStopWithLocalizablePlace = {
  place: {
    provider?: string | null;
    externalId?: string | null;
    contentId?: string | null;
    contentTypeId?: string | null;
    title: string;
    address?: string | null;
  };
};

export type SharedRouteDetail = NonNullable<SharedRouteByIdQuery["route"]>;

/** 공용 DAY 상세 UI에서 사용하는 개인 인증 필드는 공개 응답을 읽을 때 빈 값으로 채운다. */
export function toSharedDayPopupRoute(route: SharedRouteDetail) {
  const toPopupStop = (stop: SharedRouteDetail["stops"][number]): MyRouteStop => ({
    ...stop,
    verificationLat: null,
    verificationLng: null,
    verificationAccuracyMeters: null,
  });
  return {
    ...route,
    days: route.days.map((day) => ({ ...day, stops: day.stops.map(toPopupStop) })),
    stops: route.stops.map(toPopupStop),
  };
}

function addSharedRoutePlaceLocalizationCandidate(
  candidateById: Map<string, SharedRoutePlaceLocalizationCandidate>,
  stop: RouteStopWithLocalizablePlace
) {
  const localizationId = getPlaceLocalizationId(stop.place);
  const contentTypeId = stop.place.contentTypeId?.trim() ?? "";
  const title = stop.place.title?.trim();

  if (!localizationId || !title || candidateById.has(localizationId)) {
    return;
  }

  candidateById.set(localizationId, {
    id: localizationId,
    contentTypeId,
    title,
    address: stop.place.address?.trim() ?? "",
  });
}

export function getSharedRoutePlaceLocalizationCandidates(
  routes: SharedRoute[]
) {
  const candidateById = new Map<string, SharedRoutePlaceLocalizationCandidate>();

  routes.forEach((route) => {
    route.stops.forEach((stop) => {
      addSharedRoutePlaceLocalizationCandidate(candidateById, stop);
    });
  });

  return [...candidateById.values()];
}

export function getRouteDetailPlaceLocalizationCandidates(
  route: SharedRouteDetail | null
) {
  if (!route) {
    return [];
  }

  const candidateById = new Map<string, SharedRoutePlaceLocalizationCandidate>();

  route.stops.forEach((stop) => {
    addSharedRoutePlaceLocalizationCandidate(candidateById, stop);
  });
  route.days.forEach((day) => {
    day.stops.forEach((stop) => {
      addSharedRoutePlaceLocalizationCandidate(candidateById, stop);
    });
  });

  return [...candidateById.values()];
}

export function getSharedRoutePlaceLocalizationKey(
  candidates: SharedRoutePlaceLocalizationCandidate[]
) {
  return candidates
    .map(
      (candidate) =>
        `${candidate.id}:${candidate.contentTypeId}:${candidate.title}:${candidate.address}`
    )
    .join("|");
}

export function localizeSharedRoutePlaces(
  routes: SharedRoute[],
  localizedPlaces: SharedRoutePlaceLocalizationCandidate[]
) {
  if (localizedPlaces.length === 0) {
    return routes;
  }

  const localizedById = new Map(
    localizedPlaces.map((place) => [place.id, place])
  );

  return routes.map((route) => {
    let hasLocalizedStop = false;
    const stops = route.stops.map((stop) => {
      const localizationId = getPlaceLocalizationId(stop.place);
      const localizedPlace = localizationId
        ? localizedById.get(localizationId)
        : null;

      if (!localizedPlace) {
        return stop;
      }

      const title = localizedPlace.title || stop.place.title;
      const address = localizedPlace.address || stop.place.address;

      if (title === stop.place.title && address === stop.place.address) {
        return stop;
      }

      hasLocalizedStop = true;

      return {
        ...stop,
        place: {
          ...stop.place,
          title,
          address,
        },
      };
    });

    return hasLocalizedStop ? ({ ...route, stops } as SharedRoute) : route;
  });
}

export function localizeRouteDetailPlaces(
  route: SharedRouteDetail | null,
  localizedPlaces: SharedRoutePlaceLocalizationCandidate[]
) {
  if (!route || localizedPlaces.length === 0) {
    return route;
  }

  const localizedById = new Map(
    localizedPlaces.map((place) => [place.id, place])
  );
  let hasLocalizedRoute = false;
  const localizeStop = <T extends RouteStopWithLocalizablePlace>(stop: T) => {
    const localizationId = getPlaceLocalizationId(stop.place);
    const localizedPlace = localizationId
      ? localizedById.get(localizationId)
      : null;

    if (!localizedPlace) {
      return stop;
    }

    const title = localizedPlace.title || stop.place.title;
    const address = localizedPlace.address || stop.place.address;

    if (title === stop.place.title && address === stop.place.address) {
      return stop;
    }

    hasLocalizedRoute = true;

    return {
      ...stop,
      place: {
        ...stop.place,
        title,
        address,
      },
    };
  };
  const stops = route.stops.map(localizeStop);
  const days = route.days.map((day) => {
    const dayStops = day.stops.map(localizeStop);

    return dayStops.some((stop, index) => stop !== day.stops[index])
      ? { ...day, stops: dayStops }
      : day;
  });

  return hasLocalizedRoute ? { ...route, stops, days } : route;
}
