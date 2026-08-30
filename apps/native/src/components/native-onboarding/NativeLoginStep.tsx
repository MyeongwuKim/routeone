/** WebView 진입에 필요한 비밀번호·Google·Apple 로그인을 처리하는 화면. */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View
} from "react-native";
import type { NativeLoginProvider } from "@/auth/nativeLoginTypes";
import { useNativeLoginErrorAlert } from "@/auth/useNativeLoginErrorAlert";
import { LOGIN_TEXT, LOGIN_THEME } from "@/constants/nativeOnboarding";

type AppLanguage = "ko" | "en";
type PasswordLoginMode = "hidden" | "test" | "reviewer";

type NativeLoginStepProps = {
  language: AppLanguage;
  accountId: string;
  password: string;
  displayName: string;
  appleAvailable: boolean;
  activeProvider: NativeLoginProvider | null;
  errorMessage: string | null;
  passwordLoginMode: PasswordLoginMode;
  toastMessage?: string | null;
  onChangeAccountId: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangeDisplayName: (value: string) => void;
  onDismissError: () => void;
  onPasswordLogin: () => void;
  onGoogleLogin: () => void;
  onAppleLogin: () => void;
};

function getButtonLabel({
  provider,
  activeProvider,
  label,
  loadingLabel,
}: {
  provider: NativeLoginProvider;
  activeProvider: NativeLoginProvider | null;
  label: string;
  loadingLabel: string;
}) {
  return activeProvider === provider ? loadingLabel : label;
}

function getAppleButtonLabel({
  activeProvider,
  appleAvailable,
  text
}: {
  activeProvider: NativeLoginProvider | null;
  appleAvailable: boolean;
  text: (typeof LOGIN_TEXT)[AppLanguage];
}) {
  if (Platform.OS !== "ios") {
    return text.appleIosOnly;
  }

  if (!appleAvailable) {
    return text.applePreparing;
  }

  return getButtonLabel({
    provider: "apple",
    activeProvider,
    label: text.appleContinue,
    loadingLabel: text.appleChecking
  });
}

export default function NativeLoginStep({
  language,
  accountId,
  password,
  displayName,
  appleAvailable,
  activeProvider,
  errorMessage,
  passwordLoginMode,
  toastMessage,
  onChangeAccountId,
  onChangePassword,
  onChangeDisplayName,
  onDismissError,
  onPasswordLogin,
  onGoogleLogin,
  onAppleLogin,
}: NativeLoginStepProps) {
  const colorScheme = useColorScheme();
  const colors = LOGIN_THEME[colorScheme === "dark" ? "dark" : "light"];
  const text = LOGIN_TEXT[language];
  const isBusy = activeProvider !== null;
  const showPasswordLogin = passwordLoginMode !== "hidden";
  const isReviewerLogin = passwordLoginMode === "reviewer";
  const isAppleDisabled = isBusy || Platform.OS !== "ios" || !appleAvailable;
  const [isToastVisible, setIsToastVisible] = useState(Boolean(toastMessage));

  useNativeLoginErrorAlert({
    errorMessage,
    language,
    onDismiss: onDismissError
  });

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    setIsToastVisible(true);
    const timeoutId = setTimeout(() => {
      setIsToastVisible(false);
    }, 3200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {isToastVisible && toastMessage ? (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View style={styles.logoBadge}>
            <Image
              accessibilityIgnoresInvertColors
              source={require("../../../assets/splash-brand-icon.png")}
              style={styles.logoImage}
            />
          </View>
          <Text style={[styles.brandName, { color: colors.brandText }]}>
            RouteOne
          </Text>
        </View>

        <View style={styles.authStack}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onGoogleLogin}
            style={({ pressed }) => [
              styles.authButton,
              {
                backgroundColor: colors.googleBackground,
                borderColor: colors.buttonBorder
              },
              isBusy && styles.disabledButton,
              pressed && { backgroundColor: colors.googlePressed }
            ]}
          >
            <View style={styles.providerMark}>
              {activeProvider === "google" ? (
                <ActivityIndicator color={colors.googleText} />
              ) : (
                <Text style={styles.googleMark}>G</Text>
              )}
            </View>
            <View style={styles.loginButtonContent}>
              <Text style={[styles.buttonText, { color: colors.googleText }]}>
                {getButtonLabel({
                  provider: "google",
                  activeProvider,
                  label: text.googleContinue,
                  loadingLabel: text.googleChecking
                })}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isAppleDisabled}
            onPress={onAppleLogin}
            style={({ pressed }) => [
              styles.authButton,
              {
                backgroundColor: colors.appleBackground,
                borderColor: colors.buttonBorder
              },
              isAppleDisabled && styles.disabledButton,
              pressed && { backgroundColor: colors.applePressed }
            ]}
          >
            <View style={styles.providerMark}>
              {activeProvider === "apple" ? (
                <ActivityIndicator color={colors.appleText} />
              ) : (
                <Text style={[styles.appleMark, { color: colors.appleText }]}>
                  
                </Text>
              )}
            </View>
            <View style={styles.loginButtonContent}>
              <Text style={[styles.buttonText, { color: colors.appleText }]}>
                {getAppleButtonLabel({
                  activeProvider,
                  appleAvailable,
                  text
                })}
              </Text>
            </View>
          </Pressable>

          {showPasswordLogin ? (
            <>
              <View style={styles.dividerRow}>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: colors.divider }
                  ]}
                />
                <Text
                  style={[styles.dividerText, { color: colors.mutedText }]}
                >
                  {isReviewerLogin
                    ? text.reviewerAccount
                    : text.testAccount}
                </Text>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: colors.divider }
                  ]}
                />
              </View>

              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isBusy}
                onChangeText={onChangeAccountId}
                placeholder={text.accountIdPlaceholder}
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText
                  }
                ]}
                value={accountId}
              />
              <TextInput
                editable={!isBusy}
                onChangeText={onChangePassword}
                placeholder={text.passwordPlaceholder}
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText
                  }
                ]}
                value={password}
              />
              {!isReviewerLogin ? (
                <TextInput
                  editable={!isBusy}
                  onChangeText={onChangeDisplayName}
                  placeholder={text.displayNamePlaceholder}
                  placeholderTextColor={colors.placeholder}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                      color: colors.inputText
                    }
                  ]}
                  value={displayName}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={onPasswordLogin}
                style={({ pressed }) => [
                  styles.authButton,
                  {
                    backgroundColor: colors.passwordBackground,
                    borderColor: colors.buttonBorder
                  },
                  isBusy && styles.disabledButton,
                  pressed && { backgroundColor: colors.passwordPressed }
                ]}
              >
                <View style={styles.loginButtonContent}>
                  <Text
                    style={[styles.buttonText, { color: colors.passwordText }]}
                  >
                    {getButtonLabel({
                      provider: "password",
                      activeProvider,
                      label: isReviewerLogin
                        ? text.reviewerAccountContinue
                        : text.testAccountContinue,
                      loadingLabel: text.checking
                    })}
                  </Text>
                </View>
                {activeProvider === "password" ? (
                  <ActivityIndicator
                    color={colors.passwordText}
                    style={styles.buttonSpinner}
                  />
                ) : null}
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  toast: {
    position: "absolute",
    top: 18,
    left: 20,
    right: 20,
    zIndex: 10,
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6
  },
  toastText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center"
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 22,
    paddingHorizontal: 24,
    paddingVertical: 34
  },
  brand: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    alignItems: "center",
    marginBottom: 10
  },
  logoBadge: {
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center"
  },
  logoImage: {
    width: 210,
    height: 210,
    resizeMode: "contain"
  },
  brandName: {
    marginTop: -34,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0
  },
  authStack: {
    width: "100%",
    maxWidth: 326,
    alignSelf: "center",
    gap: 12
  },
  authButton: {
    position: "relative",
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 14
  },
  disabledButton: {
    opacity: 0.52
  },
  providerMark: {
    position: "absolute",
    left: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  googleMark: {
    color: "#4285f4",
    fontSize: 18,
    fontWeight: "900"
  },
  appleMark: {
    fontSize: 19,
    fontWeight: "900"
  },
  loginButtonContent: {
    alignItems: "center",
    justifyContent: "center"
  },
  buttonSpinner: {
    position: "absolute",
    right: 18
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8
  },
  dividerLine: {
    flex: 1,
    height: 1
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0
  }
});
