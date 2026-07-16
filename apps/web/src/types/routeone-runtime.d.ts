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
    };
    RouteOneNative?: {
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
