import AccountAvatar from "@/components/account/AccountAvatar";
import type { SharedRouteOwnerFieldsFragment } from "@/generated/graphql";
import { getAccountDisplayName } from "@/lib/accountDisplay";
import { useUiText } from "@/lib/uiText";

type SharedRouteAuthorProps = {
  owner: SharedRouteOwnerFieldsFragment;
  isMine?: boolean;
  compact?: boolean;
  className?: string;
};

function SharedRouteAuthor({
  owner,
  isMine = false,
  compact = false,
  className = "",
}: SharedRouteAuthorProps) {
  const text = useUiText();
  const displayName = getAccountDisplayName(owner, text.account.fallbackName);

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <AccountAvatar
        user={owner}
        fallbackName={text.account.fallbackName}
        className={compact ? "size-6 ring-2" : "size-7 ring-2"}
        textClassName={compact ? "text-[10px]" : "text-xs"}
      />
      <span
        className={`min-w-0 truncate font-black text-slate-700 dark:text-slate-100 ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        {displayName}
      </span>
      {isMine ? (
        <span className="shrink-0 rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[9px] font-black leading-4 text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
          {text.sharedRouteCard.myShare}
        </span>
      ) : null}
    </div>
  );
}

export default SharedRouteAuthor;
