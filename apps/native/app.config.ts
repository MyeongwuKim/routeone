type AppVariant = "dev" | "prod";

function getAppVariant(): AppVariant {
  const variant = process.env.APP_VARIANT?.trim().toLowerCase() ?? "dev";

  if (variant === "dev" || variant === "prod") {
    return variant;
  }

  throw new Error(`APP_VARIANT must be "dev" or "prod". Received "${variant}".`);
}

const appVariant = getAppVariant();
const isDevVariant = appVariant === "dev";
const appDisplayName = isDevVariant ? "RouteOneDev" : "RouteOne";
const appSlug = isDevVariant ? "routeone-native-dev" : "routeone-native";
const appScheme = isDevVariant ? "routeone-dev" : "routeone";
const appBundleIdentifier = isDevVariant
  ? "com.routeone.app.dev"
  : "com.routeone.app";
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
    "expo-location",
    {
      locationWhenInUsePermission:
        "RouteOne이 장소 근처 도착 여부와 방문 인증을 확인하기 위해 현재 위치를 사용합니다."
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
    version: "0.1.0",
    orientation: "portrait",
    scheme: appScheme,
    userInterfaceStyle: "light",
    jsEngine: "hermes",
    platforms: ["ios", "android"],
    plugins,
    ios: {
      bundleIdentifier: appBundleIdentifier,
      supportsTablet: false,
      usesAppleSignIn: enableAppleSignIn,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsLocalNetworking: true
        },
        NSLocationWhenInUseUsageDescription:
          "RouteOne이 장소 근처 도착 여부와 방문 인증을 확인하기 위해 현재 위치를 사용합니다.",
        NSCameraUsageDescription:
          "RouteOne이 방문한 장소의 사진 인증을 남기기 위해 카메라를 사용합니다.",
        NSPhotoLibraryUsageDescription:
          "RouteOne이 지난 방문 사진 인증을 위해 선택한 사진을 사용합니다."
      }
    },
    android: {
      package: appBundleIdentifier,
      edgeToEdgeEnabled: true,
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA"]
    }
  }
};
