import {
  LocalizeTourPlaceOverviewDocument,
  LocalizeTourPlacesDocument,
  type TourPlaceOverviewLocalizationInput,
  type TourPlaceLocalizationInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

export const placeLocalizationApi = {
  localizeTourPlaceOverview(input: TourPlaceOverviewLocalizationInput) {
    return requestGraphQL(LocalizeTourPlaceOverviewDocument, { input });
  },
  localizeTourPlaces(input: TourPlaceLocalizationInput[]) {
    return requestGraphQL(LocalizeTourPlacesDocument, { input });
  },
};
