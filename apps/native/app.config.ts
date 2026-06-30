export default {
  expo: {
    name: "RouteOne",
    slug: "routeone-native",
    version: "0.1.0",
    orientation: "portrait",
    scheme: "routeone",
    userInterfaceStyle: "light",
    jsEngine: "hermes",
    platforms: ["ios", "android"],
    plugins: [
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
            "RouteOne이 방문한 장소의 사진 인증을 남기기 위해 카메라를 사용합니다."
        }
      ]
    ],
    ios: {
      bundleIdentifier: "com.routeone.app",
      supportsTablet: false,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "RouteOne이 장소 근처 도착 여부와 방문 인증을 확인하기 위해 현재 위치를 사용합니다.",
        NSCameraUsageDescription:
          "RouteOne이 방문한 장소의 사진 인증을 남기기 위해 카메라를 사용합니다."
      }
    },
    android: {
      package: "com.routeone.app",
      edgeToEdgeEnabled: true,
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA"]
    }
  }
};
