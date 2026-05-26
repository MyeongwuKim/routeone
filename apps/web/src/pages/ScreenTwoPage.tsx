function ScreenTwoPage() {
  return (
    <section className="space-y-4 pb-4">
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-brand-700">화면2 영역</p>
      </div>

      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
        >
          <p className="text-sm text-slate-700">화면2 콘텐츠 {item}</p>
        </div>
      ))}
    </section>
  );
}

export default ScreenTwoPage;
