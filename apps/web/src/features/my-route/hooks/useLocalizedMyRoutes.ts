import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPlaceLocalizationId,
  localizeTourPlaces,
} from "@/lib/placeLocalization";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import type { MyRoute, MyRouteStop } from "../types";

type RoutePlaceLocalizationCandidate = {
  id: string;
  contentTypeId: string;
  title: string;
  address: string;
};

function getRouteLocalizationCandidates(route: MyRoute) {
  const candidateById = new Map<string, RoutePlaceLocalizationCandidate>();
  const addStop = (stop: MyRouteStop) => {
    const localizationId = getPlaceLocalizationId(stop.place);
    const contentTypeId = stop.place.contentTypeId?.trim();
    const title = stop.place.title.trim();

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
  };

  route.stops.forEach(addStop);
  route.days.forEach((day) => day.stops.forEach(addStop));

  return [...candidateById.values()];
}

function localizeRoute(
  route: MyRoute,
  localizedById: Map<string, RoutePlaceLocalizationCandidate>
) {
  let hasLocalizedStop = false;
  const localizeStop = (stop: MyRouteStop) => {
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
  };
  const stops = route.stops.map(localizeStop);
  const days = route.days.map((day) => {
    const dayStops = day.stops.map(localizeStop);

    return dayStops.some((stop, index) => stop !== day.stops[index])
      ? { ...day, stops: dayStops }
      : day;
  });

  return hasLocalizedStop ? { ...route, stops, days } : route;
}

export function useLocalizedMyRoutes(routes: MyRoute[]) {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const candidatesByRouteId = useMemo(
    () =>
      new Map(
        routes.map((route) => [route.id, getRouteLocalizationCandidates(route)])
      ),
    [routes]
  );
  const candidates = useMemo(() => {
    const candidateById = new Map<string, RoutePlaceLocalizationCandidate>();

    candidatesByRouteId.forEach((routeCandidates) => {
      routeCandidates.forEach((candidate) => {
        if (!candidateById.has(candidate.id)) {
          candidateById.set(candidate.id, candidate);
        }
      });
    });

    return [...candidateById.values()].sort((left, right) =>
      left.id.localeCompare(right.id)
    );
  }, [candidatesByRouteId]);
  const localizationKey = useMemo(
    () =>
      candidates
        .map(
          (candidate) =>
            `${candidate.id}:${candidate.contentTypeId}:${candidate.title}:${candidate.address}`
        )
        .join("|"),
    [candidates]
  );
  const localizationQuery = useQuery({
    queryKey: ["my-route-place-localizations", appLanguage, localizationKey],
    enabled: appLanguage === "en" && candidates.length > 0,
    queryFn: () =>
      localizeTourPlaces(candidates, appLanguage, {
        retryUncached: true,
        retryAttempts: 3,
      }),
    placeholderData: (previousData) => previousData,
  });
  const localizedById = useMemo(
    () =>
      new Map(
        (localizationQuery.data ?? []).map((place) => [place.id, place])
      ),
    [localizationQuery.data]
  );
  const localizedRoutes = useMemo(() => {
    if (appLanguage !== "en") {
      return routes;
    }

    return routes.flatMap((route) => {
      const routeCandidates = candidatesByRouteId.get(route.id) ?? [];
      const isLocalizationReady = routeCandidates.every((candidate) =>
        localizedById.has(candidate.id)
      );

      return isLocalizationReady ? [localizeRoute(route, localizedById)] : [];
    });
  }, [appLanguage, candidatesByRouteId, localizedById, routes]);
  const isUpdating =
    appLanguage === "en" &&
    localizationQuery.isFetching &&
    localizedRoutes.length < routes.length;

  return {
    routes: localizedRoutes,
    isLoading: isUpdating && localizedRoutes.length === 0,
    isUpdating,
  };
}
