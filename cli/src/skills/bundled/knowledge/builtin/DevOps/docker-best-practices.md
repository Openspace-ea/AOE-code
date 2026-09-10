# Docker 最佳实践

## Dockerfile 优化

### 多阶段构建

```dockerfile
# 阶段 1: 构建
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# 阶段 2: 生产
FROM node:18-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
USER nextjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 层缓存优化

```dockerfile
# ✅ 好的做法 - 先复制依赖文件
COPY package*.json ./
RUN npm ci
COPY . .

# ❌ 不好的做法 - 每次都重新安装依赖
COPY . .
RUN npm ci
```

### 使用 .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
dist
build
coverage
*.md
```

## Docker Compose

### 开发环境

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/mydb
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### 生产环境

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 安全最佳实践

### 1. 使用非 root 用户

```dockerfile
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs
```

### 2. 扫描漏洞

```bash
# 使用 Trivy 扫描镜像
trivy image myapp:latest

# 使用 Snyk 扫描
snyk container test myapp:latest
```

### 3. 使用特定版本标签

```dockerfile
# ✅ 好的做法
FROM node:18.17.0-alpine

# ❌ 不好的做法
FROM node:latest
```

## 网络配置

### 自定义网络

```yaml
version: '3.8'

services:
  app:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend

  nginx:
    networks:
      - frontend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # 不允许外部访问
```

## 数据持久化

### 使用命名卷

```yaml
services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
    driver: local
```

### 使用绑定挂载（开发）

```yaml
services:
  app:
    volumes:
      - .:/app
      - /app/node_modules  # 匿名卷，避免覆盖容器内的 node_modules
```

## 日志管理

### 配置日志驱动

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 性能优化

### 1. 使用 Alpine 镜像

```dockerfile
FROM node:18-alpine  # ~170MB
# 而不是
FROM node:18         # ~900MB
```

### 2. 合并 RUN 指令

```dockerfile
# ✅ 好的做法
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# ❌ 不好的做法
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*
```

### 3. 使用 .dockerignore 排除文件

```
.git
node_modules
npm-debug.log
coverage
.env
```

## 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

## 常用命令

```bash
# 构建镜像
docker build -t myapp:latest .

# 运行容器
docker run -d -p 3000:3000 --name myapp myapp:latest

# 查看日志
docker logs -f myapp

# 进入容器
docker exec -it myapp sh

# 清理未使用的资源
docker system prune -a

# 查看镜像层
docker history myapp:latest
```
