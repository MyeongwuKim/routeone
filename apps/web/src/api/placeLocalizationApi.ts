
import {
  CacheTourCategoryLocalizationsDocument,
  LocalizeTourPlaceOverviewDocument,
  LocalizeTourPlacesDocument,
  TourCategoryLocalizationsDocument,
  type TourCategoryLocalizationInput,
  type TourPlaceOverviewLocalizationInput,
  type TourPlaceLocalizationInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

const LOCALIZATION_REQUEST_OPTIONS = {
  timeoutMs: 12_000,
  maxRetryCount: 0,
};

const FRESH_LOCALIZATION_REQUEST_OPTIONS = {
  timeoutMs: 30_000,
  maxRetryCount: 0,
};

const OVERVIEW_LOCALIZATION_REQUEST_OPTIONS = {
  timeoutMs: 25_000,
  maxRetryCount: 0,
};

const CATEGORY_LOCALIZATION_REQUEST_OPTIONS = {
  timeoutMs: 8_000,
  maxRetryCount: 0,
};

/**
 * 관광지 개요·장소·분류명 번역 요청을 각각의 제한 시간으로 전달하며 자동 재시도는 하지 않는다.
 * waitForFresh 장소 번역은 캐시 응답 대신 새 번역을 기다리므로 30초 제한 시간을 사용한다.
 */
export const placeLocalizationApi = {
  localizeTourPlaceOverview(input: TourPlaceOverviewLocalizationInput) {
    return requestGraphQL(
      LocalizeTourPlaceOverviewDocument,
      { input },
      OVERVIEW_LOCALIZATION_REQUEST_OPTIONS
    );
  },
  localizeTourPlaces(
    input: TourPlaceLocalizationInput[],
    waitForFresh = false
  ) {
    return requestGraphQL(
      LocalizeTourPlacesDocument,
      { input, waitForFresh },
      waitForFresh
        ? FRESH_LOCALIZATION_REQUEST_OPTIONS
        : LOCALIZATION_REQUEST_OPTIONS
    );
  },
  cacheTourCategoryLocalizations(input: TourCategoryLocalizationInput[]) {
    return requestGraphQL(
      CacheTourCategoryLocalizationsDocument,
      { input },
      CATEGORY_LOCALIZATION_REQUEST_OPTIONS
    );
  },
  tourCategoryLocalizations(locale: string) {
    return requestGraphQL(
      TourCategoryLocalizationsDocument,
      { locale },
      CATEGORY_LOCALIZATION_REQUEST_OPTIONS
    );
  },
};
