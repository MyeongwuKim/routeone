import {
  cleanAddressKeyword,
  fetchJsonWithTimeout,
  JUSO_REQUEST_TIMEOUT_MS,
  normalizeAddressForMatch,
} from "./placeLocalization.shared.js";

type JusoSearchResponse = {
  results?: {
    common?: { errorCode?: string; errorMessage?: string };
    juso?:
      | Array<{
          roadAddr?: string;
          roadAddrPart1?: string;
          jibunAddr?: string;
          engAddr?: string;
        }>
      | string;
  };
};

export async function fetchOfficialEnglishAddress(address: string) {
  const apiKey = process.env.JUSO_API_KEY?.trim();
  const keyword = cleanAddressKeyword(address);
  if (!apiKey || !keyword) {
    return null;
  }

  try {
    const query = new URLSearchParams({
      confmKey: apiKey,
      currentPage: "1",
      countPerPage: "10",
      keyword,
      resultType: "json",
    });
    const { response, data } = await fetchJsonWithTimeout<JusoSearchResponse>(
      `https://business.juso.go.kr/addrlink/addrLinkApi.do?${query.toString()}`,
      undefined,
      JUSO_REQUEST_TIMEOUT_MS
    );
    if (!response.ok || data.results?.common?.errorCode !== "0") {
      return null;
    }

    const rawItems = data.results?.juso;
    const items = Array.isArray(rawItems) ? rawItems : [];
    const normalizedKeyword = normalizeAddressForMatch(keyword);
    const exactMatch = items.find((item) =>
      [item.roadAddrPart1, item.roadAddr, item.jibunAddr].some(
        (candidate) =>
          candidate && normalizeAddressForMatch(candidate) === normalizedKeyword
      )
    );
    const uniqueNumberedMatch =
      /\d/u.test(keyword) && items.length === 1 ? items[0] : undefined;

    return (exactMatch || uniqueNumberedMatch)?.engAddr?.trim() || null;
  } catch {
    return null;
  }
}
