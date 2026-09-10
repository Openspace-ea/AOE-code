# CI/CD 最佳实践

## GitHub Actions
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

## 管道设计
- 阶段：lint → test → build → deploy
- 并行化独立任务
- 缓存依赖：`actions/cache` / 语言原生缓存
- 矩阵构建：多版本/多平台测试

## 部署策略
- **蓝绿部署**：两套环境切换
- **金丝雀发布**：逐步增加流量
- **滚动更新**：逐个替换实例
- **Feature Flag**：代码级功能开关

## GitLab CI
```yaml
stages: [lint, test, build, deploy]
test:
  stage: test
  script: [npm ci, npm test]
  cache:
    paths: [node_modules/]
```

## 自动化
- PR 自动标签：`actions/labeler`
- 依赖更新：Dependabot / Renovate
- 安全扫描：Snyk / CodeQL
- 发布自动化：semantic-release / changesets
