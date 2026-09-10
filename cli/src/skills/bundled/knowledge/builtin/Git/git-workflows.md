# Git 工作流最佳实践

## 分支策略

### 1. Git Flow

适用于有明确发布周期的项目：

```
main (生产)
  │
  ├── develop (开发)
  │     │
  │     ├── feature/xxx
  │     ├── feature/yyy
  │     │
  │     └── release/v1.0
  │
  └── hotfix/xxx
```

**分支说明：**
- `main`: 生产环境代码，始终保持稳定
- `develop`: 开发分支，集成所有功能
- `feature/*`: 功能分支，从 develop 创建
- `release/*`: 发布分支，准备新版本
- `hotfix/*`: 紧急修复，从 main 创建

### 2. GitHub Flow

适用于持续部署的项目：

```
main (生产)
  │
  ├── feature/xxx → PR → main
  ├── feature/yyy → PR → main
  └── feature/zzz → PR → main
```

**流程简单：**
1. 从 main 创建功能分支
2. 开发完成后提交 PR
3. 代码审查通过后合并到 main
4. 自动部署

### 3. Trunk-Based Development

适用于高频发布的项目：

```
main (主干)
  │
  ├── 短生命周期分支 (1-2天)
  └── 直接提交到 main
```

## 提交规范

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**类型：**
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例：**
```
feat(auth): add OAuth2 login support

- Implement Google OAuth2 provider
- Add login/logout flow
- Store tokens securely

Closes #123
```

## 常用命令

### 分支操作

```bash
# 创建并切换分支
git checkout -b feature/new-feature

# 查看所有分支
git branch -a

# 删除本地分支
git branch -d feature/old-feature

# 删除远程分支
git push origin --delete feature/old-feature

# 重命名分支
git branch -m old-name new-name
```

### 提交操作

```bash
# 暂存所有更改
git add .

# 暂存特定文件
git add src/index.ts

# 提交
git commit -m "feat: add new feature"

# 修改最后一次提交
git commit --amend

# 交互式暂存
git add -p
```

### 同步操作

```bash
# 拉取最新代码
git pull origin main

# 拉取并变基
git pull --rebase origin main

# 推送
git push origin feature/my-feature

# 强制推送（谨慎使用）
git push --force-with-lease origin feature/my-feature
```

### 合并操作

```bash
# 合并分支
git merge feature/my-feature

# 变基
git rebase main

# 交互式变基（整理提交历史）
git rebase -i HEAD~3

# 中止变基
git rebase --abort
```

## 冲突解决

### 1. 合并冲突

```bash
# 合并时出现冲突
git merge feature/branch
# CONFLICT: Merge conflict in src/index.ts

# 查看冲突文件
git status

# 解决冲突后
git add src/index.ts
git commit
```

### 2. 冲突标记

```typescript
<<<<<<< HEAD
// 当前分支的代码
const a = 1
=======
// 合并分支的代码
const a = 2
>>>>>>> feature/branch
```

### 3. 使用工具解决冲突

```bash
# 使用 VS Code
code .

# 使用 meld
git mergetool

# 使用 git 自带的合并工具
git mergetool --tool=vimdiff
```

## 回退操作

### 1. 撤销工作区更改

```bash
# 撤销单个文件
git checkout -- src/index.ts

# 撤销所有更改
git checkout -- .
```

### 2. 撤销暂存

```bash
# 撤销暂存
git reset HEAD src/index.ts

# 撤销所有暂存
git reset HEAD
```

### 3. 回退提交

```bash
# 回退到上一个提交（保留更改）
git reset --soft HEAD~1

# 回退到上一个提交（丢弃更改）
git reset --hard HEAD~1

# 创建新的提交来撤销
git revert HEAD
```

## 标签管理

```bash
# 创建轻量标签
git tag v1.0.0

# 创建附注标签
git tag -a v1.0.0 -m "Release version 1.0.0"

# 推送标签
git push origin v1.0.0

# 推送所有标签
git push origin --tags

# 删除标签
git tag -d v1.0.0
```

## 配置优化

### .gitconfig 推荐配置

```ini
[user]
    name = Your Name
    email = your.email@example.com

[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    lg = log --oneline --graph --decorate

[pull]
    rebase = true

[push]
    default = current

[core]
    autocrlf = input  # Linux/Mac
    # autocrlf = true  # Windows
```

### .gitignore 模板

```
# Dependencies
node_modules/
vendor/

# Build output
dist/
build/
*.o
*.exe

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Environment
.env
.env.local
```

## 工作流示例

### 功能开发流程

```bash
# 1. 创建功能分支
git checkout -b feature/user-auth

# 2. 开发功能
# ... 编写代码 ...

# 3. 提交更改
git add .
git commit -m "feat(auth): implement user authentication"

# 4. 推送分支
git push origin feature/user-auth

# 5. 创建 PR（通过 GitHub/GitLab）

# 6. 代码审查后合并

# 7. 拉取最新代码
git checkout main
git pull origin main

# 8. 删除功能分支
git branch -d feature/user-auth
```

### 紧急修复流程

```bash
# 1. 从 main 创建 hotfix 分支
git checkout -h hotfix/critical-bug main

# 2. 修复 bug
# ... 编写代码 ...

# 3. 提交修复
git add .
git commit -m "fix: resolve critical security vulnerability"

# 4. 合并到 main
git checkout main
git merge hotfix/critical-bug

# 5. 打标签
git tag -a v1.0.1 -m "Hotfix: critical security update"
git push origin v1.0.1

# 6. 合并到 develop
git checkout develop
git merge hotfix/critical-bug

# 7. 删除 hotfix 分支
git branch -d hotfix/critical-bug
```
