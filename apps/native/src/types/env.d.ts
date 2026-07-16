declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_NCP_MAPS_KEY_ID?: string;
    EXPO_PUBLIC_NCP_MAPS_KEY?: string;
    EXPO_PUBLIC_NAVER_MAP_API_KEY_ID?: string;
    EXPO_PUBLIC_NAVER_MAP_API_KEY?: string;
    EXPO_PUBLIC_GRAPHQL_ENDPOINT?: string;
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_APP_VARIANT?: "dev" | "prod";
    EXPO_PUBLIC_WEB_BUNDLE_BASE_URL?: string;
    EXPO_PUBLIC_WEB_BUNDLE_PREFIX?: string;
    EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_DEV?: string;
    EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD?: string;
  }
}
