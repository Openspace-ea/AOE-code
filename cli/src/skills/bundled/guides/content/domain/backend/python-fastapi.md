# Python FastAPI 最佳实践

## 项目结构
```
app/
  api/            # 路由层
    v1/
      endpoints/
  core/           # 配置、安全、依赖
  models/         # SQLAlchemy 模型
  schemas/        # Pydantic 模型
  services/       # 业务逻辑
  repositories/   # 数据访问
  main.py         # 应用入口
```

## 路由设计
- 使用 `APIRouter` 模块化
- 路径参数用类型注解：`user_id: int`
- 请求体用 Pydantic 模型
- 响应模型用 `response_model` 参数

## 依赖注入
- `Depends()` 注入数据库会话、认证、配置
- 链式依赖：`current_user: User = Depends(get_current_active_user)`
- `yield` 依赖用于资源清理（如数据库连接）

## 异步模式
- `async def` 处理 I/O 密集操作
- `def` 处理 CPU 密集操作（自动放入线程池）
- 数据库用 `asyncpg` / `aiosqlite`
- HTTP 客户端用 `httpx`（支持 async）

## 数据验证
- Pydantic V2：更快的验证和序列化
- `Field()` 定义约束：`min_length`, `max_length`, `pattern`
- 自定义验证器：`@field_validator`
- 嵌套模型处理复杂结构

## 代码示例

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')

class UserResponse(BaseModel):
    id: int
    name: str
    email: str

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    user = await user_service.create(db, data)
    return user

# 全局异常处理
@app.exception_handler(AppError)
async def app_error_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )
```

## 常见反模式
- 避免：在路由中直接操作数据库
- 避免：忽略类型注解（失去自动文档）
- 避免：过度使用中间件（优先用依赖注入）
- 避免：同步数据库驱动 + async def（阻塞事件循环）
