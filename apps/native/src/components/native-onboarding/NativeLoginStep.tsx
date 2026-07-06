import {
  ActivityIndicator,
  Platform,
  Pressable,
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

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>R1</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ROUTE ONE</Text>
            <Text style={styles.title}>로그인</Text>
          </View>
        </View>

        <View style={styles.oauthActions}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onGoogleLogin}
            style={({ pressed }) => [
              styles.oauthButton,
              styles.googleButton,
              pressed && styles.buttonPressed
            ]}
          >
            {activeProvider === "google" ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.googleMark}>G</Text>
            )}
            <Text style={styles.googleButtonText}>
              {getButtonLabel({
                provider: "google",
                activeProvider,
                label: "Google로 계속",
                loadingLabel: "Google 확인 중"
              })}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isAppleDisabled}
            onPress={onAppleLogin}
            style={({ pressed }) => [
              styles.oauthButton,
              styles.appleButton,
              isAppleDisabled && styles.disabledButton,
              pressed && styles.appleButtonPressed
            ]}
          >
            {activeProvider === "apple" ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.appleMark}></Text>
            )}
            <Text style={styles.appleButtonText}>
              {Platform.OS === "ios" && appleAvailable
                ? getButtonLabel({
                    provider: "apple",
                    activeProvider,
                    label: "Apple로 계속",
                    loadingLabel: "Apple 확인 중"
                  })
                : "Apple 로그인은 iOS 전용"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>테스트 계정</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.form}>
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
              styles.passwordButton,
              isBusy && styles.disabledButton,
              pressed && styles.passwordButtonPressed
            ]}
          >
            {activeProvider === "password" ? (
              <ActivityIndicator color="#ffffff" />
            ) : null}
            <Text style={styles.passwordButtonText}>
              {getButtonLabel({
                provider: "password",
                activeProvider,
                label: "기존 방식으로 로그인",
                loadingLabel: "로그인 중"
              })}
            </Text>
          </Pressable>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
    backgroundColor: "#e7f2ef"
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(20, 184, 166, 0.46)",
    backgroundColor: "#ffffff",
    padding: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12
    },
    elevation: 12
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e"
  },
  iconText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
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
    fontSize: 22,
    fontWeight: "900"
  },
  oauthActions: {
    gap: 10,
    marginTop: 24
  },
  oauthButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 22
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0"
  },
  dividerText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800"
  },
  form: {
    gap: 10,
    marginTop: 16
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    backgroundColor: "#ffffff"
  },
  passwordButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
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
  errorText: {
    marginTop: 14,
    color: "#be123c",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  }
});
