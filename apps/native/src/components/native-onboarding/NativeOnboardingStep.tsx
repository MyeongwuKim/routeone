import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

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

const ONBOARDING_THEME = {
  light: {
    background: "#f8fafc",
    brandText: "#0f766e",
    mutedText: "#64748b",
    cardBackground: "#ffffff",
    cardBorder: "#e2e8f0",
    title: "#0f172a",
    description: "#475569",
    primaryBackground: "#0f766e",
    primaryPressed: "#115e59",
    primaryText: "#ffffff",
    secondaryBackground: "#ffffff",
    secondaryPressed: "#edf7f4",
    secondaryBorder: "#d5e7e1",
    secondaryText: "#0f766e"
  },
  dark: {
    background: "#061918",
    brandText: "#f8fafc",
    mutedText: "rgba(226, 245, 241, 0.76)",
    cardBackground: "rgba(13, 36, 34, 0.92)",
    cardBorder: "rgba(148, 216, 204, 0.18)",
    title: "#f8fafc",
    description: "rgba(226, 245, 241, 0.76)",
    primaryBackground: "#14b8a6",
    primaryPressed: "#0f9488",
    primaryText: "#042f2e",
    secondaryBackground: "rgba(13, 36, 34, 0.88)",
    secondaryPressed: "rgba(20, 184, 166, 0.18)",
    secondaryBorder: "rgba(148, 216, 204, 0.22)",
    secondaryText: "#e2f5f1"
  }
} as const;

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
