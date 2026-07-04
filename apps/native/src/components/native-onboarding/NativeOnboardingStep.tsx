import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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

export function NativeOnboardingLoading() {
  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#0f766e" />
      <Text style={styles.loadingText}>RouteOne을 준비하는 중이에요.</Text>
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

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>R1</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ROUTE ONE</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        <Text style={styles.description}>{description}</Text>
        <View style={secondaryAction ? styles.actions : undefined}>
          {actions.map((action) => (
            <Pressable
              accessibilityRole="button"
              disabled={action.disabled}
              key={action.variant}
              onPress={action.onPress}
              style={({ pressed }) => [
                secondaryAction ? styles.button : styles.fullButton,
                action.variant === "primary"
                  ? styles.primaryButton
                  : styles.secondaryButton,
                pressed &&
                  (action.variant === "primary"
                    ? styles.primaryButtonPressed
                    : styles.buttonPressed),
              ]}
            >
              <Text
                style={
                  action.variant === "primary"
                    ? styles.primaryButtonText
                    : styles.secondaryButtonText
                }
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
    backgroundColor: "#e7f2ef",
  },
  loadingText: {
    marginTop: 12,
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(20, 184, 166, 0.46)",
    backgroundColor: "#ffffff",
    padding: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
  },
  iconText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "900",
  },
  title: {
    marginTop: 2,
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  description: {
    marginTop: 22,
    color: "#475569",
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
    alignItems: "center",
    justifyContent: "center",
  },
  fullButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  primaryButton: {
    backgroundColor: "#0f766e",
  },
  buttonPressed: {
    opacity: 0.72,
  },
  primaryButtonPressed: {
    backgroundColor: "#115e59",
  },
  secondaryButtonText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
});
