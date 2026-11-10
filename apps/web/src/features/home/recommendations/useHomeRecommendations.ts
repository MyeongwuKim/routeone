import { useEffect, useRef, useState } from "react";
import { queryOptions, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getServiceArea, resolveServiceRegion, type ServiceAreaId } from "@/data/serviceAreas";
import { selectExploreRegion } from "@/features/service-area/serviceAreaSelection";
import { findServiceRegionAtLocation } from "@/features/home/map/serviceRegionSelection";
import { HomeTourCoursesByDistrictsDocument, HomeTourCoursesDocument } from "@/generated/graphql";
import { serviceRegionBoundariesQueryOptions } from "@/hooks/useServiceRegionBoundaries";
import { useTourCourseDescription, useTourCourseTitle } from "@/hooks/useTourCourseLocalization";
import { createMapSheetPlaceFromAttraction, resolveMarkerType } from "@/lib/gangwonAttractionMap";
import { requestGraphQL } from "@/lib/graphqlClient";
import { CAFE_LCLS_CODE } from "@/lib/placeCategory";
import { localizeTourPlaces } from "@/lib/placeLocalization";
import { fetchTourCourseFacts, fetchTourCourseOverview, fetchTourCourseStopPlace, fetchTourCourseStops } from "@/lib/visitKoreaTourApi";
import { TOUR_API_SERVICE_KEY } from "@/pages/HomePage.constants";
import { useAppLanguageStore, type AppLanguage } from "@/stores/appLanguageStore";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore, type MapSheetCourseStopDescription } from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useEffectiveServiceArea, useServiceAreaStore } from "@/stores/serviceAreaStore";
import type { MapSheetPlace } from "@/types/place";
import {
  createHomeSelectionParams,
  findTourCourseRegion,
  formatTourCourseMeasurement,
  loadAvailableHomeCoursePage,
  readHomeSelection,
  type HomeTourCourse,
} from "./homeRecommendations";

const COURSE_DETAIL_STALE_TIME = 60 * 60 * 1000;

/** 추천 목록 검증, 썸네일과 방문지 상세에서 같은 원본 코스 순서를 재사용한다. */
function homeCourseItineraryOptions(courseId: string) {
  return queryOptions({
    queryKey: ["home-official-tour-course-itinerary", courseId],
    staleTime: COURSE_DETAIL_STALE_TIME,
    retry: false,
    queryFn: ({ signal }) => fetchTourCourseStops(TOUR_API_SERVICE_KEY, courseId, signal),
  });
}

/** 목록에서 검증한 장소 원본을 대표 사진과 펼친 코스에서도 재사용한다. */
function homeCoursePlaceOptions(contentId: string) {
  return queryOptions({
    queryKey: ["home-official-tour-course-place", contentId],
    staleTime: COURSE_DETAIL_STALE_TIME,
    retry: false,
    queryFn: ({ signal }) => fetchTourCourseStopPlace(TOUR_API_SERVICE_KEY, contentId, signal),
  });
}

function getCourseStopContentIds(stops: { contentId: string }[]) {
  return [...new Set(stops.map(({ contentId }) => contentId).filter((id) => /^\d+$/.test(id)))];
}

/** 관광공사 이미지 서버의 HTTP 주소를 앱에서도 열리는 HTTPS 주소로 바꾼다. */
function normalizeCourseCoverUrl(image?: string) {
  return image?.trim().replace(/^http:\/\/tong\.visitkorea\.or\.kr\//i, "https://tong.visitkorea.or.kr/") ?? "";
}

/**
 * URL에 선택된 시·군·구의 공식 코스 중 모든 방문지를 지도에 연결할 수 있는 코스를 조회한다.
 * 선택이 바뀌면 첫 페이지로 돌아가고, 다음 페이지는 더 보기로 요청한다.
 */
export function useHomeRecommendations() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultArea = useEffectiveServiceArea();
  const language = useAppLanguageStore(state => state.language);
  const selection = readHomeSelection(params) ?? {
    areaId: defaultArea.id,
    regionCodes: [],
  };
  const { regionCodes } = selection;
  const resultScope = `${selection.areaId}:${regionCodes.join(",")}`;
  const area = getServiceArea(selection.areaId);
  const selectedRegions = area.regions.filter(({ sigunguCode }) => regionCodes.includes(sigunguCode));
  const region = selectedRegions.length === 1 ? selectedRegions[0] : null;
  const exploreRegionCode = useHomeExploreStore(state => state.exploreAreaId === area.id ? state.selectedSigunguCode : null);
  const savedRegionCode = useServiceAreaStore(state => state.selectedAreaId === area.id ? state.selectedRegionCode : null);
  // 지도는 선택 범위 안에서 기존 탐색 지역을 우선하고, 없으면 첫 번째 지역을 연다.
  const mapCandidates = selectedRegions.length ? selectedRegions : area.regions;
  const mapRegion = mapCandidates.find(({ sigunguCode }) =>
    sigunguCode === (exploreRegionCode ?? savedRegionCode)
  ) ?? selectedRegions[0] ?? area.defaultRegion;
  const query = useInfiniteQuery({
    queryKey: ["home-official-tour-courses", selection.areaId, regionCodes],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => loadAvailableHomeCoursePage(pageParam, {
      signal,
      loadPage: async (page) => {
        const variables = { areaCode: area.tourAreaCode, page };
        const options = { authToken: null, maxRetryCount: 0 };
        const result = regionCodes.length > 1
          ? await requestGraphQL(HomeTourCoursesByDistrictsDocument, { ...variables, sigunguCodes: regionCodes }, options)
          : await requestGraphQL(HomeTourCoursesDocument, { ...variables, sigunguCode: regionCodes[0] }, options);
        return result.homeTourCourses;
      },
      loadStops: (courseId) => queryClient.fetchQuery(homeCourseItineraryOptions(courseId)),
      loadPlace: (contentId) => queryClient.fetchQuery(homeCoursePlaceOptions(contentId)),
    }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: Infinity,
    // 같은 지역을 다시 골라도 이전에 펼친 페이지까지 자동으로 불러오지 않는다.
    gcTime: 0,
    retry: false,
  });
  const pages = query.data?.pages ?? [];
  const courses = Array.from(new Map(pages.flatMap(({ courses: pageCourses }) =>
    pageCourses.map((course) => [course.id, course] as const)
  )).values());

  /** 시·도가 바뀌면 새 시·도 전체를 즉시 조회하고 지도의 시작 지역도 맞춘다. */
  const selectArea = (areaId: ServiceAreaId) => {
    if (areaId === area.id) return;
    const saved = useServiceAreaStore.getState();
    const regionCode = saved.selectedAreaId === areaId ? saved.selectedRegionCode : null;
    selectExploreRegion(areaId, regionCode ?? undefined);
    setParams(createHomeSelectionParams({ areaId, regionCodes: [] }), { replace: true });
  };
  /** 같은 시·도 안에서 선택을 바꾸고, 모두 해제하면 시·도 전체를 조회한다. */
  const selectRegions = (nextCodes: string[]) => {
    if (nextCodes.length === regionCodes.length && nextCodes.every((code) => regionCodes.includes(code))) return;
    const nextMapCode = nextCodes.length && !nextCodes.includes(mapRegion.sigunguCode)
      ? nextCodes[0] : mapRegion.sigunguCode;
    selectExploreRegion(area.id, nextMapCode);
    setParams(createHomeSelectionParams({ areaId: area.id, regionCodes: nextCodes }), { replace: true });
  };
  /** 추천 장소의 전체 화면 상세를 열고 해당 코스에서 받은 방문지 설명을 함께 전달한다. */
  const openPlace = (place: MapSheetPlace, courseStopDescription: MapSheetCourseStopDescription) => {
    const origin = region ?? resolveServiceRegion(null, place.signguCode)?.region ?? mapRegion;
    useMapSheetStore.getState().openSheet(place, {
      mode: "full-popup",
      courseStopDescription,
      fallbackDirectionOrigin: { coordinates: origin.center, label: origin.label, isCurrentLocation: false },
    });
  };
  /** 지도에는 시·군·구를 적용하고, URL에는 홈으로 돌아올 때 복원할 추천 범위를 남긴다. */
  const prepareMap = () => selectExploreRegion(area.id, mapRegion.sigunguCode);
  const mapHref = `/home/map?${createHomeSelectionParams(selection)}`;

  /** 공식 코스의 방문지를 기존 목록에 중복 없이 담고 코스 만들기를 연다. */
  const startCourse = (places: MapSheetPlace[]) => {
    const firstStopRegion = area.regions.find(({ adminCode }) => adminCode === places[0]?.signguCode);
    selectExploreRegion(area.id, (region ?? firstStopRegion ?? mapRegion).sigunguCode);
    useRouteEditFlowStore.getState().clearAppendTarget();
    const { addSavedPlaces, openSavedList } = usePlaceCartStore.getState();
    addSavedPlaces(places, language);
    openSavedList();
    navigate(mapHref);
  };

  return {
    selection, area, selectedRegions, language, resultScope,
    query, courses,
    mapHref,
    actions: { selectArea, selectRegions, openPlace, prepareMap, startCourse },
  };
}

/** 화면에 가까워진 카드의 소개·코스 정보와 번역을 조회하고, 대표 사진이 없으면 방문지 사진을 찾는다. */
export function useHomeCoursePreview(course: HomeTourCourse, language: AppLanguage) {
  const queryClient = useQueryClient();
  const coverRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(() => typeof IntersectionObserver === "undefined");
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const officialImage = normalizeCourseCoverUrl(course.image);
  const courseImage = failedImages.includes(officialImage) ? "" : officialImage;

  useEffect(() => {
    const cover = coverRef.current;
    if (!cover || isNearViewport) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setIsNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "320px 0px" });
    observer.observe(cover);
    return () => observer.disconnect();
  }, [isNearViewport]);

  const overview = useQuery({
    queryKey: ["home-official-tour-course-overview", course.id],
    enabled: isNearViewport,
    staleTime: COURSE_DETAIL_STALE_TIME,
    retry: false,
    queryFn: ({ signal }) => fetchTourCourseOverview(TOUR_API_SERVICE_KEY, course.id, signal),
  });
  const facts = useQuery({
    queryKey: ["home-official-tour-course-facts", course.id],
    enabled: isNearViewport,
    staleTime: COURSE_DETAIL_STALE_TIME,
    retry: false,
    queryFn: ({ signal }) => fetchTourCourseFacts(TOUR_API_SERVICE_KEY, course.id, signal),
  });
  const title = useTourCourseTitle(course.id, course.title, language, isNearViewport);
  const courseKey = `tour-course:${course.id}`;
  const description = useTourCourseDescription(`${courseKey}:overview`, overview.data ?? "", language, isNearViewport);
  const distance = useTourCourseDescription(
    `${courseKey}:distance`, formatTourCourseMeasurement(facts.data?.distance ?? "", language), language,
  );
  const duration = useTourCourseDescription(
    `${courseKey}:duration`, formatTourCourseMeasurement(facts.data?.duration ?? "", language), language,
  );
  const sourceTheme = facts.data?.theme ?? "";
  const themeText = language === "en" && sourceTheme === "자연여행"
    ? "Nature travel"
    : sourceTheme;
  const theme = useTourCourseDescription(`${courseKey}:theme`, themeText, language);

  const needsFallback = isNearViewport && !courseImage;
  const itinerary = useQuery({ ...homeCourseItineraryOptions(course.id), enabled: needsFallback });
  const stops = itinerary.data;
  const stopImage = stops?.map(({ image }) => normalizeCourseCoverUrl(image))
    .find((image) => image && !failedImages.includes(image));
  const placeCover = useQuery({
    queryKey: ["home-official-tour-course-place-cover", course.id],
    enabled: needsFallback && !stopImage && Boolean(stops?.length),
    staleTime: COURSE_DETAIL_STALE_TIME,
    retry: false,
    queryFn: async ({ signal }) => {
      // 코스 자체와 방문 순서에 사진이 없으면, 사진이 있는 첫 장소까지만 상세를 확인한다.
      for (const contentId of getCourseStopContentIds(stops ?? [])) {
        signal.throwIfAborted();
        const place = await queryClient.fetchQuery(homeCoursePlaceOptions(contentId)).catch(() => null);
        const images = [place?.attraction.secondImage, place?.attraction.firstImage]
          .map(normalizeCourseCoverUrl)
          .filter(Boolean);
        if (images.length) return images;
      }
      return [];
    },
  });

  return {
    coverRef,
    title,
    description,
    distance,
    duration,
    theme,
    image: courseImage || stopImage || placeCover.data?.find((image) => image && !failedImages.includes(image)),
    markImageFailed: (image: string) => setFailedImages((previous) => [...previous, image]),
  };
}

/** 펼친 코스의 방문지를 순서대로 정리한다. 영어 모드에서는 첫 조회부터 이름과 주소 번역을 기다린다. */
export function useHomeCourseStops(courseId: string, language: AppLanguage, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["home-official-tour-course-stops", courseId, language],
    enabled,
    staleTime: COURSE_DETAIL_STALE_TIME,
    retry: 1,
    queryFn: async ({ signal }) => {
      const stops = await queryClient.fetchQuery(homeCourseItineraryOptions(courseId));
      signal.throwIfAborted();
      const contentIds = getCourseStopContentIds(stops);
      const results = await Promise.allSettled(contentIds.map((id) => queryClient.fetchQuery(homeCoursePlaceOptions(id))));
      signal.throwIfAborted();
      const placesById = new Map(results.flatMap((result, index) =>
        result.status === "fulfilled" && result.value ? [[contentIds[index], result.value] as const] : []
      ));
      const localized = await localizeTourPlaces(
        [...placesById.values()].map(({ attraction }) => attraction),
        language,
        { waitForFresh: true },
      );
      signal.throwIfAborted();
      const localizedById = new Map(localized.map((attraction) => [attraction.id, attraction]));
      // 지역 코드가 없는 방문지를 펼칠 때만 경계 데이터로 소속 지역을 보완한다.
      const needsBoundary = [...placesById.values()].some((place) => !findTourCourseRegion(place));
      const boundaries = needsBoundary
        ? await queryClient.ensureQueryData(serviceRegionBoundariesQueryOptions).catch(() => undefined)
        : undefined;

      return stops.map((stop, index) => {
        const description = {
          contentId: `tour-course:${courseId}:stop:${index}:${stop.contentId}`,
          text: stop.description,
        };
        const entry = placesById.get(stop.contentId);
        if (!entry) return { title: stop.title, place: null, description };

        const attraction = localizedById.get(stop.contentId) ?? entry.attraction;
        const location = findTourCourseRegion(entry) ?? (boundaries && findServiceRegionAtLocation(attraction, boundaries));
        const place = createMapSheetPlaceFromAttraction({
          attraction: { ...attraction, firstImage: attraction.firstImage || stop.image },
          markerType: resolveMarkerType(attraction, { [CAFE_LCLS_CODE]: "카페" }),
          areaCode: location?.area.tatsAreaCode ?? "",
          signguCode: location?.region.adminCode ?? "",
          touristTrendName: entry.attraction.title,
          topRank: null,
        });
        const translatedTitle = attraction.title !== entry.attraction.title ? attraction.title : "";
        return { title: translatedTitle || stop.title || place.title, place, description };
      });
    },
  });
}
