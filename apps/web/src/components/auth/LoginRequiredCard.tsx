/**
 * 사용 위치: 로그인이 필요한 하단 탭과 계정 화면
 *
 * 용도:
 * 게스트에게 이용 가능한 기능과 계정 기능의 차이를 안내하고 로그인으로 연결한다.
 *
 * 구조:
 * 계정 아이콘, 안내 문구, 네이티브 로그인 요청 버튼으로 구성되어 있다.
 */
import { MdLogin, MdOutlineAccountCircle } from "react-icons/md";
import { useLoginRequest } from "@/hooks/useLoginRequest";
import { useUiText } from "@/lib/uiText";

function LoginRequiredCard() {
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
      </div>
    </section>
  );
}

export default LoginRequiredCard;
