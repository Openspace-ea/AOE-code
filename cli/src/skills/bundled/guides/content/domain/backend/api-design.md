# API 设计最佳实践

## REST 设计
- 资源用名词（复数）：`/users`, `/orders`
- HTTP 方法语义：GET 读取，POST 创建，PUT 全量更新，PATCH 部分更新，DELETE 删除
- 状态码：200 成功，201 创建，204 无内容，400 客户端错误，401 未认证，403 未授权，404 未找到，500 服务端错误
- 嵌套资源：`/users/123/orders`

## 分页
```
GET /users?page=2&limit=20&sort=name:asc
响应：
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "hasNext": true
  }
}
```

## 过滤与搜索
- 简单过滤：`?status=active&role=admin`
- 范围过滤：`?created_after=2024-01-01&created_before=2024-12-31`
- 搜索：`?q=search_term`
- 字段选择：`?fields=id,name,email`

## 版本控制
- URL 路径：`/api/v1/users`（最直观）
- 请求头：`Accept: application/vnd.api+json;version=1`
- 保持向后兼容，破坏性变更递增版本号

## 错误响应格式
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## 认证与授权
- JWT：无状态，适合微服务
- OAuth 2.0：第三方授权
- API Key：简单场景
- RBAC：角色基础访问控制

## GraphQL
- Schema-first 设计
- DataLoader 解决 N+1 问题
- 分页用 Cursor-based（Relay 规范）
- 查询深度限制防滥用

## gRPC
- Protocol Buffers 定义接口
- 四种模式：Unary / Server Streaming / Client Streaming / Bidirectional
- 适合内部微服务通信
- 与 REST 网关共存
