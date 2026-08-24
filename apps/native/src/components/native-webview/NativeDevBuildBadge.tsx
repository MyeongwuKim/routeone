/** dev 빌드임을 WebView보다 위에 표시하는 네이티브 전용 배지. */
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { DEV_BUILD_BADGE_LABEL } from "@/constants/nativeWebView";
import { WEB_BUNDLE_UPDATE_CONFIG } from "@/config/webBundleUpdateConfig";

export default function NativeDevBuildBadge() {
  if (WEB_BUNDLE_UPDATE_CONFIG.appVariant !== "dev") {
    return null;
  }

  return (
    <SafeAreaView pointerEvents="none" style={styles.layer}>
      <View style={styles.positioner}>
        <View style={styles.badge}>
          <Text style={styles.label}>{DEV_BUILD_BADGE_LABEL}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000
  },
  positioner: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingRight: 12,
    paddingBottom: 80
  },
  badge: {
    borderRadius: 6,
    backgroundColor: "#dc2626",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  label: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8
  }
});
