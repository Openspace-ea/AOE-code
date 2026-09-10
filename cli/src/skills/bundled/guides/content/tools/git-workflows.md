# Git 工作流最佳实践

## 分支策略
- **Git Flow**：`main` + `develop` + `feature/*` + `release/*` + `hotfix/*`
- **GitHub Flow**：`main` + `feature/*`（简单，适合持续部署）
- **Trunk Based**：直接在 main 上开发，短命分支

## Commit 规范
```
<type>(<scope>): <description>

feat: 新功能
fix: 修复
docs: 文档
refactor: 重构
test: 测试
chore: 构建/工具
```

## Rebase vs Merge
- Rebase：保持线性历史，个人分支
- Merge：保留合并历史，公共分支
- 交互式 rebase：`git rebase -i` 清理提交

## 常用命令
```bash
# 撤销
git reset --soft HEAD~1    # 撤销最后一次提交（保留修改）
git revert <commit>        # 创建反向提交
git stash / git stash pop  # 暂存工作区

# 调试
git bisect start           # 二分查找 bug
git bisect bad / git bisect good

# 协作
git fetch --prune          # 清理远程已删除分支
git cherry-pick <commit>   # 拣选提交
```

## .gitignore
- 操作系统：`.DS_Store`, `Thumbs.db`
- IDE：`.vscode/`, `.idea/`
- 依赖：`node_modules/`, `vendor/`
- 构建：`dist/`, `build/`
- 环境：`.env`, `.env.local`

## 常见问题
- 冲突解决：`git mergetool` 或手动编辑
- 大文件：Git LFS
- 误删分支：`git reflog` 恢复
- 子模块：`git submodule`
