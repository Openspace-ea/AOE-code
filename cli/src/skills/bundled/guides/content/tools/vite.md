# Vite 配置最佳实践

## 核心优势
- 开发服务器：ESM 原生加载，冷启动极快
- HMR：模块级热更新
- 构建：Rollup 打包，优化生产产物

## 配置
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: { '/api': 'http://localhost:8080' } },
  build: {
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom'] } },
    },
  },
  resolve: { alias: { '@': '/src' } },
})
```

## 常用插件
- `@vitejs/plugin-react`：React 支持
- `@vitejs/plugin-vue`：Vue 支持
- `vite-plugin-svgr`：SVG 作为组件
- `vite-plugin-pwa`：PWA 支持
- `unplugin-auto-import`：自动导入

## 环境变量
- `VITE_` 前缀暴露给客户端
- `.env` / `.env.local` / `.env.production`
- `import.meta.env.VITE_API_URL`

## 优化技巧
- `optimizeDeps.include`：预构建频繁依赖
- `css.modules.localsConvention`：camelCase 类名
- `build.target: 'es2020'`：现代浏览器
- `build.sourcemap: true`：生产环境 source map

## 常见问题
- CJS 依赖不兼容：`optimizeDeps.include`
- 路径别名：`resolve.alias` + TypeScript `paths`
- CSS 模块：`*.module.css` 命名约定
