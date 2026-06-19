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
    "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}": typeof types.ClearRouteDocument,
    "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.CloneRouteDocument,
    "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.CreateRouteDocument,
    "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  memo\n  visitStatus\n  visitedAt\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}": typeof types.RoutePlaceFieldsFragmentDoc,
    "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.LikeRouteDocument,
    "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true) {\n  markRouteStopVisited(stopId: $stopId, visited: $visited) {\n    ...RouteDetailFields\n  }\n}": typeof types.MarkRouteStopVisitedDocument,
    "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}": typeof types.MyRoutesDocument,
    "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n  }\n}": typeof types.RouteByIdDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.SaveRouteDocument,
    "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}": typeof types.ShareRouteDocument,
    "query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n  }\n}": typeof types.SharedRoutesDocument,
    "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.UnlikeRouteDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.UnsaveRouteDocument,
};
const documents: Documents = {
    "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}": types.ClearRouteDocument,
    "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.CloneRouteDocument,
    "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.CreateRouteDocument,
    "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  memo\n  visitStatus\n  visitedAt\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}": types.RoutePlaceFieldsFragmentDoc,
    "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.LikeRouteDocument,
    "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true) {\n  markRouteStopVisited(stopId: $stopId, visited: $visited) {\n    ...RouteDetailFields\n  }\n}": types.MarkRouteStopVisitedDocument,
    "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}": types.MyRoutesDocument,
    "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n  }\n}": types.RouteByIdDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.SaveRouteDocument,
    "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}": types.ShareRouteDocument,
    "query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n  }\n}": types.SharedRoutesDocument,
    "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.UnlikeRouteDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.UnsaveRouteDocument,
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
export function graphql(source: "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  memo\n  visitStatus\n  visitedAt\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}"): (typeof documents)["fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  memo\n  visitStatus\n  visitedAt\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true) {\n  markRouteStopVisited(stopId: $stopId, visited: $visited) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true) {\n  markRouteStopVisited(stopId: $stopId, visited: $visited) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}"];
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
export function graphql(source: "query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n  }\n}"): (typeof documents)["query SharedRoutes($regionCode: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, limit: $limit) {\n    ...RouteSummaryFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;