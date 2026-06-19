import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const naverMapClientId =
    env.NAVER_MAP_API_KEY_ID ??
    env.VITE_NAVER_MAP_API_KEY_ID ??
    env.VITE_NCP_MAPS_KEY_ID ??
    ''
  const naverMapClientSecret =
    env.NAVER_MAP_API_KEY ??
    env.VITE_NAVER_MAP_API_KEY ??
    env.VITE_NCP_MAPS_KEY ??
    ''
  const graphqlProxyTarget =
    env.VITE_GRAPHQL_PROXY_TARGET ?? env.API_URL ?? 'http://localhost:4000'

  if (!naverMapClientId || !naverMapClientSecret) {
    console.warn(
      '[vite] map-direction proxy auth headers are incomplete. Set VITE_NCP_MAPS_KEY_ID and VITE_NCP_MAPS_KEY.'
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/tour-api": {
          target: "https://apis.data.go.kr",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tour-api/, ""),
        },
        "/map-direction": {
          target: "https://maps.apigw.ntruss.com",
          changeOrigin: true,
          headers: {
            "x-ncp-apigw-api-key-id": naverMapClientId,
            "x-ncp-apigw-api-key": naverMapClientSecret,
          },
        },
        "/graphql": {
          target: graphqlProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
