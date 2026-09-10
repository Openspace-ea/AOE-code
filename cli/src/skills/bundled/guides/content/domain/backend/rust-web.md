# Rust Web 开发

## 框架选择
- **Axum**：Tokio 生态，类型安全，Tower 中间件
- **Actix-web**：高性能，Actor 模型
- **Rocket**：易用性优先，宏驱动

## Axum 模式
- 路由：`Router::new().route("/path", get(handler))`
- 提取器：`Path`, `Query`, `Json`, `State`, `Extension`
- 中间件：Tower Layer
- 状态共享：`State<Arc<AppState>>`

## 错误处理
- 自定义错误类型实现 `IntoResponse`
- `thiserror` 简化错误派生
- `anyhow` 用于应用级错误（不适合库）
- Result 链式处理：`?` 操作符

## 异步模式
- `async` / `.await` 基于 Tokio
- `tokio::spawn` 并发任务
- `tokio::select!` 多个异步操作竞争
- `tokio::sync` 异步锁和通道

## 序列化
- `serde` + `serde_json`：JSON 处理
- `#[derive(Serialize, Deserialize)]`
- `#[serde(rename_all = "camelCase")]` 字段重命名
- `#[serde(skip_serializing_if = "Option::is_none")]` 条件序列化

## 代码示例

```rust
use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    db: Database,
}

#[derive(Deserialize)]
struct CreateUser {
    name: String,
    email: String,
}

#[derive(Serialize)]
struct User {
    id: i64,
    name: String,
    email: String,
}

async fn create_user(
    State(state): State<Arc<AppState>>,
    Json(data): Json<CreateUser>,
) -> Result<Json<User>, AppError> {
    let user = state.db.create_user(data).await?;
    Ok(Json(user))
}

#[tokio::main]
async fn main() {
    let state = Arc::new(AppState { db: connect_db().await });
    let app = Router::new()
        .route("/users", post(create_user))
        .route("/users/:id", get(get_user))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

## 常见反模式
- 避免：过度使用 `clone()`（考虑引用或 `Rc`/`Arc`）
- 避免：`unwrap()` 在生产代码中（用 `?` 或 `expect`）
- 避免：阻塞异步运行时（用 `spawn_blocking`）
- 避免：生命周期标注过早（先让编译器告诉你）
