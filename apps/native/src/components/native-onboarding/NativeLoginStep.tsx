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

type NativeLoginStepProps = {
  accountId: string;
  password: string;
  displayName: string;
  appleAvailable: boolean;
  activeProvider: NativeLoginProvider | null;
  errorMessage: string | null;
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
  appleAvailable
}: {
  activeProvider: NativeLoginProvider | null;
  appleAvailable: boolean;
}) {
  if (Platform.OS !== "ios") {
    return "iOS에서 사용 가능";
  }

  if (!appleAvailable) {
    return "Apple 준비 중";
  }

  return getButtonLabel({
    provider: "apple",
    activeProvider,
    label: "Apple로 계속",
    loadingLabel: "Apple 확인 중"
  });
}

function getFriendlyErrorMessage(errorMessage: string) {
  if (errorMessage.includes("URL schemes")) {
    return "Google 로그인 설정이 앱에 아직 반영되지 않았어요. 앱을 다시 설치한 뒤 시도해 주세요.";
  }

  if (
    errorMessage.includes("비활성화된 빌드") ||
    errorMessage.includes("Sign in with Apple")
  ) {
    return "Apple 로그인 권한을 켠 뒤 앱을 다시 설치해 주세요.";
  }

  return errorMessage;
}

export default function NativeLoginStep({
  accountId,
  password,
  displayName,
  appleAvailable,
  activeProvider,
  errorMessage,
  onChangeAccountId,
  onChangePassword,
  onChangeDisplayName,
  onPasswordLogin,
  onGoogleLogin,
  onAppleLogin,
}: NativeLoginStepProps) {
  const colorScheme = useColorScheme();
  const colors = LOGIN_THEME[colorScheme === "dark" ? "dark" : "light"];
  const isBusy = activeProvider !== null;
  const isAppleDisabled = isBusy || Platform.OS !== "ios" || !appleAvailable;
  const friendlyErrorMessage = errorMessage
    ? getFriendlyErrorMessage(errorMessage)
    : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
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
                  label: "Google로 계속",
                  loadingLabel: "Google 확인 중"
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
                {getAppleButtonLabel({ activeProvider, appleAvailable })}
              </Text>
            </View>
          </Pressable>

          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.divider }]}
            />
            <Text style={[styles.dividerText, { color: colors.mutedText }]}>
              테스트 계정
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
            placeholder="아이디"
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
            placeholder="비밀번호"
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
            placeholder="닉네임(선택)"
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
                  label: "테스트 계정으로 계속",
                  loadingLabel: "확인 중"
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
              계속 진행하지 못했어요
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
