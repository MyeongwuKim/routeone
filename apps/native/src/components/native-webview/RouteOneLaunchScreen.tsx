/** 앱 시작과 웹 번들 준비 과정에서 시스템 시작 화면과 같은 크기의 심벌과 진행 상태를 표시한다. */
import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  useColorScheme,
  View
} from "react-native";
import { NATIVE_BRAND } from "@/constants/nativeOnboarding";

type RouteOneLaunchScreenProps = {
  language: keyof typeof NATIVE_BRAND.name;
  progress: number;
  message: string;
  showProgress?: boolean;
  tagline?: string;
};

const LAUNCH_LOGO_SIZE = 240;

export default function RouteOneLaunchScreen({
  language,
  progress,
  message,
  showProgress = true,
  tagline = "오늘은 어디로 마실 갈까요?"
}: RouteOneLaunchScreenProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === "dark"
    ? NATIVE_BRAND.darkBackground
    : NATIVE_BRAND.background;
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const animatedProgress = useRef(
    new Animated.Value(normalizedProgress)
  ).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: normalizedProgress,
      duration: 280,
      useNativeDriver: false
    }).start();
  }, [animatedProgress, normalizedProgress]);

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <View style={styles.brand}>
        <Image
          accessibilityIgnoresInvertColors
          source={require("../../../assets/splash-brand-icon.png")}
          style={styles.logo}
        />
        <Text style={styles.name}>{NATIVE_BRAND.name[language]}</Text>
        <Text style={styles.tagline}>{tagline}</Text>
      </View>

      {showProgress ? (
        <View style={styles.progressArea}>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(normalizedProgress * 100)
            }}
            style={styles.progressTrack}
          >
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth }
              ]}
            />
          </View>
          <View style={styles.progressCaption}>
            <Text
              numberOfLines={1}
              style={styles.message}
            >
              {message}
            </Text>
            <Text style={styles.percentage}>
              {Math.round(normalizedProgress * 100)}%
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28
  },
  brand: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    transform: [{ translateY: -LAUNCH_LOGO_SIZE / 2 }]
  },
  logo: {
    width: LAUNCH_LOGO_SIZE,
    height: LAUNCH_LOGO_SIZE,
    resizeMode: "contain"
  },
  name: {
    marginTop: -30,
    color: NATIVE_BRAND.mint,
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0
  },
  tagline: {
    marginTop: 7,
    color: "rgba(230, 246, 238, 0.8)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0
  },
  progressArea: {
    position: "absolute",
    bottom: 54,
    alignSelf: "center",
    width: "100%",
    maxWidth: 320
  },
  progressTrack: {
    width: "100%",
    backgroundColor: "rgba(230, 246, 238, 0.22)",
    height: 7,
    overflow: "hidden",
    borderRadius: 4
  },
  progressFill: {
    height: "100%",
    backgroundColor: NATIVE_BRAND.mint,
    borderRadius: 4
  },
  progressCaption: {
    minHeight: 22,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  message: {
    flex: 1,
    color: "rgba(230, 246, 238, 0.8)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0
  },
  percentage: {
    minWidth: 34,
    color: NATIVE_BRAND.apricot,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  }
});
