import type { AppLanguage } from "@/stores/appLanguageStore";

const ko = {
  title: "여행 카드", create: "카드 만들기", close: "닫기", titleLabel: "여행 제목",
  captionLabel: "짧은 한 줄", optional: "선택", captionPlaceholder: "기억하고 싶은 순간을 남겨 주세요",
  photos: "카드에 담을 사진", photosHint: "첫 번째 사진이 크게 보여요. 최대 4장까지 담을 수 있어요.",
  album: "앨범에서 추가", replace: "앨범 사진으로 교체", existing: "여행에서 남긴 사진",
  hero: "대표 사진", photo: "사진", previous: "앞으로 이동", next: "뒤로 이동", remove: "사진 빼기",
  position: "사진 위치", positionHint: "사진을 움직이거나 아래에서 위치를 조정해 주세요.",
  horizontal: "가로 위치", vertical: "세로 위치", reset: "가운데로", preview: "완성될 여행 카드",
  noPhotos: "여행 사진을 골라 주세요", noPhotosHint: "앨범 사진을 담으면 여행 카드가 완성돼요.",
  dayCards: "기존 DAY 카드 보기", missing: "불러오지 못한 사진이 있어요. 다시 시도하거나 교체해 주세요.",
  preparing: "여행 기록을 불러오고 있어요", working: "카드를 준비하고 있어요", retry: "다시 시도",
  loadError: "여행 기록을 불러오지 못했어요. 다시 시도해 주세요.",
  renderError: "카드를 만들지 못했어요. 다시 시도해 주세요.",
  pickError: "사진을 불러오지 못했어요. 권한을 확인하거나 다른 사진을 골라 주세요.",
  titleEmpty: "여행 제목을 입력해 주세요.", titleLong: "제목이 한 줄에 들어오도록 줄여 주세요.",
  captionLong: "한 줄에 들어오도록 문장을 줄여 주세요.", limit: "사진은 최대 4장까지 담을 수 있어요.",
  save: "이미지 저장", share: "공유하기", saveStarted: "이미지 다운로드를 시작했어요.",
  saveDone: "시스템에서 이미지를 전달했어요.", shareFallback: "공유 대신 이미지를 다운로드했어요.",
  saveError: "이미지를 저장하지 못했어요. 다시 시도해 주세요.", shareError: "공유하지 못했어요. 다시 시도해 주세요.",
  albumPhoto: "앨범 사진", loadingPhoto: "사진을 준비하고 있어요", selected: "선택됨",
  unavailable: "불러오기 실패", initialMissing: "불러오지 못한 인증 사진은 제외했어요. 해당 사진을 누르면 다시 시도할 수 있어요.",
  editPhotos: "사진 편집",
};

const en: Record<keyof typeof ko, string> = {
  title: "Travel card", create: "Create card", close: "Close", titleLabel: "Trip title",
  captionLabel: "A short line", optional: "Optional", captionPlaceholder: "A moment to remember",
  photos: "Photos for your card", photosHint: "The first photo is the cover. Choose up to 4 photos.",
  album: "Add from library", replace: "Replace from library", existing: "Photos from your trip",
  hero: "Cover photo", photo: "Photo", previous: "Move earlier", next: "Move later", remove: "Remove photo",
  position: "Photo position", positionHint: "Move the photo or adjust its position below.",
  horizontal: "Horizontal position", vertical: "Vertical position", reset: "Center", preview: "Your finished travel card",
  noPhotos: "Choose your travel photos", noPhotosHint: "Add photos from your library to create your card.",
  dayCards: "View existing DAY cards", missing: "Some photos could not be loaded. Retry or replace them.",
  preparing: "Loading your travel memories", working: "Preparing your card", retry: "Retry",
  loadError: "Could not load this trip. Please try again.", renderError: "Could not create the card. Please try again.",
  pickError: "Could not load the photo. Check access or choose another photo.",
  titleEmpty: "Enter a trip title.", titleLong: "Shorten the title to fit on one line.",
  captionLong: "Shorten the caption to fit on one line.", limit: "You can choose up to 4 photos.",
  save: "Save image", share: "Share", saveStarted: "Image download started.",
  saveDone: "Image handed over by the system.", shareFallback: "Downloaded the image instead of sharing.",
  saveError: "Could not save the image. Please try again.", shareError: "Could not share. Please try again.",
  albumPhoto: "Library photo", loadingPhoto: "Preparing your photo", selected: "Selected",
  unavailable: "Unavailable", initialMissing: "Some trip photos could not be loaded. Select a photo below to retry.",
  editPhotos: "Edit photos",
};

/** 여행 카드 전용 안내를 기존 앱 언어에 맞춰 반환한다. 사용자가 쓴 제목·문장은 번역하지 않는다. */
export function getTravelCardText(language: AppLanguage) { return language === "en" ? en : ko; }
