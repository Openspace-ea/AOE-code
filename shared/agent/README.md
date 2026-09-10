# @aoe/agent

AOE Code Agent 核心逻辑，三端共享（CLI、Desktop、Browser）。

## 职责

- Agent 对话引擎
- 工具调用与执行
- 上下文管理
- 流式输出处理

## 依赖

- `@aoe/core` — API 客户端、认证
- `@aoe/types` — 类型定义

## 不包含

- 任何 UI 逻辑（Ink / React）
- 终端交互
- 浏览器渲染

## 使用

```typescript
import { Agent } from '@aoe/agent'
```

CLI、Desktop、Browser 各自在 UI 层调用此包，不重复实现 Agent 逻辑。
