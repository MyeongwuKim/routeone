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
import type { NativeUpdateRequirement } from "../../nativeUpdate/nativeUpdatePolicy";

type AppLanguage = "ko" | "en";

type NativeForceUpdateScreenProps = {
  isRefreshing: boolean;
  language: AppLanguage;
  onRefresh: () => Promise<void> | void;
  requirement: NativeUpdateRequirement;
};

const UPDATE_TEXT = {
  ko: {
    title: "앱 업데이트가 필요해요",
    description:
      "안정적인 사용을 위해 RouteOne을 최신 버전으로\n업데이트해 주세요.",
    currentVersion: "현재 버전",
    minimumVersion: "필요 버전",
    openStore: "스토어에서 업데이트",
    refresh: "업데이트 확인",
    refreshing: "확인 중",
    storeError: "스토어를 열지 못했어요. 잠시 후 다시 시도해 주세요."
  },
  en: {
    title: "App update required",
    description:
      "Update RouteOne to the latest version to continue using the app.",
    currentVersion: "Current version",
    minimumVersion: "Required version",
    openStore: "Update in store",
    refresh: "Check update",
    refreshing: "Checking",
    storeError: "Could not open the store. Please try again."
  }
} as const;

export default function NativeForceUpdateScreen({
  isRefreshing,
  language,
  onRefresh,
  requirement
}: NativeForceUpdateScreenProps) {
  const colorScheme = useColorScheme();
  const text = UPDATE_TEXT[language];
  const [storeError, setStoreError] = useState<string | null>(null);
  const colors =
    colorScheme === "dark"
      ? {
          background: "#061918",
          card: "#0d2422",
          border: "rgba(148, 216, 204, 0.22)",
          title: "#f8fafc",
          description: "rgba(226, 245, 241, 0.76)",
          versionBackground: "rgba(20, 184, 166, 0.12)",
          versionLabel: "rgba(226, 245, 241, 0.68)",
          versionValue: "#f8fafc",
          primary: "#14b8a6",
          primaryPressed: "#0f9488",
          primaryText: "#042f2e",
          secondary: "rgba(13, 36, 34, 0.88)",
          secondaryPressed: "rgba(20, 184, 166, 0.18)",
          secondaryText: "#e2f5f1",
          error: "#fda4af"
        }
      : {
          background: "#f8fafc",
          card: "#ffffff",
          border: "#d5e7e1",
          title: "#0f172a",
          description: "#475569",
          versionBackground: "#edf7f4",
          versionLabel: "#64748b",
          versionValue: "#0f172a",
          primary: "#0f766e",
          primaryPressed: "#115e59",
          primaryText: "#ffffff",
          secondary: "#ffffff",
          secondaryPressed: "#edf7f4",
          secondaryText: "#0f766e",
          error: "#be123c"
        };

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
