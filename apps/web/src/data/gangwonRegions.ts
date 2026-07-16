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
  {
    label: "강릉",
    sigunguCode: "1",
    adminCode: "51150",
    center: { lat: 37.7519, lng: 128.8761 },
  },
  {
    label: "고성",
    sigunguCode: "2",
    adminCode: "51820",
    center: { lat: 38.3804, lng: 128.4677 },
  },
  {
    label: "동해",
    sigunguCode: "3",
    adminCode: "51170",
    center: { lat: 37.5247, lng: 129.1143 },
  },
  {
    label: "삼척",
    sigunguCode: "4",
    adminCode: "51230",
    center: { lat: 37.4499, lng: 129.1652 },
  },
  {
    label: "속초",
    sigunguCode: "5",
    adminCode: "51210",
    center: { lat: 38.207, lng: 128.5918 },
  },
  {
    label: "양구",
    sigunguCode: "6",
    adminCode: "51800",
    center: { lat: 38.1057, lng: 127.99 },
  },
  {
    label: "양양",
    sigunguCode: "7",
    adminCode: "51830",
    center: { lat: 38.0754, lng: 128.6191 },
  },
  {
    label: "영월",
    sigunguCode: "8",
    adminCode: "51750",
    center: { lat: 37.1836, lng: 128.4617 },
  },
  {
    label: "원주",
    sigunguCode: "9",
    adminCode: "51130",
    center: { lat: 37.3422, lng: 127.9202 },
  },
  {
    label: "인제",
    sigunguCode: "10",
    adminCode: "51810",
    center: { lat: 38.0697, lng: 128.1704 },
  },
  {
    label: "정선",
    sigunguCode: "11",
    adminCode: "51770",
    center: { lat: 37.3807, lng: 128.6611 },
  },
  {
    label: "철원",
    sigunguCode: "12",
    adminCode: "51780",
    center: { lat: 38.1466, lng: 127.3134 },
  },
  {
    label: "춘천",
    sigunguCode: "13",
    adminCode: "51110",
    center: { lat: 37.8813, lng: 127.7298 },
  },
  {
    label: "태백",
    sigunguCode: "14",
    adminCode: "51190",
    center: { lat: 37.1641, lng: 128.9856 },
  },
  {
    label: "평창",
    sigunguCode: "15",
    adminCode: "51760",
    center: { lat: 37.3704, lng: 128.3906 },
  },
  {
    label: "홍천",
    sigunguCode: "16",
    adminCode: "51720",
    center: { lat: 37.6972, lng: 127.8886 },
  },
  {
    label: "화천",
    sigunguCode: "17",
    adminCode: "51790",
    center: { lat: 38.1062, lng: 127.7082 },
  },
  {
    label: "횡성",
    sigunguCode: "18",
    adminCode: "51730",
    center: { lat: 37.4918, lng: 127.985 },
  },
] as const;

export type GangwonRegion = (typeof GANGWON_REGIONS)[number];
export type GangwonRegionLabel = GangwonRegion["label"];

export const DEFAULT_GANGWON_REGION = GANGWON_REGIONS[0];

export const GANGWON_REGION_LABELS: readonly GangwonRegionLabel[] =
  GANGWON_REGIONS.map((region) => region.label);

export const GANGWON_REGION_CENTER_BY_LABEL = Object.fromEntries(
  GANGWON_REGIONS.map((region) => [region.label, region.center])
) as Readonly<Record<GangwonRegionLabel, Coordinates>>;

export const GANGWON_SIGUNGU_CODE_BY_LABEL = Object.fromEntries(
  GANGWON_REGIONS.map((region) => [region.label, region.sigunguCode])
) as Readonly<Record<GangwonRegionLabel, string>>;

export const GANGWON_REGION_LABEL_BY_CODE = Object.fromEntries(
  GANGWON_REGIONS.flatMap((region) => [
    [region.sigunguCode, region.label],
    [region.adminCode, region.label],
  ])
) as Readonly<Record<string, GangwonRegionLabel>>;

export const GANGWON_SIGNGU_ADMIN_CODES = Object.fromEntries(
  GANGWON_REGIONS.map((region) => [region.sigunguCode, region.adminCode])
) as Readonly<Record<string, string>>;

export const GANGWON_TATS_AREA_CODE = "51";
export const GANGWON_AREA_CODE = "32";
