import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 后端服务地址在环境变量 VITE_API_PROXY_TARGET 中配置，缺省本机 8080
// 与官网 web/vite.config.ts 保持同一套代理约定
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
          // 后端实际路由不带 /api 前缀，转发前剥离
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
        // TLE 全量目录的 dev 代理：ssa.aseem.cn 未配 CORS 期间，浏览器直连会被
        // 拦截，经同源代理转发（ssaCatalog.ts 双通道：直连失败自动降级到这里）。
        // 生产环境等效的 nginx 反代规则需同步配置，或给 ssa.aseem.cn 加 ACAO 头走直连
        '/tle-proxy': {
          target: 'https://ssa.aseem.cn',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/tle-proxy/, ''),
        },
      },
    },
  }
})
