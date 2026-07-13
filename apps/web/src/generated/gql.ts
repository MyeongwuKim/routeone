/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    overviewSource\n    cached\n  }\n}": typeof types.LocalizeTourPlaceOverviewDocument,
    "mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!) {\n  localizeTourPlaces(input: $input) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}": typeof types.LocalizeTourPlacesDocument,
    "mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.AppendRouteDaysDocument,
    "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}": typeof types.ClearRouteDocument,
    "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.CloneRouteDocument,
    "mutation CreateRouteStopVisitPhotoUpload($stopId: ID!) {\n  createRouteStopVisitPhotoUpload(stopId: $stopId) {\n    imageId\n    uploadUrl\n    imageUrl\n    fileName\n    environment\n    expiresAt\n  }\n}": typeof types.CreateRouteStopVisitPhotoUploadDocument,
    "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.CreateRouteDocument,
    "mutation DeleteRouteDay($dayId: ID!) {\n  deleteRouteDay(dayId: $dayId) {\n    ...RouteDetailFields\n  }\n}": typeof types.DeleteRouteDayDocument,
    "mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}": typeof types.DeleteRouteDocument,
    "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}": typeof types.RoutePlaceFieldsFragmentDoc,
    "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.LikeRouteDocument,
    "query LikedSharedRouteConnection($limit: Int, $cursor: String) {\n  likedRouteConnection(limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": typeof types.LikedSharedRouteConnectionDocument,
    "query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": typeof types.LikedSharedRoutesDocument,
    "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true, $verification: RouteStopVisitVerificationInput, $actualStayMinutes: Int) {\n  markRouteStopVisited(\n    stopId: $stopId\n    visited: $visited\n    verification: $verification\n    actualStayMinutes: $actualStayMinutes\n  ) {\n    ...RouteDetailFields\n  }\n}": typeof types.MarkRouteStopVisitedDocument,
    "query MyRouteHistoryConnection($limit: Int, $cursor: String, $today: DateTime) {\n  myRouteHistoryConnection(limit: $limit, cursor: $cursor, today: $today) {\n    nodes {\n      ...RouteDetailFields\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": typeof types.MyRouteHistoryConnectionDocument,
    "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}": typeof types.MyRoutesDocument,
    "query PlacePhotos($place: PlaceSnapshotInput!, $limit: Int) {\n  placePhotos(place: $place, limit: $limit) {\n    id\n    placeKey\n    placeKeys\n    provider\n    externalId\n    contentId\n    contentTypeId\n    title\n    address\n    lat\n    lng\n    categoryLabel\n    categoryName\n    placeImageUrl\n    regionCode\n    regionLabelKey\n    imageId\n    imageUrl\n    thumbnailUrl\n    variant\n    source\n    status\n    verifiedAt\n    createdAt\n    updatedAt\n  }\n}": typeof types.PlacePhotosDocument,
    "query PlaceStaySummaries($places: [PlaceSnapshotInput!]!) {\n  placeStaySummaries(places: $places) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": typeof types.PlaceStaySummariesDocument,
    "query PlaceStaySummary($place: PlaceSnapshotInput!) {\n  placeStaySummary(place: $place) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": typeof types.PlaceStaySummaryDocument,
    "query PosterImageDataUrl($url: String!) {\n  posterImageDataUrl(url: $url)\n}": typeof types.PosterImageDataUrlDocument,
    "mutation ReorderRouteStops($input: ReorderRouteStopsInput!) {\n  reorderRouteStops(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.ReorderRouteStopsDocument,
    "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n  }\n}": typeof types.RouteByIdDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.SaveRouteDocument,
    "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}": typeof types.ShareRouteDocument,
    "query SharedRouteConnection($regionCode: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(regionCode: $regionCode, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": typeof types.SharedRouteConnectionDocument,
    "query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": typeof types.SharedRoutesDocument,
    "mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.StartRouteDocument,
    "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.UnlikeRouteDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.UnsaveRouteDocument,
    "mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.UpdateRouteStopStayMinutesDocument,
    "mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}": typeof types.LoginWithPasswordDocument,
    "query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    locale\n    createdAt\n    updatedAt\n  }\n}": typeof types.MeDocument,
};
const documents: Documents = {
    "mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    overviewSource\n    cached\n  }\n}": types.LocalizeTourPlaceOverviewDocument,
    "mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!) {\n  localizeTourPlaces(input: $input) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}": types.LocalizeTourPlacesDocument,
    "mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.AppendRouteDaysDocument,
    "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}": types.ClearRouteDocument,
    "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.CloneRouteDocument,
    "mutation CreateRouteStopVisitPhotoUpload($stopId: ID!) {\n  createRouteStopVisitPhotoUpload(stopId: $stopId) {\n    imageId\n    uploadUrl\n    imageUrl\n    fileName\n    environment\n    expiresAt\n  }\n}": types.CreateRouteStopVisitPhotoUploadDocument,
    "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.CreateRouteDocument,
    "mutation DeleteRouteDay($dayId: ID!) {\n  deleteRouteDay(dayId: $dayId) {\n    ...RouteDetailFields\n  }\n}": types.DeleteRouteDayDocument,
    "mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}": types.DeleteRouteDocument,
    "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}": types.RoutePlaceFieldsFragmentDoc,
    "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.LikeRouteDocument,
    "query LikedSharedRouteConnection($limit: Int, $cursor: String) {\n  likedRouteConnection(limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": types.LikedSharedRouteConnectionDocument,
    "query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": types.LikedSharedRoutesDocument,
    "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true, $verification: RouteStopVisitVerificationInput, $actualStayMinutes: Int) {\n  markRouteStopVisited(\n    stopId: $stopId\n    visited: $visited\n    verification: $verification\n    actualStayMinutes: $actualStayMinutes\n  ) {\n    ...RouteDetailFields\n  }\n}": types.MarkRouteStopVisitedDocument,
    "query MyRouteHistoryConnection($limit: Int, $cursor: String, $today: DateTime) {\n  myRouteHistoryConnection(limit: $limit, cursor: $cursor, today: $today) {\n    nodes {\n      ...RouteDetailFields\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": types.MyRouteHistoryConnectionDocument,
    "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}": types.MyRoutesDocument,
    "query PlacePhotos($place: PlaceSnapshotInput!, $limit: Int) {\n  placePhotos(place: $place, limit: $limit) {\n    id\n    placeKey\n    placeKeys\n    provider\n    externalId\n    contentId\n    contentTypeId\n    title\n    address\n    lat\n    lng\n    categoryLabel\n    categoryName\n    placeImageUrl\n    regionCode\n    regionLabelKey\n    imageId\n    imageUrl\n    thumbnailUrl\n    variant\n    source\n    status\n    verifiedAt\n    createdAt\n    updatedAt\n  }\n}": types.PlacePhotosDocument,
    "query PlaceStaySummaries($places: [PlaceSnapshotInput!]!) {\n  placeStaySummaries(places: $places) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": types.PlaceStaySummariesDocument,
    "query PlaceStaySummary($place: PlaceSnapshotInput!) {\n  placeStaySummary(place: $place) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": types.PlaceStaySummaryDocument,
    "query PosterImageDataUrl($url: String!) {\n  posterImageDataUrl(url: $url)\n}": types.PosterImageDataUrlDocument,
    "mutation ReorderRouteStops($input: ReorderRouteStopsInput!) {\n  reorderRouteStops(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.ReorderRouteStopsDocument,
    "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n  }\n}": types.RouteByIdDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.SaveRouteDocument,
    "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}": types.ShareRouteDocument,
    "query SharedRouteConnection($regionCode: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(regionCode: $regionCode, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": types.SharedRouteConnectionDocument,
    "query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": types.SharedRoutesDocument,
    "mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.StartRouteDocument,
    "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.UnlikeRouteDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.UnsaveRouteDocument,
    "mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.UpdateRouteStopStayMinutesDocument,
    "mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}": types.LoginWithPasswordDocument,
    "query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    locale\n    createdAt\n    updatedAt\n  }\n}": types.MeDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    overviewSource\n    cached\n  }\n}"): (typeof documents)["mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    overviewSource\n    cached\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!) {\n  localizeTourPlaces(input: $input) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}"): (typeof documents)["mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!) {\n  localizeTourPlaces(input: $input) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateRouteStopVisitPhotoUpload($stopId: ID!) {\n  createRouteStopVisitPhotoUpload(stopId: $stopId) {\n    imageId\n    uploadUrl\n    imageUrl\n    fileName\n    environment\n    expiresAt\n  }\n}"): (typeof documents)["mutation CreateRouteStopVisitPhotoUpload($stopId: ID!) {\n  createRouteStopVisitPhotoUpload(stopId: $stopId) {\n    imageId\n    uploadUrl\n    imageUrl\n    fileName\n    environment\n    expiresAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteRouteDay($dayId: ID!) {\n  deleteRouteDay(dayId: $dayId) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation DeleteRouteDay($dayId: ID!) {\n  deleteRouteDay(dayId: $dayId) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}"): (typeof documents)["mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}"): (typeof documents)["fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query LikedSharedRouteConnection($limit: Int, $cursor: String) {\n  likedRouteConnection(limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"): (typeof documents)["query LikedSharedRouteConnection($limit: Int, $cursor: String) {\n  likedRouteConnection(limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"): (typeof documents)["query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true, $verification: RouteStopVisitVerificationInput, $actualStayMinutes: Int) {\n  markRouteStopVisited(\n    stopId: $stopId\n    visited: $visited\n    verification: $verification\n    actualStayMinutes: $actualStayMinutes\n  ) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true, $verification: RouteStopVisitVerificationInput, $actualStayMinutes: Int) {\n  markRouteStopVisited(\n    stopId: $stopId\n    visited: $visited\n    verification: $verification\n    actualStayMinutes: $actualStayMinutes\n  ) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyRouteHistoryConnection($limit: Int, $cursor: String, $today: DateTime) {\n  myRouteHistoryConnection(limit: $limit, cursor: $cursor, today: $today) {\n    nodes {\n      ...RouteDetailFields\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"): (typeof documents)["query MyRouteHistoryConnection($limit: Int, $cursor: String, $today: DateTime) {\n  myRouteHistoryConnection(limit: $limit, cursor: $cursor, today: $today) {\n    nodes {\n      ...RouteDetailFields\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query PlacePhotos($place: PlaceSnapshotInput!, $limit: Int) {\n  placePhotos(place: $place, limit: $limit) {\n    id\n    placeKey\n    placeKeys\n    provider\n    externalId\n    contentId\n    contentTypeId\n    title\n    address\n    lat\n    lng\n    categoryLabel\n    categoryName\n    placeImageUrl\n    regionCode\n    regionLabelKey\n    imageId\n    imageUrl\n    thumbnailUrl\n    variant\n    source\n    status\n    verifiedAt\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query PlacePhotos($place: PlaceSnapshotInput!, $limit: Int) {\n  placePhotos(place: $place, limit: $limit) {\n    id\n    placeKey\n    placeKeys\n    provider\n    externalId\n    contentId\n    contentTypeId\n    title\n    address\n    lat\n    lng\n    categoryLabel\n    categoryName\n    placeImageUrl\n    regionCode\n    regionLabelKey\n    imageId\n    imageUrl\n    thumbnailUrl\n    variant\n    source\n    status\n    verifiedAt\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query PlaceStaySummaries($places: [PlaceSnapshotInput!]!) {\n  placeStaySummaries(places: $places) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}"): (typeof documents)["query PlaceStaySummaries($places: [PlaceSnapshotInput!]!) {\n  placeStaySummaries(places: $places) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query PlaceStaySummary($place: PlaceSnapshotInput!) {\n  placeStaySummary(place: $place) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}"): (typeof documents)["query PlaceStaySummary($place: PlaceSnapshotInput!) {\n  placeStaySummary(place: $place) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query PosterImageDataUrl($url: String!) {\n  posterImageDataUrl(url: $url)\n}"): (typeof documents)["query PosterImageDataUrl($url: String!) {\n  posterImageDataUrl(url: $url)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ReorderRouteStops($input: ReorderRouteStopsInput!) {\n  reorderRouteStops(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation ReorderRouteStops($input: ReorderRouteStopsInput!) {\n  reorderRouteStops(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}"): (typeof documents)["mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SharedRouteConnection($regionCode: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(regionCode: $regionCode, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"): (typeof documents)["query SharedRouteConnection($regionCode: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(regionCode: $regionCode, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      stops {\n        id\n        place {\n          title\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"): (typeof documents)["query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n    stops {\n      id\n      place {\n        title\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}"): (typeof documents)["mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    locale\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    locale\n    createdAt\n    updatedAt\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;