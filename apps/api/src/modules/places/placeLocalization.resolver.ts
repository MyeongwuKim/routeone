import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import {
  cacheTourCategoryLocalizations,
  getTourCategoryLocalizations,
  localizeTourPlaceOverview,
  localizeTourPlaces,
  type TourCategoryLocalizationInput,
  type TourPlaceOverviewLocalizationInput,
  type TourPlaceLocalizationInput,
} from "./placeLocalization.service.js";

export const placeLocalizationTypeDefs = gql`
  enum PlaceLocalizationTitleSource {
    OPENAI
    OVERRIDE
    SOURCE
  }

  enum PlaceLocalizationAddressSource {
    JUSO
    OPENAI
    SOURCE
  }

  enum PlaceLocalizationOverviewSource {
    OPENAI
    SOURCE
  }

  input TourPlaceLocalizationInput {
    contentId: String!
    contentTypeId: String
    title: String!
    address: String
  }

  type TourPlaceLocalization {
    contentId: String!
    title: String!
    address: String!
    titleSource: PlaceLocalizationTitleSource!
    addressSource: PlaceLocalizationAddressSource!
    cached: Boolean!
  }

  input TourPlaceOverviewLocalizationInput {
    contentId: String!
    overview: String!
    operatingHours: String
    restDate: String
    infoCenter: String
  }

  type TourPlaceOverviewLocalization {
    contentId: String!
    overview: String!
    operatingHours: String!
    restDate: String!
    infoCenter: String!
    overviewSource: PlaceLocalizationOverviewSource!
    cached: Boolean!
  }

  input TourCategoryLocalizationInput {
    code: String!
    locale: String!
    label: String!
    sourceLabel: String
  }

  type TourCategoryLocalization {
    code: String!
    locale: String!
    label: String!
    sourceLabel: String!
    cached: Boolean!
  }

  extend type Query {
    tourCategoryLocalizations(locale: String!): [TourCategoryLocalization!]!
  }

  extend type Mutation {
    localizeTourPlaces(input: [TourPlaceLocalizationInput!]!): [TourPlaceLocalization!]!
    localizeTourPlaceOverview(input: TourPlaceOverviewLocalizationInput!): TourPlaceOverviewLocalization!
    cacheTourCategoryLocalizations(input: [TourCategoryLocalizationInput!]!): [TourCategoryLocalization!]!
  }
`;

type LocalizeTourPlacesArgs = {
  input: TourPlaceLocalizationInput[];
};

type LocalizeTourPlaceOverviewArgs = {
  input: TourPlaceOverviewLocalizationInput;
};

type TourCategoryLocalizationsArgs = {
  locale: string;
};

type CacheTourCategoryLocalizationsArgs = {
  input: TourCategoryLocalizationInput[];
};

export const placeLocalizationResolvers = {
  Query: {
    tourCategoryLocalizations(
      _parent: unknown,
      args: TourCategoryLocalizationsArgs,
      context: GraphQLContext
    ) {
      return getTourCategoryLocalizations(context.prisma, args.locale);
    },
  },
  Mutation: {
    localizeTourPlaces(
      _parent: unknown,
      args: LocalizeTourPlacesArgs,
      context: GraphQLContext
    ) {
      return localizeTourPlaces(context.prisma, args.input);
    },
    localizeTourPlaceOverview(
      _parent: unknown,
      args: LocalizeTourPlaceOverviewArgs,
      context: GraphQLContext
    ) {
      return localizeTourPlaceOverview(context.prisma, args.input);
    },
    cacheTourCategoryLocalizations(
      _parent: unknown,
      args: CacheTourCategoryLocalizationsArgs,
      context: GraphQLContext
    ) {
      return cacheTourCategoryLocalizations(context.prisma, args.input);
    },
  },
};
