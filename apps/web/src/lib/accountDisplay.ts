import type { AuthProvider } from "@/generated/graphql";
import type { AuthUser } from "@/stores/authUserStore";

export function getAccountDisplayName(
  user: AuthUser | null,
  fallback: string
) {
  const displayName = user?.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const emailName = user?.email?.split("@")[0]?.trim();

  return emailName || user?.accountId?.trim() || fallback;
}

export function getAccountIdentifier(user: AuthUser | null) {
  return user?.email?.trim() || user?.accountId?.trim() || null;
}

export function getAccountProviderLabels(
  user: AuthUser | null,
  labels: Record<AuthProvider, string>
) {
  const storedProviders = user?.authProviders ?? [];
  const providers: AuthProvider[] =
    storedProviders.length > 0 ? storedProviders : ["UNKNOWN"];

  return providers.map((provider) => labels[provider]);
}

export function getAccountAvatarFallback(
  user: AuthUser | null,
  fallback: string
) {
  return getAccountDisplayName(user, fallback).slice(0, 1).toUpperCase();
}
