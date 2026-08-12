import type { Coordinates } from "@/data/gangwonRegions";

export const SEOUL_CENTER: Coordinates = {
  lat: 37.5665,
  lng: 126.978,
};

export const SEOUL_REGIONS = [
  {
    label: "강남구",
    sigunguCode: "1",
    adminCode: "11680",
    center: { lat: 37.5172, lng: 127.0473 },
  },
  {
    label: "강동구",
    sigunguCode: "2",
    adminCode: "11740",
    center: { lat: 37.5301, lng: 127.1238 },
  },
  {
    label: "강북구",
    sigunguCode: "3",
    adminCode: "11305",
    center: { lat: 37.6396, lng: 127.0257 },
  },
  {
    label: "강서구",
    sigunguCode: "4",
    adminCode: "11500",
    center: { lat: 37.5509, lng: 126.8495 },
  },
  {
    label: "관악구",
    sigunguCode: "5",
    adminCode: "11620",
    center: { lat: 37.4784, lng: 126.9516 },
  },
  {
    label: "광진구",
    sigunguCode: "6",
    adminCode: "11215",
    center: { lat: 37.5385, lng: 127.0823 },
  },
  {
    label: "구로구",
    sigunguCode: "7",
    adminCode: "11530",
    center: { lat: 37.4955, lng: 126.8874 },
  },
  {
    label: "금천구",
    sigunguCode: "8",
    adminCode: "11545",
    center: { lat: 37.4569, lng: 126.8955 },
  },
  {
    label: "노원구",
    sigunguCode: "9",
    adminCode: "11350",
    center: { lat: 37.6542, lng: 127.0568 },
  },
  {
    label: "도봉구",
    sigunguCode: "10",
    adminCode: "11320",
    center: { lat: 37.6688, lng: 127.0471 },
  },
  {
    label: "동대문구",
    sigunguCode: "11",
    adminCode: "11230",
    center: { lat: 37.5744, lng: 127.0396 },
  },
  {
    label: "동작구",
    sigunguCode: "12",
    adminCode: "11590",
    center: { lat: 37.5124, lng: 126.9393 },
  },
  {
    label: "마포구",
    sigunguCode: "13",
    adminCode: "11440",
    center: { lat: 37.5663, lng: 126.9019 },
  },
  {
    label: "서대문구",
    sigunguCode: "14",
    adminCode: "11410",
    center: { lat: 37.5791, lng: 126.9368 },
  },
  {
    label: "서초구",
    sigunguCode: "15",
    adminCode: "11650",
    center: { lat: 37.4837, lng: 127.0324 },
  },
  {
    label: "성동구",
    sigunguCode: "16",
    adminCode: "11200",
    center: { lat: 37.5633, lng: 127.0371 },
  },
  {
    label: "성북구",
    sigunguCode: "17",
    adminCode: "11290",
    center: { lat: 37.5894, lng: 127.0167 },
  },
  {
    label: "송파구",
    sigunguCode: "18",
    adminCode: "11710",
    center: { lat: 37.5145, lng: 127.1059 },
  },
  {
    label: "양천구",
    sigunguCode: "19",
    adminCode: "11470",
    center: { lat: 37.517, lng: 126.8665 },
  },
  {
    label: "영등포구",
    sigunguCode: "20",
    adminCode: "11560",
    center: { lat: 37.5264, lng: 126.8963 },
  },
  {
    label: "용산구",
    sigunguCode: "21",
    adminCode: "11170",
    center: { lat: 37.5326, lng: 126.9905 },
  },
  {
    label: "은평구",
    sigunguCode: "22",
    adminCode: "11380",
    center: { lat: 37.6027, lng: 126.9291 },
  },
  {
    label: "종로구",
    sigunguCode: "23",
    adminCode: "11110",
    center: { lat: 37.5735, lng: 126.979 },
  },
  {
    label: "중구",
    sigunguCode: "24",
    adminCode: "11140",
    center: { lat: 37.5641, lng: 126.9979 },
  },
  {
    label: "중랑구",
    sigunguCode: "25",
    adminCode: "11260",
    center: { lat: 37.6063, lng: 127.0927 },
  },
] as const;

export const DEFAULT_SEOUL_REGION = SEOUL_REGIONS[22];
export const SEOUL_TOUR_AREA_CODE = "1";
export const SEOUL_TATS_AREA_CODE = "11";

