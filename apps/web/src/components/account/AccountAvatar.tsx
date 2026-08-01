import { useState } from "react";
import {
  getAccountAvatarFallback,
  type AccountDisplayUser,
} from "@/lib/accountDisplay";

function AccountAvatar({
  user,
  fallbackName,
  className = "size-16",
  textClassName = "text-2xl",
}: {
  user: AccountDisplayUser | null;
  fallbackName: string;
  className?: string;
  textClassName?: string;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const avatarUrl = user?.avatarUrl?.trim() || null;
  const shouldShowImage = avatarUrl && failedImageUrl !== avatarUrl;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-black text-brand-700 ring-4 ring-white/80 dark:bg-brand-400/20 dark:text-brand-100 dark:ring-brand-950/40 ${className} ${textClassName}`}
      aria-hidden="true"
    >
      {getAccountAvatarFallback(user, fallbackName)}
      {shouldShowImage ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedImageUrl(avatarUrl)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

export default AccountAvatar;
