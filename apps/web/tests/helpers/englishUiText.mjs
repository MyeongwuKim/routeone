/** 영어팩이 준비된 화면을 렌더링하는 테스트에 실제 영어 문구를 전달한다. */
export async function loadEnglishUiText(server) {
  const { default: englishText } = await server.ssrLoadModule("/src/lib/ui-text/en.ts");
  const { completeEnglishText } = await server.ssrLoadModule("/src/lib/ui-text/englishPack.ts");
  return completeEnglishText(englishText);
}
