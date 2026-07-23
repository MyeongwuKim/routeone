import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  useColorScheme,
  View
} from "react-native";

type RouteOneLaunchScreenProps = {
  progress: number;
  message: string;
  tagline?: string;
};

export default function RouteOneLaunchScreen({
  progress,
  message,
  tagline = "여행의 시작부터 도착까지"
}: RouteOneLaunchScreenProps) {
  const colorScheme = useColorScheme();
  const colors =
    colorScheme === "dark"
      ? {
          background: "#061918",
          title: "#f8fafc",
          muted: "rgba(226, 245, 241, 0.78)",
          track: "rgba(226, 245, 241, 0.2)",
          fill: "#e2f5f1",
          percentage: "#ffb199"
        }
      : {
          background: "#0f766e",
          title: "#ffffff",
          muted: "rgba(255, 255, 255, 0.78)",
          track: "rgba(255, 255, 255, 0.22)",
          fill: "#ffffff",
          percentage: "#ffb199"
        };
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.brand}>
        <Image
          accessibilityIgnoresInvertColors
          source={require("../../../assets/splash-brand-icon.png")}
          style={styles.logo}
        />
        <Text style={[styles.name, { color: colors.title }]}>RouteOne</Text>
        <Text style={[styles.tagline, { color: colors.muted }]}>
          {tagline}
        </Text>
      </View>

      <View style={styles.progressArea}>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(normalizedProgress * 100)
          }}
          style={[styles.progressTrack, { backgroundColor: colors.track }]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: colors.fill, width: progressWidth }
            ]}
          />
        </View>
        <View style={styles.progressCaption}>
          <Text
            numberOfLines={1}
            style={[styles.message, { color: colors.muted }]}
          >
            {message}
          </Text>
          <Text style={[styles.percentage, { color: colors.percentage }]}>
            {Math.round(normalizedProgress * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28
  },
  brand: {
    alignItems: "center"
  },
  logo: {
    width: 280,
    height: 280,
    resizeMode: "contain"
  },
  name: {
    marginTop: -42,
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0
  },
  tagline: {
    marginTop: 7,
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
    height: 7,
    overflow: "hidden",
    borderRadius: 4
  },
  progressFill: {
    height: "100%",
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
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0
  },
  percentage: {
    minWidth: 34,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  }
});
