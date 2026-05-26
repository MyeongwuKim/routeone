declare global {
  interface Window {
    navermap_authFailure?: () => void;
    naver?: {
      maps: any;
    };
  }
}

export {};
