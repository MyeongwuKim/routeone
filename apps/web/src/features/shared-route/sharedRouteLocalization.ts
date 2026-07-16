import type { RouteByIdQuery } from "@/generated/graphql";
import { getPlaceLocalizationId } from "@/lib/placeLocalization";
import type { SharedRoute } from "./sharedRouteCardModel";

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

export type SharedRouteDetail = NonNullable<RouteByIdQuery["route"]>;

function addSharedRoutePlaceLocalizationCandidate(
  candidateById: Map<string, SharedRoutePlaceLocalizationCandidate>,
  stop: RouteStopWithLocalizablePlace
) {
  const localizationId = getPlaceLocalizationId(stop.place);
  const contentTypeId = stop.place.contentTypeId?.trim();
  const title = stop.place.title?.trim();

  if (
    !localizationId ||
    !contentTypeId ||
    !title ||
    candidateById.has(localizationId)
  ) {
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
