import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const nestedPnpmModuleSegment =
  String.raw`(?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?`
const nodeModulePattern = (packagePattern: string) =>
  new RegExp(
    String.raw`node_modules[\\/]${nestedPnpmModuleSegment}${packagePattern}[\\/]`
  )

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isNativeWebBundle = env.ROUTEONE_NATIVE_WEB_BUNDLE === '1'
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
    base: isNativeWebBundle ? './' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      modulePreload: isNativeWebBundle ? false : undefined,
      rolldownOptions: {
        output: {
          codeSplitting: {
            minSize: 20 * 1024,
            groups: [
              {
                name: 'react-vendor',
                test: nodeModulePattern(
                  String.raw`(?:react|react-dom|scheduler)`
                ),
                priority: 50,
              },
              {
                name: 'router-vendor',
                test: nodeModulePattern(String.raw`react-router(?:-dom)?`),
                priority: 45,
              },
              {
                name: 'query-vendor',
                test: nodeModulePattern(
                  String.raw`@tanstack[\\/]react-query`
                ),
                priority: 40,
              },
              {
                name: 'chart-vendor',
                test: nodeModulePattern(
                  String.raw`(?:chart\.js|react-chartjs-2)`
                ),
                priority: 40,
              },
              {
                name: 'graphql-vendor',
                test: nodeModulePattern(
                  String.raw`(?:graphql|@graphql-typed-document-node[\\/]core)`
                ),
                priority: 35,
              },
              {
                name: 'icons-vendor',
                test: nodeModulePattern(String.raw`react-icons`),
                priority: 30,
                maxSize: 180 * 1024,
              },
              {
                name: 'vendor',
                test: nodeModulePattern(String.raw`[^\\/]+`),
                priority: 10,
                maxSize: 220 * 1024,
              },
            ],
          },
        },
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
