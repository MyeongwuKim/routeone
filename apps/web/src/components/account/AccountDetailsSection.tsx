import type { ReactNode } from "react";
import { FaApple } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import {
  MdCalendarToday,
  MdEmail,
  MdKey,
  MdOutlineAccountCircle,
} from "react-icons/md";
import type { AuthProvider } from "@/generated/graphql";
import { getAccountDisplayName, getAccountIdentifier } from "@/lib/accountDisplay";
import { useUiText } from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import type { AuthUser } from "@/stores/authUserStore";
import AccountAvatar from "./AccountAvatar";
import { AccountLoadError, AccountLoadingState } from "./AccountQueryFeedback";

function AccountInfoRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-500">{label}</span>
        <span className="mt-1 block break-all text-sm font-bold text-slate-900">
          {children}
        </span>
      </span>
    </div>
  );
}

function AuthProviderIcon({ provider }: { provider: AuthProvider }) {
  if (provider === "GOOGLE") return <FcGoogle />;
  if (provider === "APPLE") return <FaApple />;
  return provider === "PASSWORD" ? <MdKey /> : <MdOutlineAccountCircle />;
}

function formatJoinedAt(value: string, language: "ko" | "en") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

type AccountDetailsSectionProps = {
  user: AuthUser | null;
  isLoading: boolean;
  onRetry: () => void;
};

export default function AccountDetailsSection({
  user,
  isLoading,
  onRetry,
}: AccountDetailsSectionProps) {
  const text = useUiText();
  const language = useAppLanguageStore((state) => state.language);

  if (!user) {
    return isLoading ? (
      <AccountLoadingState variant="details" />
    ) : (
      <AccountLoadError onRetry={onRetry} />
    );
  }

  const socialAuthProviders = user.authProviders.filter(
    (provider) => provider === "GOOGLE" || provider === "APPLE"
  );
  const authProviders: AuthProvider[] =
    socialAuthProviders.length > 0 ? socialAuthProviders : ["UNKNOWN"];
  const displayName = getAccountDisplayName(user, text.account.fallbackName);
  const identifier = getAccountIdentifier(user) ?? text.myInfo.localTestAccount;
  const accountRoleLabel =
    user.role === "OWNER"
      ? text.account.masterAccount
      : user.role === "REVIEWER"
        ? text.account.reviewerAccount
        : null;

  return (
    <>
      <section className="rounded-3xl border border-brand-200 bg-gradient-to-br from-white via-white to-brand-50 p-5 shadow-sm dark:border-brand-400/25 dark:from-[#0d2926] dark:via-[#0b211f] dark:to-[#0f3431]">
        <div className="flex items-center gap-4">
          <AccountAvatar
            user={user}
            fallbackName={text.account.fallbackName}
            className="size-20"
            textClassName="text-3xl"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-slate-900">
              {displayName}
            </h2>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">
              {identifier}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {accountRoleLabel ? (
                <span className="inline-flex items-center rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-black text-white">
                  {accountRoleLabel}
                </span>
              ) : null}
              {authProviders.map((provider) => (
                <span
                  key={provider}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:bg-brand-400/15 dark:text-brand-100"
                >
                  <span className="text-sm">
                    <AuthProviderIcon provider={provider} />
                  </span>
                  {text.account.providers[provider]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">
            {text.account.accountSection}
          </p>
        </div>
        {user.email ? (
          <>
            <AccountInfoRow icon={<MdEmail />} label={text.account.email}>
              {user.email}
            </AccountInfoRow>
            <div className="border-b border-brand-50" />
          </>
        ) : null}
        {user.accountId ? (
          <>
            <AccountInfoRow
              icon={<MdOutlineAccountCircle />}
              label={text.account.accountId}
            >
              {user.accountId}
            </AccountInfoRow>
            <div className="border-b border-brand-50" />
          </>
        ) : null}
        <AccountInfoRow icon={<MdKey />} label={text.account.loginMethods}>
          <span className="flex flex-wrap gap-x-2 gap-y-1">
            {authProviders.map((provider) => (
              <span key={provider}>{text.account.providers[provider]}</span>
            ))}
          </span>
        </AccountInfoRow>
        <div className="border-b border-brand-50" />
        <AccountInfoRow icon={<MdCalendarToday />} label={text.account.joinedAt}>
          {formatJoinedAt(user.createdAt, language)}
        </AccountInfoRow>
      </section>
    </>
  );
}
