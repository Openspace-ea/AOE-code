# Docker 最佳实践

## Dockerfile 优化
- 多阶段构建减少镜像体积
- 合并 RUN 指令减少层数
- `.dockerignore` 排除无关文件
- 使用特定标签的基础镜像（非 `latest`）
- 非 root 用户运行

## 多阶段构建示例

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## 层缓存优化
- 先复制 `package.json`，再 `npm install`，最后复制源码
- 变化频率低的层放前面
- `COPY --chown` 设置文件权限

## 安全
- 使用最小基础镜像（Alpine / Distroless）
- 定期更新基础镜像
- 扫描漏洞：`docker scout` / Trivy
- 不在镜像中存储密钥

## 网络与存储
- 自定义 bridge 网络实现服务发现
- Volume 持久化数据
- tmpfs 临时文件
- 健康检查：`HEALTHCHECK` 指令

## 常见反模式
- 避免：使用 `latest` 标签
- 避免：在容器中存储状态
- 避免：以 root 运行
- 避免：忽略 `.dockerignore`
