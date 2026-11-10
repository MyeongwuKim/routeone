/**
 * 사용 위치: 로그인이 필요한 하단 탭과 계정 화면
 *
 * 용도:
 * 게스트에게 이용 가능한 기능과 계정 기능의 차이를 안내하고 로그인으로 연결한다.
 *
 * 구조:
 * 로그인 요청 버튼을 표시하고, 내 정보에서는 게스트도 열 수 있는 언어 설정을 함께 제공한다.
 */
import { MdLanguage, MdLogin, MdOutlineAccountCircle } from "react-icons/md";
import { Link } from "react-router-dom";
import { useLoginRequest } from "@/hooks/useLoginRequest";
import { useUiText } from "@/lib/uiText";

function LoginRequiredCard({ showLanguageLink }: { showLanguageLink: boolean }) {
  const text = useUiText();
  const requestLogin = useLoginRequest();

  return (
    <section className="flex h-full min-h-0 items-center justify-center">
      <div className="w-full max-w-sm rounded-3xl border border-brand-100 bg-white p-6 text-center shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d]">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-50 text-4xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
          <MdOutlineAccountCircle />
        </span>
        <h1 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
          {text.auth.requiredTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
          {text.auth.requiredDescription}
        </p>
        <button
          type="button"
          onClick={() => requestLogin("protected-screen")}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.99]"
        >
          <MdLogin className="text-lg" />
          {text.auth.login}
        </button>
        {showLanguageLink ? (
          <Link
            to="/me/language"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand-200 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50 dark:border-brand-400/25 dark:text-brand-100 dark:hover:bg-brand-400/10"
          >
            <MdLanguage aria-hidden="true" className="text-lg" />
            {text.routeShell.languageTitle}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export default LoginRequiredCard;
