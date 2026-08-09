/** WebView 진입 전에 언어와 기기 권한을 순서대로 안내하는 공용 화면. */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { ONBOARDING_THEME } from "@/constants/nativeOnboarding";

type NativeOnboardingAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loadingLabel?: string;
  variant: "primary" | "secondary";
};

type NativeOnboardingStepProps = {
  title: string;
  description: string;
  primaryAction: NativeOnboardingAction;
  secondaryAction?: NativeOnboardingAction;
};

export function useNativeOnboardingTheme() {
  const colorScheme = useColorScheme();

  return ONBOARDING_THEME[colorScheme === "dark" ? "dark" : "light"];
}

export function NativeOnboardingLoading() {
  const colors = useNativeOnboardingTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.brandText} />
      <Text style={[styles.loadingText, { color: colors.mutedText }]}>
        RouteOne을 준비하는 중이에요.
      </Text>
    </View>
  );
}

export default function NativeOnboardingStep({
  title,
  description,
  primaryAction,
  secondaryAction,
}: NativeOnboardingStepProps) {
  const actions = secondaryAction
    ? [secondaryAction, primaryAction]
    : [primaryAction];
  const colors = useNativeOnboardingTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder
          }
        ]}
      >
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.title }]}>{title}</Text>
        </View>
        <Text style={[styles.description, { color: colors.description }]}>
          {description}
        </Text>
        <View style={secondaryAction ? styles.actions : undefined}>
          {actions.map((action) => (
            <Pressable
              accessibilityRole="button"
              disabled={action.disabled}
              key={action.variant}
              onPress={action.onPress}
              style={({ pressed }) => [
                secondaryAction ? styles.button : styles.fullButton,
                {
                  backgroundColor:
                    action.variant === "primary"
                      ? colors.primaryBackground
                      : colors.secondaryBackground,
                  borderColor:
                    action.variant === "primary"
                      ? colors.primaryBackground
                      : colors.secondaryBorder
                },
                pressed && {
                  backgroundColor:
                    action.variant === "primary"
                      ? colors.primaryPressed
                      : colors.secondaryPressed
                },
                action.disabled && styles.disabledButton
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color:
                      action.variant === "primary"
                        ? colors.primaryText
                        : colors.secondaryText
                  }
                ]}
              >
                {action.disabled && action.loadingLabel
                  ? action.loadingLabel
                  : action.label}
              </Text>
            </Pressable>
          ))}
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
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "800"
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 8,
  },
  headerText: {
    width: "100%"
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  description: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fullButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
  },
  disabledButton: {
    opacity: 0.56
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
});
