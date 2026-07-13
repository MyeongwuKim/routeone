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

const OVERVIEW_LOCALIZATION_REQUEST_OPTIONS = {
  timeoutMs: 25_000,
  maxRetryCount: 0,
};

const CATEGORY_LOCALIZATION_REQUEST_OPTIONS = {
  timeoutMs: 8_000,
  maxRetryCount: 0,
};

export const placeLocalizationApi = {
  localizeTourPlaceOverview(input: TourPlaceOverviewLocalizationInput) {
    return requestGraphQL(
      LocalizeTourPlaceOverviewDocument,
      { input },
      OVERVIEW_LOCALIZATION_REQUEST_OPTIONS
    );
  },
  localizeTourPlaces(input: TourPlaceLocalizationInput[]) {
    return requestGraphQL(
      LocalizeTourPlacesDocument,
      { input },
      LOCALIZATION_REQUEST_OPTIONS
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
