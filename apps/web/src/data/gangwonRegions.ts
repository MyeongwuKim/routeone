export type Coordinates = {
  lat: number;
  lng: number;
};

export const GANGWON_CENTER: Coordinates = {
  lat: 37.8228,
  lng: 128.1555,
};

export const GANGWON_BOUNDS = {
  south: 37.02,
  west: 127.1,
  north: 38.62,
  east: 129.38,
};

export const GANGWON_REGIONS = [
  { label: "강릉", sigunguCode: "1", center: { lat: 37.7519, lng: 128.8761 } },
  { label: "고성", sigunguCode: "2", center: { lat: 38.3804, lng: 128.4677 } },
  { label: "동해", sigunguCode: "3", center: { lat: 37.5247, lng: 129.1143 } },
  { label: "삼척", sigunguCode: "4", center: { lat: 37.4499, lng: 129.1652 } },
  { label: "속초", sigunguCode: "5", center: { lat: 38.207, lng: 128.5918 } },
  { label: "양구", sigunguCode: "6", center: { lat: 38.1057, lng: 127.99 } },
  { label: "양양", sigunguCode: "7", center: { lat: 38.0754, lng: 128.6191 } },
  { label: "영월", sigunguCode: "8", center: { lat: 37.1836, lng: 128.4617 } },
  { label: "원주", sigunguCode: "9", center: { lat: 37.3422, lng: 127.9202 } },
  { label: "인제", sigunguCode: "10", center: { lat: 38.0697, lng: 128.1704 } },
  { label: "정선", sigunguCode: "11", center: { lat: 37.3807, lng: 128.6611 } },
  { label: "철원", sigunguCode: "12", center: { lat: 38.1466, lng: 127.3134 } },
  { label: "춘천", sigunguCode: "13", center: { lat: 37.8813, lng: 127.7298 } },
  { label: "태백", sigunguCode: "14", center: { lat: 37.1641, lng: 128.9856 } },
  { label: "평창", sigunguCode: "15", center: { lat: 37.3704, lng: 128.3906 } },
  { label: "홍천", sigunguCode: "16", center: { lat: 37.6972, lng: 127.8886 } },
  { label: "화천", sigunguCode: "17", center: { lat: 38.1062, lng: 127.7082 } },
  { label: "횡성", sigunguCode: "18", center: { lat: 37.4918, lng: 127.985 } },
] as const;

export const GANGWON_SIGNGU_ADMIN_CODES: Record<string, string> = {
  "1": "51150", // 강릉
  "2": "51820", // 고성
  "3": "51170", // 동해
  "4": "51230", // 삼척
  "5": "51210", // 속초
  "6": "51800", // 양구
  "7": "51830", // 양양
  "8": "51750", // 영월
  "9": "51130", // 원주
  "10": "51810", // 인제
  "11": "51770", // 정선
  "12": "51780", // 철원
  "13": "51110", // 춘천
  "14": "51190", // 태백
  "15": "51760", // 평창
  "16": "51720", // 홍천
  "17": "51790", // 화천
  "18": "51730", // 횡성
};

export const GANGWON_TATS_AREA_CODE = "51";
