# Node.js / Express 最佳实践

## 项目结构
```
src/
  controllers/    # 请求处理逻辑
  services/       # 业务逻辑
  repositories/   # 数据访问层
  middleware/     # Express 中间件
  routes/         # 路由定义
  models/         # 数据模型
  utils/          # 工具函数
```

## Express 模式
- 路由与控制器分离
- 中间件链：认证 → 验证 → 处理
- 错误处理中间件放在最后
- 使用 `express.Router()` 模块化路由

## 错误处理
- 自定义错误类继承 Error
- 全局错误中间件统一处理
- 异步路由用 `express-async-errors` 或包装器
- 区分客户端错误（4xx）和服务端错误（5xx）

## 安全
- `helmet` 设置安全 HTTP 头
- `cors` 配置跨域策略
- `express-rate-limit` 限流
- 输入验证：`zod` / `joi` / `express-validator`
- 参数化查询防 SQL 注入

## 常见反模式
- 避免：回调地狱（用 async/await）
- 避免：在路由中直接写业务逻辑
- 避免：忽略错误处理
- 避免：同步操作阻塞事件循环

## 代码示例

```typescript
// 错误处理中间件
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
  ) {
    super(message)
  }
}

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    })
  }
  console.error(err)
  res.status(500).json({ status: 'error', message: 'Internal server error' })
}

// 控制器模式
async function getUser(req: Request, res: Response) {
  const user = await userService.findById(req.params.id)
  if (!user) throw new AppError(404, 'User not found')
  res.json({ data: user })
}
```

## Fastify 替代
- 性能更高（比 Express 快 ~2x）
- 内置 JSON Schema 验证
- 内置 TypeScript 支持
- 插件系统更严格
