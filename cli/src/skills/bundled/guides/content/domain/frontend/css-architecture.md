# CSS 架构模式

## CSS Modules
- 组件级作用域，避免全局污染
- 类名自动哈希，无需 BEM 命名
- 与 React/Vue/Angular 无缝集成
- 适合中大型项目

## Tailwind CSS
- 原子化 CSS，减少自定义样式
- `@apply` 提取重复模式
- `tailwind.config.js` 自定义主题
- JIT 模式按需生成，体积小
- 配合 `clsx` / `cva` 条件组合

## CSS-in-JS
- Styled-components / Emotion：运行时方案
- Vanilla Extract：零运行时，编译时生成
- Panda CSS：零运行时 + 类型安全
- 适合需要动态样式的场景

## 布局系统
- Flexbox：一维布局（行或列）
- Grid：二维布局（行列同时）
- Container Queries：组件级响应式
- 子网格（Subgrid）：嵌套网格对齐

## 最佳实践
- 优先使用 CSS 变量（Custom Properties）管理主题
- 用 `clamp()` 实现流式排版
- 用 `aspect-ratio` 替代 padding hack
- 用 `gap` 替代 margin 管理间距
- 暗色模式：`prefers-color-scheme` 或 class 切换

## 响应式设计
- Mobile-first：从小屏开始，`min-width` 媒体查询向上扩展
- 断点标准化：640px / 768px / 1024px / 1280px
- 用相对单位（rem / em）而非固定 px
- 触摸目标最小 44x44px
