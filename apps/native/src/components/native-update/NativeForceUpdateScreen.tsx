/** 최소 네이티브 앱 버전을 충족하지 못했을 때 진입을 차단하는 화면. */
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View
} from "react-native";
import { UPDATE_TEXT, UPDATE_THEME } from "@/constants/nativeUpdate";
import type { NativeUpdateRequirement } from "@/nativeUpdate/nativeUpdatePolicy";

type AppLanguage = "ko" | "en";

type NativeForceUpdateScreenProps = {
  isRefreshing: boolean;
  language: AppLanguage;
  onRefresh: () => Promise<void> | void;
  requirement: NativeUpdateRequirement;
};

export default function NativeForceUpdateScreen({
  isRefreshing,
  language,
  onRefresh,
  requirement
}: NativeForceUpdateScreenProps) {
  const colorScheme = useColorScheme();
  const text = UPDATE_TEXT[language];
  const [storeError, setStoreError] = useState<string | null>(null);
  const colors = UPDATE_THEME[colorScheme === "dark" ? "dark" : "light"];

  const openStore = async () => {
    setStoreError(null);

    try {
      await Linking.openURL(requirement.storeUrl);
    } catch {
      setStoreError(text.storeError);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        backgroundColor={colors.background}
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <View style={styles.screen}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <View style={[styles.icon, { backgroundColor: colors.primary }]}>
            <Text style={[styles.iconText, { color: colors.primaryText }]}>
              ↑
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.title }]}>{text.title}</Text>
          <Text style={[styles.description, { color: colors.description }]}>
            {text.description}
          </Text>

          <View
            style={[
              styles.versionBox,
              { backgroundColor: colors.versionBackground }
            ]}
          >
            <View style={styles.versionRow}>
              <Text
                style={[styles.versionLabel, { color: colors.versionLabel }]}
              >
                {text.currentVersion}
              </Text>
              <Text
                style={[styles.versionValue, { color: colors.versionValue }]}
              >
                {requirement.currentVersion}
              </Text>
            </View>
            <View style={styles.versionRow}>
              <Text
                style={[styles.versionLabel, { color: colors.versionLabel }]}
              >
                {text.minimumVersion}
              </Text>
              <Text
                style={[styles.versionValue, { color: colors.versionValue }]}
              >
                {requirement.minimumVersion}
              </Text>
            </View>
          </View>

          {storeError ? (
            <Text style={[styles.error, { color: colors.error }]}>
              {storeError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void openStore();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: pressed ? colors.primaryPressed : colors.primary
              }
            ]}
          >
            <Text
              style={[styles.primaryButtonText, { color: colors.primaryText }]}
            >
              {text.openStore}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isRefreshing}
            onPress={() => {
              void onRefresh();
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: pressed
                  ? colors.secondaryPressed
                  : colors.secondary,
                borderColor: colors.border
              },
              isRefreshing && styles.disabledButton
            ]}
          >
            {isRefreshing ? (
              <ActivityIndicator color={colors.secondaryText} size="small" />
            ) : null}
            <Text
              style={[
                styles.secondaryButtonText,
                { color: colors.secondaryText }
              ]}
            >
              {isRefreshing ? text.refreshing : text.refresh}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 8
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8
  },
  icon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18
  },
  iconText: {
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36
  },
  title: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  },
  versionBox: {
    width: "100%",
    gap: 10,
    marginTop: 22,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: "700"
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "900"
  },
  error: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center"
  },
  primaryButton: {
    width: "100%",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 16
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    width: "100%",
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "800"
  },
  disabledButton: {
    opacity: 0.65
  }
});
