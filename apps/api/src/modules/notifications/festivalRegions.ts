/** 축제 조회·알림 설정·여행 일정의 지역 코드를 연결한다. 코드는 전국에서 고유한 5자리 행정 코드를 사용한다. */

type FestivalArea = { areaCode: string; label: string; englishLabel: string; regions: readonly (readonly [adminCode: string, tourCode: string, label: string, englishLabel: string])[] };

export const FESTIVAL_AREAS: readonly FestivalArea[] = [
  { areaCode: "32", label: "강원", englishLabel: "Gangwon", regions: [
    ["51150", "1", "강릉", "Gangneung"],
    ["51820", "2", "고성", "Goseong"],
    ["51170", "3", "동해", "Donghae"],
    ["51230", "4", "삼척", "Samcheok"],
    ["51210", "5", "속초", "Sokcho"],
    ["51800", "6", "양구", "Yanggu"],
    ["51830", "7", "양양", "Yangyang"],
    ["51750", "8", "영월", "Yeongwol"],
    ["51130", "9", "원주", "Wonju"],
    ["51810", "10", "인제", "Inje"],
    ["51770", "11", "정선", "Jeongseon"],
    ["51780", "12", "철원", "Cheorwon"],
    ["51110", "13", "춘천", "Chuncheon"],
    ["51190", "14", "태백", "Taebaek"],
    ["51760", "15", "평창", "Pyeongchang"],
    ["51720", "16", "홍천", "Hongcheon"],
    ["51790", "17", "화천", "Hwacheon"],
    ["51730", "18", "횡성", "Hoengseong"],
  ] },
  { areaCode: "1", label: "서울", englishLabel: "Seoul", regions: [
    ["11680", "1", "강남구", "Gangnam-gu"],
    ["11740", "2", "강동구", "Gangdong-gu"],
    ["11305", "3", "강북구", "Gangbuk-gu"],
    ["11500", "4", "강서구", "Gangseo-gu"],
    ["11620", "5", "관악구", "Gwanak-gu"],
    ["11215", "6", "광진구", "Gwangjin-gu"],
    ["11530", "7", "구로구", "Guro-gu"],
    ["11545", "8", "금천구", "Geumcheon-gu"],
    ["11350", "9", "노원구", "Nowon-gu"],
    ["11320", "10", "도봉구", "Dobong-gu"],
    ["11230", "11", "동대문구", "Dongdaemun-gu"],
    ["11590", "12", "동작구", "Dongjak-gu"],
    ["11440", "13", "마포구", "Mapo-gu"],
    ["11410", "14", "서대문구", "Seodaemun-gu"],
    ["11650", "15", "서초구", "Seocho-gu"],
    ["11200", "16", "성동구", "Seongdong-gu"],
    ["11290", "17", "성북구", "Seongbuk-gu"],
    ["11710", "18", "송파구", "Songpa-gu"],
    ["11470", "19", "양천구", "Yangcheon-gu"],
    ["11560", "20", "영등포구", "Yeongdeungpo-gu"],
    ["11170", "21", "용산구", "Yongsan-gu"],
    ["11380", "22", "은평구", "Eunpyeong-gu"],
    ["11110", "23", "종로구", "Jongno-gu"],
    ["11140", "24", "중구", "Jung-gu"],
    ["11260", "25", "중랑구", "Jungnang-gu"],
  ] },
  { areaCode: "31", label: "경기도", englishLabel: "Gyeonggi-do", regions: [
    ["41820", "1", "가평군", "Gapyeong-gun"],
    ["41280", "2", "고양시", "Goyang-si"],
    ["41290", "3", "과천시", "Gwacheon-si"],
    ["41210", "4", "광명시", "Gwangmyeong-si"],
    ["41610", "5", "광주시", "Gwangju-si"],
    ["41310", "6", "구리시", "Guri-si"],
    ["41410", "7", "군포시", "Gunpo-si"],
    ["41570", "8", "김포시", "Gimpo-si"],
    ["41360", "9", "남양주시", "Namyangju-si"],
    ["41250", "10", "동두천시", "Dongducheon-si"],
    ["41190", "11", "부천시", "Bucheon-si"],
    ["41130", "12", "성남시", "Seongnam-si"],
    ["41110", "13", "수원시", "Suwon-si"],
    ["41390", "14", "시흥시", "Siheung-si"],
    ["41270", "15", "안산시", "Ansan-si"],
    ["41550", "16", "안성시", "Anseong-si"],
    ["41170", "17", "안양시", "Anyang-si"],
    ["41630", "18", "양주시", "Yangju-si"],
    ["41830", "19", "양평군", "Yangpyeong-gun"],
    ["41670", "20", "여주시", "Yeoju-si"],
    ["41800", "21", "연천군", "Yeoncheon-gun"],
    ["41370", "22", "오산시", "Osan-si"],
    ["41460", "23", "용인시", "Yongin-si"],
    ["41430", "24", "의왕시", "Uiwang-si"],
    ["41150", "25", "의정부시", "Uijeongbu-si"],
    ["41500", "26", "이천시", "Icheon-si"],
    ["41480", "27", "파주시", "Paju-si"],
    ["41220", "28", "평택시", "Pyeongtaek-si"],
    ["41650", "29", "포천시", "Pocheon-si"],
    ["41450", "30", "하남시", "Hanam-si"],
    ["41590", "31", "화성시", "Hwaseong-si"],
  ] },
  { areaCode: "6", label: "부산", englishLabel: "Busan", regions: [
    ["26440", "1", "강서구", "Gangseo-gu"],
    ["26410", "2", "금정구", "Geumjeong-gu"],
    ["26710", "3", "기장군", "Gijang-gun"],
    ["26290", "4", "남구", "Nam-gu"],
    ["26170", "5", "동구", "Dong-gu"],
    ["26260", "6", "동래구", "Dongnae-gu"],
    ["26230", "7", "부산진구", "Busanjin-gu"],
    ["26320", "8", "북구", "Buk-gu"],
    ["26530", "9", "사상구", "Sasang-gu"],
    ["26380", "10", "사하구", "Saha-gu"],
    ["26140", "11", "서구", "Seo-gu"],
    ["26500", "12", "수영구", "Suyeong-gu"],
    ["26470", "13", "연제구", "Yeonje-gu"],
    ["26200", "14", "영도구", "Yeongdo-gu"],
    ["26110", "15", "중구", "Jung-gu"],
    ["26350", "16", "해운대구", "Haeundae-gu"],
  ] },
  { areaCode: "4", label: "대구", englishLabel: "Daegu", regions: [
    ["27200", "1", "남구", "Nam-gu"],
    ["27290", "2", "달서구", "Dalseo-gu"],
    ["27710", "3", "달성군", "Dalseong-gun"],
    ["27140", "4", "동구", "Dong-gu"],
    ["27230", "5", "북구", "Buk-gu"],
    ["27170", "6", "서구", "Seo-gu"],
    ["27260", "7", "수성구", "Suseong-gu"],
    ["27110", "8", "중구", "Jung-gu"],
    ["27720", "9", "군위군", "Gunwi-gun"],
  ] },
  { areaCode: "5", label: "광주", englishLabel: "Gwangju", regions: [
    ["29200", "1", "광산구", "Gwangsan-gu"],
    ["29155", "2", "남구", "Nam-gu"],
    ["29110", "3", "동구", "Dong-gu"],
    ["29170", "4", "북구", "Buk-gu"],
    ["29140", "5", "서구", "Seo-gu"],
  ] },
  { areaCode: "3", label: "대전", englishLabel: "Daejeon", regions: [
    ["30230", "1", "대덕구", "Daedeok-gu"],
    ["30110", "2", "동구", "Dong-gu"],
    ["30170", "3", "서구", "Seo-gu"],
    ["30200", "4", "유성구", "Yuseong-gu"],
    ["30140", "5", "중구", "Jung-gu"],
  ] },
  { areaCode: "7", label: "울산", englishLabel: "Ulsan", regions: [
    ["31110", "1", "중구", "Jung-gu"],
    ["31140", "2", "남구", "Nam-gu"],
    ["31170", "3", "동구", "Dong-gu"],
    ["31200", "4", "북구", "Buk-gu"],
    ["31710", "5", "울주군", "Ulju-gun"],
  ] },
  { areaCode: "8", label: "세종", englishLabel: "Sejong", regions: [
    ["36110", "1", "세종특별자치시", "Sejong"],
  ] },
  { areaCode: "33", label: "충북", englishLabel: "Chungbuk", regions: [
    ["43760", "1", "괴산군", "Goesan-gun"],
    ["43800", "2", "단양군", "Danyang-gun"],
    ["43720", "3", "보은군", "Boeun-gun"],
    ["43740", "4", "영동군", "Yeongdong-gun"],
    ["43730", "5", "옥천군", "Okcheon-gun"],
    ["43770", "6", "음성군", "Eumseong-gun"],
    ["43150", "7", "제천시", "Jecheon-si"],
    ["43750", "8", "진천군", "Jincheon-gun"],
    ["43110", "10", "청주시", "Cheongju-si"],
    ["43130", "11", "충주시", "Chungju-si"],
    ["43745", "12", "증평군", "Jeungpyeong-gun"],
  ] },
  { areaCode: "34", label: "충남", englishLabel: "Chungnam", regions: [
    ["44150", "1", "공주시", "Gongju-si"],
    ["44710", "2", "금산군", "Geumsan-gun"],
    ["44230", "3", "논산시", "Nonsan-si"],
    ["44270", "4", "당진시", "Dangjin-si"],
    ["44180", "5", "보령시", "Boryeong-si"],
    ["44760", "6", "부여군", "Buyeo-gun"],
    ["44210", "7", "서산시", "Seosan-si"],
    ["44770", "8", "서천군", "Seocheon-gun"],
    ["44200", "9", "아산시", "Asan-si"],
    ["44810", "11", "예산군", "Yesan-gun"],
    ["44130", "12", "천안시", "Cheonan-si"],
    ["44790", "13", "청양군", "Cheongyang-gun"],
    ["44825", "14", "태안군", "Taean-gun"],
    ["44800", "15", "홍성군", "Hongseong-gun"],
    ["44250", "16", "계룡시", "Gyeryong-si"],
  ] },
  { areaCode: "37", label: "전북", englishLabel: "Jeonbuk", regions: [
    ["52790", "1", "고창군", "Gochang-gun"],
    ["52130", "2", "군산시", "Gunsan-si"],
    ["52210", "3", "김제시", "Gimje-si"],
    ["52190", "4", "남원시", "Namwon-si"],
    ["52730", "5", "무주군", "Muju-gun"],
    ["52800", "6", "부안군", "Buan-gun"],
    ["52770", "7", "순창군", "Sunchang-gun"],
    ["52710", "8", "완주군", "Wanju-gun"],
    ["52140", "9", "익산시", "Iksan-si"],
    ["52750", "10", "임실군", "Imsil-gun"],
    ["52740", "11", "장수군", "Jangsu-gun"],
    ["52110", "12", "전주시", "Jeonju-si"],
    ["52180", "13", "정읍시", "Jeongeup-si"],
    ["52720", "14", "진안군", "Jinan-gun"],
  ] },
  { areaCode: "38", label: "전남", englishLabel: "Jeonnam", regions: [
    ["46810", "1", "강진군", "Gangjin-gun"],
    ["46770", "2", "고흥군", "Goheung-gun"],
    ["46720", "3", "곡성군", "Gokseong-gun"],
    ["46230", "4", "광양시", "Gwangyang-si"],
    ["46730", "5", "구례군", "Gurye-gun"],
    ["46170", "6", "나주시", "Naju-si"],
    ["46710", "7", "담양군", "Damyang-gun"],
    ["46110", "8", "목포시", "Mokpo-si"],
    ["46840", "9", "무안군", "Muan-gun"],
    ["46780", "10", "보성군", "Boseong-gun"],
    ["46150", "11", "순천시", "Suncheon-si"],
    ["46910", "12", "신안군", "Sinan-gun"],
    ["46130", "13", "여수시", "Yeosu-si"],
    ["46870", "15", "영광군", "Yeonggwang-gun"],
    ["46830", "16", "영암군", "Yeongam-gun"],
    ["46890", "17", "완도군", "Wando-gun"],
    ["46880", "18", "장성군", "Jangseong-gun"],
    ["46800", "19", "장흥군", "Jangheung-gun"],
    ["46900", "20", "진도군", "Jindo-gun"],
    ["46860", "21", "함평군", "Hampyeong-gun"],
    ["46820", "22", "해남군", "Haenam-gun"],
    ["46790", "23", "화순군", "Hwasun-gun"],
  ] },
  { areaCode: "35", label: "경북", englishLabel: "Gyeongbuk", regions: [
    ["47290", "1", "경산시", "Gyeongsan-si"],
    ["47130", "2", "경주시", "Gyeongju-si"],
    ["47830", "3", "고령군", "Goryeong-gun"],
    ["47190", "4", "구미시", "Gumi-si"],
    ["47150", "6", "김천시", "Gimcheon-si"],
    ["47280", "7", "문경시", "Mungyeong-si"],
    ["47920", "8", "봉화군", "Bonghwa-gun"],
    ["47250", "9", "상주시", "Sangju-si"],
    ["47840", "10", "성주군", "Seongju-gun"],
    ["47170", "11", "안동시", "Andong-si"],
    ["47770", "12", "영덕군", "Yeongdeok-gun"],
    ["47760", "13", "영양군", "Yeongyang-gun"],
    ["47210", "14", "영주시", "Yeongju-si"],
    ["47230", "15", "영천시", "Yeongcheon-si"],
    ["47900", "16", "예천군", "Yecheon-gun"],
    ["47940", "17", "울릉군", "Ulleung-gun"],
    ["47930", "18", "울진군", "Uljin-gun"],
    ["47730", "19", "의성군", "Uiseong-gun"],
    ["47820", "20", "청도군", "Cheongdo-gun"],
    ["47750", "21", "청송군", "Cheongsong-gun"],
    ["47850", "22", "칠곡군", "Chilgok-gun"],
    ["47110", "23", "포항시", "Pohang-si"],
  ] },
  { areaCode: "36", label: "경남", englishLabel: "Gyeongnam", regions: [
    ["48310", "1", "거제시", "Geoje-si"],
    ["48880", "2", "거창군", "Geochang-gun"],
    ["48820", "3", "고성군", "Goseong-gun"],
    ["48250", "4", "김해시", "Gimhae-si"],
    ["48840", "5", "남해군", "Namhae-gun"],
    ["48270", "7", "밀양시", "Miryang-si"],
    ["48240", "8", "사천시", "Sacheon-si"],
    ["48860", "9", "산청군", "Sancheong-gun"],
    ["48330", "10", "양산시", "Yangsan-si"],
    ["48720", "12", "의령군", "Uiryeong-gun"],
    ["48170", "13", "진주시", "Jinju-si"],
    ["48740", "15", "창녕군", "Changnyeong-gun"],
    ["48120", "16", "창원시", "Changwon-si"],
    ["48220", "17", "통영시", "Tongyeong-si"],
    ["48850", "18", "하동군", "Hadong-gun"],
    ["48730", "19", "함안군", "Haman-gun"],
    ["48870", "20", "함양군", "Hamyang-gun"],
    ["48890", "21", "합천군", "Hapcheon-gun"],
  ] },
  { areaCode: "39", label: "제주", englishLabel: "Jeju", regions: [
    ["50130", "3", "서귀포시", "Seogwipo-si"],
    ["50110", "4", "제주시", "Jeju-si"],
  ] },
];

/** 행정 코드를 키로 갖는 축제 권역·시군구 정보. 기존 강원 단축 코드는 별도 정규화해서 읽는다. */
export const FESTIVAL_REGION_BY_CODE = Object.fromEntries(FESTIVAL_AREAS.flatMap(area =>
  area.regions.map(([code, tourCode, label, englishLabel]) => [code, {code, tourCode, label, englishLabel, areaCode: area.areaCode, areaLabel: area.label, areaEnglishLabel: area.englishLabel}])
));

/** 경기도 일반구는 상위 시로, 기존 강원 단축 코드는 시군 행정 코드로 변환한다. */
export function normalizeFestivalRegionCode(value: string) {
  const code = value.trim();
  const serviceCode = /^41\d{3}$/.test(code) ? `${code.slice(0, 4)}0` : code;
  if (Object.hasOwn(FESTIVAL_REGION_BY_CODE, serviceCode)) return serviceCode;
  return FESTIVAL_AREAS.find(area => area.areaCode === "32")?.regions.find(region => region[1] === code)?.[0] ?? null;
}

/** 장소에 저장한 행정 코드 또는 관광공사 권역:시군구 키를 축제 지역 행정 코드로 연결한다. */
export function resolveFestivalRegionCode(regionCode?: string | null, regionLabelKey?: string | null) {
  const [areaCode, localCode] = regionLabelKey?.split(":") ?? [];
  for (const code of [regionCode, localCode]) {
    if (code && /^\d{5}$/.test(code)) {
      const normalized = code.startsWith("45") ? "52" + code.slice(2) : code.startsWith("42") ? "51" + code.slice(2) : code;
      const region = normalizeFestivalRegionCode(normalized);
      if (region) return region;
    }
  }
  if (areaCode && localCode) {
    return getFestivalRegionCode(areaCode, localCode);
  }
  return regionCode ? normalizeFestivalRegionCode(regionCode) : null;
}

/** 관광공사 권역과 권역 안의 시군구 코드를 전국에서 고유한 행정 코드로 변환한다. */
export function getFestivalRegionCode(areaCode: string, tourCode: string) {
  return FESTIVAL_AREAS.find(area => area.areaCode === areaCode)?.regions.find(region => region[1] === tourCode)?.[0] ?? null;
}

/** 알림 본문에 표시할 도·시군구 이름. 유효하지 않은 코드는 반환하지 않는다. */
export function getFestivalRegionLabel(regionCode: string, language: "ko" | "en" = "ko") {
  const code = normalizeFestivalRegionCode(regionCode);
  const region = code ? FESTIVAL_REGION_BY_CODE[code] : null;
  if (!region) return "";
  return language === "en"
    ? region.areaEnglishLabel + " " + region.englishLabel
    : region.areaLabel + " " + region.label;
}


/** 같은 지역의 기존 강원 단축 코드와 새 행정 코드를 같은 구독으로 판정한다. 미지원 코드는 일치하지 않는다. */
export function isFestivalRegionSelected(regionCode: string, selectedCodes: string[]) {
  const code = normalizeFestivalRegionCode(regionCode);
  return code !== null && selectedCodes.some(selected => normalizeFestivalRegionCode(selected) === code);
}
