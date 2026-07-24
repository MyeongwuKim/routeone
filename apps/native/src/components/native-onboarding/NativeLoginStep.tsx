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
import type { NativeLoginProvider } from "../../auth/nativeLoginTypes";

type AppLanguage = "ko" | "en";

type NativeLoginStepProps = {
  language: AppLanguage;
  accountId: string;
  password: string;
  displayName: string;
  appleAvailable: boolean;
  activeProvider: NativeLoginProvider | null;
  errorMessage: string | null;
  toastMessage?: string | null;
  onChangeAccountId: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangeDisplayName: (value: string) => void;
  onPasswordLogin: () => void;
  onGoogleLogin: () => void;
  onAppleLogin: () => void;
};

const LOGIN_THEME = {
  light: {
    background: "#0f766e",
    brandText: "#ffffff",
    mutedText: "rgba(255, 255, 255, 0.76)",
    buttonBorder: "rgba(255, 255, 255, 0.38)",
    googleBackground: "#ffffff",
    googlePressed: "#edf7f4",
    googleText: "#111827",
    appleBackground: "#111827",
    applePressed: "#030712",
    appleText: "#ffffff",
    divider: "rgba(255, 255, 255, 0.26)",
    inputBackground: "rgba(255, 255, 255, 0.94)",
    inputBorder: "rgba(255, 255, 255, 0.28)",
    inputText: "#0f172a",
    placeholder: "#8ba19c",
    passwordBackground: "#ffffff",
    passwordPressed: "#def2ed",
    passwordText: "#0f766e",
    errorBackground: "#fff1f2",
    errorBorder: "#fecdd3",
    errorText: "#be123c"
  },
  dark: {
    background: "#061918",
    brandText: "#f8fafc",
    mutedText: "rgba(226, 245, 241, 0.72)",
    buttonBorder: "rgba(148, 216, 204, 0.18)",
    googleBackground: "#eef7f4",
    googlePressed: "#d7ebe5",
    googleText: "#0f172a",
    appleBackground: "#f8fafc",
    applePressed: "#dbe4e1",
    appleText: "#020617",
    divider: "rgba(226, 245, 241, 0.2)",
    inputBackground: "rgba(13, 36, 34, 0.9)",
    inputBorder: "rgba(148, 216, 204, 0.22)",
    inputText: "#f8fafc",
    placeholder: "#78948f",
    passwordBackground: "#14b8a6",
    passwordPressed: "#0f9488",
    passwordText: "#042f2e",
    errorBackground: "#3a121b",
    errorBorder: "#7f1d1d",
    errorText: "#fecdd3"
  }
} as const;

const LOGIN_TEXT = {
  ko: {
    appleChecking: "Apple 확인 중",
    appleContinue: "Apple로 계속",
    appleIosOnly: "iOS에서 사용 가능",
    applePermissionError: "Apple 로그인 권한을 켠 뒤 앱을 다시 설치해 주세요.",
    applePreparing: "Apple 준비 중",
    checking: "확인 중",
    displayNamePlaceholder: "닉네임(선택)",
    errorTitle: "계속 진행하지 못했어요",
    googleChecking: "Google 확인 중",
    googleConfigurationError:
      "Google 로그인 설정이 앱에 아직 반영되지 않았어요. 앱을 다시 설치한 뒤 시도해 주세요.",
    googleContinue: "Google로 계속",
    passwordPlaceholder: "비밀번호",
    testAccount: "테스트 계정",
    testAccountContinue: "테스트 계정으로 계속",
    accountIdPlaceholder: "아이디"
  },
  en: {
    appleChecking: "Checking Apple",
    appleContinue: "Continue with Apple",
    appleIosOnly: "Available on iOS",
    applePermissionError:
      "Turn on Sign in with Apple, then reinstall the app.",
    applePreparing: "Preparing Apple",
    checking: "Checking",
    displayNamePlaceholder: "Nickname (optional)",
    errorTitle: "Could not continue",
    googleChecking: "Checking Google",
    googleConfigurationError:
      "Google sign-in configuration has not been applied to this app yet. Reinstall the app and try again.",
    googleContinue: "Continue with Google",
    passwordPlaceholder: "Password",
    testAccount: "Test account",
    testAccountContinue: "Continue with test account",
    accountIdPlaceholder: "ID"
  }
} as const;

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

function getFriendlyErrorMessage(
  errorMessage: string,
  text: (typeof LOGIN_TEXT)[AppLanguage]
) {
  if (errorMessage.includes("URL schemes")) {
    return text.googleConfigurationError;
  }

  if (
    errorMessage.includes("비활성화된 빌드") ||
    errorMessage.includes("Sign in with Apple")
  ) {
    return text.applePermissionError;
  }

  return errorMessage;
}

export default function NativeLoginStep({
  language,
  accountId,
  password,
  displayName,
  appleAvailable,
  activeProvider,
  errorMessage,
  toastMessage,
  onChangeAccountId,
  onChangePassword,
  onChangeDisplayName,
  onPasswordLogin,
  onGoogleLogin,
  onAppleLogin,
}: NativeLoginStepProps) {
  const colorScheme = useColorScheme();
  const colors = LOGIN_THEME[colorScheme === "dark" ? "dark" : "light"];
  const text = LOGIN_TEXT[language];
  const isBusy = activeProvider !== null;
  const isAppleDisabled = isBusy || Platform.OS !== "ios" || !appleAvailable;
  const [isToastVisible, setIsToastVisible] = useState(Boolean(toastMessage));
  const friendlyErrorMessage = errorMessage
    ? getFriendlyErrorMessage(errorMessage, text)
    : null;

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

          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.divider }]}
            />
            <Text style={[styles.dividerText, { color: colors.mutedText }]}>
              {text.testAccount}
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.divider }]}
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
              <Text style={[styles.buttonText, { color: colors.passwordText }]}>
                {getButtonLabel({
                  provider: "password",
                  activeProvider,
                  label: text.testAccountContinue,
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
        </View>

        {friendlyErrorMessage ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.errorBackground,
                borderColor: colors.errorBorder
              }
            ]}
          >
            <Text style={[styles.errorTitle, { color: colors.errorText }]}>
              {text.errorTitle}
            </Text>
            <Text style={[styles.errorText, { color: colors.errorText }]}>
              {friendlyErrorMessage}
            </Text>
          </View>
        ) : null}
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
  },
  errorBox: {
    width: "100%",
    maxWidth: 326,
    alignSelf: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0
  },
  errorText: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    letterSpacing: 0
  }
});
