/**
 * 용도: 사용법 버튼의 열림 상태를 관리하고 전달받은 안내를 팝업으로 보여준다.
 * 탭 화면과 일정 만들기에서 같은 버튼과 닫기 동작을 사용한다.
 */
import { useState } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";
import HelpDialog, { type HelpGuide } from "./HelpDialog";

type HelpButtonProps = {
  guide: HelpGuide;
  label: string;
  className?: string;
  disabled?: boolean;
};

function HelpButton({ guide, label, className = "", disabled = false }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const title = guide.title;

  return (
    <>
      <button
        type="button"
        aria-label={title}
        aria-haspopup="dialog"
        title={title}
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white/95 text-[25px] text-brand-700 shadow-sm transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-40 dark:border-brand-400/30 dark:bg-[#102a27] dark:text-brand-200 dark:hover:bg-[#163b36] ${className}`}
      >
        <IoInformationCircleOutline aria-hidden="true" />
      </button>
      {isOpen ? (
        <HelpDialog guide={guide} label={label} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}

export default HelpButton;
