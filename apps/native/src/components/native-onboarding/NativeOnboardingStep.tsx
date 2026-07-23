import {
  ActivityIndicator,
  Image,
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
    background: "#0f766e",
    brandText: "#ffffff",
    mutedText: "rgba(255, 255, 255, 0.78)",
    cardBackground: "rgba(255, 255, 255, 0.96)",
    cardBorder: "rgba(255, 255, 255, 0.28)",
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

function useOnboardingTheme() {
  const colorScheme = useColorScheme();

  return ONBOARDING_THEME[colorScheme === "dark" ? "dark" : "light"];
}

export function NativeOnboardingLoading() {
  const colors = useOnboardingTheme();

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
  const colors = useOnboardingTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.brand}>
        <Image
          accessibilityIgnoresInvertColors
          source={require("../../../assets/splash-brand-icon.png")}
          style={styles.logoImage}
        />
        <Text style={[styles.brandName, { color: colors.brandText }]}>
          RouteOne
        </Text>
      </View>

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
          <Text style={[styles.eyebrow, { color: colors.secondaryText }]}>
            ROUTE ONE
          </Text>
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
    paddingHorizontal: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "800"
  },
  brand: {
    alignItems: "center",
    marginBottom: 18
  },
  logoImage: {
    width: 150,
    height: 150,
    resizeMode: "contain"
  },
  brandName: {
    marginTop: -28,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0
  },
  card: {
    width: "100%",
    maxWidth: 326,
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 12,
  },
  headerText: {
    width: "100%"
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
  },
  title: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: "900",
  },
  description: {
    marginTop: 22,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 23,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
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
