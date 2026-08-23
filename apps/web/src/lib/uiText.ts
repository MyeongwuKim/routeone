import type { SearchFilter } from "@/lib/gangwonAttractionMap";
import type { NativeFestivalNotificationKind } from "@/native-bridge";
import type { AuthProvider } from "@/generated/graphql";
import {
  useAppLanguageStore,
  type AppLanguage,
} from "@/stores/appLanguageStore";

export type UiText = {
  common: {
    cancel: string;
    clearAll: string;
    close: string;
    confirm: string;
    edit: string;
    retry: string;
    reset: string;
    unknown: string;
    back: string;
    backToMyInfo: string;
    placeLocalizationLoading: string;
    selectedCount: (count: number) => string;
  };
  inputs: {
    datePlaceholder: string;
    weekdayLabels: string[];
    formatDateLabel: (
      year: number,
      month: number,
      day: number,
      weekday: string
    ) => string;
    formatMonthTitle: (year: number, month: number) => string;
    previousMonthAria: string;
    nextMonthAria: string;
    selectToday: string;
    timePlaceholder: string;
    am: string;
    pm: string;
    save: string;
  };
  labels: {
    regions: Record<string, string>;
    placeCategories: Record<string, string>;
  };
  nav: {
    home: string;
    myRoute: string;
    sharedRoute: string;
    myInfo: string;
  };
  routeShell: {
    defaultLoadingTitle: string;
    defaultLoadingDescription: string;
    homeLoadingTitle: string;
    homeLoadingDescription: string;
    loginLoadingTitle: string;
    loginLoadingDescription: string;
    myRouteTitle: string;
    myRouteDescription: string;
    myRouteLoadingTitle: string;
    myRouteLoadingDescription: string;
    sharedRouteTitle: string;
    sharedRouteDescription: string;
    sharedRouteLoadingTitle: string;
    myInfoTitle: string;
    myInfoDescription: string;
    myInfoLoadingTitle: string;
    routeHistoryTitle: string;
    routeHistoryLoadingTitle: string;
    likedRouteTitle: string;
    likedRouteLoadingTitle: string;
    accountTitle: string;
    appSettings: string;
    languageTitle: string;
    notificationSettingsTitle: string;
    serviceAreaTitle: string;
    appInfoTitle: string;
  };
  myInfo: {
    menuSection: string;
    accountInfo: string;
    accountChecking: string;
    localTestAccount: string;
    visitedRoutes: string;
    visitedRoutesDescription: string;
    likedRoutes: string;
    likedRoutesDescription: string;
    settingsSection: string;
    darkMode: string;
    darkModeOn: string;
    darkModeOff: string;
    language: string;
    korean: string;
    english: string;
    notificationSettings: string;
    notificationSettingsDescription: string;
    serviceArea: string;
    serviceAreaDescription: (area: string) => string;
    appInfo: string;
    appInfoDescription: string;
    logout: string;
    logoutDescription: string;
    logoutToast: string;
  };
  serviceArea: {
    selectAreaAria: string;
    optionDescription: (area: string) => string;
    note: string;
    changedToast: (area: string) => string;
  };
  account: {
    eyebrow: string;
    title: string;
    fallbackName: string;
    accountSection: string;
    email: string;
    accountId: string;
    loginMethods: string;
    joinedAt: string;
    providers: Record<AuthProvider, string>;
    managementSection: string;
    logout: string;
    logoutDescription: string;
    deleteAccount: string;
    deleteAccountDescription: string;
    deleteConfirmTitle: string;
    deleteConfirmDescription: string;
    deleteConfirmDetail: string;
    deleteConfirmAction: string;
    deleting: string;
    deleteSuccess: string;
    deleteError: string;
  };
  notificationSettings: {
    sectionTitle: string;
    festivalTitle: string;
    festivalOnDescription: (regions: string) => string;
    festivalOffDescription: string;
    festivalStatus: (count: number) => string;
    routeStartTitle: string;
    routeStartDescription: string;
    routeReviewTitle: string;
    routeReviewDescription: string;
    routeArrivalTitle: string;
    routeArrivalDescription: string;
    regionSectionTitle: string;
    regionSectionDescription: string;
    finishRegionSelection: string;
    selectedRegionCount: (count: number) => string;
    maxRegionToast: string;
    savedToast: string;
    saveError: string;
    permissionDeniedToast: string;
    loading: string;
  };
  language: {
    koLabel: string;
    koNativeLabel: string;
    koDescription: string;
    enLabel: string;
    enNativeLabel: string;
    enDescription: string;
    changedToKoToast: string;
    changedToEnToast: string;
    selectLanguageAria: string;
    note: string;
  };
  search: {
    filters: Record<SearchFilter, string>;
    placeholder: (region: string) => string;
    clearKeyword: string;
    close: string;
    todayFestival: string;
    concentrationRank: (rank: number) => string;
    more: (visible: number, total: number) => string;
    noResultsTitle: string;
    noResultsDescription: string;
    noResultsFooter: string;
    recentTitle: string;
    clearRecent: string;
    noRecentTitle: string;
    noRecentDescription: string;
    noRecentFooter: string;
    deleteRecentAria: (keyword: string) => string;
  };
  home: {
    missingTourKey: string;
    loadingMapTitle: string;
    loadingMapDescription: string;
    loadingLocationTitle: string;
    loadingLocationDescription: string;
    loadingFooter: string;
    loadingPlacesTitle: string;
    loadingPlacesDescription: string;
    loadingEnglishTitle: string;
    loadingEnglishDescription: string;
    loadingEnglishFooter: string;
    loadingRankingTitle: string;
    loadingRankingDescription: string;
    loadingMarkersTitle: string;
    loadingMarkersDescription: string;
    mapMissingKey: string;
    mapAuthError: (origin: string, href: string) => string;
    mapSdkMissing: string;
    mapLoadError: string;
    today: string;
    ongoing: string;
    appendDayTitle: (routeTitle: string, dayIndex: number) => string;
    appendDayDescription: (dayIndex: number) => string;
    checkout: string;
    openSearchAria: string;
    searchPrompt: (region: string) => string;
    savedPlacesAria: string;
    notificationsAria: string;
    currentLocation: string;
    focusCurrentLocationAria: string;
    currentLocationUnavailable: string;
    festivalTestSend: string;
    festivalTestSending: string;
    festivalTestSendAria: string;
    festivalTestSent: string;
    festivalTestFailed: (reason: string) => string;
    festivalTestPermissionDenied: string;
    festivalTestDeviceUnavailable: string;
    festivalTestProjectUnavailable: string;
  };
  notifications: {
    title: string;
    description: string;
    close: string;
    emptyTitle: string;
    emptyDescription: string;
    loadError: string;
    collapse: string;
    showMore: (count: number) => string;
    openFestivalAria: (festivalTitle: string) => string;
    festivalDetailLoadError: string;
    openRouteAria: (routeTitle: string) => string;
    summaryTitle: (regionLabel: string, count: number) => string;
    arrivalTitle: (placeTitle: string) => string;
    arrivalDescription: string;
    routeStartTitle: (dayIndex: number) => string;
    routeStartDescription: string;
    routeStartOverdueTitle: (dayIndex: number) => string;
    routeStartOverdueDescription: string;
    routeReviewCompletedTitle: (routeTitle: string) => string;
    routeReviewIncompleteTitle: (routeTitle: string) => string;
    routeReviewUnstartedTitle: (routeTitle: string) => string;
    routeReviewCompletedDescription: (deadlineAt: string) => string;
    routeReviewDescription: (deadlineAt: string) => string;
    formatDate: (dateKey: string) => string;
    formatTimestamp: (value: string) => string;
    kinds: Record<NativeFestivalNotificationKind, string>;
  };
  myRoute: {
    count: (count: number) => string;
    unknownDate: string;
    am: string;
    pm: string;
    deleteSuccess: string;
    deleteError: string;
    startSuccess: string;
    startError: string;
    futureStartError: string;
    viewConflictingRoute: string;
    conflictConfirm: string;
    conflictTitle: string;
    conflictDescription: (
      routeTitle: string,
      dayIndex: number,
      dateLabel: string
    ) => string;
    conflictDetail: (routeTitle: string) => string;
    appendToast: string;
    startNow: string;
    chooseStartTime: string;
    plannedPeriodPastTitle: string;
    plannedStartDiffTitle: string;
    plannedPeriodDescription: (start: string, end: string) => string;
    plannedStartDescription: (start: string, today: string) => string;
    startTodayDetail: string;
    startToday: string;
    startPlannedDate: string;
    chooseDate: string;
    deleteTitle: string;
    deleteDescription: (routeTitle: string) => string;
    deleteDetail: string;
    delete: string;
    loadError: string;
    loadingTitle: string;
    loadingDescription: string;
    needsReviewSection: string;
    upcomingSection: string;
    undatedSection: string;
    startDateModalTitle: string;
    startDateModalDescription: (routeTitle: string) => string;
    startDateLabel: string;
    startRoute: string;
    startTimeLateTitle: string;
    startTimeEarlyTitle: string;
    startTimeReviewDescription: (
      scheduledLabel: string,
      currentLabel: string
    ) => string;
    startTimeReviewDetail: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyFooter: string;
    createFromMap: string;
  };
  myRouteCard: {
    shared: string;
    pastRoute: string;
    startsToday: string;
    startRequired: string;
    inProgress: string;
    scheduled: string;
    startsTomorrow: string;
    startsInDays: (days: number) => string;
    startReviewRequired: string;
    emptyDay: string;
    additionalPlaces: (count: number) => string;
    pastSchedule: string;
    noVisitsToday: string;
    todayRouteCompleted: string;
    todaySchedule: string;
    todayProgress: string;
    completedPlaceCount: (completed: number, total: number) => string;
    routeCompleted: string;
    recordReviewNeeded: string;
    recordIncomplete: string;
    correctionUntil: (dateLabel: string) => string;
    dayTrip: string;
    nightTrip: (nights: number, days: number) => string;
    completed: string;
    proof: string;
    average: string;
    durationMinutes: (minutes: number) => string;
    durationHours: (hours: number) => string;
    durationHoursMinutes: (hours: number, minutes: number) => string;
    visitedCount: (visited: number, total: number) => string;
    placeCount: (count: number) => string;
    dayCount: (count: number) => string;
    photoRecord: string;
    folded: string;
    startTravel: string;
    start: string;
    remainingDays: string;
    swipeDays: string;
    addDay: string;
    moreDays: (count: number) => string;
  };
  routeHistory: {
    posterTitle: string;
    closeAria: string;
    posterAlt: (label: string) => string;
    share: string;
    save: string;
    backgroundTitle: string;
    backgroundPaper: string;
    backgroundSunset: string;
    backgroundOcean: string;
    backgroundForest: string;
    backgroundLavender: string;
    backgroundDawn: string;
    backgroundAlbum: string;
    backgroundChangeErrorToast: string;
    generatingTitle: string;
    generatingDescription: string;
    generatingFooter: string;
    missingPhotoToast: (count: number) => string;
    createErrorToast: string;
    saveDoneToast: string;
    downloadStartedToast: (label: string) => string;
    saveErrorToast: string;
    shareDownloadToast: string;
    shareErrorToast: string;
    eyebrow: string;
    title: string;
    description: string;
    loadedCount: (count: number) => string;
    loadError: string;
    loadingTitle: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyFooter: string;
    nextLoadingTitle: string;
    making: string;
    dayCard: string;
    createPosterAria: (routeTitle: string) => string;
    notVisited: string;
    deleteRoute: string;
    notVisitedTitle: string;
    notVisitedDescription: (routeTitle: string) => string;
    notVisitedDetail: string;
    notVisitedSuccess: string;
    notVisitedError: string;
  };
  sharedRoute: {
    feedTitle: string;
    feedDescription: string;
    feedError: string;
    feedEmpty: string;
    likedTitle: string;
    likedDescription: string;
    likedError: string;
    likedEmpty: string;
    areaFilterAria: string;
    sortAria: string;
    sortButtonLabel: string;
    sortSharedDescLabel: string;
    sortSharedDescDescription: string;
    sortSharedAscLabel: string;
    sortSharedAscDescription: string;
    sortLikesDescLabel: string;
    sortLikesDescDescription: string;
    filterButton: (count: number) => string;
    clearActiveFilters: string;
    filterTitle: string;
    filterDescription: string;
    filterClose: string;
    tagFilter: string;
    placeFilter: string;
    noTags: string;
    noPlaces: string;
    chooseRegion: string;
    regionPlaces: (region: string) => string;
    placeCount: (count: number) => string;
    noRegionPlaces: string;
    selectedCount: (count: number) => string;
    apply: (count: number) => string;
    filterTagLabel: (value: string) => string;
    filterPlaceLabel: (value: string) => string;
    selectedRouteMissing: string;
    routeNotFound: string;
    likeError: string;
    likedBackAria: string;
    loadingFeed: string;
    loadingLiked: string;
    emptyLikedDescription: string;
    emptyFeedDescription: string;
    emptyLikedFooter: string;
    emptyFeedFooter: string;
    noFilteredTitle: string;
    noFilteredDescription: string;
    noFilteredFooter: string;
    searchingConditions: string;
    loadingNext: string;
    detailError: string;
    mineBadge: string;
    ownRouteLikeAria: (count: number) => string;
    unlikeAria: (count: number) => string;
    likeAria: (count: number) => string;
  };
  sharedRouteCard: {
    unknownRegion: string;
    etcCategory: string;
    shared: string;
    routeSuffix: string;
    otherRegions: (count: number) => string;
    dayTrip: string;
    nightTrip: (nights: number, days: number) => string;
    completed: (completed: number, total: number) => string;
    densePlan: string;
    relaxedPlan: string;
    balancedPlan: string;
    lightPlan: string;
    beachRoute: string;
    cafeWalk: string;
    verificationTag: (completed: number, total: number) => string;
    unverifiedRoute: string;
    mixedRoute: string;
    focusedRoute: (focus: string) => string;
    focusCategories: Record<string, string>;
    myShare: string;
    likeAria: (title: string) => string;
    folded: string;
    morePlaces: (count: number) => string;
    moreTags: (count: number) => string;
  };
  dayRoute: {
    dateUnknown: string;
    undatedRouteTitle: string;
    routeTitle: (start: string, end: string | null) => string;
    daySchedule: (days: number) => string;
    fullRouteProgress: (completed: number, total: number) => string;
    selectedDay: (day: number, date: string) => string;
    closeAria: string;
    routeShared: string;
    routeMap: string;
    routeMapDayTitle: (day: number) => string;
    routeMapSelectedDay: (day: number) => string;
    selectedSchedule: string;
    routeMapCloseAria: string;
    routeMapComparison: string;
    addToCart: string;
    routeCalculating: string;
    mapPreparing: string;
    mapFallbackTitle: string;
    mapFallbackDescription: string;
    routeMapPartialLoadError: string;
    originalRouteDashed: string;
    recalculatedRouteSolid: string;
    startBasis: string;
    startRouteComparisonAria: string;
    stopOrderLabel: (order: string) => string;
    checkoutScopeAria: string;
    checkoutScope: string;
    checkoutScopeTitle: string;
    checkoutScopeCloseAria: string;
    selectAll: string;
    selected: string;
    select: string;
    currentViewingDaySr: string;
    selectedDays: (count: number) => string;
    addPlacesSummary: (count: number) => string;
    sharing: string;
    shared: string;
    share: string;
    shareAfterComplete: string;
    sharedRouteHeartAria: (count: number) => string;
    savedStartLocation: string;
    noStartPlace: string;
    startFromMapDescription: (day: number) => string;
    startFromFirstPlaceDescription: (day: number) => string;
    emptyStartDescription: string;
    start: string;
    firstPlace: string;
    nextPlace: string;
    currentDestination: string;
    placeDirections: string;
    openPlaceDirectionsAria: (title: string) => string;
    noStartGps: string;
    editStartLocationAria: string;
    firstPlaceTravel: (label: string) => string;
    nextPlaceTravel: (label: string) => string;
    travelLoading: string;
    travelError: string;
    travelByCar: (duration: string) => string;
    travelEstimatedByCar: (duration: string) => string;
    noTime: string;
    minutes: (minutes: number) => string;
    hours: (hours: number) => string;
    hoursMinutes: (hours: number, minutes: number) => string;
    nextDayClock: (clock: string) => string;
    dayOffsetClock: (days: number, clock: string) => string;
    visited: string;
    visiting: string;
    notVisited: string;
    arrivedAt: (clock: string) => string;
    actualTimeRange: (start: string, end: string) => string;
    ongoingTimeRange: (start: string) => string;
    estimatedTimeRange: (start: string, end: string) => string;
    actualStay: (duration: string) => string;
    plannedStay: (duration: string) => string;
    editVisitTimesAria: (title: string) => string;
    visitTimeEdited: string;
    visitTimeEditTitle: string;
    visitTimeEditDescription: string;
    arrivalTime: string;
    completionTime: string;
    gpsVerificationTimePreserved: string;
    stayTimeAfterEdit: (duration: string) => string;
    visitTimeFutureError: string;
    visitTimeOrderError: string;
    visitTimeMaxError: string;
    visitTimePreviousStopError: (title: string) => string;
    visitTimePreviousStopOngoingError: (title: string) => string;
    visitTimeNextStopError: (title: string) => string;
    saveVisitTimes: string;
    placeFallback: string;
    gpsVerification: string;
    gpsVerificationPhoto: string;
    photoPublicationQuestion: string;
    photoPublicationDescription: (title: string) => string;
    photoPublicationPrivacy: string;
    publishPhoto: string;
    keepPhotoPrivate: string;
    photoPublished: string;
    photoPrivate: string;
    unpublishPhoto: string;
    deletePhoto: string;
    deletePhotoQuestion: string;
    deletePhotoDescription: string;
    cancelPhotoDelete: string;
    addVisitPhoto: string;
    replaceVisitPhoto: string;
    gpsTestTitle: (title: string) => string;
    gpsTestDescription: string;
    gpsTestButton: string;
    gpsTestActiveButton: string;
    gpsTestOpenAria: (title: string) => string;
    gpsTestCloseAria: string;
    gpsTestPlaceLegend: string;
    gpsTestLocationLegend: string;
    gpsTestInsideRadius: (distance: string) => string;
    gpsTestOutsideRadius: (distance: string) => string;
    gpsTestApplying: string;
    gpsTestApplyLocation: string;
    gpsTestAppliedWithNotification: string;
    gpsTestAppliedWithoutNotification: string;
    gpsTestBackgroundRegistered: string;
    gpsTestBackgroundDelivered: string;
    gpsTestBackgroundNotRegistered: string;
    gpsTestBackgroundUnsupported: string;
    gpsTestUseRealLocation: string;
    gpsTestCleared: string;
    gpsTestMoveFailed: string;
    gpsTestUnavailable: string;
    photoRecord: string;
    manualCompletion: string;
    retrospectiveCompletionDescription: string;
    retrospectivePhotoCompletionAction: string;
    retrospectiveCompletionAction: string;
    noGps: string;
    closeImageAria: (label: string) => string;
    verificationImageAlt: (title: string, label: string) => string;
    viewVerificationPhotoAria: (title: string, label: string) => string;
    moveOrderAria: (title: string) => string;
    cancelVisitAria: (title: string) => string;
    markVisitAria: (title: string) => string;
    checkInAria: (title: string) => string;
    finishVisitAria: (title: string) => string;
    cancelVisitTitle: string;
    markVisitTitle: string;
    checkInTitle: string;
    finishVisitTitle: string;
    arrivalCheckTitle: string;
    arrivalCheckDescription: string;
    gpsCheckIn: string;
    manualVisitCompletion: string;
    visitFinishQuestion: string;
    elapsedSinceArrival: (duration: string) => string;
    actualStayQuestion: string;
    actualStayDescription: string;
    continueStay: string;
    completeVisit: string;
    cancelCheckIn: string;
    skipActualStay: string;
    saveActualStay: string;
    allPlacesCompleted: string;
    remainingPlaces: (count: number) => string;
    expectedStart: string;
    plannedDeparture: string;
    expectedEnd: string;
    totalDuration: string;
    actualStart: string;
    startDay: string;
    recordActualStart: string;
    editPlannedStartAria: (dayIndex: number) => string;
    editActualStartAria: (dayIndex: number) => string;
    dayStartTitle: (dayIndex: number) => string;
    plannedStartEditTitle: (dayIndex: number) => string;
    actualStartEditTitle: (dayIndex: number) => string;
    dayStartPlannedDescription: (timeLabel: string) => string;
    dayStartNow: (timeLabel: string) => string;
    startAtSelectedTime: string;
    savePlannedStart: string;
    saveActualStart: string;
    dayStartFutureError: string;
    dayStartAfterVisitError: string;
    actualEnd: string;
    actualTotalDuration: string;
    dragGuide: string;
    dropHere: string;
    dropToEnd: string;
    emptyDayTitle: string;
    emptyDayDescription: string;
    daySummaryEmpty: string;
    daySummaryMore: (firstPlace: string, count: number) => string;
    placeCount: (count: number) => string;
  };
  placeSheet: {
    rankBadge: (rank: number) => string;
    durationMinutes: (minutes: number) => string;
    durationHours: (hours: number) => string;
    durationHoursMinutes: (hours: number, minutes: number) => string;
    googleImageQuery: (keyword: string) => string;
    selectedPlaceMissing: string;
    localizationFallbackWarn: string;
    stayChecking: string;
    stayEmpty: string;
    staySamplePending: (minCount: number) => string;
    stayAverage: (averageLabel: string, visitCount: number) => string;
    currentLocation: string;
    referenceLocation: (label: string) => string;
    gangwonReferenceLocation: string;
    currentLocationCheckingTitle: string;
    currentLocationCheckingDescription: string;
    currentLocationUnavailableTitle: string;
    currentLocationUnavailableDescription: (label: string) => string;
    destination: string;
    mapLoadError: string;
    bottomSheetCloseAria: string;
    sheetCloseAria: string;
    predictionTop: (rank: number) => string;
    addToRouteAria: string;
    addToCartToast: string;
    viewSharedRoutesWithPlace: string;
    userAverageStay: string;
    placeImageAlt: (title: string, index: number) => string;
    searchMore: string;
    viewOnGoogle: string;
    imageMissingTitle: string;
    imageMissingDescription: string;
    userPhotosTitle: string;
    userPhotosDescription: string;
    userPhotoViewerTitle: (title: string) => string;
    userPhotoAlt: (title: string, index: number) => string;
    visitPhoto: string;
    noUserPhotosTitle: string;
    noUserPhotosDescription: string;
    detailTitle: string;
    noOverview: string;
    operatingHours: string;
    closedDays: string;
    contact: string;
    mapPreparing: string;
    address: string;
    routeFromCurrentLocation: (duration: string) => string;
    routeFromReferenceLocation: (label: string, duration: string) => string;
    referenceRouteNotice: string;
    routeLoadError: string;
    directions: string;
    nearbyTitle: string;
    nearbyBadge: string;
    nearbyEmpty: string;
    nearbyFootnote: string;
    topRankInfoCloseAria: string;
    topRankInfoTitle: string;
    topRankInfoDescription: string;
    topRankInfoNote: string;
    imageViewerCloseAria: string;
    previousImageAria: string;
    nextImageAria: string;
    thumbnailAlt: (title: string) => string;
    trendTitle: string;
    trendLabel: string;
    trendTooltip: (value: number) => string;
    weekly: string;
    monthly: string;
    touristTrendEmpty: string;
    nonTouristTrendEmpty: string;
    trendDescription: string;
    detailValueTranslations: Record<string, string>;
  };
  cart: {
    emptyTitle: string;
    emptyDescription: string;
    emptyFooter: string;
    thumbnailAlt: (title: string) => string;
    removeAria: (title: string) => string;
    validationStartDateRequired: string;
    validationStartDateFuture: string;
    validationTripDaysRequired: string;
    validationTimeInvalid: string;
    validationTimeOrder: string;
    apply: string;
    next: string;
    buildRoute: string;
    backAria: string;
    restartCheckout: string;
    restartCheckoutAria: string;
    appendRouteBanner: (title: string) => string;
    todayPastTitle: string;
    todayOneDayTitle: string;
    todayStartTitle: string;
    todayPastDescription: string;
    todayOneDayDescription: string;
    todayMultiDayDescription: (days: number) => string;
    useCurrentTime: string;
    continueAnyway: string;
    chooseAgain: string;
    continueToday: string;
    scheduleTitle: string;
    startDateLabel: string;
    tripDaysLabel: string;
    dayCount: (days: number) => string;
    customTripDaysButton: string;
    scheduleRange: (start: string, end: string) => string;
    todayPastWarning: string;
    todayOneDayWarning: string;
    todayMultiDayWarning: (days: number) => string;
    dailyStartTimeLabel: string;
    dailyStartTimeTitle: string;
    dailyStartTimeDescription: string;
    scheduleEndTimeLabel: string;
    scheduleEndTimeTitle: string;
    scheduleEndTimeDescription: string;
    customTripDaysTitle: string;
    customTripDaysDescription: string;
    customTripDaysPlaceholder: string;
    tempoTitle: string;
    tempoRelaxedTitle: string;
    tempoRelaxedDescription: string;
    tempoBalancedTitle: string;
    tempoBalancedDescription: string;
    tempoPackedTitle: string;
    tempoPackedDescription: string;
    startLocationTitle: string;
    startLocationDescription: string;
    startLocationGuide: string;
    startLocationPreparing: string;
    selectedStartLocation: string;
    startLocationUnavailable: string;
    nearSavedPlaces: string;
    startDistanceFar: (distance: string) => string;
    startDistanceOk: (distance: string) => string;
    startLocationPickerTitle: string;
    startLocationPickerCloseAria: string;
    startLocationPickerGuide: string;
    saveRouteFallbackError: string;
    noPlacesToSaveToast: string;
    dateConflictTitle: string;
    dateConflictDescription: (requested: string, existing: string) => string;
    dateConflictDetail: string;
    viewMyRoutes: string;
    chooseDateAgain: string;
    routeSavedToast: (count: number) => string;
    appendDaySavedToast: (title: string) => string;
    editingBadge: string;
    appendResultTitle: string;
    resultTitle: string;
    appendResultDescription: (title: string) => string;
    resultDescription: (tempoLabel: string) => string;
    overScheduleWarning: (clock: string) => string;
    startLocationLabel: string;
    firstPlaceTravelWarning: (duration: string) => string;
    startLocationRecalculateDescription: string;
    changeOnMap: string;
    finishOrderEditing: string;
    cancelChanges: string;
    applyChanges: string;
    saving: string;
    addDay: string;
    done: string;
    addSegmentAria: string;
    drag: string;
    minuteUnit: string;
    stayEditCloseAria: string;
    stayMinuteInputAria: string;
    stayTimeDescription: string;
    averageStaySummary: (visits: number, duration: string) => string;
    placeEditCloseAria: string;
    placeEditTitle: string;
    noAddress: string;
    arrivalTime: string;
    travelTime: string;
    userAverageStay: string;
    averageStayLabel: (duration: string) => string;
    averageStayVisitBasis: (visits: number) => string;
    moveToAnotherDay: string;
    moveFirst: string;
    moveLast: string;
    removeFromRoute: string;
    routeCompare: string;
    routeView: string;
    placeCount: (count: number) => string;
    moveToPreviousDayEnd: (day: number) => string;
    moveToNextDayStart: (day: number) => string;
    dropToEnd: string;
    sOrder: string;
    carTravelEstimate: string;
    carTravelDirections: string;
    routeTravelCalculatingDescription: string;
    routeTravelFallbackWarning: string;
    noPlacedPlaces: string;
    routeOriginal: string;
    routeCurrent: string;
    routeAll: string;
    routeViewModeAria: string;
    routeDayViewAria: (label: string) => string;
    segmentHighlighted: string;
    viewAll: string;
    insertSheetCloseAria: string;
    insertSheetTitle: string;
    insertSheetDescription: string;
    insertSearchPlaceholder: string;
    detour: string;
    insertEmptyTitle: string;
    insertEmptyDescription: string;
    searchDirectly: string;
  };
};

const UI_TEXT: Record<AppLanguage, UiText> = {
  ko: {
    common: {
      cancel: "취소",
      clearAll: "비우기",
      close: "닫기",
      confirm: "확인",
      edit: "수정",
      retry: "다시 시도",
      reset: "초기화",
      unknown: "미정",
      back: "이전 화면으로 돌아가기",
      backToMyInfo: "내 정보로 돌아가기",
      placeLocalizationLoading: "장소 정보를 영어로 번역하고 있어요",
      selectedCount: (count) => `${count}개 선택`,
    },
    inputs: {
      datePlaceholder: "날짜 선택",
      weekdayLabels: ["일", "월", "화", "수", "목", "금", "토"],
      formatDateLabel: (year, month, day, weekday) =>
        `${year}년 ${month}월 ${day}일 (${weekday})`,
      formatMonthTitle: (year, month) => `${year}년 ${month}월`,
      previousMonthAria: "이전 달",
      nextMonthAria: "다음 달",
      selectToday: "오늘 선택",
      timePlaceholder: "시간 선택",
      am: "오전",
      pm: "오후",
      save: "저장",
    },
    labels: {
      regions: {
        서울: "서울",
        강남구: "강남구",
        강동구: "강동구",
        강북구: "강북구",
        강서구: "강서구",
        관악구: "관악구",
        광진구: "광진구",
        구로구: "구로구",
        금천구: "금천구",
        노원구: "노원구",
        도봉구: "도봉구",
        동대문구: "동대문구",
        동작구: "동작구",
        마포구: "마포구",
        서대문구: "서대문구",
        서초구: "서초구",
        성동구: "성동구",
        성북구: "성북구",
        송파구: "송파구",
        양천구: "양천구",
        영등포구: "영등포구",
        용산구: "용산구",
        은평구: "은평구",
        종로구: "종로구",
        중구: "중구",
        중랑구: "중랑구",
        강원: "강원",
        강릉: "강릉",
        고성: "고성",
        동해: "동해",
        삼척: "삼척",
        속초: "속초",
        양구: "양구",
        양양: "양양",
        영월: "영월",
        원주: "원주",
        인제: "인제",
        정선: "정선",
        철원: "철원",
        춘천: "춘천",
        태백: "태백",
        평창: "평창",
        홍천: "홍천",
        화천: "화천",
        횡성: "횡성",
        "지역 미정": "지역 미정",
      },
      placeCategories: {
        관광지: "관광지",
        카페: "카페",
        음식점: "음식점",
        음식: "음식",
        축제: "축제",
        "축제/공연": "축제/공연",
        축제공연행사: "축제공연행사",
        문화시설: "문화시설",
        문화: "문화",
        레포츠: "레포츠",
        자연: "자연",
        자연관광: "자연관광",
        자연관광지: "자연관광지",
        강: "강",
        계곡: "계곡",
        폭포: "폭포",
        호수: "호수",
        해변: "해변",
        해수욕장: "해수욕장",
        "해변·해수욕장": "해변·해수욕장",
        섬: "섬",
        바다: "바다",
        항구: "항구",
        포구: "포구",
        등대: "등대",
        유람선: "유람선",
        잠수함관광: "잠수함관광",
        "유람선/잠수함관광": "유람선/잠수함관광",
        해양관광: "해양관광",
        수상레포츠: "수상레포츠",
        수상레저스포츠: "수상레저스포츠",
        약수터: "약수터",
        온천: "온천",
        동굴: "동굴",
        숲: "숲",
        수목원: "수목원",
        자연휴양림: "자연휴양림",
        역사: "역사",
        역사관광: "역사관광",
        역사관광지: "역사관광지",
        체험: "체험",
        체험마을: "체험마을",
        "농.산.어촌 체험": "농.산.어촌 체험",
        이색체험: "이색체험",
        전통체험: "전통체험",
        휴양관광지: "휴양관광지",
        유적지: "유적지",
        "유적지/사적지": "유적지/사적지",
        탑: "탑",
        비석: "비석",
        기념탑: "기념탑",
        기념비: "기념비",
        "탑/비석/기념탑": "탑/비석/기념탑",
        "탑ㆍ비석ㆍ기념탑": "탑ㆍ비석ㆍ기념탑",
        동상: "동상",
        조형물: "조형물",
        전망대: "전망대",
        공원: "공원",
        산: "산",
        고개: "고개",
        사찰: "사찰",
        성: "성",
        고택: "고택",
        생가: "생가",
        박물관: "박물관",
        미술관: "미술관",
        전시관: "전시관",
        공연장: "공연장",
        문화원: "문화원",
        테마공원: "테마공원",
        놀이공원: "놀이공원",
        관광단지: "관광단지",
        한식: "한식",
        중식: "중식",
        일식: "일식",
        양식: "양식",
        아시아식: "아시아식",
        이색음식점: "이색음식점",
        채식전문점: "채식전문점",
        숙박: "숙박",
        쇼핑: "쇼핑",
        관광: "관광",
        기타: "기타",
        장소: "장소",
        "지역 미정": "지역 미정",
      },
    },
    nav: {
      home: "지도",
      myRoute: "내 루트",
      sharedRoute: "공유 루트",
      myInfo: "내 정보",
    },
    routeShell: {
      defaultLoadingTitle: "화면 준비 중",
      defaultLoadingDescription: "감자가 화면 조각을 맞추고 있어요.",
      homeLoadingTitle: "지도 화면 준비 중",
      homeLoadingDescription: "주변 장소와 루트 화면을 맞추고 있어요.",
      loginLoadingTitle: "로그인 화면 준비 중",
      loginLoadingDescription: "계정 화면을 맞추고 있어요.",
      myRouteTitle: "나의 여행 루트",
      myRouteDescription: "현재 루트와 다가오는 일정을 한곳에서 확인해요",
      myRouteLoadingTitle: "감자가 내 루트 확인 중",
      myRouteLoadingDescription: "여행 일정을 정리하고 있어요.",
      sharedRouteTitle: "공유 루트",
      sharedRouteDescription: "완료한 여행 루트를 모아보는 피드",
      sharedRouteLoadingTitle: "공유 루트 찾는 중",
      myInfoTitle: "내 정보",
      myInfoDescription: "계정과 다녀온 루트를 관리하는 메뉴",
      myInfoLoadingTitle: "계정 확인 중",
      routeHistoryTitle: "다녀온 루트",
      routeHistoryLoadingTitle: "기록 찾는 중",
      likedRouteTitle: "좋아요한 공유 루트",
      likedRouteLoadingTitle: "하트 루트 찾는 중",
      accountTitle: "계정 정보",
      appSettings: "앱 설정",
      languageTitle: "언어 설정",
      notificationSettingsTitle: "알림 설정",
      serviceAreaTitle: "테스트 지역 설정",
      appInfoTitle: "버전 및 권한",
    },
    myInfo: {
      menuSection: "나의 여행",
      accountInfo: "계정 정보",
      accountChecking: "계정 확인 중",
      localTestAccount: "로컬 테스트 계정",
      visitedRoutes: "다녀온 루트",
      visitedRoutesDescription: "완료했거나 지난 일정 모아보기",
      likedRoutes: "좋아요한 공유 루트",
      likedRoutesDescription: "내가 좋아요한 공유 루트 모아보기",
      settingsSection: "앱 설정",
      darkMode: "다크 모드",
      darkModeOn: "어두운 화면으로 보기",
      darkModeOff: "밝은 화면으로 보기",
      language: "언어 설정",
      korean: "한국어",
      english: "English",
      notificationSettings: "알림 설정",
      notificationSettingsDescription: "축제·루트·장소 도착 알림 관리",
      serviceArea: "테스트 지역 설정",
      serviceAreaDescription: (area) => `${area} Open API 장소 사용 중`,
      appInfo: "버전 및 권한",
      appInfoDescription: "앱 버전과 위치·알림·카메라·앨범 권한 확인",
      logout: "로그아웃",
      logoutDescription: "현재 계정에서 나가기",
      logoutToast: "로그아웃했어요.",
    },
    serviceArea: {
      selectAreaAria: "GPS 테스트 지역 선택",
      optionDescription: (area) =>
        `${area}의 시군구별 Open API 장소를 지도에 표시해요.`,
      note: "개발 빌드에서만 사용하는 설정이에요. 현재 위치와 가까운 시군구가 홈 필터 맨 앞에 표시돼요.",
      changedToast: (area) => `${area} 테스트 모드로 변경했어요.`,
    },
    account: {
      eyebrow: "내 정보",
      title: "계정 정보",
      fallbackName: "RouteOne 사용자",
      accountSection: "현재 계정",
      email: "이메일",
      accountId: "아이디",
      loginMethods: "연결된 로그인",
      joinedAt: "가입일",
      providers: {
        PASSWORD: "테스트용",
        GOOGLE: "Google",
        APPLE: "Apple",
        UNKNOWN: "테스트용",
      },
      managementSection: "계정 관리",
      logout: "로그아웃",
      logoutDescription: "현재 계정에서 나가기",
      deleteAccount: "회원 탈퇴",
      deleteAccountDescription: "계정과 저장된 데이터를 모두 삭제",
      deleteConfirmTitle: "RouteOne을 탈퇴할까요?",
      deleteConfirmDescription:
        "내 루트와 방문 기록, 인증 사진, 좋아요와 알림 설정이 모두 삭제돼요.",
      deleteConfirmDetail:
        "삭제한 계정과 여행 기록은 복구할 수 없어요.",
      deleteConfirmAction: "탈퇴하기",
      deleting: "탈퇴 처리 중...",
      deleteSuccess: "회원 탈퇴가 완료됐어요.",
      deleteError: "회원 탈퇴에 실패했어요. 다시 시도해 주세요.",
    },
    notificationSettings: {
      sectionTitle: "받을 알림",
      festivalTitle: "축제 알림",
      festivalOnDescription: (regions) => `${regions} 축제 소식 받기`,
      festivalOffDescription: "지역을 선택하면 축제 소식을 받을 수 있어요",
      festivalStatus: (count) =>
        count > 0 ? `${count}곳 알림 중` : "꺼짐",
      routeStartTitle: "일정 시작 알림",
      routeStartDescription:
        "각 DAY 시작 1시간 전과 미시작 시 한 번 더 안내",
      routeReviewTitle: "루트 종료 알림",
      routeReviewDescription:
        "루트 종료 후 7일 안에 방문 기록을 확인·정리하도록 보내는 리마인더",
      routeArrivalTitle: "장소 도착 알림",
      routeArrivalDescription:
        "앱이 닫혀 있어도 다음 장소 300m 근처에서 인증 사진 알림",
      regionSectionTitle: "축제 알림 지역",
      regionSectionDescription:
        "최대 2곳까지 선택할 수 있어요. 선택하지 않으면 알림이 꺼져요.",
      finishRegionSelection: "선택 완료",
      selectedRegionCount: (count) => `${count}/2곳 선택`,
      maxRegionToast: "축제 알림 지역은 최대 2곳까지 선택할 수 있어요.",
      savedToast: "알림 설정을 저장했어요.",
      saveError: "알림 설정을 저장하지 못했어요.",
      permissionDeniedToast: "기기 설정에서 알림 권한을 켜 주세요.",
      loading: "알림 설정을 불러오고 있어요.",
    },
    language: {
      koLabel: "한국어",
      koNativeLabel: "Korean",
      koDescription: "지도와 관광 정보를 한국어로 표시",
      enLabel: "English",
      enNativeLabel: "영어",
      enDescription: "Show maps and travel information in English",
      changedToKoToast: "언어가 한국어로 변경됐어요.",
      changedToEnToast: "언어가 영어로 변경됐어요.",
      selectLanguageAria: "표시 언어 선택",
      note:
        "선택한 언어는 지도, 장소 검색과 관광 정보에 적용돼요. 계정과 루트에 저장된 기존 내용은 바뀌지 않아요.",
    },
    search: {
      filters: {
        all: "전체",
        tourist: "관광지",
        food: "음식점",
        cafe: "카페",
        festival: "축제",
      },
      placeholder: (region) => `${region} 명소, 카페, 음식점, 축제 검색`,
      clearKeyword: "검색어 지우기",
      close: "검색 닫기",
      todayFestival: "오늘 진행 중",
      concentrationRank: (rank) => `예측 집중률 ${rank}위`,
      more: (visible, total) => `더 보기 ${visible}/${total}`,
      noResultsTitle: "검색 결과가 없어요",
      noResultsDescription: "감자가 다른 장소도 꼼꼼히 찾아봤어요.",
      noResultsFooter: "검색어나 카테고리를 바꿔보세요.",
      recentTitle: "최근 검색",
      clearRecent: "전체 비우기",
      noRecentTitle: "아직 최근 검색어가 없어요",
      noRecentDescription: "감자가 첫 번째 검색을 기다리고 있어요.",
      noRecentFooter: "장소를 검색하면 여기에 기록돼요.",
      deleteRecentAria: (keyword) => `${keyword} 최근 검색 삭제`,
    },
    home: {
      missingTourKey: "VITE_VISITKOREA_SERVICE_KEY가 비어있습니다.",
      loadingMapTitle: "지도를 준비하고 있어요",
      loadingMapDescription: "지도를 다시 연결하는 중",
      loadingLocationTitle: "내 위치를 확인하고 있어요",
      loadingLocationDescription: "가까운 지역 필터를 준비하는 중",
      loadingFooter: "감자 분석 모드 진행 중",
      loadingPlacesTitle: "장소 데이터를 찾고 있어요",
      loadingPlacesDescription: "지도를 보면서 장소 후보를 찾는 중",
      loadingEnglishTitle: "영문 장소 정보를 준비하고 있어요",
      loadingEnglishDescription: "공식 영문주소와 장소명을 저장하는 중",
      loadingEnglishFooter: "다음부터는 저장된 정보를 바로 불러와요",
      loadingRankingTitle: "순위를 매기고 있어요",
      loadingRankingDescription: "방문자 집중률 예측 데이터를 정리하는 중",
      loadingMarkersTitle: "지도를 그리고 있어요",
      loadingMarkersDescription: "지도 위에 핀을 배치하는 중",
      mapMissingKey: "VITE_NCP_MAPS_KEY_ID가 설정되지 않았습니다.",
      mapAuthError: (origin, href) =>
        origin === "unknown"
          ? "네이버 지도 인증에 실패했습니다. 앱이 원격 웹 번들 entryUrl이 아닌 내장 HTML로 실행 중인지 확인해 주세요."
          : `네이버 지도 인증에 실패했습니다. 네이버 콘솔 Web 서비스 URL에 ${origin} 등록 여부를 확인해 주세요. 실행 URL: ${href}`,
      mapSdkMissing: "Naver Maps SDK를 찾을 수 없습니다.",
      mapLoadError: "지도 로드에 실패했습니다. 키와 도메인 등록을 확인해 주세요.",
      today: "오늘",
      ongoing: "진행 중",
      appendDayTitle: (routeTitle, dayIndex) =>
        `${routeTitle}에 DAY ${dayIndex} 추가 중`,
      appendDayDescription: (dayIndex) =>
        `지도에서 장소를 담은 뒤 DAY ${dayIndex} 일정을 완성해 보세요`,
      checkout: "담은 장소 확인",
      openSearchAria: "장소 검색 열기",
      searchPrompt: (region) => `${region} 명소 검색`,
      savedPlacesAria: "담은 장소",
      notificationsAria: "알림함 열기",
      currentLocation: "현재 위치",
      focusCurrentLocationAria: "현재 위치로 이동",
      currentLocationUnavailable: "현재 위치를 확인하지 못했어요.",
      festivalTestSend: "축제 알림 바로 보내기",
      festivalTestSending: "보내는 중",
      festivalTestSendAria: "알림 설정 지역의 실제 축제 알림 보내기",
      festivalTestSent: "실제 축제 알림을 보냈어요.",
      festivalTestFailed: (reason) =>
        reason || "축제 테스트 알림을 보내지 못했어요.",
      festivalTestPermissionDenied:
        "알림 권한이 꺼져 있어요. 기기 설정에서 알림을 허용해 주세요.",
      festivalTestDeviceUnavailable:
        "이 앱에서 푸시 토큰을 가져오지 못했어요. 앱을 다시 실행한 뒤 시도해 주세요.",
      festivalTestProjectUnavailable:
        "앱의 Expo 프로젝트 설정을 확인해 주세요.",
    },
    notifications: {
      title: "알림함",
      description: "받은 여행 알림을 날짜별로 모아봐요",
      close: "알림함 닫기",
      emptyTitle: "아직 받은 알림이 없어요",
      emptyDescription:
        "축제 소식, 일정 시작, 장소 도착과 루트 기록 안내가 여기에 모여요.",
      loadError: "알림을 불러오지 못했어요",
      collapse: "접기",
      showMore: (count) => `${count}개 더 보기`,
      openFestivalAria: (festivalTitle) => `${festivalTitle} 축제 보기`,
      festivalDetailLoadError: "축제 상세 정보를 불러오지 못했어요.",
      openRouteAria: (routeTitle) => `${routeTitle} 일정 보기`,
      summaryTitle: (regionLabel, count) =>
        `${regionLabel}에서 열리는 축제 ${count}개`,
      arrivalTitle: (placeTitle) => `${placeTitle}에 도착했어요`,
      arrivalDescription: "방문 인증 사진을 남겨보세요.",
      routeStartTitle: (dayIndex) =>
        `DAY ${dayIndex} 일정이 시작돼요`,
      routeStartDescription:
        "방문할 장소와 이동 경로를 미리 확인해 보세요.",
      routeStartOverdueTitle: (dayIndex) =>
        `DAY ${dayIndex} 시작 시간이 지났어요`,
      routeStartOverdueDescription:
        "아직 출발하지 않았다면 오늘 일정과 이동 경로를 확인해 보세요.",
      routeReviewCompletedTitle: (routeTitle) =>
        `${routeTitle}, 무사히 잘 마쳤네요`,
      routeReviewIncompleteTitle: (routeTitle) =>
        `${routeTitle} 기록을 마무리해 보세요`,
      routeReviewUnstartedTitle: (routeTitle) =>
        `${routeTitle} 일정이 끝났어요`,
      routeReviewCompletedDescription: (deadlineAt) => {
        const date = new Date(deadlineAt);
        const correctionText = Number.isFinite(date.getTime())
          ? `빠진 기록은 ${date.getMonth() + 1}월 ${date.getDate()}일까지 보완할 수 있어요.`
          : "빠진 기록은 종료 후 7일 안에 보완할 수 있어요.";

        return `${correctionText} DAY 카드를 만들거나 내 루트를 공유해 보세요.`;
      },
      routeReviewDescription: (deadlineAt) => {
        const date = new Date(deadlineAt);
        return Number.isFinite(date.getTime())
          ? `${date.getMonth() + 1}월 ${date.getDate()}일까지 방문 기록을 보정할 수 있어요.`
          : "종료 후 7일 동안 방문 기록을 보정할 수 있어요.";
      },
      formatDate: (dateKey) => {
        const [year, month, day] = dateKey.split("-");
        return `${year}.${Number(month)}.${Number(day)}`;
      },
      formatTimestamp: (value) => {
        const date = new Date(value);
        return Number.isFinite(date.getTime())
          ? `${date.getMonth() + 1}.${date.getDate()} ${date.getHours() < 12 ? "오전" : "오후"} ${date.getHours() % 12 || 12}:${`${date.getMinutes()}`.padStart(2, "0")}`
          : value;
      },
      kinds: {
        today: "오늘",
        weekly: "이번 주",
        monthly: "이번 달",
        trip: "여행일",
        test: "테스트",
      },
    },
    myRoute: {
      count: (count) => `${count}개`,
      unknownDate: "미정",
      am: "오전",
      pm: "오후",
      deleteSuccess: "일정을 삭제했어요.",
      deleteError: "일정을 삭제하지 못했어요.",
      startSuccess: "여행을 시작했어요.",
      startError: "여행을 시작하지 못했어요.",
      futureStartError: "미래 날짜의 여행은 아직 시작할 수 없어요.",
      viewConflictingRoute: "해당 일정 보기",
      conflictConfirm: "확인",
      conflictTitle: "다음 날짜에 이미 일정이 있어요",
      conflictDescription: (routeTitle, dayIndex, dateLabel) =>
        `${routeTitle}에 DAY ${dayIndex}을 추가하려면 ${dateLabel} 날짜가 필요해요.`,
      conflictDetail: (routeTitle) =>
        `${routeTitle} 일정이 같은 날짜를 사용 중이라 바로 이어 붙일 수 없어요. 아래 일정을 수정하거나 날짜를 먼저 비워주세요.`,
      appendToast: "지도에서 장소를 담아 추가할 DAY를 만들어요.",
      startNow: "지금 시작하기",
      chooseStartTime: "시작시간 선택",
      plannedPeriodPastTitle: "예정 기간이 지났어요",
      plannedStartDiffTitle: "여행을 오늘 시작할까요?",
      plannedPeriodDescription: (start, end) =>
        `예정 기간은 ${start} ~ ${end}였어요.`,
      plannedStartDescription: (start) =>
        `설정된 시작일은 ${start}이에요.`,
      startTodayDetail:
        "지금 시작하면 DAY 1 일정만 오늘과 현재 시간 기준으로 다시 계산돼요.",
      startToday: "지금 시작하기",
      startPlannedDate: "예정일로 시작",
      chooseDate: "다른 날짜 선택",
      deleteTitle: "일정을 삭제할까요?",
      deleteDescription: (routeTitle) =>
        `${routeTitle} 전체와 포함된 DAY, 장소가 모두 삭제돼요.`,
      deleteDetail: "삭제한 일정은 다시 되돌릴 수 없어요.",
      delete: "삭제",
      loadError: "내 루트를 불러오지 못했어요.",
      loadingTitle: "감자가 내 루트 확인 중",
      loadingDescription: "여행 일정을 정리하고 있어요.",
      needsReviewSection: "시작 확인 필요",
      upcomingSection: "다가오는 일정",
      undatedSection: "날짜 미정 루트",
      startDateModalTitle: "다른 시작일 선택",
      startDateModalDescription: (routeTitle) =>
        `${routeTitle}의 DAY 1 기준 날짜를 선택해요.`,
      startDateLabel: "시작 날짜",
      startRoute: "시작하기",
      startTimeLateTitle: "계획 시작 시각이 지났어요",
      startTimeEarlyTitle: "계획 시작 시각보다 빨라요",
      startTimeReviewDescription: (scheduledLabel, currentLabel) =>
        `계획 시작 시각은 ${scheduledLabel}, 현재 시간은 ${currentLabel}예요.`,
      startTimeReviewDetail:
        "지금 시작하면 DAY 1 일정만 현재 시간 기준으로 다시 계산돼요.",
      emptyTitle: "아직 만든 루트가 없어요",
      emptyDescription: "감자가 빈 여행 가방을 보고 있어요.",
      emptyFooter: "지도에서 장소를 담고 루트를 만들어 보세요.",
      createFromMap: "지도에서 루트 만들기",
    },
    myRouteCard: {
      shared: "공유됨",
      pastRoute: "지난 루트",
      startsToday: "오늘 시작",
      startRequired: "시작 필요",
      inProgress: "여행 중",
      scheduled: "예정",
      startsTomorrow: "내일 시작",
      startsInDays: (days) => `${days}일 후 시작`,
      startReviewRequired: "시작 확인 필요",
      emptyDay: "비어 있음",
      additionalPlaces: (count) => `외 ${count}곳`,
      pastSchedule: "지난 일정",
      noVisitsToday: "오늘 등록된 방문지가 없어요",
      todayRouteCompleted: "오늘 루트 완료",
      todaySchedule: "오늘 일정",
      todayProgress: "오늘 진행률",
      completedPlaceCount: (completed, total) => `${completed}/${total}곳 완료`,
      routeCompleted: "완료",
      recordReviewNeeded: "기록 확인 필요",
      recordIncomplete: "미완료",
      correctionUntil: (dateLabel) => `${dateLabel}까지 수정 가능`,
      dayTrip: "당일치기",
      nightTrip: (nights, days) => `${nights}박 ${days}일`,
      completed: "완료",
      proof: "인증",
      average: "평균",
      durationMinutes: (minutes) => `${minutes}분`,
      durationHours: (hours) => `${hours}시간`,
      durationHoursMinutes: (hours, minutes) => `${hours}시간 ${minutes}분`,
      visitedCount: (visited, total) => `${visited}/${total}곳 방문`,
      placeCount: (count) => `${count}곳`,
      dayCount: (count) => `${count}일`,
      photoRecord: "기록",
      folded: "접기",
      startTravel: "여행 시작",
      start: "시작",
      remainingDays: "나머지 Day",
      swipeDays: "좌우로 넘겨보기",
      addDay: "DAY 추가",
      moreDays: (count) => `+${count}일 더 있음`,
    },
    routeHistory: {
      posterTitle: "DAY 포스터",
      closeAria: "닫기",
      posterAlt: (label) => `${label} 포스터 미리보기`,
      share: "공유",
      save: "저장",
      backgroundTitle: "배경 선택",
      backgroundPaper: "종이",
      backgroundSunset: "노을",
      backgroundOcean: "바다",
      backgroundForest: "숲",
      backgroundLavender: "라벤더",
      backgroundDawn: "새벽",
      backgroundAlbum: "앨범",
      backgroundChangeErrorToast: "포토카드 배경을 바꾸지 못했어요.",
      generatingTitle: "감자가 DAY 카드를 변환 중...",
      generatingDescription: "폴라로이드 사진을 PNG로 굽고 있어요.",
      generatingFooter: "잠시만 기다려주세요",
      missingPhotoToast: (count) => `사진 ${count}장을 카드에 넣지 못했어요.`,
      createErrorToast: "DAY 포스터를 만들지 못했어요.",
      saveDoneToast: "포토카드 저장/공유를 완료했어요.",
      downloadStartedToast: (label) => `${label} PNG 다운로드를 시작했어요.`,
      saveErrorToast: "포토카드를 저장하지 못했어요.",
      shareDownloadToast: "공유를 지원하지 않아 PNG 다운로드를 시작했어요.",
      shareErrorToast: "포스터 공유를 완료하지 못했어요.",
      eyebrow: "내 정보",
      title: "다녀온 루트",
      description: "완료했거나 지난 일정",
      loadedCount: (count) => `불러온 ${count}개 루트 · 종료 후 7일 보정 가능`,
      loadError: "다녀온 루트를 불러오지 못했어요.",
      loadingTitle: "기록 찾는 중",
      emptyTitle: "아직 다녀온 루트가 없어요.",
      emptyDescription: "감자가 빈 여행 기록을 보고 있어요.",
      emptyFooter: "완료했거나 종료된 일정이 여기에 모여요.",
      nextLoadingTitle: "다음 기록 찾는 중",
      making: "제작 중",
      dayCard: "DAY 카드",
      createPosterAria: (routeTitle) => `${routeTitle} DAY 포스터 만들기`,
      notVisited: "완료한 장소가 없어요",
      deleteRoute: "일정 삭제",
      notVisitedTitle: "이 일정을 삭제할까요?",
      notVisitedDescription: (routeTitle) =>
        `${routeTitle}에는 완료된 방문 기록이 없어요.`,
      notVisitedDetail: "일정과 장소 기록이 삭제되며 다시 되돌릴 수 없어요.",
      notVisitedSuccess: "일정을 삭제했어요.",
      notVisitedError: "일정을 삭제하지 못했어요.",
    },
    sharedRoute: {
      feedTitle: "공유 루트",
      feedDescription: "완료한 여행 루트를 모아보는 피드",
      feedError: "공유 루트를 불러오지 못했어요.",
      feedEmpty: "아직 공유된 루트가 없어요.",
      likedTitle: "좋아요한 공유 루트",
      likedDescription: "내가 좋아요한 공유 루트 모아보기",
      likedError: "좋아요한 공유 루트를 불러오지 못했어요.",
      likedEmpty: "아직 좋아요한 공유 루트가 없어요.",
      areaFilterAria: "공유 루트 지역 선택",
      sortAria: "공유 루트 정렬",
      sortButtonLabel: "정렬",
      sortSharedDescLabel: "최신순",
      sortSharedDescDescription: "최근 공유된 루트 먼저",
      sortSharedAscLabel: "오래된순",
      sortSharedAscDescription: "오래전에 공유된 루트 먼저",
      sortLikesDescLabel: "인기순",
      sortLikesDescDescription: "하트가 많은 루트 먼저",
      filterButton: (count) => `필터${count > 0 ? ` ${count}` : ""}`,
      clearActiveFilters: "전체 해제",
      filterTitle: "필터 옵션",
      filterDescription:
        "태그를 고르거나, 지역을 누른 뒤 해당 지역의 장소를 선택해요.",
      filterClose: "필터 닫기",
      tagFilter: "태그 필터",
      placeFilter: "장소 필터",
      noTags: "선택할 태그가 없어요.",
      noPlaces: "선택할 장소가 없어요.",
      chooseRegion: "지역 선택",
      regionPlaces: (region) => `${region} 장소`,
      placeCount: (count) => `${count}곳`,
      noRegionPlaces: "이 지역의 명소를 찾지 못했어요.",
      selectedCount: (count) => `${count}개 선택`,
      apply: (count) => `확인${count > 0 ? ` ${count}` : ""}`,
      filterTagLabel: (value) => `태그: ${value}`,
      filterPlaceLabel: (value) => `장소: ${value}`,
      selectedRouteMissing: "선택한 공유 루트가 없습니다.",
      routeNotFound: "공유 루트를 찾지 못했어요.",
      likeError: "좋아요를 반영하지 못했어요.",
      likedBackAria: "내 정보로 돌아가기",
      loadingFeed: "공유 루트 찾는 중",
      loadingLiked: "하트 루트 찾는 중",
      emptyLikedDescription: "좋아요한 루트는 여기서 볼 수 있어요.",
      emptyFeedDescription: "공개된 여행 루트를 찾고 있어요.",
      emptyLikedFooter: "공유 루트에서 하트를 눌러보세요.",
      emptyFeedFooter: "공유된 루트가 여기에 모여요.",
      noFilteredTitle: "조건에 맞는 공유 루트가 없어요.",
      noFilteredDescription: "감자가 필터 안을 다시 살펴보고 있어요.",
      noFilteredFooter: "필터를 줄이면 더 많은 루트가 보여요.",
      searchingConditions: "조건 찾는 중",
      loadingNext: "다음 루트 찾는 중",
      detailError: "공유 루트 상세를 불러오지 못했어요.",
      mineBadge: "내 공유 루트",
      ownRouteLikeAria: (count) => `내가 공유한 루트, 하트 ${count}개`,
      unlikeAria: (count) => `좋아요 취소, 하트 ${count}개`,
      likeAria: (count) => `좋아요, 하트 ${count}개`,
    },
    sharedRouteCard: {
      unknownRegion: "지역 미정",
      etcCategory: "기타",
      shared: "공유",
      routeSuffix: "루트",
      otherRegions: (count) => `외 ${count}`,
      dayTrip: "당일치기",
      nightTrip: (nights, days) => `${nights}박 ${days}일`,
      completed: (completed, total) => `${completed}/${total} 완료`,
      densePlan: "촘촘 플랜",
      relaxedPlan: "여유 플랜",
      balancedPlan: "균형 플랜",
      lightPlan: "가벼운 플랜",
      beachRoute: "해변 루트",
      cafeWalk: "카페 산책",
      verificationTag: (completed, total) => `인증 ${completed}/${total}곳`,
      unverifiedRoute: "미인증 루트",
      mixedRoute: "골고루 담은 루트",
      focusedRoute: (focus) => `${focus} 위주`,
      focusCategories: {
        카페: "카페",
        음식점: "음식점",
        관광지: "관광지",
        해변: "해변",
        공원: "공원",
        동굴: "동굴",
        시장: "시장",
        장소: "장소",
      },
      myShare: "내 공유",
      likeAria: (title) => `${title} 좋아요`,
      folded: "접기",
      morePlaces: (count) => `+${count}`,
      moreTags: (count) => `+${count}`,
    },
    dayRoute: {
      dateUnknown: "날짜 미정",
      undatedRouteTitle: "날짜 미정 일정",
      routeTitle: (start, end) =>
        end && start !== end ? `${start} ~ ${end} 일정` : `${start} 일정`,
      daySchedule: (days) => `${days}일 일정`,
      fullRouteProgress: (completed, total) =>
        `전체 루트 ${completed}/${total} 완료`,
      selectedDay: (day, date) => `DAY ${day} 선택됨 · ${date}`,
      closeAria: "일차 경로 닫기",
      routeShared: "공유됨",
      routeMap: "루트 지도",
      routeMapDayTitle: (day) => `DAY ${day} ROUTE`,
      routeMapSelectedDay: (day) => `DAY ${day} 선택`,
      selectedSchedule: "선택한 일정",
      routeMapCloseAria: "루트 지도 닫기",
      routeMapComparison: "기존/재계산 비교",
      addToCart: "담기",
      routeCalculating: "경로 계산 중",
      mapPreparing: "지도 준비 중",
      mapFallbackTitle: "지도 대신 장소 순서를 보여드려요",
      mapFallbackDescription:
        "지도 SDK를 불러오지 못했지만 아래에서 방문 순서와 완료 장소를 확인할 수 있어요.",
      routeMapPartialLoadError:
        "일부 도로 경로를 불러오지 못해 직선으로 표시했습니다.",
      originalRouteDashed: "기존 경로 점선",
      recalculatedRouteSolid: "재계산 경로 실선",
      startBasis: "START 기준",
      startRouteComparisonAria: "START 기준 경로 비교",
      stopOrderLabel: (order) => `${order}번째`,
      checkoutScopeAria: "담기 범위 선택",
      checkoutScope: "담기 범위",
      checkoutScopeTitle: "담을 DAY를 선택해주세요",
      checkoutScopeCloseAria: "담기 범위 닫기",
      selectAll: "전체 선택",
      selected: "선택됨",
      select: "선택",
      currentViewingDaySr: "현재 보고 있는 DAY",
      selectedDays: (count) => `${count}일 선택`,
      addPlacesSummary: (count) => `총 ${count}곳 담기`,
      sharing: "공유 중",
      shared: "공유됨",
      share: "공유하기",
      shareAfterComplete: "완료 후 공유",
      sharedRouteHeartAria: (count) => `하트 ${count}개 받은 공유 루트`,
      savedStartLocation: "저장한 출발 위치",
      noStartPlace: "출발 장소 없음",
      startFromMapDescription: (day) =>
        `DAY ${day} 루트 지도에서 START로 표시돼요.`,
      startFromFirstPlaceDescription: (day) =>
        `별도 출발지 없이 첫 장소부터 DAY ${day}를 시작해요.`,
      emptyStartDescription: "장소를 추가하면 첫 장소가 출발 기준으로 표시돼요.",
      start: "출발",
      firstPlace: "첫 장소",
      nextPlace: "다음 목적지",
      currentDestination: "현재 목적지",
      placeDirections: "지도·길찾기",
      openPlaceDirectionsAria: (title) => `${title} 지도와 길찾기 보기`,
      noStartGps: "출발 GPS 없음",
      editStartLocationAria: "스타트 지점 수정",
      firstPlaceTravel: (label) => `이동 · ${label}`,
      nextPlaceTravel: (label) => `다음 목적지까지 ${label}`,
      travelLoading: "이동 시간 계산 중",
      travelError: "이동 시간 확인 불가",
      travelByCar: (duration) => `차량 약 ${duration}`,
      travelEstimatedByCar: (duration) => `차량 추정 ${duration}`,
      noTime: "시간 미정",
      minutes: (minutes) => `${minutes}분`,
      hours: (hours) => `${hours}시간`,
      hoursMinutes: (hours, minutes) => `${hours}시간 ${minutes}분`,
      nextDayClock: (clock) => `다음날 ${clock}`,
      dayOffsetClock: (days, clock) => `+${days}일 ${clock}`,
      visited: "완료됨",
      visiting: "머무는 중",
      notVisited: "방문 전",
      arrivedAt: (clock) => `${clock} 도착`,
      actualTimeRange: (start, end) => `${start} 도착 · ${end} 완료`,
      ongoingTimeRange: (start) => `${start} 도착 · 머무는 중`,
      estimatedTimeRange: (start, end) => `예상 ${start}-${end}`,
      actualStay: (duration) => `실제 ${duration}`,
      plannedStay: (duration) => `계획 ${duration}`,
      editVisitTimesAria: (title) => `${title} 도착 및 완료시간 수정`,
      visitTimeEdited: "수정됨",
      visitTimeEditTitle: "방문시간 수정",
      visitTimeEditDescription:
        "일정 날짜는 그대로 두고 실제 도착·완료시간만 수정해요.",
      arrivalTime: "도착시간",
      completionTime: "완료시간",
      gpsVerificationTimePreserved:
        "GPS 인증 시각과 인증 위치는 원본 기록으로 그대로 보관돼요.",
      stayTimeAfterEdit: (duration) => `수정 후 실제 체류시간 ${duration}`,
      visitTimeFutureError: "현재보다 이후 시간은 입력할 수 없어요.",
      visitTimeOrderError: "완료시간은 도착시간보다 빠를 수 없어요.",
      visitTimeMaxError: "체류시간은 최대 8시간까지 기록할 수 있어요.",
      visitTimePreviousStopError: (title) =>
        `도착시간은 앞 장소 '${title}'의 완료시간보다 빠를 수 없어요.`,
      visitTimePreviousStopOngoingError: (title) =>
        `앞 장소 '${title}' 방문을 먼저 완료해 주세요.`,
      visitTimeNextStopError: (title) =>
        `방문시간은 다음 목적지 '${title}'의 도착시간보다 늦을 수 없어요.`,
      saveVisitTimes: "시간 저장",
      placeFallback: "장소",
      gpsVerification: "GPS 인증",
      gpsVerificationPhoto: "GPS 인증 사진",
      photoPublicationQuestion: "이 사진을 장소 사진에 공개할까요?",
      photoPublicationDescription: (title) =>
        `공개하면 ${title} 상세의 ‘사용자들이 올린 사진’에서 다른 사용자가 볼 수 있어요.`,
      photoPublicationPrivacy:
        "사진만 공개되며 비공개 루트와 일정은 공개되지 않아요.",
      publishPhoto: "사진 공개하기",
      keepPhotoPrivate: "나만 보기",
      photoPublished: "장소 사진에 공개 중",
      photoPrivate: "나만 보는 사진",
      unpublishPhoto: "공개 취소",
      deletePhoto: "사진 삭제",
      deletePhotoQuestion: "인증 사진을 삭제할까요?",
      deletePhotoDescription:
        "사진은 완전히 삭제되지만 방문과 체류 기록은 유지돼요.",
      cancelPhotoDelete: "취소",
      addVisitPhoto: "사진 추가",
      replaceVisitPhoto: "사진 변경",
      gpsTestTitle: (title) => `${title} GPS 테스트`,
      gpsTestDescription:
        "보라색 마커로 앱 실행 중 위치를 테스트해요. 초록색 원은 300m 도착 반경이며, 종료 상태 알림 등록 여부는 아래에 따로 표시돼요.",
      gpsTestButton: "테스트",
      gpsTestActiveButton: "테스트 중",
      gpsTestOpenAria: (title) => `${title} GPS 테스트 지도 열기`,
      gpsTestCloseAria: "GPS 테스트 지도 닫기",
      gpsTestPlaceLegend: "장소",
      gpsTestLocationLegend: "테스트 위치",
      gpsTestInsideRadius: (distance) =>
        `장소까지 ${distance} · GPS 성공 예상`,
      gpsTestOutsideRadius: (distance) =>
        `장소까지 ${distance} · GPS 실패 예상`,
      gpsTestApplying: "적용 중",
      gpsTestApplyLocation: "이 위치 적용",
      gpsTestAppliedWithNotification:
        "테스트 위치를 적용했고 앱 실행 중 즉시 알림을 보냈어요.",
      gpsTestAppliedWithoutNotification:
        "테스트 위치를 적용했어요. 도착 반경 밖이라 알림은 보내지 않았어요.",
      gpsTestBackgroundRegistered: "종료 상태 알림 · 등록됨",
      gpsTestBackgroundDelivered: "종료 상태 알림 · 오늘 이미 발송됨",
      gpsTestBackgroundNotRegistered: "종료 상태 알림 · 등록 안 됨",
      gpsTestBackgroundUnsupported: "종료 상태 알림 · 확인 불가",
      gpsTestUseRealLocation: "실제 GPS로 복귀",
      gpsTestCleared: "테스트 위치를 해제하고 실제 GPS로 돌아왔어요.",
      gpsTestMoveFailed: "테스트 위치를 바꾸지 못했어요.",
      gpsTestUnavailable: "이 앱에서는 GPS 테스트를 사용할 수 없어요.",
      photoRecord: "사진 기록",
      manualCompletion: "완료 기록",
      retrospectiveCompletionDescription:
        "지난 일정은 사진과 함께 또는 사진 없이 완료할 수 있어요.",
      retrospectivePhotoCompletionAction: "사진 남기고 완료",
      retrospectiveCompletionAction: "사진 없이 완료",
      noGps: "GPS 없음",
      closeImageAria: (label) => `${label} 이미지 닫기`,
      verificationImageAlt: (title, label) => `${title} ${label} 이미지`,
      viewVerificationPhotoAria: (title, label) => `${title} ${label} 보기`,
      moveOrderAria: (title) => `${title} 순서 이동`,
      cancelVisitAria: (title) => `${title} 완료 취소`,
      markVisitAria: (title) => `${title} 완료 처리`,
      checkInAria: (title) => `${title} 도착 인증`,
      finishVisitAria: (title) => `${title} 방문 완료`,
      cancelVisitTitle: "완료 취소",
      markVisitTitle: "완료 처리",
      checkInTitle: "도착 인증",
      finishVisitTitle: "방문 완료",
      arrivalCheckTitle: "도착을 인증할까요?",
      arrivalCheckDescription:
        "장소 반경 100m 안에서 GPS로 도착을 확인해요. 사진을 남기면 사진 인증도 함께 저장돼요.",
      gpsCheckIn: "GPS로 도착 인증",
      manualVisitCompletion: "인증 없이 방문 완료",
      visitFinishQuestion: "방문을 마칠까요?",
      elapsedSinceArrival: (duration) =>
        `도착 후 ${duration}이 지났어요. 완료하면 실제 체류시간으로 기록돼요.`,
      actualStayQuestion: "얼마나 머물렀나요?",
      actualStayDescription: "실제로 머문 시간을 입력해 주세요.",
      continueStay: "계속 머물기",
      completeVisit: "방문 완료",
      cancelCheckIn: "도착 인증 취소",
      skipActualStay: "기록 안 함",
      saveActualStay: "저장",
      allPlacesCompleted: "모든 장소 완료",
      remainingPlaces: (count) => `${count}곳 남음`,
      expectedStart: "시작 시간",
      plannedDeparture: "예정 시각",
      expectedEnd: "종료 시간",
      totalDuration: "총 소요",
      actualStart: "시작 시각",
      startDay: "DAY 시작하기",
      recordActualStart: "시작 시각 기록",
      editPlannedStartAria: (dayIndex) =>
        `DAY ${dayIndex} 계획 시작 시각 수정`,
      editActualStartAria: (dayIndex) =>
        `DAY ${dayIndex} 시작 시각 수정`,
      dayStartTitle: (dayIndex) => `DAY ${dayIndex}를 시작할까요?`,
      plannedStartEditTitle: (dayIndex) =>
        `DAY ${dayIndex} 계획 시작 시각`,
      actualStartEditTitle: (dayIndex) =>
        `DAY ${dayIndex} 시작 시각`,
      dayStartPlannedDescription: (timeLabel) =>
        `계획 시작 시각은 ${timeLabel}이에요.`,
      dayStartNow: (timeLabel) => `지금 시작 · ${timeLabel}`,
      startAtSelectedTime: "선택한 시간으로 시작",
      savePlannedStart: "계획 시작 저장",
      saveActualStart: "시작 시각 저장",
      dayStartFutureError: "현재보다 이후 시간으로는 시작할 수 없어요.",
      dayStartAfterVisitError: "시작 시각은 첫 방문 기록보다 빨라야 해요.",
      actualEnd: "종료 시각",
      actualTotalDuration: "실제 소요",
      dragGuide: "오른쪽 핸들을 잡고 원하는 위치로 옮겨 주세요.",
      dropHere: "여기에 놓기",
      dropToEnd: "맨 뒤에 놓기",
      emptyDayTitle: "이 날은 아직 비어 있어요",
      emptyDayDescription: "장소를 추가하면 이동 순서를 볼 수 있어요.",
      daySummaryEmpty: "비어 있음",
      daySummaryMore: (firstPlace, count) => `${firstPlace} 외 ${count}곳`,
      placeCount: (count) => `${count}곳`,
    },
    placeSheet: {
      rankBadge: (rank) => `예측 집중률 ${rank}위`,
      durationMinutes: (minutes) => `${minutes}분`,
      durationHours: (hours) => `${hours}시간`,
      durationHoursMinutes: (hours, minutes) => `${hours}시간 ${minutes}분`,
      googleImageQuery: (keyword) => `${keyword} 사진`,
      selectedPlaceMissing: "선택된 장소가 없습니다.",
      localizationFallbackWarn:
        "장소 설명 영문 현지화에 실패해 한국어 원문을 사용합니다.",
      stayChecking: "체류 데이터를 확인 중이에요.",
      stayEmpty: "아직 사용자 체류 데이터가 없어요.",
      staySamplePending: (minCount) =>
        `표본이 아직 적어요. ${minCount}회 이상 쌓이면 평균을 보여줘요.`,
      stayAverage: (averageLabel, visitCount) =>
        `${averageLabel} · ${visitCount}회 방문 기준`,
      currentLocation: "현재 위치",
      referenceLocation: (label) => `${label} 중심`,
      gangwonReferenceLocation: "강원 중심",
      currentLocationCheckingTitle: "현재 위치를 확인하고 있어요.",
      currentLocationCheckingDescription:
        "확인이 끝나면 내 위치 기준 경로를 보여드려요.",
      currentLocationUnavailableTitle: "현재 위치를 확인하지 못했어요.",
      currentLocationUnavailableDescription: (label) =>
        `지금은 ${label} 기준의 참고 경로를 보여드려요.`,
      destination: "목적지",
      mapLoadError: "지도를 불러오지 못했습니다.",
      bottomSheetCloseAria: "바텀시트 닫기",
      sheetCloseAria: "시트 닫기",
      predictionTop: (rank) => `예측 TOP ${rank}`,
      addToRouteAria: "내 루트 담기",
      addToCartToast: "여행지 카트에 담았습니다",
      viewSharedRoutesWithPlace: "이 장소가 포함된 루트 보기",
      userAverageStay: "유저 평균 체류",
      placeImageAlt: (title, index) => `${title} 이미지 ${index}`,
      searchMore: "더 찾아보기",
      viewOnGoogle: "구글에서 보기",
      imageMissingTitle: "이미지 없음",
      imageMissingDescription: "등록된 대표 이미지가 아직 없습니다.",
      userPhotosTitle: "사용자들이 올린 사진",
      userPhotosDescription: "사진 인증과 기록으로 공유된 방문 사진이에요.",
      userPhotoViewerTitle: (title) => `${title} 사용자 사진`,
      userPhotoAlt: (title, index) => `${title} 사용자 사진 ${index}`,
      visitPhoto: "방문 사진",
      noUserPhotosTitle: "아직 올라온 사진이 없어요.",
      noUserPhotosDescription: "이 장소를 사진 인증하면 여기에 모여요.",
      detailTitle: "상세 정보",
      noOverview: "아직 제공된 상세 설명이 없습니다.",
      operatingHours: "이용시간",
      closedDays: "휴무일",
      contact: "문의",
      mapPreparing: "지도 준비 중",
      address: "주소",
      routeFromCurrentLocation: (duration) =>
        `내 위치 기준 차로 ${duration}`,
      routeFromReferenceLocation: (label, duration) =>
        `${label} 기준 참고 경로 · 차로 ${duration}`,
      referenceRouteNotice:
        "위치 권한을 허용하면 실제 내 위치 기준으로 다시 안내할 수 있어요.",
      routeLoadError: "길찾기 정보를 가져오지 못했습니다.",
      directions: "길찾기",
      nearbyTitle: "이런 곳도 좋아요",
      nearbyBadge: "주변 추천",
      nearbyEmpty: "주변 추천 데이터가 아직 없습니다.",
      nearbyFootnote:
        "현재 장소에서 약 6km 안에 있는 관광지, 음식점, 카페를 추천해요.",
      topRankInfoCloseAria: "예측 집중률 안내 닫기",
      topRankInfoTitle: "예측 순위",
      topRankInfoDescription:
        "한국관광공사 이동통신 기반 방문자 집계 데이터를 바탕으로 산출한 집중률 예측값 기준 순위입니다. 같은 지역의 관광지 중 상대적으로 관심도가 높은 장소를 표시합니다.",
      topRankInfoNote: "실제 혼잡도나 실시간 방문자 수와는 다를 수 있어요.",
      imageViewerCloseAria: "이미지 보기 닫기",
      previousImageAria: "이전 이미지",
      nextImageAria: "다음 이미지",
      thumbnailAlt: (title) => `${title} 썸네일`,
      trendTitle: "예측 집중률 추이",
      trendLabel: "예측 집중률",
      trendTooltip: (value) => `예측 집중률 ${value.toFixed(1)} / 100`,
      weekly: "주간",
      monthly: "월간",
      touristTrendEmpty:
        "선택한 관광지의 예측 집중률 데이터가 아직 없습니다.",
      nonTouristTrendEmpty: "예측 집중률 데이터는 관광지에 한해 제공됩니다.",
      trendDescription:
        "이동통신 기반 방문자 데이터를 분석해 예측한 값이에요. 가장 붐비는 시기를 100으로 본 상대 지수이며, 실시간 혼잡도나 방문자 수와는 다를 수 있어요.",
      detailValueTranslations: {
        "체험 일정별 상이": "체험 일정별 상이",
        "일정별 상이": "일정별 상이",
        "상시 가능": "상시 가능",
        상시개방: "상시개방",
        "상시 개방": "상시 개방",
        연중개방: "연중개방",
        "연중 개방": "연중 개방",
        연중무휴: "연중무휴",
        없음: "없음",
        문의: "문의",
        전화문의: "전화문의",
        "전화 문의": "전화 문의",
        "홈페이지 참조": "홈페이지 참조",
        "홈페이지 참고": "홈페이지 참고",
        "홈페이지 확인": "홈페이지 확인",
        "현장 문의": "현장 문의",
        "사전 문의": "사전 문의",
        "사전 예약": "사전 예약",
        "사전예약": "사전예약",
        "명절 휴무": "명절 휴무",
        "매주 월요일": "매주 월요일",
        "매주 화요일": "매주 화요일",
        "매주 수요일": "매주 수요일",
        "매주 목요일": "매주 목요일",
        "매주 금요일": "매주 금요일",
        "매주 토요일": "매주 토요일",
        "매주 일요일": "매주 일요일",
      },
    },
    cart: {
      emptyTitle: "아직 담은 장소가 없어요",
      emptyDescription: "감자가 여행 가방을 비워두고 기다리고 있어요.",
      emptyFooter: "지도에서 가고 싶은 장소를 담아주세요.",
      thumbnailAlt: (title) => `${title} 썸네일`,
      removeAria: (title) => `${title} 삭제`,
      validationStartDateRequired: "여행 시작일을 선택해야 해요.",
      validationStartDateFuture: "여행 시작일은 오늘 또는 이후로 선택해야 해요.",
      validationTripDaysRequired: "여행 일수는 1일 이상이어야 해요.",
      validationTimeInvalid: "시작/종료 시간을 다시 확인해요.",
      validationTimeOrder: "하루 일정의 종료 시간은 시작 시간보다 늦어야 해요.",
      apply: "적용",
      next: "다음",
      buildRoute: "루트 짜기",
      backAria: "뒤로가기",
      restartCheckout: "1단계로",
      restartCheckoutAria: "체크아웃 1단계로 돌아가기",
      appendRouteBanner: (title) => `${title}에 새 DAY를 추가하는 중`,
      todayPastTitle: "시작 시간이 이미 지난 시간이에요",
      todayOneDayTitle: "오늘 당일 일정이 맞나요?",
      todayStartTitle: "오늘 바로 시작하는 일정인가요?",
      todayPastDescription:
        "선택한 시작 시간이 현재 시간보다 이전이에요. 오늘 일정으로 진행하려면 시작 시간을 한 번 더 확인해주세요.",
      todayOneDayDescription:
        "오늘 시작해서 오늘 끝나는 1일 일정으로 저장돼요. 실제로 당일 여행이 맞는지 한 번 더 확인해주세요.",
      todayMultiDayDescription: (days) =>
        `${days}일 일정이지만 시작일이 오늘이에요. 실제로 오늘부터 시작하는 여행이 맞는지 한 번 더 확인해주세요.`,
      useCurrentTime: "현재 시간으로 변경",
      continueAnyway: "그대로 계속",
      chooseAgain: "다시 선택",
      continueToday: "오늘 시작으로 계속",
      scheduleTitle: "여행 일정 정보를 정해주세요",
      startDateLabel: "여행 시작일",
      tripDaysLabel: "여행 일수",
      dayCount: (days) => `${days}일`,
      customTripDaysButton: "직접 입력",
      scheduleRange: (start, end) => `일정 범위: ${start} ~ ${end}`,
      todayPastWarning:
        "선택한 시작 시간이 이미 지난 시간이에요. 오늘 일정이라면 시작 시간을 한 번 더 확인해주세요.",
      todayOneDayWarning:
        "오늘 시작해서 오늘 끝나는 당일 일정이에요. 다음 단계로 가기 전에 한 번 더 확인해주세요.",
      todayMultiDayWarning: (days) =>
        `오늘 바로 시작하는 ${days}일 일정이에요. 다음 단계로 가기 전에 한 번 더 확인해주세요.`,
      dailyStartTimeLabel: "매일 시작 시간",
      dailyStartTimeTitle: "매일 시작 시간 설정",
      dailyStartTimeDescription: "여행하는 날마다 이 시간에 일정을 시작해요.",
      scheduleEndTimeLabel: "일정 종료 희망시간",
      scheduleEndTimeTitle: "일정 종료 희망시간 설정",
      scheduleEndTimeDescription: "하루 일정을 마무리하고 싶은 시각이에요.",
      customTripDaysTitle: "여행 일수 입력",
      customTripDaysDescription: "1일 이상 숫자를 입력해 주세요.",
      customTripDaysPlaceholder: "예: 10",
      tempoTitle: "여행 템포를 골라주세요",
      tempoRelaxedTitle: "여유롭게",
      tempoRelaxedDescription: "장소당 체류시간을 길게 배치",
      tempoBalancedTitle: "보통",
      tempoBalancedDescription: "체류시간을 적당하게 배치",
      tempoPackedTitle: "촘촘하게",
      tempoPackedDescription: "많이 둘러보는 밀도 높은 일정",
      startLocationTitle: "출발 위치가 맞나요?",
      startLocationDescription:
        "여행을 실제로 시작할 위치로 마커를 옮기면 그 지점 기준으로 루트를 계산해요.",
      startLocationGuide: "지도를 탭하거나 출발 마커를 드래그해서 위치를 맞춰요.",
      startLocationPreparing: "출발 위치를 준비하고 있어요.",
      selectedStartLocation: "선택한 출발 위치",
      startLocationUnavailable: "출발 위치를 확인할 수 없어요.",
      nearSavedPlaces: "장소 근처",
      startDistanceFar: (distance) =>
        `담은 장소 중심까지 약 ${distance}입니다. 실제 출발지가 여행 지역 안이라면 마커를 옮겨 주세요.`,
      startDistanceOk: (distance) =>
        `담은 장소 중심까지 약 ${distance}입니다. 이 위치로 시작해도 괜찮아 보여요.`,
      startLocationPickerTitle: "출발 위치 선택",
      startLocationPickerCloseAria: "출발 위치 선택 닫기",
      startLocationPickerGuide:
        "지도를 탭하거나 시작 마커를 드래그해서 출발 위치를 맞춰요.",
      saveRouteFallbackError: "루트 저장에 실패했어요. 잠시 후 다시 시도해 주세요.",
      noPlacesToSaveToast: "저장할 장소가 없어요.",
      dateConflictTitle: "이미 일정이 있어요",
      dateConflictDescription: (requested, existing) =>
        `${requested} 일정이 기존 ${existing} 일정과 겹쳐서 저장할 수 없어요.`,
      dateConflictDetail:
        "내 루트에서 기존 일정을 확인하거나 여행 날짜를 다시 선택해 주세요.",
      viewMyRoutes: "내 루트 보기",
      chooseDateAgain: "날짜 다시 선택",
      routeSavedToast: (count) => `${count}개 장소로 루트를 저장했어요.`,
      appendDaySavedToast: (title) => `${title}에 DAY를 추가했어요.`,
      editingBadge: "수정 중",
      appendResultTitle: "추가할 DAY를 만들었어요",
      resultTitle: "추천 루트를 만들었어요",
      appendResultDescription: (title) =>
        `${title}에 붙일 새 DAY입니다. 체류시간과 순서를 확인한 뒤 추가해요.`,
      resultDescription: (tempoLabel) =>
        `추천 루트는 ${tempoLabel} 템포의 예상 체류시간과 장소 간 거리를 바탕으로 계산한 참고 일정이에요. 실제 이동 시간과 현장 상황에 따라 달라질 수 있으니, 일정과 체류시간을 확인한 뒤 조정해 주세요.`,
      overScheduleWarning: (clock) =>
        `담은 장소가 많아 일부 일정이 희망 종료 시간 ${clock}을 넘습니다. 여행 일수를 늘리거나 체류시간을 줄여 주세요.`,
      startLocationLabel: "출발 위치",
      firstPlaceTravelWarning: (duration) =>
        `첫 장소까지 약 ${duration} 걸려요. 실제 출발지가 다르면 지도에서 위치를 바꿔요.`,
      startLocationRecalculateDescription:
        "현재 위치와 여행 지역이 다르면 지도에서 출발 위치를 바꿔 다시 계산해요.",
      changeOnMap: "지도에서 변경",
      finishOrderEditing: "순서 변경을 완료해 주세요",
      cancelChanges: "변경 취소",
      applyChanges: "변경 적용",
      saving: "루트 저장 중...",
      addDay: "DAY 추가",
      done: "완료",
      addSegmentAria: "이 구간에 장소 추가",
      drag: "드래그",
      minuteUnit: "분",
      stayEditCloseAria: "체류 시간 수정 닫기",
      stayMinuteInputAria: "체류 시간(분)",
      stayTimeDescription: "장소에서 머무는 시간을 조정해요",
      averageStaySummary: (visits, duration) => `${visits}회 평균 ${duration}`,
      placeEditCloseAria: "장소 편집 닫기",
      placeEditTitle: "장소 편집",
      noAddress: "주소 정보가 없습니다",
      arrivalTime: "도착 시간",
      travelTime: "이동 시간",
      userAverageStay: "사용자 평균 체류",
      averageStayLabel: (duration) => `평균 ${duration}`,
      averageStayVisitBasis: (visits) => `${visits}회 방문 기록 기준`,
      moveToAnotherDay: "다른 날짜로 이동",
      moveFirst: "맨 앞",
      moveLast: "맨 뒤",
      removeFromRoute: "이 루트에서 빼기",
      routeCompare: "루트비교",
      routeView: "루트보기",
      placeCount: (count) => `${count}곳`,
      moveToPreviousDayEnd: (day) => `DAY ${day} 맨 뒤로 이동`,
      moveToNextDayStart: (day) => `DAY ${day} 맨 앞으로 이동`,
      dropToEnd: "맨 뒤로 옮기려면 여기에 놓기",
      sOrder: "S자 순서",
      carTravelEstimate: "차량 이동 추정",
      carTravelDirections: "네이버 길찾기 기준",
      routeTravelCalculatingDescription:
        "확정된 장소 순서대로 실제 차량 이동 시간을 확인하고 있어요.",
      routeTravelFallbackWarning:
        "일부 구간의 길찾기 정보를 불러오지 못해 해당 구간은 추정 시간을 표시합니다.",
      noPlacedPlaces: "배치된 장소가 없습니다",
      routeOriginal: "기존 경로",
      routeCurrent: "재계산 경로",
      routeAll: "전체",
      routeViewModeAria: "경로 표시 방식",
      routeDayViewAria: (label) => `${label} 경로 보기`,
      segmentHighlighted: "구간 하이라이트 중",
      viewAll: "전체 보기",
      insertSheetCloseAria: "구간 장소 추가 닫기",
      insertSheetTitle: "이 구간에 장소 추가",
      insertSheetDescription: "경로에서 크게 벗어나지 않는 후보를 먼저 보여줘요.",
      insertSearchPlaceholder: "이 구간에 넣을 장소 검색",
      detour: "우회",
      insertEmptyTitle: "이 조건에 맞는 추천 후보가 없어요",
      insertEmptyDescription:
        "검색어를 바꾸거나 전체 검색에서 직접 찾아볼 수 있어요.",
      searchDirectly: "전체 검색에서 직접 찾기",
    },
  },
  en: {
    common: {
      cancel: "Cancel",
      clearAll: "Empty",
      close: "Close",
      confirm: "OK",
      edit: "Edit",
      retry: "Try again",
      reset: "Reset",
      unknown: "TBD",
      back: "Go back",
      backToMyInfo: "Back to My Info",
      placeLocalizationLoading: "Translating place information…",
      selectedCount: (count) => `${count} selected`,
    },
    inputs: {
      datePlaceholder: "Select date",
      weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      formatDateLabel: (year, month, day, weekday) =>
        `${new Date(year, month - 1, day).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })} (${weekday})`,
      formatMonthTitle: (year, month) =>
        new Date(year, month - 1, 1).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        }),
      previousMonthAria: "Previous month",
      nextMonthAria: "Next month",
      selectToday: "Select today",
      timePlaceholder: "Select time",
      am: "AM",
      pm: "PM",
      save: "Save",
    },
    labels: {
      regions: {
        서울: "Seoul",
        강남구: "Gangnam-gu",
        강동구: "Gangdong-gu",
        강북구: "Gangbuk-gu",
        강서구: "Gangseo-gu",
        관악구: "Gwanak-gu",
        광진구: "Gwangjin-gu",
        구로구: "Guro-gu",
        금천구: "Geumcheon-gu",
        노원구: "Nowon-gu",
        도봉구: "Dobong-gu",
        동대문구: "Dongdaemun-gu",
        동작구: "Dongjak-gu",
        마포구: "Mapo-gu",
        서대문구: "Seodaemun-gu",
        서초구: "Seocho-gu",
        성동구: "Seongdong-gu",
        성북구: "Seongbuk-gu",
        송파구: "Songpa-gu",
        양천구: "Yangcheon-gu",
        영등포구: "Yeongdeungpo-gu",
        용산구: "Yongsan-gu",
        은평구: "Eunpyeong-gu",
        종로구: "Jongno-gu",
        중구: "Jung-gu",
        중랑구: "Jungnang-gu",
        강원: "Gangwon",
        강릉: "Gangneung",
        고성: "Goseong",
        동해: "Donghae",
        삼척: "Samcheok",
        속초: "Sokcho",
        양구: "Yanggu",
        양양: "Yangyang",
        영월: "Yeongwol",
        원주: "Wonju",
        인제: "Inje",
        정선: "Jeongseon",
        철원: "Cheorwon",
        춘천: "Chuncheon",
        태백: "Taebaek",
        평창: "Pyeongchang",
        홍천: "Hongcheon",
        화천: "Hwacheon",
        횡성: "Hoengseong",
        "지역 미정": "Unknown region",
      },
      placeCategories: {
        관광지: "Attraction",
        카페: "Cafe",
        음식점: "Restaurant",
        음식: "Food",
        축제: "Festival",
        "축제/공연": "Festival/Performance",
        축제공연행사: "Festival/Event",
        문화시설: "Cultural Facility",
        문화: "Culture",
        레포츠: "Leisure Sports",
        자연: "Nature",
        자연관광: "Nature Attraction",
        자연관광지: "Nature Attraction",
        강: "River",
        계곡: "Valley",
        폭포: "Waterfall",
        호수: "Lake",
        해변: "Beach",
        해수욕장: "Beach",
        "해변·해수욕장": "Beach",
        섬: "Island",
        바다: "Sea",
        항구: "Harbor",
        포구: "Port",
        등대: "Lighthouse",
        유람선: "Cruise",
        잠수함관광: "Submarine Tour",
        "유람선/잠수함관광": "Cruise/Submarine Tour",
        해양관광: "Marine Tour",
        수상레포츠: "Water Sports",
        수상레저스포츠: "Water Leisure Sports",
        약수터: "Mineral Spring",
        온천: "Hot Spring",
        동굴: "Cave",
        숲: "Forest",
        수목원: "Arboretum",
        자연휴양림: "Recreational Forest",
        역사: "History",
        역사관광: "Historical Attraction",
        역사관광지: "Historical Attraction",
        체험: "Experience",
        체험마을: "Experience Village",
        "농.산.어촌 체험": "Rural/Fishing Village Experience",
        이색체험: "Unique Experience",
        전통체험: "Traditional Experience",
        휴양관광지: "Recreational Attraction",
        유적지: "Historic Site",
        "유적지/사적지": "Historic Site",
        탑: "Tower",
        비석: "Stone Monument",
        기념탑: "Memorial Tower",
        기념비: "Memorial Monument",
        "탑/비석/기념탑": "Towers & Memorials",
        "탑ㆍ비석ㆍ기념탑": "Towers & Memorials",
        동상: "Statue",
        조형물: "Sculpture",
        전망대: "Observatory",
        공원: "Park",
        산: "Mountain",
        고개: "Mountain Pass",
        능: "Royal Tomb",
        사찰: "Temple",
        성: "Castle/Fortress",
        고택: "Historic House",
        생가: "Birthplace",
        박물관: "Museum",
        미술관: "Art Museum",
        전시관: "Exhibition Hall",
        공연장: "Performance Hall",
        문화원: "Cultural Center",
        테마공원: "Theme Park",
        놀이공원: "Amusement Park",
        관광단지: "Tourist Complex",
        한식: "Korean Food",
        중식: "Chinese Food",
        일식: "Japanese Food",
        양식: "Western Food",
        아시아식: "Asian Food",
        이색음식점: "Unique Restaurant",
        채식전문점: "Vegetarian Restaurant",
        햄버거: "Hamburger",
        추천코스: "Recommended Course",
        가족코스: "Family Course",
        나홀로코스: "Solo Course",
        힐링코스: "Healing Course",
        도보코스: "Walking Course",
        캠핑코스: "Camping Course",
        맛코스: "Food Tour",
        문화거리: "Cultural Street",
        수련시설: "Training Facility",
        숙박: "Accommodation",
        쇼핑: "Shopping",
        관광: "Attraction",
        기타: "Other",
        장소: "Place",
        "지역 미정": "Unknown region",
      },
    },
    nav: {
      home: "Map",
      myRoute: "My Routes",
      sharedRoute: "Shared",
      myInfo: "My Info",
    },
    routeShell: {
      defaultLoadingTitle: "Preparing screen",
      defaultLoadingDescription: "Putting the screen together.",
      homeLoadingTitle: "Preparing map",
      homeLoadingDescription: "Loading nearby places and routes.",
      loginLoadingTitle: "Preparing login",
      loginLoadingDescription: "Getting the account screen ready.",
      myRouteTitle: "My Travel Routes",
      myRouteDescription: "Check current and upcoming trips in one place",
      myRouteLoadingTitle: "Checking your routes",
      myRouteLoadingDescription: "Organizing your travel schedule.",
      sharedRouteTitle: "Shared Routes",
      sharedRouteDescription: "Browse travel routes completed by others",
      sharedRouteLoadingTitle: "Finding shared routes",
      myInfoTitle: "My Info",
      myInfoDescription: "Manage your account and route history",
      myInfoLoadingTitle: "Checking account",
      routeHistoryTitle: "Visited Routes",
      routeHistoryLoadingTitle: "Finding history",
      likedRouteTitle: "Liked Shared Routes",
      likedRouteLoadingTitle: "Finding liked routes",
      accountTitle: "Account",
      appSettings: "App Settings",
      languageTitle: "Language",
      notificationSettingsTitle: "Notifications",
      serviceAreaTitle: "Test Region",
      appInfoTitle: "Version & Permissions",
    },
    myInfo: {
      menuSection: "My Trips",
      accountInfo: "Account",
      accountChecking: "Checking account",
      localTestAccount: "Local test account",
      visitedRoutes: "Visited Routes",
      visitedRoutesDescription: "Completed or past schedules",
      likedRoutes: "Liked Shared Routes",
      likedRoutesDescription: "Routes you saved with hearts",
      settingsSection: "App Settings",
      darkMode: "Dark Mode",
      darkModeOn: "Use dark theme",
      darkModeOff: "Use light theme",
      language: "Language",
      korean: "Korean",
      english: "English",
      notificationSettings: "Notifications",
      notificationSettingsDescription:
        "Manage festival, route, and arrival alerts",
      serviceArea: "Test Region",
      serviceAreaDescription: (area) => `Using ${area} Open API places`,
      appInfo: "Version & Permissions",
      appInfoDescription:
        "Check app versions, location, notification, camera, and photo library permissions",
      logout: "Log Out",
      logoutDescription: "Leave the current account",
      logoutToast: "Logged out.",
    },
    serviceArea: {
      selectAreaAria: "Select a GPS test region",
      optionDescription: (area) =>
        `Show Open API places for each district in ${area}.`,
      note: "This setting is available only in development builds. The district nearest your current location appears first on Home.",
      changedToast: (area) => `Changed the test region to ${area}.`,
    },
    account: {
      eyebrow: "My Info",
      title: "Account",
      fallbackName: "RouteOne user",
      accountSection: "Current Account",
      email: "Email",
      accountId: "Account ID",
      loginMethods: "Connected Sign-ins",
      joinedAt: "Joined",
      providers: {
        PASSWORD: "Test-only",
        GOOGLE: "Google",
        APPLE: "Apple",
        UNKNOWN: "Test-only",
      },
      managementSection: "Account Management",
      logout: "Log Out",
      logoutDescription: "Leave the current account",
      deleteAccount: "Delete Account",
      deleteAccountDescription: "Delete the account and all saved data",
      deleteConfirmTitle: "Delete your RouteOne account?",
      deleteConfirmDescription:
        "Your routes, visit records, verification photos, likes, and notification settings will be deleted.",
      deleteConfirmDetail:
        "Deleted accounts and trip records cannot be recovered.",
      deleteConfirmAction: "Delete Account",
      deleting: "Deleting account...",
      deleteSuccess: "Your account has been deleted.",
      deleteError: "Could not delete the account. Try again.",
    },
    notificationSettings: {
      sectionTitle: "Notifications",
      festivalTitle: "Festival Alerts",
      festivalOnDescription: (regions) => `Festival news for ${regions}`,
      festivalOffDescription:
        "Choose areas to receive festival news",
      festivalStatus: (count) =>
        count > 0
          ? `${count} area${count === 1 ? "" : "s"} active`
          : "Off",
      routeStartTitle: "Schedule Start Alerts",
      routeStartDescription:
        "An alert 1 hour before each DAY and one follow-up if it has not started",
      routeReviewTitle: "Route Review Alerts",
      routeReviewDescription:
        "A reminder to review and organize visit records within 7 days after a route ends",
      routeArrivalTitle: "Place Arrival Alerts",
      routeArrivalDescription:
        "Photo reminders within 300m of the next stop, even when the app is closed",
      regionSectionTitle: "Festival Alert Areas",
      regionSectionDescription:
        "Choose up to two areas. Leave all unselected to turn alerts off.",
      finishRegionSelection: "Done",
      selectedRegionCount: (count) => `${count}/2 selected`,
      maxRegionToast: "You can select up to two festival alert areas.",
      savedToast: "Notification settings saved.",
      saveError: "Could not save notification settings.",
      permissionDeniedToast:
        "Enable notification permission in device settings.",
      loading: "Loading notification settings.",
    },
    language: {
      koLabel: "Korean",
      koNativeLabel: "한국어",
      koDescription: "Show maps and travel information in Korean",
      enLabel: "English",
      enNativeLabel: "영어",
      enDescription: "Show maps and travel information in English",
      changedToKoToast: "Language changed to Korean.",
      changedToEnToast: "Language changed to English.",
      selectLanguageAria: "Choose display language",
      note:
        "The selected language applies to maps, place search, and travel information. Existing account and route content stays unchanged.",
    },
    search: {
      filters: {
        all: "All",
        tourist: "Attractions",
        food: "Food",
        cafe: "Cafes",
        festival: "Festivals",
      },
      placeholder: (region) =>
        `Search ${region} attractions, cafes, food, festivals`,
      clearKeyword: "Clear search keyword",
      close: "Close search",
      todayFestival: "Happening today",
      concentrationRank: (rank) => `Predicted crowd rank #${rank}`,
      more: (visible, total) => `Show more ${visible}/${total}`,
      noResultsTitle: "No search results",
      noResultsDescription: "We checked other places too.",
      noResultsFooter: "Try another keyword or category.",
      recentTitle: "Recent Searches",
      clearRecent: "Clear all",
      noRecentTitle: "No recent searches yet",
      noRecentDescription: "Your first place search will appear here.",
      noRecentFooter: "Search for a place to save it here.",
      deleteRecentAria: (keyword) => `Delete recent search ${keyword}`,
    },
    home: {
      missingTourKey: "VITE_VISITKOREA_SERVICE_KEY is empty.",
      loadingMapTitle: "Preparing the map",
      loadingMapDescription: "Reconnecting the map",
      loadingLocationTitle: "Finding your location",
      loadingLocationDescription: "Preparing the nearest region filter",
      loadingFooter: "Analysis mode in progress",
      loadingPlacesTitle: "Finding place data",
      loadingPlacesDescription: "Looking for place candidates on the map",
      loadingEnglishTitle: "Preparing English place info",
      loadingEnglishDescription: "Saving official English names and addresses",
      loadingEnglishFooter: "Saved info loads faster next time",
      loadingRankingTitle: "Ranking places",
      loadingRankingDescription: "Processing predicted visitor concentration",
      loadingMarkersTitle: "Drawing the map",
      loadingMarkersDescription: "Placing pins on the map",
      mapMissingKey: "VITE_NCP_MAPS_KEY_ID is not configured.",
      mapAuthError: (origin, href) =>
        origin === "unknown"
          ? "Naver Maps authentication failed. Check whether the app is running the embedded HTML instead of the remote web bundle entryUrl."
          : `Naver Maps authentication failed. Check whether ${origin} is registered as a Web service URL in the Naver console. Runtime URL: ${href}`,
      mapSdkMissing: "Naver Maps SDK was not found.",
      mapLoadError: "Failed to load the map. Check the key and registered domain.",
      today: "Today",
      ongoing: "Ongoing",
      appendDayTitle: (routeTitle, dayIndex) =>
        `Adding DAY ${dayIndex} to ${routeTitle}`,
      appendDayDescription: (dayIndex) =>
        `Save places from the map, then complete your DAY ${dayIndex} schedule`,
      checkout: "Review Saved Places",
      openSearchAria: "Open place search",
      searchPrompt: (region) => `Search ${region} places`,
      savedPlacesAria: "Saved places",
      notificationsAria: "Open notifications",
      currentLocation: "Current location",
      focusCurrentLocationAria: "Move to current location",
      currentLocationUnavailable: "Could not find your current location.",
      festivalTestSend: "Send Festival Alert",
      festivalTestSending: "Sending",
      festivalTestSendAria:
        "Send real festival alerts for configured notification areas",
      festivalTestSent: "Real festival alert sent.",
      festivalTestFailed: (reason) =>
        reason || "Could not send the festival test alert.",
      festivalTestPermissionDenied:
        "Notifications are disabled. Allow them in device settings.",
      festivalTestDeviceUnavailable:
        "Could not get a push token from this app. Restart the app and try again.",
      festivalTestProjectUnavailable:
        "Check the app's Expo project configuration.",
    },
    notifications: {
      title: "Notifications",
      description: "Travel notifications collected by date",
      close: "Close notifications",
      emptyTitle: "No notifications yet",
      emptyDescription:
        "Festival, schedule start, arrival, and route record updates will appear here.",
      loadError: "Could not load notifications",
      collapse: "Show less",
      showMore: (count) => `Show ${count} more`,
      openFestivalAria: (festivalTitle) => `View ${festivalTitle}`,
      festivalDetailLoadError: "Could not load the festival details.",
      openRouteAria: (routeTitle) => `View ${routeTitle}`,
      summaryTitle: (regionLabel, count) =>
        `${count} festival${count === 1 ? "" : "s"} in ${regionLabel}`,
      arrivalTitle: (placeTitle) => `You arrived near ${placeTitle}`,
      arrivalDescription: "Leave a verification photo.",
      routeStartTitle: (dayIndex) => `DAY ${dayIndex} begins`,
      routeStartDescription:
        "Check your places and travel route before you leave.",
      routeStartOverdueTitle: (dayIndex) =>
        `DAY ${dayIndex} was scheduled to start`,
      routeStartOverdueDescription:
        "If you haven't left yet, check today's schedule and travel route.",
      routeReviewCompletedTitle: (routeTitle) =>
        `${routeTitle}—you made it!`,
      routeReviewIncompleteTitle: (routeTitle) =>
        `Finish your ${routeTitle} record`,
      routeReviewUnstartedTitle: (routeTitle) =>
        `${routeTitle} has ended`,
      routeReviewCompletedDescription: (deadlineAt) => {
        const date = new Date(deadlineAt);
        const correctionText = Number.isFinite(date.getTime())
          ? `Update any missing details through ${date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}.`
          : "Update any missing details within 7 days.";

        return `${correctionText} Make a DAY card or share your route.`;
      },
      routeReviewDescription: (deadlineAt) => {
        const date = new Date(deadlineAt);
        return Number.isFinite(date.getTime())
          ? `You can update visit records through ${date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}.`
          : "You can update visit records for 7 days after the trip ends.";
      },
      formatDate: (dateKey) => {
        const parsedDate = new Date(`${dateKey}T12:00:00`);

        return Number.isFinite(parsedDate.getTime())
          ? parsedDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : dateKey;
      },
      formatTimestamp: (value) => {
        const date = new Date(value);
        return Number.isFinite(date.getTime())
          ? date.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : value;
      },
      kinds: {
        today: "Today",
        weekly: "This week",
        monthly: "This month",
        trip: "Trip day",
        test: "Test",
      },
    },
    myRoute: {
      count: (count) => `${count}`,
      unknownDate: "TBD",
      am: "AM",
      pm: "PM",
      deleteSuccess: "Schedule deleted.",
      deleteError: "Could not delete the schedule.",
      startSuccess: "Trip started.",
      startError: "Could not start the trip.",
      futureStartError: "A trip with a future start date cannot be started yet.",
      viewConflictingRoute: "View schedule",
      conflictConfirm: "OK",
      conflictTitle: "Another schedule already uses that date",
      conflictDescription: (routeTitle, dayIndex, dateLabel) =>
        `${routeTitle} needs ${dateLabel} to add DAY ${dayIndex}.`,
      conflictDetail: (routeTitle) =>
        `${routeTitle} already uses the same date, so this day cannot be appended yet. Edit that schedule or free up the date first.`,
      appendToast: "Add places on the map to create another DAY.",
      startNow: "Start now",
      chooseStartTime: "Choose start time",
      plannedPeriodPastTitle: "The planned period has passed",
      plannedStartDiffTitle: "Start this trip today?",
      plannedPeriodDescription: (start, end) =>
        `The planned period was ${start} - ${end}.`,
      plannedStartDescription: (start) =>
        `The configured start date is ${start}.`,
      startTodayDetail:
        "Starting now recalculates only DAY 1 from today and the current time.",
      startToday: "Start today",
      startPlannedDate: "Start on planned date",
      chooseDate: "Choose another date",
      deleteTitle: "Delete this schedule?",
      deleteDescription: (routeTitle) =>
        `${routeTitle} and all included DAYs and places will be deleted.`,
      deleteDetail: "Deleted schedules cannot be restored.",
      delete: "Delete",
      loadError: "Could not load your routes.",
      loadingTitle: "Checking your routes",
      loadingDescription: "Organizing your travel schedule.",
      needsReviewSection: "Needs Start Review",
      upcomingSection: "Upcoming",
      undatedSection: "Undated Routes",
      startDateModalTitle: "Choose actual start date",
      startDateModalDescription: (routeTitle) =>
        `Choose the date for DAY 1 of ${routeTitle}.`,
      startDateLabel: "Start date",
      startRoute: "Start",
      startTimeLateTitle: "The planned start time has passed",
      startTimeEarlyTitle: "This is earlier than the planned start time",
      startTimeReviewDescription: (scheduledLabel, currentLabel) =>
        `The planned start time is ${scheduledLabel}, and the current time is ${currentLabel}.`,
      startTimeReviewDetail:
        "Starting now recalculates only DAY 1 from the current time.",
      emptyTitle: "No routes yet",
      emptyDescription: "Your travel bag is still empty.",
      emptyFooter: "Save places on the map and create a route.",
      createFromMap: "Create route from map",
    },
    myRouteCard: {
      shared: "Shared",
      pastRoute: "Past Route",
      startsToday: "Starts today",
      startRequired: "Start required",
      inProgress: "In progress",
      scheduled: "Scheduled",
      startsTomorrow: "Starts tomorrow",
      startsInDays: (days) => `Starts in ${days} days`,
      startReviewRequired: "Review start",
      emptyDay: "No places",
      additionalPlaces: (count) => `and ${count} more`,
      pastSchedule: "Past schedule",
      noVisitsToday: "No places scheduled for today",
      todayRouteCompleted: "Today's route completed",
      todaySchedule: "Today's schedule",
      todayProgress: "Today's progress",
      completedPlaceCount: (completed, total) =>
        `${completed}/${total} ${total === 1 ? "place" : "places"} completed`,
      routeCompleted: "Completed",
      recordReviewNeeded: "Review Records",
      recordIncomplete: "Incomplete",
      correctionUntil: (dateLabel) => `Editable through ${dateLabel}`,
      dayTrip: "Day trip",
      nightTrip: (nights, days) => `${nights}N ${days}D`,
      completed: "Completed",
      proof: "Verification",
      average: "Average",
      durationMinutes: (minutes) => `${minutes}m`,
      durationHours: (hours) => `${hours}h`,
      durationHoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
      visitedCount: (visited, total) => `${visited}/${total} visited`,
      placeCount: (count) => `${count} ${count === 1 ? "place" : "places"}`,
      dayCount: (count) => `${count} ${count === 1 ? "day" : "days"}`,
      photoRecord: "Records",
      folded: "Fold",
      startTravel: "Start Trip",
      start: "Start",
      remainingDays: "More Days",
      swipeDays: "Swipe to browse",
      addDay: "Add DAY",
      moreDays: (count) => `+${count} more days`,
    },
    routeHistory: {
      posterTitle: "DAY Poster",
      closeAria: "Close",
      posterAlt: (label) => `${label} poster preview`,
      share: "Share",
      save: "Save",
      backgroundTitle: "Choose background",
      backgroundPaper: "Paper",
      backgroundSunset: "Sunset",
      backgroundOcean: "Ocean",
      backgroundForest: "Forest",
      backgroundLavender: "Lavender",
      backgroundDawn: "Dawn",
      backgroundAlbum: "Album",
      backgroundChangeErrorToast: "Could not change the photo card background.",
      generatingTitle: "Creating DAY card...",
      generatingDescription: "Converting polaroid photos into PNG.",
      generatingFooter: "Please wait a moment",
      missingPhotoToast: (count) => `${count} photos could not be added to the card.`,
      createErrorToast: "Could not create the DAY poster.",
      saveDoneToast: "Photo card saved or shared.",
      downloadStartedToast: (label) => `Started downloading ${label} PNG.`,
      saveErrorToast: "Could not save the photo card.",
      shareDownloadToast: "Sharing is unavailable, so PNG download started.",
      shareErrorToast: "Could not complete poster sharing.",
      eyebrow: "My Info",
      title: "Visited Routes",
      description: "Completed or past schedules",
      loadedCount: (count) => `${count} routes loaded · editable for 7 days after ending`,
      loadError: "Could not load visited routes.",
      loadingTitle: "Finding history",
      emptyTitle: "No visited routes yet",
      emptyDescription: "Your travel history is empty.",
      emptyFooter: "Completed or ended schedules will appear here.",
      nextLoadingTitle: "Finding more history",
      making: "Creating",
      dayCard: "DAY Card",
      createPosterAria: (routeTitle) => `Create DAY poster for ${routeTitle}`,
      notVisited: "No completed places",
      deleteRoute: "Delete trip",
      notVisitedTitle: "Delete this trip?",
      notVisitedDescription: (routeTitle) =>
        `${routeTitle} has no completed visits.`,
      notVisitedDetail:
        "The schedule and its place records will be deleted permanently.",
      notVisitedSuccess: "The trip was deleted.",
      notVisitedError: "Could not delete the trip.",
    },
    sharedRoute: {
      feedTitle: "Shared Routes",
      feedDescription: "Browse travel routes completed by others",
      feedError: "Could not load shared routes.",
      feedEmpty: "No shared routes yet",
      likedTitle: "Liked Shared Routes",
      likedDescription: "Routes you saved with hearts",
      likedError: "Could not load liked shared routes.",
      likedEmpty: "No liked shared routes yet",
      areaFilterAria: "Choose a shared route area",
      sortAria: "Sort shared routes",
      sortButtonLabel: "Sort",
      sortSharedDescLabel: "Newest",
      sortSharedDescDescription: "Recently shared routes first",
      sortSharedAscLabel: "Oldest",
      sortSharedAscDescription: "Older shared routes first",
      sortLikesDescLabel: "Popular",
      sortLikesDescDescription: "Routes with more hearts first",
      filterButton: (count) => `Filter${count > 0 ? ` ${count}` : ""}`,
      clearActiveFilters: "Clear all",
      filterTitle: "Filter Options",
      filterDescription:
        "Choose tags, or select a region and then places in that region.",
      filterClose: "Close filters",
      tagFilter: "Tag Filter",
      placeFilter: "Place Filter",
      noTags: "No tags to choose.",
      noPlaces: "No places to choose.",
      chooseRegion: "Choose region",
      regionPlaces: (region) => `${region} places`,
      placeCount: (count) => `${count} ${count === 1 ? "place" : "places"}`,
      noRegionPlaces: "No attractions found in this region.",
      selectedCount: (count) => `${count} selected`,
      apply: (count) => `Apply${count > 0 ? ` ${count}` : ""}`,
      filterTagLabel: (value) => `Tag: ${value}`,
      filterPlaceLabel: (value) => `Place: ${value}`,
      selectedRouteMissing: "No shared route is selected.",
      routeNotFound: "Shared route not found.",
      likeError: "Could not update the like.",
      likedBackAria: "Back to My Info",
      loadingFeed: "Finding shared routes",
      loadingLiked: "Finding liked routes",
      emptyLikedDescription: "View liked routes here.",
      emptyFeedDescription: "Looking for public travel routes.",
      emptyLikedFooter: "Tap a heart to save a route.",
      emptyFeedFooter: "Shared routes collect here.",
      noFilteredTitle: "No shared routes match the filters",
      noFilteredDescription: "Checking inside the current filters.",
      noFilteredFooter: "Try removing a filter to see more routes.",
      searchingConditions: "Searching filters",
      loadingNext: "Finding more routes",
      detailError: "Could not load shared route details.",
      mineBadge: "My shared route",
      ownRouteLikeAria: (count) => `My shared route, ${count} hearts`,
      unlikeAria: (count) => `Unlike, ${count} hearts`,
      likeAria: (count) => `Like, ${count} hearts`,
    },
    sharedRouteCard: {
      unknownRegion: "Unknown region",
      etcCategory: "Other",
      shared: "Shared",
      routeSuffix: "Route",
      otherRegions: (count) => `+${count} more`,
      dayTrip: "Day trip",
      nightTrip: (nights, days) => `${nights}N ${days}D`,
      completed: (completed, total) => `${completed}/${total} completed`,
      densePlan: "Dense Plan",
      relaxedPlan: "Relaxed Plan",
      balancedPlan: "Balanced Plan",
      lightPlan: "Light Plan",
      beachRoute: "Beach Route",
      cafeWalk: "Cafe Walk",
      verificationTag: (completed, total) => `Verified ${completed}/${total}`,
      unverifiedRoute: "Unverified Route",
      mixedRoute: "Mixed Route",
      focusedRoute: (focus) => `${focus}-focused`,
      focusCategories: {
        카페: "Cafe",
        음식점: "Restaurant",
        관광지: "Attraction",
        해변: "Beach",
        공원: "Park",
        동굴: "Cave",
        시장: "Market",
        장소: "Place",
      },
      myShare: "Mine",
      likeAria: (title) => `Like ${title}`,
      folded: "Fold",
      morePlaces: (count) => `+${count}`,
      moreTags: (count) => `+${count}`,
    },
    dayRoute: {
      dateUnknown: "Date TBD",
      undatedRouteTitle: "Unscheduled Trip",
      routeTitle: (start, end) =>
        end && start !== end ? `${start} - ${end} Schedule` : `${start} Schedule`,
      daySchedule: (days) => `${days}-day schedule`,
      fullRouteProgress: (completed, total) =>
        `Full route ${completed}/${total} completed`,
      selectedDay: (day, date) => `DAY ${day} selected · ${date}`,
      closeAria: "Close day route",
      routeShared: "Shared",
      routeMap: "Route Map",
      routeMapDayTitle: (day) => `DAY ${day} ROUTE`,
      routeMapSelectedDay: (day) => `DAY ${day} selected`,
      selectedSchedule: "Selected schedule",
      routeMapCloseAria: "Close route map",
      routeMapComparison: "Original/Recalculated",
      addToCart: "Add",
      routeCalculating: "Calculating route",
      mapPreparing: "Preparing map",
      mapFallbackTitle: "Showing place order instead of the map",
      mapFallbackDescription:
        "The map SDK could not be loaded, but you can still review the visit order and completed places below.",
      routeMapPartialLoadError:
        "Some road routes could not be loaded, so straight lines are shown.",
      originalRouteDashed: "Original route dashed",
      recalculatedRouteSolid: "Recalculated route solid",
      startBasis: "START basis",
      startRouteComparisonAria: "Compare routes from START",
      stopOrderLabel: (order) => `Stop ${order}`,
      checkoutScopeAria: "Choose add scope",
      checkoutScope: "Add Scope",
      checkoutScopeTitle: "Choose DAYs to add",
      checkoutScopeCloseAria: "Close add scope",
      selectAll: "Select all",
      selected: "Selected",
      select: "Select",
      currentViewingDaySr: "Currently viewing DAY",
      selectedDays: (count) => `${count} days selected`,
      addPlacesSummary: (count) => `Add ${count} places`,
      sharing: "Sharing",
      shared: "Shared",
      share: "Share",
      shareAfterComplete: "Share after completion",
      sharedRouteHeartAria: (count) => `Shared route with ${count} hearts`,
      savedStartLocation: "Saved start location",
      noStartPlace: "No start place",
      startFromMapDescription: (day) =>
        `Shown as START on the DAY ${day} route map.`,
      startFromFirstPlaceDescription: (day) =>
        `DAY ${day} starts from the first place without a separate start point.`,
      emptyStartDescription: "Add places to use the first place as the start.",
      start: "Start",
      firstPlace: "First place",
      nextPlace: "Next destination",
      currentDestination: "Current destination",
      placeDirections: "Map & directions",
      openPlaceDirectionsAria: (title) => `View map and directions to ${title}`,
      noStartGps: "No start GPS",
      editStartLocationAria: "Edit start point",
      firstPlaceTravel: (label) => `Travel · ${label}`,
      nextPlaceTravel: (label) => `To next destination: ${label}`,
      travelLoading: "Calculating travel time",
      travelError: "Travel time unavailable",
      travelByCar: (duration) => `About ${duration} by car`,
      travelEstimatedByCar: (duration) => `Estimated ${duration} by car`,
      noTime: "Time TBD",
      minutes: (minutes) => `${minutes}m`,
      hours: (hours) => `${hours}h`,
      hoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
      nextDayClock: (clock) => `Next day ${clock}`,
      dayOffsetClock: (days, clock) => `+${days}d ${clock}`,
      visited: "Done",
      visiting: "Visiting",
      notVisited: "Not visited",
      arrivedAt: (clock) => `Arrived ${clock}`,
      actualTimeRange: (start, end) => `Arrived ${start} · done ${end}`,
      ongoingTimeRange: (start) => `Arrived ${start} · visiting`,
      estimatedTimeRange: (start, end) => `Est. ${start}-${end}`,
      actualStay: (duration) => `Actual ${duration}`,
      plannedStay: (duration) => `Planned ${duration}`,
      editVisitTimesAria: (title) => `Edit arrival and completion times for ${title}`,
      visitTimeEdited: "Edited",
      visitTimeEditTitle: "Edit visit time",
      visitTimeEditDescription:
        "Keep the schedule date and edit only the arrival and completion times.",
      arrivalTime: "Arrival time",
      completionTime: "Completion time",
      gpsVerificationTimePreserved:
        "The original GPS verification time and location will be preserved.",
      stayTimeAfterEdit: (duration) => `Actual stay after edit: ${duration}`,
      visitTimeFutureError: "Visit times cannot be in the future.",
      visitTimeOrderError: "Completion time cannot be before arrival time.",
      visitTimeMaxError: "A stay can be recorded for up to 8 hours.",
      visitTimePreviousStopError: (title) =>
        `Arrival cannot be before the completion time for the previous stop, '${title}'.`,
      visitTimePreviousStopOngoingError: (title) =>
        `Finish the previous stop, '${title}', first.`,
      visitTimeNextStopError: (title) =>
        `This visit cannot end after the arrival time for the next stop, '${title}'.`,
      saveVisitTimes: "Save time",
      placeFallback: "Place",
      gpsVerification: "GPS verified",
      gpsVerificationPhoto: "GPS verification photo",
      photoPublicationQuestion: "Share this photo on the place page?",
      photoPublicationDescription: (title) =>
        `Other users will be able to see it in the community photos for ${title}.`,
      photoPublicationPrivacy:
        "Only the photo is shared. Your private route and schedule stay private.",
      publishPhoto: "Share photo",
      keepPhotoPrivate: "Keep private",
      photoPublished: "Shared on place page",
      photoPrivate: "Private photo",
      unpublishPhoto: "Stop sharing",
      deletePhoto: "Delete photo",
      deletePhotoQuestion: "Delete this verification photo?",
      deletePhotoDescription:
        "The photo will be permanently deleted, but your visit and stay record will remain.",
      cancelPhotoDelete: "Cancel",
      addVisitPhoto: "Add photo",
      replaceVisitPhoto: "Change photo",
      gpsTestTitle: (title) => `${title} GPS test`,
      gpsTestDescription:
        "Use the purple marker to test location while the app is open. The green circle is the 300 m arrival radius; closed-app registration appears below.",
      gpsTestButton: "Test",
      gpsTestActiveButton: "Testing",
      gpsTestOpenAria: (title) => `Open the GPS test map for ${title}`,
      gpsTestCloseAria: "Close GPS test map",
      gpsTestPlaceLegend: "Place",
      gpsTestLocationLegend: "Test location",
      gpsTestInsideRadius: (distance) =>
        `${distance} from place · GPS should pass`,
      gpsTestOutsideRadius: (distance) =>
        `${distance} from place · GPS should fail`,
      gpsTestApplying: "Applying",
      gpsTestApplyLocation: "Apply location",
      gpsTestAppliedWithNotification:
        "The test location was applied and an immediate in-app test alert was sent.",
      gpsTestAppliedWithoutNotification:
        "The test location was applied. No alert was sent outside the arrival radius.",
      gpsTestBackgroundRegistered: "Closed-app alert · Registered",
      gpsTestBackgroundDelivered: "Closed-app alert · Already sent today",
      gpsTestBackgroundNotRegistered: "Closed-app alert · Not registered",
      gpsTestBackgroundUnsupported: "Closed-app alert · Unable to verify",
      gpsTestUseRealLocation: "Use real GPS",
      gpsTestCleared: "The test location was cleared. Using real GPS.",
      gpsTestMoveFailed: "Could not change the test location.",
      gpsTestUnavailable: "GPS testing is unavailable in this app.",
      photoRecord: "Photo record",
      manualCompletion: "Completion record",
      retrospectiveCompletionDescription:
        "Complete a past schedule with or without a photo.",
      retrospectivePhotoCompletionAction: "Complete with a photo",
      retrospectiveCompletionAction: "Complete without a photo",
      noGps: "No GPS",
      closeImageAria: (label) => `Close ${label}`,
      verificationImageAlt: (title, label) => `${title} ${label}`,
      viewVerificationPhotoAria: (title, label) => `View ${label} for ${title}`,
      moveOrderAria: (title) => `Move ${title}`,
      cancelVisitAria: (title) => `Mark ${title} incomplete`,
      markVisitAria: (title) => `Mark ${title} complete`,
      checkInAria: (title) => `Verify arrival at ${title}`,
      finishVisitAria: (title) => `Complete visit to ${title}`,
      cancelVisitTitle: "Mark incomplete",
      markVisitTitle: "Mark complete",
      checkInTitle: "Verify arrival",
      finishVisitTitle: "Complete visit",
      arrivalCheckTitle: "Verify your arrival?",
      arrivalCheckDescription:
        "Verify your arrival with GPS within 100 m. Add a photo to save photo verification too.",
      gpsCheckIn: "Verify arrival with GPS",
      manualVisitCompletion: "Complete without verification",
      visitFinishQuestion: "Finish this visit?",
      elapsedSinceArrival: (duration) =>
        `${duration} has passed since arrival. Completing records it as your actual stay.`,
      actualStayQuestion: "How long did you stay?",
      actualStayDescription: "Enter the time you actually spent here.",
      continueStay: "Keep visiting",
      completeVisit: "Complete visit",
      cancelCheckIn: "Cancel arrival",
      skipActualStay: "Skip",
      saveActualStay: "Save",
      allPlacesCompleted: "All places completed",
      remainingPlaces: (count) => `${count} left`,
      expectedStart: "Start time",
      plannedDeparture: "Planned start",
      expectedEnd: "End time",
      totalDuration: "Total Time",
      actualStart: "Start time",
      startDay: "Start DAY",
      recordActualStart: "Record start time",
      editPlannedStartAria: (dayIndex) =>
        `Edit planned start time for DAY ${dayIndex}`,
      editActualStartAria: (dayIndex) =>
        `Edit start time for DAY ${dayIndex}`,
      dayStartTitle: (dayIndex) => `Start DAY ${dayIndex}?`,
      plannedStartEditTitle: (dayIndex) =>
        `DAY ${dayIndex} planned start time`,
      actualStartEditTitle: (dayIndex) =>
        `DAY ${dayIndex} start time`,
      dayStartPlannedDescription: (timeLabel) =>
        `The planned start time is ${timeLabel}.`,
      dayStartNow: (timeLabel) => `Start now · ${timeLabel}`,
      startAtSelectedTime: "Start at selected time",
      savePlannedStart: "Save planned start",
      saveActualStart: "Save start time",
      dayStartFutureError: "The start time cannot be later than now.",
      dayStartAfterVisitError:
        "The start time must be earlier than the first visit record.",
      actualEnd: "End time",
      actualTotalDuration: "Actual Time",
      dragGuide: "Grab the handle on the right and move it where you want.",
      dropHere: "Drop here",
      dropToEnd: "Drop at end",
      emptyDayTitle: "This day is empty",
      emptyDayDescription: "Add places to see the travel order.",
      daySummaryEmpty: "Empty",
      daySummaryMore: (firstPlace, count) => `${firstPlace} +${count} more`,
      placeCount: (count) => `${count} ${count === 1 ? "place" : "places"}`,
    },
    placeSheet: {
      rankBadge: (rank) => `Predicted crowd rank #${rank}`,
      durationMinutes: (minutes) => `${minutes}m`,
      durationHours: (hours) => `${hours}h`,
      durationHoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
      googleImageQuery: (keyword) => `${keyword} photos`,
      selectedPlaceMissing: "No place is selected.",
      localizationFallbackWarn:
        "Failed to localize the place overview, using the Korean original.",
      stayChecking: "Checking stay data.",
      stayEmpty: "No user stay data yet.",
      staySamplePending: (minCount) =>
        `Not enough samples yet. The average appears after ${minCount}+ visits.`,
      stayAverage: (averageLabel, visitCount) =>
        `${averageLabel} · based on ${visitCount} visits`,
      currentLocation: "Current location",
      referenceLocation: (label) => `${label} center`,
      gangwonReferenceLocation: "Gangwon center",
      currentLocationCheckingTitle: "Checking your current location.",
      currentLocationCheckingDescription:
        "Your route will update as soon as your location is ready.",
      currentLocationUnavailableTitle:
        "Could not confirm your current location.",
      currentLocationUnavailableDescription: (label) =>
        `Showing a reference route from ${label} for now.`,
      destination: "Destination",
      mapLoadError: "Could not load the map.",
      bottomSheetCloseAria: "Close bottom sheet",
      sheetCloseAria: "Close sheet",
      predictionTop: (rank) => `TOP ${rank}`,
      addToRouteAria: "Add to my route",
      addToCartToast: "Added to your travel cart",
      viewSharedRoutesWithPlace: "View routes with this place",
      userAverageStay: "Average User Stay",
      placeImageAlt: (title, index) => `${title} image ${index}`,
      searchMore: "Find more",
      viewOnGoogle: "View on Google",
      imageMissingTitle: "No images",
      imageMissingDescription: "No representative image has been added yet.",
      userPhotosTitle: "User Photos",
      userPhotosDescription: "Photos shared through visit records.",
      userPhotoViewerTitle: (title) => `${title} user photos`,
      userPhotoAlt: (title, index) => `${title} user photo ${index}`,
      visitPhoto: "Visit Photo",
      noUserPhotosTitle: "No photos uploaded yet.",
      noUserPhotosDescription:
        "Photos will appear here after users verify visits.",
      detailTitle: "Details",
      noOverview: "No detailed description is available yet.",
      operatingHours: "Hours",
      closedDays: "Closed Days",
      contact: "Contact",
      mapPreparing: "Preparing map",
      address: "Address",
      routeFromCurrentLocation: (duration) =>
        `${duration} by car from your location`,
      routeFromReferenceLocation: (label, duration) =>
        `Reference route from ${label} · ${duration} by car`,
      referenceRouteNotice:
        "Allow location access to recalculate this from your real position.",
      routeLoadError: "Could not load directions.",
      directions: "Directions",
      nearbyTitle: "You Might Also Like",
      nearbyBadge: "Nearby",
      nearbyEmpty: "No nearby recommendation data yet.",
      nearbyFootnote:
        "Showing attractions, restaurants, and cafes within about 6 km of this place.",
      topRankInfoCloseAria: "Close predicted crowd info",
      topRankInfoTitle: "Predicted Rank",
      topRankInfoDescription:
        "This rank is based on predicted concentration from Korea Tourism Organization mobile visitor statistics. It highlights places with relatively higher interest among attractions in the same area.",
      topRankInfoNote:
        "It may differ from real-time crowding or live visitor counts.",
      imageViewerCloseAria: "Close image viewer",
      previousImageAria: "Previous image",
      nextImageAria: "Next image",
      thumbnailAlt: (title) => `${title} thumbnail`,
      trendTitle: "Predicted Crowd Trend",
      trendLabel: "Predicted crowd",
      trendTooltip: (value) => `Predicted crowd ${value.toFixed(1)} / 100`,
      weekly: "Weekly",
      monthly: "Monthly",
      touristTrendEmpty:
        "No predicted crowd data is available for this attraction yet.",
      nonTouristTrendEmpty:
        "Predicted crowd data is only available for attractions.",
      trendDescription:
        "Predicted from mobile visitor data. This relative index sets the attraction's busiest period to 100 and may differ from real-time crowds or visitor counts.",
      detailValueTranslations: {
        "체험 일정별 상이": "Varies by experience schedule",
        "일정별 상이": "Varies by schedule",
        "상시 가능": "Available anytime",
        상시개방: "Open at all times",
        "상시 개방": "Open at all times",
        연중개방: "Open year-round",
        "연중 개방": "Open year-round",
        연중무휴: "Open year-round",
        없음: "None",
        문의: "Inquiries",
        전화문의: "Call for details",
        "전화 문의": "Call for details",
        "홈페이지 참조": "See website",
        "홈페이지 참고": "See website",
        "홈페이지 확인": "Check website",
        "현장 문의": "Ask on site",
        "사전 문의": "Ask in advance",
        "사전 예약": "Advance reservation required",
        "사전예약": "Advance reservation required",
        "명절 휴무": "Closed on holidays",
        "매주 월요일": "Every Monday",
        "매주 화요일": "Every Tuesday",
        "매주 수요일": "Every Wednesday",
        "매주 목요일": "Every Thursday",
        "매주 금요일": "Every Friday",
        "매주 토요일": "Every Saturday",
        "매주 일요일": "Every Sunday",
      },
    },
    cart: {
      emptyTitle: "No saved places yet",
      emptyDescription: "Your travel bag is waiting empty.",
      emptyFooter: "Add places from the map.",
      thumbnailAlt: (title) => `${title} thumbnail`,
      removeAria: (title) => `Remove ${title}`,
      validationStartDateRequired: "Choose a trip start date.",
      validationStartDateFuture: "Choose today or a later date.",
      validationTripDaysRequired: "Trip length must be at least 1 day.",
      validationTimeInvalid: "Check the start and end times again.",
      validationTimeOrder: "The daily end time must be later than the start time.",
      apply: "Apply",
      next: "Next",
      buildRoute: "Build route",
      backAria: "Go back",
      restartCheckout: "Step 1",
      restartCheckoutAria: "Go back to checkout step 1",
      appendRouteBanner: (title) => `Adding a new DAY to ${title}`,
      todayPastTitle: "The start time has already passed",
      todayOneDayTitle: "Is this a same-day trip?",
      todayStartTitle: "Does this trip start today?",
      todayPastDescription:
        "The selected start time is earlier than the current time. Please check it once more before continuing with today's trip.",
      todayOneDayDescription:
        "This will be saved as a 1-day trip that starts and ends today. Please confirm that it is a same-day trip.",
      todayMultiDayDescription: (days) =>
        `This is a ${days}-day trip, but the start date is today. Please confirm that the trip really starts today.`,
      useCurrentTime: "Use current time",
      continueAnyway: "Continue anyway",
      chooseAgain: "Choose again",
      continueToday: "Continue from today",
      scheduleTitle: "Set your trip schedule",
      startDateLabel: "Trip start date",
      tripDaysLabel: "Trip length",
      dayCount: (days) => `${days}D`,
      customTripDaysButton: "Custom",
      scheduleRange: (start, end) => `Schedule range: ${start} - ${end}`,
      todayPastWarning:
        "The selected start time has already passed. If this is today's trip, please check the start time once more.",
      todayOneDayWarning:
        "This is a same-day trip that starts and ends today. Please confirm before moving on.",
      todayMultiDayWarning: (days) =>
        `This ${days}-day trip starts today. Please confirm before moving on.`,
      dailyStartTimeLabel: "Daily start time",
      dailyStartTimeTitle: "Set daily start time",
      dailyStartTimeDescription: "Each travel day starts at this time.",
      scheduleEndTimeLabel: "Preferred end time",
      scheduleEndTimeTitle: "Set preferred end time",
      scheduleEndTimeDescription: "The time you want to wrap up each day.",
      customTripDaysTitle: "Enter trip length",
      customTripDaysDescription: "Enter a number of 1 day or more.",
      customTripDaysPlaceholder: "e.g. 10",
      tempoTitle: "Choose your travel tempo",
      tempoRelaxedTitle: "Relaxed",
      tempoRelaxedDescription: "Longer stay time at each place",
      tempoBalancedTitle: "Balanced",
      tempoBalancedDescription: "Moderate stay time at each place",
      tempoPackedTitle: "Packed",
      tempoPackedDescription: "A dense plan to see more places",
      startLocationTitle: "Is this start point right?",
      startLocationDescription:
        "Move the marker to where you will actually start, and the route will be calculated from there.",
      startLocationGuide: "Tap the map or drag the start marker to adjust it.",
      startLocationPreparing: "Preparing start point.",
      selectedStartLocation: "Selected start point",
      startLocationUnavailable: "Could not confirm the start point.",
      nearSavedPlaces: "Near places",
      startDistanceFar: (distance) =>
        `About ${distance} from the center of your saved places. If your real start point is inside the trip area, move the marker.`,
      startDistanceOk: (distance) =>
        `About ${distance} from the center of your saved places. This start point looks okay.`,
      startLocationPickerTitle: "Choose start point",
      startLocationPickerCloseAria: "Close start point picker",
      startLocationPickerGuide: "Tap the map or drag the start marker to adjust it.",
      saveRouteFallbackError: "Could not save the route. Please try again soon.",
      noPlacesToSaveToast: "There are no places to save.",
      dateConflictTitle: "You already have a schedule",
      dateConflictDescription: (requested, existing) =>
        `${requested} overlaps with your existing ${existing} schedule, so it cannot be saved.`,
      dateConflictDetail:
        "Check the existing schedule in My Routes or choose different travel dates.",
      viewMyRoutes: "View My Routes",
      chooseDateAgain: "Choose date again",
      routeSavedToast: (count) => `Saved a route with ${count} places.`,
      appendDaySavedToast: (title) => `Added a DAY to ${title}.`,
      editingBadge: "Editing",
      appendResultTitle: "New DAY is ready",
      resultTitle: "Recommended route is ready",
      appendResultDescription: (title) =>
        `This new DAY will be added to ${title}. Review the stay times and order before adding it.`,
      resultDescription: (tempoLabel) =>
        `This recommended route is a reference schedule based on estimated stay times for the ${tempoLabel} tempo and distances between places. Actual travel times and on-site conditions may vary, so review and adjust the schedule and stay times.`,
      overScheduleWarning: (clock) =>
        `Some stops go past your preferred end time of ${clock}. Add more trip days or shorten stay times.`,
      startLocationLabel: "Start point",
      firstPlaceTravelWarning: (duration) =>
        `It takes about ${duration} to the first place. If your real start point is different, change it on the map.`,
      startLocationRecalculateDescription:
        "If your current location is away from the trip area, change the start point on the map and recalculate.",
      changeOnMap: "Change on map",
      finishOrderEditing: "Finish changing the order",
      cancelChanges: "Cancel changes",
      applyChanges: "Apply changes",
      saving: "Saving route...",
      addDay: "Add DAY",
      done: "Done",
      addSegmentAria: "Add a place to this segment",
      drag: "Drag",
      minuteUnit: "m",
      stayEditCloseAria: "Close stay time editor",
      stayMinuteInputAria: "Stay time in minutes",
      stayTimeDescription: "Adjust how long you will stay at this place.",
      averageStaySummary: (visits, duration) => `${visits}-visit avg ${duration}`,
      placeEditCloseAria: "Close place editor",
      placeEditTitle: "Edit place",
      noAddress: "No address available",
      arrivalTime: "Arrival time",
      travelTime: "Travel time",
      userAverageStay: "Average User Stay",
      averageStayLabel: (duration) => `Avg ${duration}`,
      averageStayVisitBasis: (visits) => `Based on ${visits} visits`,
      moveToAnotherDay: "Move to another day",
      moveFirst: "First",
      moveLast: "Last",
      removeFromRoute: "Remove from this route",
      routeCompare: "Compare",
      routeView: "View route",
      placeCount: (count) => `${count} ${count === 1 ? "place" : "places"}`,
      moveToPreviousDayEnd: (day) => `Move to end of DAY ${day}`,
      moveToNextDayStart: (day) => `Move to start of DAY ${day}`,
      dropToEnd: "Drop here to move to the end",
      sOrder: "S-order",
      carTravelEstimate: "Estimated car travel",
      carTravelDirections: "Naver driving directions",
      routeTravelCalculatingDescription:
        "Checking driving times for the finalized stop order.",
      routeTravelFallbackWarning:
        "Directions were unavailable for some segments, so estimated times are shown for those segments.",
      noPlacedPlaces: "No places arranged",
      routeOriginal: "Original route",
      routeCurrent: "Recalculated route",
      routeAll: "All",
      routeViewModeAria: "Route display mode",
      routeDayViewAria: (label) => `View route for ${label}`,
      segmentHighlighted: "Segment highlighted",
      viewAll: "View all",
      insertSheetCloseAria: "Close segment place add",
      insertSheetTitle: "Add a place to this segment",
      insertSheetDescription:
        "Candidates that stay close to this route segment are shown first.",
      insertSearchPlaceholder: "Search places for this segment",
      detour: "Detour",
      insertEmptyTitle: "No recommended candidates match this condition",
      insertEmptyDescription:
        "Try another keyword or find a place from full search.",
      searchDirectly: "Find from full search",
    },
  },
};

export function getUiText(language: AppLanguage) {
  return UI_TEXT[language];
}

function findMappedPlaceCategory(label: string, text: UiText) {
  const trimmedLabel = label.trim();
  const directMatch = text.labels.placeCategories[trimmedLabel];

  if (directMatch) {
    return directMatch;
  }

  const compactLabel = trimmedLabel.replace(/\s+/g, "");
  const compactMatch = Object.entries(text.labels.placeCategories).find(
    ([source]) => source.replace(/\s+/g, "") === compactLabel
  );

  if (compactMatch) {
    return compactMatch[1];
  }

  if (text === UI_TEXT.ko) {
    const koreanSourceMatch = Object.entries(
      UI_TEXT.en.labels.placeCategories
    ).find(
      ([, englishLabel]) =>
        englishLabel.replace(/\s+/g, "").toLowerCase() ===
        compactLabel.toLowerCase()
    );

    return koreanSourceMatch?.[0] ?? null;
  }

  return null;
}

export function localizePlaceCategoryLabel(
  categoryLabel: string | null | undefined,
  text: UiText
) {
  const label = categoryLabel?.trim();

  if (!label) {
    return text.labels.placeCategories["장소"] ?? "장소";
  }

  const mappedLabel = findMappedPlaceCategory(label, text);

  if (mappedLabel) {
    return mappedLabel;
  }

  const parts = label
    .split(/\s*(?:\/|·|ㆍ|,|>|-)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const localizedParts = parts.map(
      (part) => findMappedPlaceCategory(part, text) ?? part
    );

    if (localizedParts.some((part, index) => part !== parts[index])) {
      return [...new Set(localizedParts)].join(" / ");
    }
  }

  return label;
}

export function useUiText() {
  const language = useAppLanguageStore((state) => state.language);

  return getUiText(language);
}
