declare global {
  type RouteOneNativeSaveImageResult = {
    shared: boolean;
    uri?: string | null;
  };

  type RouteOneNativeArrivalNotificationPlace = {
    id: string;
    routeId: string;
    routeTitle?: string | null;
    dayId: string;
    dayIndex: number;
    stopId: string;
    title: string;
    lat: number;
    lng: number;
  };

  type RouteOneNativeArrivalNotificationSyncResult = {
    activeCount: number;
    backgroundLocationStatus: string;
    notificationStatus: string;
  };

  interface Window {
    RouteOneRuntimeConfig?: {
      graphqlEndpoint?: string;
      routerMode?: "browser" | "hash";
      devVerificationBypass?: boolean;
      webBundlePublicOrigin?: string | null;
    };
    RouteOneNative?: {
      getAppInfo?: () => Promise<{
        platform: string;
        appVersion?: string | null;
        buildNumber?: string | null;
        runtimeVersion?: string | null;
        osVersion?: string | null;
        bundleIdentifier?: string | null;
        webBundleVersion?: string | null;
        webBundleKind?: "embedded" | "installed" | "remote" | null;
        webBundleChannel?: string | null;
        appVariant?: string | null;
      }>;
      syncRouteArrivalNotifications?: (options: {
        places: RouteOneNativeArrivalNotificationPlace[];
        radiusMeters?: number;
      }) => Promise<RouteOneNativeArrivalNotificationSyncResult>;
      saveImage?: (options: {
        dataUrl: string;
        fileName: string;
        title?: string;
      }) => Promise<RouteOneNativeSaveImageResult>;
    };
  }
}

export {};
