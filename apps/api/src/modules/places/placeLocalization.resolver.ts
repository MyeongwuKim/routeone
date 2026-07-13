import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import {
  localizeTourPlaceOverview,
  localizeTourPlaces,
  type TourPlaceOverviewLocalizationInput,
  type TourPlaceLocalizationInput,
} from "./placeLocalization.service.js";

export const placeLocalizationTypeDefs = gql`
  enum PlaceLocalizationTitleSource {
    OPENAI
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
  }

  type TourPlaceOverviewLocalization {
    contentId: String!
    overview: String!
    overviewSource: PlaceLocalizationOverviewSource!
    cached: Boolean!
  }

  extend type Mutation {
    localizeTourPlaces(input: [TourPlaceLocalizationInput!]!): [TourPlaceLocalization!]!
    localizeTourPlaceOverview(input: TourPlaceOverviewLocalizationInput!): TourPlaceOverviewLocalization!
  }
`;

type LocalizeTourPlacesArgs = {
  input: TourPlaceLocalizationInput[];
};

type LocalizeTourPlaceOverviewArgs = {
  input: TourPlaceOverviewLocalizationInput;
};

export const placeLocalizationResolvers = {
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
  },
};
