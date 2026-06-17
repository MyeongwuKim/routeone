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
    ios: {
      bundleIdentifier: "com.routeone.app",
      supportsTablet: false
    },
    android: {
      package: "com.routeone.app",
      edgeToEdgeEnabled: true
    }
  }
};
