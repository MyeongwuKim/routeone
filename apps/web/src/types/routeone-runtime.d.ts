declare global {
  type RouteOneNativeSaveImageResult = {
    shared: boolean;
    uri?: string | null;
  };

  interface Window {
    RouteOneRuntimeConfig?: {
      graphqlEndpoint?: string;
      routerMode?: "browser" | "hash";
    };
    RouteOneNative?: {
      saveImage?: (options: {
        dataUrl: string;
        fileName: string;
        title?: string;
      }) => Promise<RouteOneNativeSaveImageResult>;
    };
  }
}

export {};
