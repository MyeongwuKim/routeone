import appVersions from "./app-versions.json";

type AppVariant = "dev" | "prod";
type AppPlatform = "ios" | "android";

type AppVersionConfig = Record<AppVariant, Record<AppPlatform, string>>;

type AppVariantConfig = {
  displayName: string;
  slug: string;
  scheme: string;
  bundleIdentifier: string;
};

type AppVariantResult = {
  appVariant: AppVariant;
  isExplicit: boolean;
};

const APP_VARIANT_CONFIG: Record<AppVariant, AppVariantConfig> = {
  dev: {
    displayName: "RouteOne(T)",
    slug: "routeone-native-dev",
    scheme: "routeone-dev",
    bundleIdentifier: "com.routeone.app.dev"
  },
  prod: {
    displayName: "RouteOne",
    slug: "routeone-native",
    scheme: "routeone",
    bundleIdentifier: "com.routeone.app"
  }
};

function getAppVariant(): AppVariantResult {
  const variant = process.env.APP_VARIANT?.trim().toLowerCase() ?? "";

  if (
    !variant ||
    variant === "none" ||
    variant === "null" ||
    variant === "undefined"
  ) {
    return {
      appVariant: "dev",
      isExplicit: false
    };
  }

  if (variant === "dev" || variant === "prod") {
    return {
      appVariant: variant,
      isExplicit: true
    };
  }

  throw new Error(
    `APP_VARIANT must be "none", "dev", or "prod". Received "${variant}".`
  );
}

function getBuildPlatform(): AppPlatform {
  const platform =
    process.env.ROUTEONE_BUILD_PLATFORM?.trim().toLowerCase() ?? "ios";

  if (platform === "ios" || platform === "android") {
    return platform;
  }

  throw new Error(
    `ROUTEONE_BUILD_PLATFORM must be "ios" or "android". Received "${platform}".`
  );
}

function getAppVersion(variant: AppVariant, platform: AppPlatform) {
  const version = (appVersions as AppVersionConfig)[variant][platform].trim();

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `Invalid ${variant}.${platform} version in app-versions.json: "${version}".`
    );
  }

  return version;
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/g, "");
}

function getWebBundleManifestUrl(
  variant: AppVariant,
  shouldUseRemoteWebBundle: boolean
) {
  if (!shouldUseRemoteWebBundle) {
    return null;
  }

  const explicitUrl =
    variant === "prod"
      ? process.env.EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD?.trim()
      : process.env.EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_DEV?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  if (!webBundlePublicBaseUrl) {
    return null;
  }

  return `${trimTrailingSlashes(webBundlePublicBaseUrl)}/latest/manifest.json`;
}

const { appVariant, isExplicit: hasExplicitAppVariant } = getAppVariant();
const buildPlatform = getBuildPlatform();
const appVariantConfig = APP_VARIANT_CONFIG[appVariant];
const appDisplayName = appVariantConfig.displayName;
const appSlug = appVariantConfig.slug;
const appScheme = appVariantConfig.scheme;
const appBundleIdentifier = appVariantConfig.bundleIdentifier;
const appVersion = getAppVersion(appVariant, buildPlatform);
const webBundleChannel = appVariant;
const webBundlePublicBaseUrl =
  process.env.EXPO_PUBLIC_WEB_BUNDLE_BASE_URL?.trim() ||
  process.env.R2_PUBLIC_BASE_URL?.trim() ||
  "";
const shouldUseRemoteWebBundle = hasExplicitAppVariant;
const webBundleManifestUrl = getWebBundleManifestUrl(
  appVariant,
  shouldUseRemoteWebBundle
);
const routeoneExtra = {
  appVariant,
  webBundleChannel,
  webBundleUpdatesEnabled: shouldUseRemoteWebBundle,
  ...(webBundleManifestUrl ? { webBundleManifestUrl } : {})
};

const googleIosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ??
  process.env.GOOGLE_IOS_CLIENT_ID?.trim() ??
  "";
const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim() ??
  process.env.GOOGLE_IOS_URL_SCHEME?.trim() ??
  (googleIosClientId.endsWith(".apps.googleusercontent.com")
    ? `com.googleusercontent.apps.${googleIosClientId.replace(
        ".apps.googleusercontent.com",
        ""
      )}`
    : "");
const plugins: unknown[] = [
  [
    "expo-splash-screen",
    {
      backgroundColor: "#0f766e",
      image: "./assets/splash-brand-icon.png",
      imageWidth: 280,
      resizeMode: "contain",
      dark: {
        backgroundColor: "#061918",
        image: "./assets/splash-brand-icon.png"
      }
    }
  ],
  [
    "expo-location",
    {
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
      isIosBackgroundLocationEnabled: true,
      locationAlwaysAndWhenInUsePermission:
        "RouteOne이 장소 근처에 도착했을 때 알림을 보내기 위해 위치를 사용합니다.",
      locationWhenInUsePermission:
        "RouteOne이 장소 근처 도착 여부와 방문 인증을 확인하기 위해 현재 위치를 사용합니다."
    }
  ],
  [
    "expo-notifications",
    {
      color: "#0f766e",
      defaultChannel: "route-arrivals",
      enableBackgroundRemoteNotifications: false
    }
  ],
  [
    "expo-image-picker",
    {
      cameraPermission:
        "RouteOne이 방문한 장소의 사진 인증을 남기기 위해 카메라를 사용합니다.",
      photosPermission:
        "RouteOne이 지난 방문 사진 인증을 위해 선택한 사진을 사용합니다."
    }
  ],
  "expo-apple-authentication",
  "./plugins/withGoogleModularHeaders"
];

if (googleIosUrlScheme) {
  plugins.push([
    "@react-native-google-signin/google-signin",
    {
      iosUrlScheme: googleIosUrlScheme
    }
  ]);
}

export default {
  expo: {
    name: appDisplayName,
    slug: appSlug,
    version: appVersion,
    icon: "./assets/icon.png",
    orientation: "portrait",
    scheme: appScheme,
    userInterfaceStyle: "automatic",
    jsEngine: "hermes",
    platforms: ["ios", "android"],
    plugins,
    extra: {
      routeone: routeoneExtra
    },
    ios: {
      bundleIdentifier: appBundleIdentifier,
      supportsTablet: false,
      usesAppleSignIn: true,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsLocalNetworking: true
        },
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "RouteOne이 장소 근처 도착 여부와 방문 인증을 확인하기 위해 현재 위치를 사용합니다.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "RouteOne이 장소 근처에 도착했을 때 알림을 보내기 위해 위치를 사용합니다.",
        NSLocationAlwaysUsageDescription:
          "RouteOne이 장소 근처에 도착했을 때 알림을 보내기 위해 위치를 사용합니다.",
        NSCameraUsageDescription:
          "RouteOne이 방문한 장소의 사진 인증을 남기기 위해 카메라를 사용합니다.",
        NSPhotoLibraryUsageDescription:
          "RouteOne이 지난 방문 사진 인증을 위해 선택한 사진을 사용합니다.",
        LSApplicationQueriesSchemes: ["nmap"],
        UIBackgroundModes: ["location"]
      }
    },
    android: {
      package: appBundleIdentifier,
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: "./assets/splash-brand-icon.png",
        backgroundColor: "#0f766e"
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "POST_NOTIFICATIONS",
        "CAMERA"
      ]
    }
  }
};
