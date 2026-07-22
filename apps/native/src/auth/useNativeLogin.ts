import { useCallback, useEffect, useState } from "react";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  loginWithNativeOAuth,
  loginWithNativePassword,
  type NativeAuthPayload
} from "./nativeAuth";
import type { NativeLoginProvider } from "./nativeLoginTypes";

type UseNativeLoginOptions = {
  onComplete: (payload: NativeAuthPayload) => Promise<void>;
};

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";

function configureGoogleSignIn() {
  GoogleSignin.configure({
    ...(GOOGLE_WEB_CLIENT_ID ? { webClientId: GOOGLE_WEB_CLIENT_ID } : {}),
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    offlineAccess: false,
    profileImageSize: 120
  });
}

function getAppleDisplayName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null
) {
  const nameParts = [
    fullName?.familyName,
    fullName?.middleName,
    fullName?.givenName
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  return nameParts.join(" ") || null;
}

function getNativeAuthErrorMessage(error: unknown) {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return "로그인을 취소했어요.";
    }

    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return "Google Play 서비스를 사용할 수 없어요.";
    }

    if (error.code === statusCodes.IN_PROGRESS) {
      return "이미 로그인을 확인하는 중이에요.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "로그인에 실패했어요. 다시 시도해 주세요.";
}

export function useNativeLogin({ onComplete }: UseNativeLoginOptions) {
  const [activeProvider, setActiveProvider] =
    useState<NativeLoginProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    let isMounted = true;

    configureGoogleSignIn();

    void AppleAuthentication.isAvailableAsync().then((isAvailable) => {
      if (isMounted) {
        setAppleAvailable(isAvailable);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePasswordLogin = useCallback(async () => {
    if (activeProvider) {
      return;
    }

    setActiveProvider("password");
    setErrorMessage(null);

    try {
      await onComplete(
        await loginWithNativePassword({
          accountId,
          password,
          displayName: displayName.trim() || undefined
        })
      );
    } catch (error) {
      setErrorMessage(getNativeAuthErrorMessage(error));
    } finally {
      setActiveProvider(null);
    }
  }, [accountId, activeProvider, displayName, onComplete, password]);

  const handleGoogleLogin = useCallback(async () => {
    if (activeProvider) {
      return;
    }

    setActiveProvider("google");
    setErrorMessage(null);

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true
      });

      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) {
        setErrorMessage("Google 로그인을 취소했어요.");
        return;
      }

      const { idToken, user } = response.data;

      if (!idToken) {
        throw new Error("Google identity token을 받지 못했어요.");
      }

      await onComplete(
        await loginWithNativeOAuth({
          provider: "GOOGLE",
          identityToken: idToken,
          displayName: user.name,
          email: user.email,
          avatarUrl: user.photo
        })
      );
    } catch (error) {
      setErrorMessage(getNativeAuthErrorMessage(error));
    } finally {
      setActiveProvider(null);
    }
  }, [activeProvider, onComplete]);

  const handleAppleLogin = useCallback(async () => {
    if (activeProvider) {
      return;
    }

    setActiveProvider("apple");
    setErrorMessage(null);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });

      if (!credential.identityToken) {
        throw new Error("Apple identity token을 받지 못했어요.");
      }

      await onComplete(
        await loginWithNativeOAuth({
          provider: "APPLE",
          identityToken: credential.identityToken,
          displayName: getAppleDisplayName(credential.fullName),
          email: credential.email
        })
      );
    } catch (error) {
      setErrorMessage(getNativeAuthErrorMessage(error));
    } finally {
      setActiveProvider(null);
    }
  }, [activeProvider, onComplete]);

  return {
    accountId,
    activeProvider,
    appleAvailable,
    displayName,
    errorMessage,
    password,
    setAccountId,
    setDisplayName,
    setPassword,
    handleAppleLogin,
    handleGoogleLogin,
    handlePasswordLogin
  };
}
