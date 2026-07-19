export type TourPlaceLocalizationInput = {
  contentId: string;
  contentTypeId?: string | null;
  title: string;
  address?: string | null;
};

export type TourPlaceOverviewLocalizationInput = {
  contentId: string;
  overview: string;
  operatingHours?: string | null;
  restDate?: string | null;
  infoCenter?: string | null;
};

export type TourPlaceOverviewCacheInput = {
  contentId: string;
  overview: string;
  operatingHours: string;
  restDate: string;
  infoCenter: string;
  sourceHash: string;
};

export type TourCategoryLocalizationInput = {
  code: string;
  locale: string;
  label: string;
  sourceLabel?: string | null;
};

export type TitleTranslation = {
  id: string;
  translatedTitle: string;
};

export type AddressTranslation = {
  id: string;
  translatedAddress: string;
};

export type PlaceOverviewTranslation = {
  translatedOverview: string;
  translatedOperatingHours: string;
  translatedRestDate: string;
  translatedInfoCenter: string;
};
