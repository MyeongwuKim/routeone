import { useEffect, useRef } from "react";
import { Alert, Keyboard } from "react-native";
import { LOGIN_TEXT } from "@/constants/nativeOnboarding";

type UseNativeLoginErrorAlertOptions = {
  errorMessage: string | null;
  language: keyof typeof LOGIN_TEXT;
  onDismiss: () => void;
};

function getFriendlyErrorMessage(
  errorMessage: string,
  text: (typeof LOGIN_TEXT)[keyof typeof LOGIN_TEXT]
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

export function useNativeLoginErrorAlert({
  errorMessage,
  language,
  onDismiss
}: UseNativeLoginErrorAlertOptions) {
  const shownErrorRef = useRef<string | null>(null);
  const text = LOGIN_TEXT[language];

  useEffect(() => {
    if (!errorMessage) {
      shownErrorRef.current = null;
      return;
    }

    if (shownErrorRef.current === errorMessage) {
      return;
    }

    shownErrorRef.current = errorMessage;
    Keyboard.dismiss();
    Alert.alert(
      text.errorTitle,
      getFriendlyErrorMessage(errorMessage, text),
      [{ text: text.errorConfirm, onPress: onDismiss }],
      { cancelable: true, onDismiss }
    );
  }, [errorMessage, onDismiss, text]);
}
