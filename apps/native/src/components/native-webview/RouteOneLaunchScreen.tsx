import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View
} from "react-native";

type RouteOneLaunchScreenProps = {
  progress: number;
  message: string;
};

export default function RouteOneLaunchScreen({
  progress,
  message
}: RouteOneLaunchScreenProps) {
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
    <View style={styles.screen}>
      <View style={styles.brand}>
        <Image
          accessibilityIgnoresInvertColors
          source={require("../../../assets/splash-icon.png")}
          style={styles.logo}
        />
        <Text style={styles.name}>RouteOne</Text>
        <Text style={styles.tagline}>여행의 시작부터 도착까지</Text>
      </View>

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
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>
        <View style={styles.progressCaption}>
          <Text numberOfLines={1} style={styles.message}>
            {message}
          </Text>
          <Text style={styles.percentage}>
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
    backgroundColor: "#f7faf9",
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
    color: "#123f3c",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0
  },
  tagline: {
    marginTop: 7,
    color: "#65807d",
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
    borderRadius: 4,
    backgroundColor: "#dce8e5"
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#0f766e"
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
    color: "#486661",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0
  },
  percentage: {
    minWidth: 34,
    color: "#e56c5b",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  }
});
