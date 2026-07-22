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
    return "Apple 로그인 준비 중";
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
  const isBusy = activeProvider !== null;
  const isAppleDisabled = isBusy || Platform.OS !== "ios" || !appleAvailable;
  const friendlyErrorMessage = errorMessage
    ? getFriendlyErrorMessage(errorMessage)
    : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Image
                accessibilityIgnoresInvertColors
                source={require("../../../assets/icon.png")}
                style={styles.logoImage}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ROUTE ONE</Text>
              <Text style={styles.title}>로그인</Text>
            </View>
          </View>
          <Text style={styles.description}>계정으로 들어가 루트를 이어가세요.</Text>
        </View>

        <View style={styles.surface}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>간편 로그인</Text>
            <Text style={styles.sectionBadge}>권장</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onGoogleLogin}
            style={({ pressed }) => [
              styles.loginButton,
              styles.googleButton,
              isBusy && styles.disabledButton,
              pressed && styles.buttonPressed
            ]}
          >
            <View style={styles.providerMark}>
              {activeProvider === "google" ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.googleMark}>G</Text>
              )}
            </View>
            <View style={styles.loginButtonContent}>
              <Text style={styles.googleButtonText}>
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
              styles.loginButton,
              styles.appleButton,
              isAppleDisabled && styles.disabledButton,
              pressed && styles.appleButtonPressed
            ]}
          >
            <View style={styles.providerMark}>
              {activeProvider === "apple" ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.appleMark}></Text>
              )}
            </View>
            <View style={styles.loginButtonContent}>
              <Text style={styles.appleButtonText}>
                {getAppleButtonLabel({ activeProvider, appleAvailable })}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.surface}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>테스트 계정</Text>
            <Text style={styles.sectionHint}>개발용</Text>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
            onChangeText={onChangeAccountId}
            placeholder="아이디"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={accountId}
          />
          <TextInput
            editable={!isBusy}
            onChangeText={onChangePassword}
            placeholder="비밀번호"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <TextInput
            editable={!isBusy}
            onChangeText={onChangeDisplayName}
            placeholder="닉네임(선택)"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={displayName}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onPasswordLogin}
            style={({ pressed }) => [
              styles.loginButton,
              styles.passwordButton,
              isBusy && styles.disabledButton,
              pressed && styles.passwordButtonPressed
            ]}
          >
            <View style={styles.loginButtonContent}>
              <Text style={styles.passwordButtonText}>
                {getButtonLabel({
                  provider: "password",
                  activeProvider,
                  label: "기존 방식으로 로그인",
                  loadingLabel: "로그인 중"
                })}
              </Text>
            </View>
            {activeProvider === "password" ? (
              <ActivityIndicator color="#ffffff" style={styles.buttonSpinner} />
            ) : null}
          </Pressable>
        </View>

        {friendlyErrorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>로그인에 실패했어요</Text>
            <Text style={styles.errorText}>{friendlyErrorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f7f4"
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 26
  },
  header: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    gap: 14
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#e7f2ef"
  },
  logoImage: {
    width: 52,
    height: 52
  },
  headerText: {
    flex: 1
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "900"
  },
  title: {
    marginTop: 2,
    color: "#111827",
    fontSize: 26,
    fontWeight: "900"
  },
  description: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22
  },
  surface: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe5df",
    backgroundColor: "#ffffff",
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10
    },
    elevation: 8
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  sectionBadge: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "900",
    backgroundColor: "#dff6ef"
  },
  sectionHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800"
  },
  loginButton: {
    position: "relative",
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 14
  },
  googleButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff"
  },
  appleButton: {
    backgroundColor: "#111827"
  },
  disabledButton: {
    opacity: 0.52
  },
  buttonPressed: {
    backgroundColor: "#f8fafc"
  },
  appleButtonPressed: {
    backgroundColor: "#030712"
  },
  providerMark: {
    position: "absolute",
    left: 14,
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
    color: "#ffffff",
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
  googleButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  appleButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    backgroundColor: "#ffffff"
  },
  passwordButton: {
    marginTop: 2,
    backgroundColor: "#0f766e"
  },
  passwordButtonPressed: {
    backgroundColor: "#115e59"
  },
  passwordButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  errorBox: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecdd3",
    backgroundColor: "#fff1f2",
    padding: 14
  },
  errorTitle: {
    color: "#be123c",
    fontSize: 14,
    fontWeight: "900"
  },
  errorText: {
    marginTop: 5,
    color: "#be123c",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  }
});
