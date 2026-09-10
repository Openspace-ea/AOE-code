# Jupyter 工作流最佳实践

## 项目组织
- 用 `nbdev` 从 Notebook 生成库
- 模块化：提取可复用代码到 `.py` 文件
- 数据目录分离：`data/raw/`, `data/processed/`
- 用 `%autoreload` 自动重载外部模块

## 可复现性
- 固定随机种子：`np.random.seed(42)`, `random.seed(42)`
- 记录环境：`pip freeze > requirements.txt` 或 `poetry lock`
- 使用 `%%time` / `%%timeit` 测量执行时间
- 版本控制：`jupytext` 转为 `.py` 再 commit

## Notebook 技巧
- 魔术命令：`%matplotlib inline`, `%load_ext autoreload`
- 交互式组件：`ipywidgets` 滑块/下拉框
- 大数据显示：`df.head()` 限制输出
- 清理输出：`Edit > Clear All Outputs` 减少文件大小

## 调试
- `%pdb` 自动进入调试器
- `%debug` 进入事后调试
- `breakpoint()` 标准 Python 调试点
- `ipdb` 增强调试体验

## 常见反模式
- 避免：单元格执行顺序依赖（重启内核 → Run All 验证）
- 避免：Notebook 文件提交到 Git（用 jupytext 或 strip output）
- 避免：在 Notebook 中定义长函数（提取到模块）
- 避免：硬编码文件路径（用配置或环境变量）
