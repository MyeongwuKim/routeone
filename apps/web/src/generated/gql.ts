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
    "query GangwonFestivals($startDate: String!, $endDate: String!) {\n  gangwonFestivals(startDate: $startDate, endDate: $endDate) {\n    id\n    title\n    startDate\n    endDate\n    regionCode\n    address\n    lat\n    lng\n    imageUrl\n  }\n}": typeof types.GangwonFestivalsDocument,
    "mutation MarkNotificationInboxRead($ids: [ID!]) {\n  markNotificationInboxRead(ids: $ids) {\n    updatedCount\n  }\n}": typeof types.MarkNotificationInboxReadDocument,
    "query NotificationInbox($first: Int!, $after: String) {\n  notificationInbox(first: $first, after: $after) {\n    items {\n      id\n      notificationKey\n      type\n      festivalKind\n      regionCode\n      regionLabel\n      dateKey\n      festivalIds\n      festivalTitles\n      festivalStartDates\n      festivalEndDates\n      routeReviewKind\n      routeId\n      routeTitle\n      dayId\n      routeDayIndex\n      routeStartAt\n      stopId\n      placeTitle\n      correctionDeadlineAt\n      availableAt\n      readAt\n      createdAt\n      updatedAt\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  unreadNotificationCount\n}": typeof types.NotificationInboxDocument,
    "query NotificationSettings {\n  notificationSettings {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}": typeof types.NotificationSettingsDocument,
    "mutation RegisterPushDevice($input: RegisterPushDeviceInput!) {\n  registerPushDevice(input: $input) {\n    id\n    platform\n    appVariant\n    enabled\n    lastSeenAt\n  }\n}": typeof types.RegisterPushDeviceDocument,
    "mutation SendFestivalTestNotification {\n  sendFestivalTestNotification {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}": typeof types.SendFestivalTestNotificationDocument,
    "mutation SendRouteReviewTestNotification($pushDeviceId: ID!) {\n  sendRouteReviewTestNotification(pushDeviceId: $pushDeviceId) {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}": typeof types.SendRouteReviewTestNotificationDocument,
    "mutation SyncFestivalNotificationInbox($notifications: [FestivalNotificationSyncInput!]!) {\n  syncFestivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}": typeof types.SyncFestivalNotificationInboxDocument,
    "mutation SyncRouteArrivalNotificationInbox($notifications: [RouteArrivalNotificationSyncInput!]!) {\n  syncRouteArrivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n    notificationKeys\n  }\n}": typeof types.SyncRouteArrivalNotificationInboxDocument,
    "mutation SyncRouteReviewNotificationInbox($notifications: [RouteReviewNotificationSyncInput!]!) {\n  syncRouteReviewNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}": typeof types.SyncRouteReviewNotificationInboxDocument,
    "mutation UnregisterPushDevice($expoPushToken: String!) {\n  unregisterPushDevice(expoPushToken: $expoPushToken) {\n    updatedCount\n  }\n}": typeof types.UnregisterPushDeviceDocument,
    "mutation UpdateNotificationSettings($input: UpdateNotificationSettingsInput!) {\n  updateNotificationSettings(input: $input) {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}": typeof types.UpdateNotificationSettingsDocument,
    "mutation CacheTourCategoryLocalizations($input: [TourCategoryLocalizationInput!]!) {\n  cacheTourCategoryLocalizations(input: $input) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}": typeof types.CacheTourCategoryLocalizationsDocument,
    "mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    operatingHours\n    restDate\n    infoCenter\n    overviewSource\n    cached\n  }\n}": typeof types.LocalizeTourPlaceOverviewDocument,
    "mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!, $waitForFresh: Boolean = false) {\n  localizeTourPlaces(input: $input, waitForFresh: $waitForFresh) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}": typeof types.LocalizeTourPlacesDocument,
    "query TourCategoryLocalizations($locale: String!) {\n  tourCategoryLocalizations(locale: $locale) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}": typeof types.TourCategoryLocalizationsDocument,
    "mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.AppendRouteDaysDocument,
    "mutation CheckInRouteStop($stopId: ID!, $verification: RouteStopVisitVerificationInput!) {\n  checkInRouteStop(stopId: $stopId, verification: $verification) {\n    ...RouteDetailFields\n  }\n}": typeof types.CheckInRouteStopDocument,
    "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}": typeof types.ClearRouteDocument,
    "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.CloneRouteDocument,
    "mutation CompleteRouteStopVisit($stopId: ID!, $actualStayMinutes: Int) {\n  completeRouteStopVisit(stopId: $stopId, actualStayMinutes: $actualStayMinutes) {\n    ...RouteDetailFields\n  }\n}": typeof types.CompleteRouteStopVisitDocument,
    "mutation CreateRouteStopVisitPhotoUpload($stopId: ID!) {\n  createRouteStopVisitPhotoUpload(stopId: $stopId) {\n    imageId\n    uploadUrl\n    imageUrl\n    fileName\n    environment\n    expiresAt\n  }\n}": typeof types.CreateRouteStopVisitPhotoUploadDocument,
    "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.CreateRouteDocument,
    "mutation DeleteRouteDay($dayId: ID!) {\n  deleteRouteDay(dayId: $dayId) {\n    ...RouteDetailFields\n  }\n}": typeof types.DeleteRouteDayDocument,
    "mutation DeleteRouteStopVisitPhoto($stopId: ID!) {\n  deleteRouteStopVisitPhoto(stopId: $stopId) {\n    ...RouteDetailFields\n  }\n}": typeof types.DeleteRouteStopVisitPhotoDocument,
    "mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}": typeof types.DeleteRouteDocument,
    "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationPhotoPublicationConsent\n  verificationPhotoPublishedAt\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n  visitTimeEditedAt\n}\n\nfragment SharedRouteOwnerFields on User {\n  id\n  displayName\n  avatarUrl\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    plannedStartMinutes\n    startedAt\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}": typeof types.RoutePlaceFieldsFragmentDoc,
    "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}": typeof types.LikeRouteDocument,
    "query LikedSharedRouteConnection($regionTag: String, $limit: Int, $cursor: String) {\n  likedRouteConnection(regionTag: $regionTag, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": typeof types.LikedSharedRouteConnectionDocument,
    "query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": typeof types.LikedSharedRoutesDocument,
    "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true, $verification: RouteStopVisitVerificationInput, $actualStayMinutes: Int) {\n  markRouteStopVisited(\n    stopId: $stopId\n    visited: $visited\n    verification: $verification\n    actualStayMinutes: $actualStayMinutes\n  ) {\n    ...RouteDetailFields\n  }\n}": typeof types.MarkRouteStopVisitedDocument,
    "query MyRouteHistoryConnection($limit: Int, $cursor: String, $today: DateTime) {\n  myRouteHistoryConnection(limit: $limit, cursor: $cursor, today: $today) {\n    nodes {\n      ...RouteDetailFields\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": typeof types.MyRouteHistoryConnectionDocument,
    "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}": typeof types.MyRoutesDocument,
    "query PlacePhotos($place: PlaceSnapshotInput!, $limit: Int) {\n  placePhotos(place: $place, limit: $limit) {\n    id\n    placeKey\n    placeKeys\n    provider\n    externalId\n    contentId\n    contentTypeId\n    title\n    address\n    lat\n    lng\n    categoryLabel\n    categoryName\n    placeImageUrl\n    regionCode\n    regionLabelKey\n    imageId\n    imageUrl\n    thumbnailUrl\n    variant\n    source\n    status\n    verifiedAt\n    createdAt\n    updatedAt\n  }\n}": typeof types.PlacePhotosDocument,
    "query PlaceStaySummaries($places: [PlaceSnapshotInput!]!) {\n  placeStaySummaries(places: $places) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": typeof types.PlaceStaySummariesDocument,
    "query PlaceStaySummary($place: PlaceSnapshotInput!) {\n  placeStaySummary(place: $place) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": typeof types.PlaceStaySummaryDocument,
    "query PosterImageDataUrl($url: String!) {\n  posterImageDataUrl(url: $url)\n}": typeof types.PosterImageDataUrlDocument,
    "mutation ReorderRouteStops($input: ReorderRouteStopsInput!) {\n  reorderRouteStops(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.ReorderRouteStopsDocument,
    "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n  }\n}": typeof types.RouteByIdDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.SaveRouteDocument,
    "mutation SetRouteStopPhotoPublication($stopId: ID!, $published: Boolean!) {\n  setRouteStopPhotoPublication(stopId: $stopId, published: $published) {\n    ...RouteDetailFields\n  }\n}": typeof types.SetRouteStopPhotoPublicationDocument,
    "mutation SetRouteStopVisitPhoto($stopId: ID!, $imageId: String!, $imageUrl: String!) {\n  setRouteStopVisitPhoto(stopId: $stopId, imageId: $imageId, imageUrl: $imageUrl) {\n    ...RouteDetailFields\n  }\n}": typeof types.SetRouteStopVisitPhotoDocument,
    "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}": typeof types.ShareRouteDocument,
    "query SharedRouteConnection($regionCode: String, $regionTag: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(\n    regionCode: $regionCode\n    regionTag: $regionTag\n    limit: $limit\n    cursor: $cursor\n  ) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": typeof types.SharedRouteConnectionDocument,
    "query SharedRoutes($regionCode: String, $regionTag: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, regionTag: $regionTag, limit: $limit) {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": typeof types.SharedRoutesDocument,
    "mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.StartRouteDocument,
    "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}": typeof types.UnlikeRouteDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": typeof types.UnsaveRouteDocument,
    "mutation UpdateRouteDayStart($input: UpdateRouteDayStartInput!) {\n  updateRouteDayStart(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.UpdateRouteDayStartDocument,
    "mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.UpdateRouteStopStayMinutesDocument,
    "mutation UpdateRouteStopVisitTimes($input: UpdateRouteStopVisitTimesInput!) {\n  updateRouteStopVisitTimes(input: $input) {\n    ...RouteDetailFields\n  }\n}": typeof types.UpdateRouteStopVisitTimesDocument,
    "mutation DeleteMyAccount {\n  deleteMyAccount {\n    id\n  }\n}": typeof types.DeleteMyAccountDocument,
    "mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}": typeof types.LoginWithPasswordDocument,
    "query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    avatarUrl\n    authProviders\n    locale\n    createdAt\n    updatedAt\n  }\n}": typeof types.MeDocument,
    "mutation RefreshAuthSession {\n  refreshAuthSession {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}": typeof types.RefreshAuthSessionDocument,
};
const documents: Documents = {
    "query GangwonFestivals($startDate: String!, $endDate: String!) {\n  gangwonFestivals(startDate: $startDate, endDate: $endDate) {\n    id\n    title\n    startDate\n    endDate\n    regionCode\n    address\n    lat\n    lng\n    imageUrl\n  }\n}": types.GangwonFestivalsDocument,
    "mutation MarkNotificationInboxRead($ids: [ID!]) {\n  markNotificationInboxRead(ids: $ids) {\n    updatedCount\n  }\n}": types.MarkNotificationInboxReadDocument,
    "query NotificationInbox($first: Int!, $after: String) {\n  notificationInbox(first: $first, after: $after) {\n    items {\n      id\n      notificationKey\n      type\n      festivalKind\n      regionCode\n      regionLabel\n      dateKey\n      festivalIds\n      festivalTitles\n      festivalStartDates\n      festivalEndDates\n      routeReviewKind\n      routeId\n      routeTitle\n      dayId\n      routeDayIndex\n      routeStartAt\n      stopId\n      placeTitle\n      correctionDeadlineAt\n      availableAt\n      readAt\n      createdAt\n      updatedAt\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  unreadNotificationCount\n}": types.NotificationInboxDocument,
    "query NotificationSettings {\n  notificationSettings {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}": types.NotificationSettingsDocument,
    "mutation RegisterPushDevice($input: RegisterPushDeviceInput!) {\n  registerPushDevice(input: $input) {\n    id\n    platform\n    appVariant\n    enabled\n    lastSeenAt\n  }\n}": types.RegisterPushDeviceDocument,
    "mutation SendFestivalTestNotification {\n  sendFestivalTestNotification {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}": types.SendFestivalTestNotificationDocument,
    "mutation SendRouteReviewTestNotification($pushDeviceId: ID!) {\n  sendRouteReviewTestNotification(pushDeviceId: $pushDeviceId) {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}": types.SendRouteReviewTestNotificationDocument,
    "mutation SyncFestivalNotificationInbox($notifications: [FestivalNotificationSyncInput!]!) {\n  syncFestivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}": types.SyncFestivalNotificationInboxDocument,
    "mutation SyncRouteArrivalNotificationInbox($notifications: [RouteArrivalNotificationSyncInput!]!) {\n  syncRouteArrivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n    notificationKeys\n  }\n}": types.SyncRouteArrivalNotificationInboxDocument,
    "mutation SyncRouteReviewNotificationInbox($notifications: [RouteReviewNotificationSyncInput!]!) {\n  syncRouteReviewNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}": types.SyncRouteReviewNotificationInboxDocument,
    "mutation UnregisterPushDevice($expoPushToken: String!) {\n  unregisterPushDevice(expoPushToken: $expoPushToken) {\n    updatedCount\n  }\n}": types.UnregisterPushDeviceDocument,
    "mutation UpdateNotificationSettings($input: UpdateNotificationSettingsInput!) {\n  updateNotificationSettings(input: $input) {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}": types.UpdateNotificationSettingsDocument,
    "mutation CacheTourCategoryLocalizations($input: [TourCategoryLocalizationInput!]!) {\n  cacheTourCategoryLocalizations(input: $input) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}": types.CacheTourCategoryLocalizationsDocument,
    "mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    operatingHours\n    restDate\n    infoCenter\n    overviewSource\n    cached\n  }\n}": types.LocalizeTourPlaceOverviewDocument,
    "mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!, $waitForFresh: Boolean = false) {\n  localizeTourPlaces(input: $input, waitForFresh: $waitForFresh) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}": types.LocalizeTourPlacesDocument,
    "query TourCategoryLocalizations($locale: String!) {\n  tourCategoryLocalizations(locale: $locale) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}": types.TourCategoryLocalizationsDocument,
    "mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.AppendRouteDaysDocument,
    "mutation CheckInRouteStop($stopId: ID!, $verification: RouteStopVisitVerificationInput!) {\n  checkInRouteStop(stopId: $stopId, verification: $verification) {\n    ...RouteDetailFields\n  }\n}": types.CheckInRouteStopDocument,
    "mutation ClearRoute($routeId: ID!) {\n  clearRoute(routeId: $routeId) {\n    ...RouteDetailFields\n  }\n}": types.ClearRouteDocument,
    "mutation CloneRoute($input: CloneRouteInput!) {\n  cloneRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.CloneRouteDocument,
    "mutation CompleteRouteStopVisit($stopId: ID!, $actualStayMinutes: Int) {\n  completeRouteStopVisit(stopId: $stopId, actualStayMinutes: $actualStayMinutes) {\n    ...RouteDetailFields\n  }\n}": types.CompleteRouteStopVisitDocument,
    "mutation CreateRouteStopVisitPhotoUpload($stopId: ID!) {\n  createRouteStopVisitPhotoUpload(stopId: $stopId) {\n    imageId\n    uploadUrl\n    imageUrl\n    fileName\n    environment\n    expiresAt\n  }\n}": types.CreateRouteStopVisitPhotoUploadDocument,
    "mutation CreateRoute($input: CreateRouteInput!) {\n  createRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.CreateRouteDocument,
    "mutation DeleteRouteDay($dayId: ID!) {\n  deleteRouteDay(dayId: $dayId) {\n    ...RouteDetailFields\n  }\n}": types.DeleteRouteDayDocument,
    "mutation DeleteRouteStopVisitPhoto($stopId: ID!) {\n  deleteRouteStopVisitPhoto(stopId: $stopId) {\n    ...RouteDetailFields\n  }\n}": types.DeleteRouteStopVisitPhotoDocument,
    "mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}": types.DeleteRouteDocument,
    "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationPhotoPublicationConsent\n  verificationPhotoPublishedAt\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n  visitTimeEditedAt\n}\n\nfragment SharedRouteOwnerFields on User {\n  id\n  displayName\n  avatarUrl\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    plannedStartMinutes\n    startedAt\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}": types.RoutePlaceFieldsFragmentDoc,
    "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}": types.LikeRouteDocument,
    "query LikedSharedRouteConnection($regionTag: String, $limit: Int, $cursor: String) {\n  likedRouteConnection(regionTag: $regionTag, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": types.LikedSharedRouteConnectionDocument,
    "query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": types.LikedSharedRoutesDocument,
    "mutation MarkRouteStopVisited($stopId: ID!, $visited: Boolean = true, $verification: RouteStopVisitVerificationInput, $actualStayMinutes: Int) {\n  markRouteStopVisited(\n    stopId: $stopId\n    visited: $visited\n    verification: $verification\n    actualStayMinutes: $actualStayMinutes\n  ) {\n    ...RouteDetailFields\n  }\n}": types.MarkRouteStopVisitedDocument,
    "query MyRouteHistoryConnection($limit: Int, $cursor: String, $today: DateTime) {\n  myRouteHistoryConnection(limit: $limit, cursor: $cursor, today: $today) {\n    nodes {\n      ...RouteDetailFields\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": types.MyRouteHistoryConnectionDocument,
    "query MyRoutes($status: RouteStatus) {\n  myRoutes(status: $status) {\n    ...RouteDetailFields\n  }\n}": types.MyRoutesDocument,
    "query PlacePhotos($place: PlaceSnapshotInput!, $limit: Int) {\n  placePhotos(place: $place, limit: $limit) {\n    id\n    placeKey\n    placeKeys\n    provider\n    externalId\n    contentId\n    contentTypeId\n    title\n    address\n    lat\n    lng\n    categoryLabel\n    categoryName\n    placeImageUrl\n    regionCode\n    regionLabelKey\n    imageId\n    imageUrl\n    thumbnailUrl\n    variant\n    source\n    status\n    verifiedAt\n    createdAt\n    updatedAt\n  }\n}": types.PlacePhotosDocument,
    "query PlaceStaySummaries($places: [PlaceSnapshotInput!]!) {\n  placeStaySummaries(places: $places) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": types.PlaceStaySummariesDocument,
    "query PlaceStaySummary($place: PlaceSnapshotInput!) {\n  placeStaySummary(place: $place) {\n    averageActualStayMinutes\n    visitCount\n    lastVisitedAt\n  }\n}": types.PlaceStaySummaryDocument,
    "query PosterImageDataUrl($url: String!) {\n  posterImageDataUrl(url: $url)\n}": types.PosterImageDataUrlDocument,
    "mutation ReorderRouteStops($input: ReorderRouteStopsInput!) {\n  reorderRouteStops(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.ReorderRouteStopsDocument,
    "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n  }\n}": types.RouteByIdDocument,
    "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.SaveRouteDocument,
    "mutation SetRouteStopPhotoPublication($stopId: ID!, $published: Boolean!) {\n  setRouteStopPhotoPublication(stopId: $stopId, published: $published) {\n    ...RouteDetailFields\n  }\n}": types.SetRouteStopPhotoPublicationDocument,
    "mutation SetRouteStopVisitPhoto($stopId: ID!, $imageId: String!, $imageUrl: String!) {\n  setRouteStopVisitPhoto(stopId: $stopId, imageId: $imageId, imageUrl: $imageUrl) {\n    ...RouteDetailFields\n  }\n}": types.SetRouteStopVisitPhotoDocument,
    "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}": types.ShareRouteDocument,
    "query SharedRouteConnection($regionCode: String, $regionTag: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(\n    regionCode: $regionCode\n    regionTag: $regionTag\n    limit: $limit\n    cursor: $cursor\n  ) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}": types.SharedRouteConnectionDocument,
    "query SharedRoutes($regionCode: String, $regionTag: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, regionTag: $regionTag, limit: $limit) {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}": types.SharedRoutesDocument,
    "mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.StartRouteDocument,
    "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}": types.UnlikeRouteDocument,
    "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}": types.UnsaveRouteDocument,
    "mutation UpdateRouteDayStart($input: UpdateRouteDayStartInput!) {\n  updateRouteDayStart(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.UpdateRouteDayStartDocument,
    "mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.UpdateRouteStopStayMinutesDocument,
    "mutation UpdateRouteStopVisitTimes($input: UpdateRouteStopVisitTimesInput!) {\n  updateRouteStopVisitTimes(input: $input) {\n    ...RouteDetailFields\n  }\n}": types.UpdateRouteStopVisitTimesDocument,
    "mutation DeleteMyAccount {\n  deleteMyAccount {\n    id\n  }\n}": types.DeleteMyAccountDocument,
    "mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}": types.LoginWithPasswordDocument,
    "query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    avatarUrl\n    authProviders\n    locale\n    createdAt\n    updatedAt\n  }\n}": types.MeDocument,
    "mutation RefreshAuthSession {\n  refreshAuthSession {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}": types.RefreshAuthSessionDocument,
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
export function graphql(source: "query GangwonFestivals($startDate: String!, $endDate: String!) {\n  gangwonFestivals(startDate: $startDate, endDate: $endDate) {\n    id\n    title\n    startDate\n    endDate\n    regionCode\n    address\n    lat\n    lng\n    imageUrl\n  }\n}"): (typeof documents)["query GangwonFestivals($startDate: String!, $endDate: String!) {\n  gangwonFestivals(startDate: $startDate, endDate: $endDate) {\n    id\n    title\n    startDate\n    endDate\n    regionCode\n    address\n    lat\n    lng\n    imageUrl\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation MarkNotificationInboxRead($ids: [ID!]) {\n  markNotificationInboxRead(ids: $ids) {\n    updatedCount\n  }\n}"): (typeof documents)["mutation MarkNotificationInboxRead($ids: [ID!]) {\n  markNotificationInboxRead(ids: $ids) {\n    updatedCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query NotificationInbox($first: Int!, $after: String) {\n  notificationInbox(first: $first, after: $after) {\n    items {\n      id\n      notificationKey\n      type\n      festivalKind\n      regionCode\n      regionLabel\n      dateKey\n      festivalIds\n      festivalTitles\n      festivalStartDates\n      festivalEndDates\n      routeReviewKind\n      routeId\n      routeTitle\n      dayId\n      routeDayIndex\n      routeStartAt\n      stopId\n      placeTitle\n      correctionDeadlineAt\n      availableAt\n      readAt\n      createdAt\n      updatedAt\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  unreadNotificationCount\n}"): (typeof documents)["query NotificationInbox($first: Int!, $after: String) {\n  notificationInbox(first: $first, after: $after) {\n    items {\n      id\n      notificationKey\n      type\n      festivalKind\n      regionCode\n      regionLabel\n      dateKey\n      festivalIds\n      festivalTitles\n      festivalStartDates\n      festivalEndDates\n      routeReviewKind\n      routeId\n      routeTitle\n      dayId\n      routeDayIndex\n      routeStartAt\n      stopId\n      placeTitle\n      correctionDeadlineAt\n      availableAt\n      readAt\n      createdAt\n      updatedAt\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  unreadNotificationCount\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query NotificationSettings {\n  notificationSettings {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query NotificationSettings {\n  notificationSettings {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RegisterPushDevice($input: RegisterPushDeviceInput!) {\n  registerPushDevice(input: $input) {\n    id\n    platform\n    appVariant\n    enabled\n    lastSeenAt\n  }\n}"): (typeof documents)["mutation RegisterPushDevice($input: RegisterPushDeviceInput!) {\n  registerPushDevice(input: $input) {\n    id\n    platform\n    appVariant\n    enabled\n    lastSeenAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SendFestivalTestNotification {\n  sendFestivalTestNotification {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}"): (typeof documents)["mutation SendFestivalTestNotification {\n  sendFestivalTestNotification {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SendRouteReviewTestNotification($pushDeviceId: ID!) {\n  sendRouteReviewTestNotification(pushDeviceId: $pushDeviceId) {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}"): (typeof documents)["mutation SendRouteReviewTestNotification($pushDeviceId: ID!) {\n  sendRouteReviewTestNotification(pushDeviceId: $pushDeviceId) {\n    notificationKey\n    pushStatus\n    pushError\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SyncFestivalNotificationInbox($notifications: [FestivalNotificationSyncInput!]!) {\n  syncFestivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}"): (typeof documents)["mutation SyncFestivalNotificationInbox($notifications: [FestivalNotificationSyncInput!]!) {\n  syncFestivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SyncRouteArrivalNotificationInbox($notifications: [RouteArrivalNotificationSyncInput!]!) {\n  syncRouteArrivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n    notificationKeys\n  }\n}"): (typeof documents)["mutation SyncRouteArrivalNotificationInbox($notifications: [RouteArrivalNotificationSyncInput!]!) {\n  syncRouteArrivalNotificationInbox(notifications: $notifications) {\n    syncedCount\n    notificationKeys\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SyncRouteReviewNotificationInbox($notifications: [RouteReviewNotificationSyncInput!]!) {\n  syncRouteReviewNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}"): (typeof documents)["mutation SyncRouteReviewNotificationInbox($notifications: [RouteReviewNotificationSyncInput!]!) {\n  syncRouteReviewNotificationInbox(notifications: $notifications) {\n    syncedCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnregisterPushDevice($expoPushToken: String!) {\n  unregisterPushDevice(expoPushToken: $expoPushToken) {\n    updatedCount\n  }\n}"): (typeof documents)["mutation UnregisterPushDevice($expoPushToken: String!) {\n  unregisterPushDevice(expoPushToken: $expoPushToken) {\n    updatedCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateNotificationSettings($input: UpdateNotificationSettingsInput!) {\n  updateNotificationSettings(input: $input) {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["mutation UpdateNotificationSettings($input: UpdateNotificationSettingsInput!) {\n  updateNotificationSettings(input: $input) {\n    festivalEnabled\n    festivalRegionCodes\n    routeStartEnabled\n    routeReviewEnabled\n    routeArrivalEnabled\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CacheTourCategoryLocalizations($input: [TourCategoryLocalizationInput!]!) {\n  cacheTourCategoryLocalizations(input: $input) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}"): (typeof documents)["mutation CacheTourCategoryLocalizations($input: [TourCategoryLocalizationInput!]!) {\n  cacheTourCategoryLocalizations(input: $input) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    operatingHours\n    restDate\n    infoCenter\n    overviewSource\n    cached\n  }\n}"): (typeof documents)["mutation LocalizeTourPlaceOverview($input: TourPlaceOverviewLocalizationInput!) {\n  localizeTourPlaceOverview(input: $input) {\n    contentId\n    overview\n    operatingHours\n    restDate\n    infoCenter\n    overviewSource\n    cached\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!, $waitForFresh: Boolean = false) {\n  localizeTourPlaces(input: $input, waitForFresh: $waitForFresh) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}"): (typeof documents)["mutation LocalizeTourPlaces($input: [TourPlaceLocalizationInput!]!, $waitForFresh: Boolean = false) {\n  localizeTourPlaces(input: $input, waitForFresh: $waitForFresh) {\n    contentId\n    title\n    address\n    titleSource\n    addressSource\n    cached\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query TourCategoryLocalizations($locale: String!) {\n  tourCategoryLocalizations(locale: $locale) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}"): (typeof documents)["query TourCategoryLocalizations($locale: String!) {\n  tourCategoryLocalizations(locale: $locale) {\n    code\n    locale\n    label\n    sourceLabel\n    cached\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation AppendRouteDays($input: AppendRouteDaysInput!) {\n  appendRouteDays(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CheckInRouteStop($stopId: ID!, $verification: RouteStopVisitVerificationInput!) {\n  checkInRouteStop(stopId: $stopId, verification: $verification) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation CheckInRouteStop($stopId: ID!, $verification: RouteStopVisitVerificationInput!) {\n  checkInRouteStop(stopId: $stopId, verification: $verification) {\n    ...RouteDetailFields\n  }\n}"];
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
export function graphql(source: "mutation CompleteRouteStopVisit($stopId: ID!, $actualStayMinutes: Int) {\n  completeRouteStopVisit(stopId: $stopId, actualStayMinutes: $actualStayMinutes) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation CompleteRouteStopVisit($stopId: ID!, $actualStayMinutes: Int) {\n  completeRouteStopVisit(stopId: $stopId, actualStayMinutes: $actualStayMinutes) {\n    ...RouteDetailFields\n  }\n}"];
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
export function graphql(source: "mutation DeleteRouteStopVisitPhoto($stopId: ID!) {\n  deleteRouteStopVisitPhoto(stopId: $stopId) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation DeleteRouteStopVisitPhoto($stopId: ID!) {\n  deleteRouteStopVisitPhoto(stopId: $stopId) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}"): (typeof documents)["mutation DeleteRoute($routeId: ID!) {\n  deleteRoute(routeId: $routeId) {\n    id\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationPhotoPublicationConsent\n  verificationPhotoPublishedAt\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n  visitTimeEditedAt\n}\n\nfragment SharedRouteOwnerFields on User {\n  id\n  displayName\n  avatarUrl\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    plannedStartMinutes\n    startedAt\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}"): (typeof documents)["fragment RoutePlaceFields on PlaceSnapshot {\n  provider\n  externalId\n  contentId\n  contentTypeId\n  title\n  address\n  lat\n  lng\n  categoryLabel\n  categoryName\n  imageUrl\n  regionCode\n  regionLabelKey\n}\n\nfragment RouteStopFields on RouteStop {\n  id\n  routeId\n  dayId\n  order\n  place {\n    ...RoutePlaceFields\n  }\n  stayMinutes\n  travelMinutesFromPrevious\n  memo\n  visitStatus\n  visitedAt\n  verificationStatus\n  verifiedAt\n  verificationPhotoImageId\n  verificationPhotoUrl\n  verificationPhotoPublicationConsent\n  verificationPhotoPublishedAt\n  verificationLat\n  verificationLng\n  verificationAccuracyMeters\n  checkedInAt\n  checkedOutAt\n  actualStayMinutes\n  visitTimeEditedAt\n}\n\nfragment SharedRouteOwnerFields on User {\n  id\n  displayName\n  avatarUrl\n}\n\nfragment RouteSummaryFields on Route {\n  id\n  sourceRouteId\n  countryCode\n  primaryRegionCode\n  primaryRegionLabelKey\n  tripDays\n  travelStartDate\n  travelEndDate\n  dailyStartMinutes\n  scheduleEndMinutes\n  status\n  visibility\n  totalStopCount\n  completedStopCount\n  likeCount\n  saveCount\n  startedAt\n  completedAt\n  sharedAt\n  shareTags\n  isMine\n  likedByMe\n  startLocation {\n    lat\n    lng\n  }\n  createdAt\n  updatedAt\n}\n\nfragment RouteDetailFields on Route {\n  ...RouteSummaryFields\n  days {\n    id\n    routeId\n    dayIndex\n    date\n    plannedStartMinutes\n    startedAt\n    stops {\n      ...RouteStopFields\n    }\n  }\n  stops {\n    ...RouteStopFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}"): (typeof documents)["mutation LikeRoute($routeId: ID!) {\n  likeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query LikedSharedRouteConnection($regionTag: String, $limit: Int, $cursor: String) {\n  likedRouteConnection(regionTag: $regionTag, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"): (typeof documents)["query LikedSharedRouteConnection($regionTag: String, $limit: Int, $cursor: String) {\n  likedRouteConnection(regionTag: $regionTag, limit: $limit, cursor: $cursor) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"): (typeof documents)["query LikedSharedRoutes {\n  likedRoutes {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"];
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
export function graphql(source: "query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n  }\n}"): (typeof documents)["query RouteById($id: ID!) {\n  route(id: $id) {\n    ...RouteDetailFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation SaveRoute($routeId: ID!) {\n  saveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SetRouteStopPhotoPublication($stopId: ID!, $published: Boolean!) {\n  setRouteStopPhotoPublication(stopId: $stopId, published: $published) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation SetRouteStopPhotoPublication($stopId: ID!, $published: Boolean!) {\n  setRouteStopPhotoPublication(stopId: $stopId, published: $published) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SetRouteStopVisitPhoto($stopId: ID!, $imageId: String!, $imageUrl: String!) {\n  setRouteStopVisitPhoto(stopId: $stopId, imageId: $imageId, imageUrl: $imageUrl) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation SetRouteStopVisitPhoto($stopId: ID!, $imageId: String!, $imageUrl: String!) {\n  setRouteStopVisitPhoto(stopId: $stopId, imageId: $imageId, imageUrl: $imageUrl) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}"): (typeof documents)["mutation ShareRoute($routeId: ID!) {\n  shareRoute(routeId: $routeId) {\n    ...RouteSummaryFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SharedRouteConnection($regionCode: String, $regionTag: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(\n    regionCode: $regionCode\n    regionTag: $regionTag\n    limit: $limit\n    cursor: $cursor\n  ) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"): (typeof documents)["query SharedRouteConnection($regionCode: String, $regionTag: String, $limit: Int, $cursor: String) {\n  sharedRouteConnection(\n    regionCode: $regionCode\n    regionTag: $regionTag\n    limit: $limit\n    cursor: $cursor\n  ) {\n    nodes {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n      stops {\n        id\n        place {\n          contentId\n          contentTypeId\n          title\n          address\n          categoryLabel\n          categoryName\n          regionCode\n          regionLabelKey\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query SharedRoutes($regionCode: String, $regionTag: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, regionTag: $regionTag, limit: $limit) {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"): (typeof documents)["query SharedRoutes($regionCode: String, $regionTag: String, $limit: Int) {\n  sharedRoutes(regionCode: $regionCode, regionTag: $regionTag, limit: $limit) {\n    ...RouteSummaryFields\n    owner {\n      ...SharedRouteOwnerFields\n    }\n    stops {\n      id\n      place {\n        contentId\n        contentTypeId\n        title\n        address\n        categoryLabel\n        categoryName\n        regionCode\n        regionLabelKey\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation StartRoute($input: StartRouteInput!) {\n  startRoute(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}"): (typeof documents)["mutation UnlikeRoute($routeId: ID!) {\n  unlikeRoute(routeId: $routeId) {\n    liked\n    saved\n    route {\n      ...RouteSummaryFields\n      owner {\n        ...SharedRouteOwnerFields\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"): (typeof documents)["mutation UnsaveRoute($routeId: ID!) {\n  unsaveRoute(routeId: $routeId) {\n    saved\n    liked\n    route {\n      ...RouteSummaryFields\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateRouteDayStart($input: UpdateRouteDayStartInput!) {\n  updateRouteDayStart(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation UpdateRouteDayStart($input: UpdateRouteDayStartInput!) {\n  updateRouteDayStart(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation UpdateRouteStopStayMinutes($input: UpdateRouteStopStayMinutesInput!) {\n  updateRouteStopStayMinutes(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateRouteStopVisitTimes($input: UpdateRouteStopVisitTimesInput!) {\n  updateRouteStopVisitTimes(input: $input) {\n    ...RouteDetailFields\n  }\n}"): (typeof documents)["mutation UpdateRouteStopVisitTimes($input: UpdateRouteStopVisitTimesInput!) {\n  updateRouteStopVisitTimes(input: $input) {\n    ...RouteDetailFields\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteMyAccount {\n  deleteMyAccount {\n    id\n  }\n}"): (typeof documents)["mutation DeleteMyAccount {\n  deleteMyAccount {\n    id\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}"): (typeof documents)["mutation LoginWithPassword($input: PasswordLoginInput!) {\n  loginWithPassword(input: $input) {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    avatarUrl\n    authProviders\n    locale\n    createdAt\n    updatedAt\n  }\n}"): (typeof documents)["query Me {\n  me {\n    id\n    accountId\n    email\n    displayName\n    avatarUrl\n    authProviders\n    locale\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RefreshAuthSession {\n  refreshAuthSession {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}"): (typeof documents)["mutation RefreshAuthSession {\n  refreshAuthSession {\n    token\n    user {\n      id\n      accountId\n      email\n      displayName\n      avatarUrl\n      authProviders\n      locale\n      createdAt\n      updatedAt\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;