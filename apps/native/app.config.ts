type AppVariant = "dev" | "prod";

type AppVariantConfig = {
  displayName: string;
  slug: string;
  scheme: string;
  bundleIdentifier: string;
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

function getAppVariant(): AppVariant {
  const variant = process.env.APP_VARIANT?.trim().toLowerCase() ?? "dev";

  if (variant === "dev" || variant === "prod") {
    return variant;
  }

  throw new Error(`APP_VARIANT must be "dev" or "prod". Received "${variant}".`);
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/g, "");
}

function getWebBundleManifestUrl(variant: AppVariant) {
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

const appVariant = getAppVariant();
const appVariantConfig = APP_VARIANT_CONFIG[appVariant];
const appDisplayName = appVariantConfig.displayName;
const appSlug = appVariantConfig.slug;
const appScheme = appVariantConfig.scheme;
const appBundleIdentifier = appVariantConfig.bundleIdentifier;
const appVersion = process.env.ROUTEONE_APP_VERSION?.trim() || "0.1.0";
const iosBuildNumber = process.env.ROUTEONE_IOS_BUILD_NUMBER?.trim() || "1";
const androidVersionCode = Number.parseInt(
  process.env.ROUTEONE_ANDROID_VERSION_CODE?.trim() || "1",
  10
);
const webBundleChannel = appVariant;
const webBundlePublicBaseUrl =
  process.env.EXPO_PUBLIC_WEB_BUNDLE_BASE_URL?.trim() ||
  process.env.R2_PUBLIC_BASE_URL?.trim() ||
  "";
const webBundleManifestUrl = getWebBundleManifestUrl(appVariant);

if (!Number.isInteger(androidVersionCode) || androidVersionCode < 1) {
  throw new Error("ROUTEONE_ANDROID_VERSION_CODE must be a positive integer.");
}

const enableAppleSignIn =
  process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN?.trim().toLowerCase() ===
    "true" || process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN?.trim() === "1";
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
      backgroundColor: "#f7faf9",
      image: "./assets/splash-icon.png",
      imageWidth: 280,
      resizeMode: "contain"
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
  "./plugins/withGoogleModularHeaders"
];

if (enableAppleSignIn) {
  plugins.push("expo-apple-authentication");
}

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
    userInterfaceStyle: "light",
    jsEngine: "hermes",
    platforms: ["ios", "android"],
    plugins,
    extra: {
      routeone: {
        appVariant,
        webBundleChannel,
        webBundleManifestUrl
      }
    },
    ios: {
      bundleIdentifier: appBundleIdentifier,
      buildNumber: iosBuildNumber,
      supportsTablet: false,
      usesAppleSignIn: enableAppleSignIn,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsLocalNetworking: true
        },
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
        UIBackgroundModes: ["location"]
      }
    },
    android: {
      package: appBundleIdentifier,
      versionCode: androidVersionCode,
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: "./assets/splash-icon.png",
        backgroundColor: "#f7faf9"
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
