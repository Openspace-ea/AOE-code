# Web 性能优化

## Core Web Vitals
- **LCP**（Largest Contentful Paint）：< 2.5s
  - 预加载关键图片：`<link rel="preload">`
  - 优化服务器响应时间（TTFB）
  - 使用 CDN
- **INP**（Interaction to Next Paint）：< 200ms
  - 拆分长任务：`requestIdleCallback` / `scheduler.yield()`
  - 减少主线程阻塞
- **CLS**（Cumulative Layout Shift）：< 0.1
  - 图片/视频指定宽高
  - 字体用 `font-display: optional`
  - 避免动态插入内容

## 代码分割
- 路由级分割：`React.lazy` / `defineAsyncComponent`
- 组件级分割：动态 import
- 第三方库分割：`React.lazy(() => import('heavy-lib'))`
- 预加载：`webpackPrefetch` / `webpackPreload`

## 资源优化
- 图片：WebP/AVIF 格式，`srcset` 响应式
- 字体：`font-display: swap`，子集化，预加载
- JS：Tree shaking，压缩，移除未使用代码
- CSS：PurgeCSS 移除未使用样式

## 缓存策略
- 静态资源：长期缓存 + 内容哈希文件名
- API：`Cache-Control` / `ETag` / `stale-while-revalidate`
- Service Worker：离线优先或网络优先
- CDN：边缘缓存 + 回源策略

## 渲染优化
- SSR / SSG：首屏快速可见
- 流式 SSR：逐步渲染页面
- Islands Architecture：部分水合
- 骨架屏：感知性能提升

## 监控
- Web Vitals 库采集真实用户数据（RUM）
- Lighthouse CI 自动化性能审计
- Performance Observer 监控长任务
