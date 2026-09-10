# Docker Compose 最佳实践

## 基础配置
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/app/src  # 开发环境挂载

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

## 环境管理
- `.env` 文件定义变量
- `docker-compose.override.yml` 开发覆盖
- `docker-compose.prod.yml` 生产配置
- `profiles` 按需启用服务

## 网络
- 默认创建 bridge 网络
- 服务名即主机名
- 自定义网络隔离服务组

## 开发工作流
```bash
docker compose up -d          # 启动
docker compose logs -f app    # 查看日志
docker compose exec app sh    # 进入容器
docker compose down -v        # 停止并清理
```

## 常见问题
- 服务启动顺序：`depends_on` + `healthcheck`
- 数据持久化：命名 volume
- 端口冲突：检查占用
- 构建缓存：`docker compose build --no-cache`
