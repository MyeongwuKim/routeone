declare global {
  interface Window {
    RouteOneRuntimeConfig?: {
      graphqlEndpoint?: string;
    };
  }
}

export {};
