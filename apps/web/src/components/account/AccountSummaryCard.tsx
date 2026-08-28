import { MdChevronRight } from "react-icons/md";
import {
  getAccountDisplayName,
  getAccountIdentifier,
  getAccountProviderLabels,
} from "@/lib/accountDisplay";
import { useUiText } from "@/lib/uiText";
import type { AuthUser } from "@/stores/authUserStore";
import AccountAvatar from "./AccountAvatar";
import { AccountLoadError, AccountLoadingState } from "./AccountQueryFeedback";

type AccountSummaryCardProps = {
  user: AuthUser | null;
  isLoading: boolean;
  onRetry: () => void;
  onClick: () => void;
};

export default function AccountSummaryCard({
  user,
  isLoading,
  onRetry,
  onClick,
}: AccountSummaryCardProps) {
  const text = useUiText();

  if (!user) {
    return isLoading ? (
      <AccountLoadingState />
    ) : (
      <AccountLoadError onRetry={onRetry} />
    );
  }

  const displayName = getAccountDisplayName(user, text.account.fallbackName);
  const identifier = getAccountIdentifier(user) ?? text.myInfo.localTestAccount;
  const providerSummary = getAccountProviderLabels(
    user,
    text.account.providers
  ).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-white via-white to-brand-50 px-4 py-5 text-left shadow-sm transition hover:border-brand-300 active:scale-[0.99] dark:border-brand-400/25 dark:from-[#0d2926] dark:via-[#0b211f] dark:to-[#0f3431]"
    >
      <AccountAvatar
        user={user}
        fallbackName={text.account.fallbackName}
        className="size-[4.5rem]"
        textClassName="text-2xl"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-black text-slate-900">
          {displayName}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-slate-500">
          {identifier}
        </span>
        <span className="mt-2 inline-flex rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
          {providerSummary}
        </span>
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-2xl text-brand-700 shadow-sm transition group-hover:translate-x-0.5 dark:bg-brand-400/10 dark:text-brand-100">
        <MdChevronRight />
      </span>
    </button>
  );
}
