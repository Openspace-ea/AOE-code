# AOE Code Agent

AOE Code 是一个 AI 驱动的航天数据分析平台，让用户通过自然语言对话完成专业航天仿真任务。

本项目是 AOE Code 的 Agent 核心与浏览器端客户端，包含共享包和可视化界面。

## 项目结构

```
├── shared/              # 共享包
│   ├── core/            # @aoe/core - API 客户端、认证、配置
│   ├── types/           # @aoe/types - TypeScript 类型定义
│   ├── ui/              # @aoe/ui - 设计 token、共享基础组件
│   ├── agent/           # @aoe/agent - Agent 核心逻辑
│   ├── gnc-core/        # @gnc/core - GNC 仿真算法
│   └── gnc-scenarios/   # @gnc/scenarios - 任务/载具数据
└── browser/             # 浏览器端客户端
```

## 共享包说明

### @aoe/core
API 客户端、认证管理、配置加载。提供统一的 HTTP 请求封装和认证流程。

### @aoe/types
TypeScript 类型定义，包括用户、Agent、API 响应等类型。

### @aoe/ui
设计 token 和共享基础组件，确保 UI 风格一致。

### @aoe/agent
Agent 核心逻辑，实现对话引擎、工具调用、上下文管理等功能。

### @gnc/core
GNC（制导、导航与控制）仿真算法库，vendored 自 gnc-space-sim。

### @gnc/scenarios
任务和载具数据，依赖 @gnc/core。

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装

```bash
# 克隆项目
git clone https://github.com/your-username/aoe-code-agent.git
cd aoe-code-agent

# 安装依赖
pnpm install
```

### 开发

```bash
cd browser

# 复制环境变量配置
cp .env.example .env

# 编辑 .env，配置 API 地址
# VITE_API_PROXY_TARGET=http://localhost:8080

# 启动开发服务器
pnpm dev
```

### 构建

```bash
cd browser
pnpm build
```

## 配置说明

### 环境变量

浏览器端使用 Vite 环境变量，配置项见 `browser/.env.example`：

```bash
# 应用主页地址
VITE_HOME_URL=http://localhost:3000

# 后端 API 地址
VITE_API_PROXY_TARGET=http://localhost:8080

# 登录页地址
VITE_LOGIN_URL=http://localhost:3000/login

# TLE 数据源地址
VITE_TLE_DATA_URL=https://ssa.aseem.cn/TLE.json
```

### API 配置

共享包 `@aoe/core` 的 API 地址需要在应用启动时注入：

```typescript
import { ConfigLoader } from '@aoe/core'

const config = new ConfigLoader({
  api: {
    baseUrl: 'https://api.your-domain.com',
    timeout: 30000,
  },
  auth: {
    baseUrl: 'https://api.your-domain.com',
    // ... 其他路径
  },
})
```

## 功能特性

### 通用对话
- 知识问答
- 知识库检索
- 技能调用
- 多轮对话

### 专业模式（3 个已上线场景）

#### 轨道模式 — 太空态势感知
- 实时展示全球 3.2 万+ 卫星位置
- 10 个星座分组
- 卫星高亮筛选、按地理区域筛选

#### 发射模拟 — 火箭发射仿真
- 真实物理引擎
- 双级火箭仿真
- 3D 视图实时展示飞行轨迹

#### 测控仿真 — 地面站覆盖分析
- 地面站配置
- 可见性分析
- Access 报告

## 技术栈

- **框架**：React 18 + TypeScript
- **构建**：Vite 5
- **3D 渲染**：three.js（R3F）
- **轨道传播**：SGP4/SDP4（satellite.js）
- **包管理**：pnpm workspace

