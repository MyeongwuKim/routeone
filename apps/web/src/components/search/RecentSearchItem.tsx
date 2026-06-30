import { IoClose, IoSearch } from "react-icons/io5";

type RecentSearchItemProps = {
  keyword: string;
  onSelect: (keyword: string) => void;
  onDelete: (keyword: string) => void;
};

function RecentSearchItem({
  keyword,
  onSelect,
  onDelete,
}: RecentSearchItemProps) {
  return (
    <div className="flex items-center rounded-2xl border border-brand-400/25 bg-[#071718] shadow-sm transition hover:border-brand-300/45">
      <button
        type="button"
        onClick={() => onSelect(keyword)}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
      >
        <IoSearch className="shrink-0 text-slate-400" />
        <span className="min-w-0 truncate text-sm font-semibold text-slate-100">
          {keyword}
        </span>
      </button>
      <button
        type="button"
        aria-label={`${keyword} 최근 검색 삭제`}
        onClick={() => onDelete(keyword)}
        className="mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700/60 hover:text-slate-100"
      >
        <IoClose />
      </button>
    </div>
  );
}

export default RecentSearchItem;
