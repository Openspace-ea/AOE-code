# Go 惯用模式

## 项目结构
```
cmd/            # 可执行文件入口
internal/       # 私有包（不可被外部导入）
pkg/            # 可被外部导入的包
api/            # API 定义（protobuf/OpenAPI）
configs/        # 配置文件
```

## 错误处理
- 显式错误检查，不使用异常
- `errors.Is` / `errors.As` 判断错误类型
- 自定义错误类型实现 `error` 接口
- 用 `%w` 包装错误保留链：`fmt.Errorf("xxx: %w", err)`
- 避免忽略错误：`_ = doSomething()` 只在明确安全时使用

## 并发模式
- Goroutine + Channel：CSP 并发模型
- `context.Context` 传递取消信号和超时
- `sync.WaitGroup` 等待一组 goroutine
- `errgroup` 处理并发错误
- 避免 goroutine 泄漏：确保有退出路径

## 接口设计
- 小接口：1-3 个方法
- 在消费者包中定义接口（而非实现者包）
- `io.Reader` / `io.Writer` 是经典范例
- 接口组合替代继承

## 代码示例

```go
// 服务层模式
type UserService struct {
    repo UserRepository
}

func NewUserService(repo UserRepository) *UserService {
    return &UserService{repo: repo}
}

func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("get user %s: %w", id, err)
    }
    return user, nil
}

// 并发处理
func ProcessItems(ctx context.Context, items []Item) error {
    g, ctx := errgroup.WithContext(ctx)
    for _, item := range items {
        item := item // 捕获循环变量
        g.Go(func() error {
            return process(ctx, item)
        })
    }
    return g.Wait()
}
```

## 常见反模式
- 避免：过度使用 `interface{}` / `any`
- 避免：在循环中 defer（延迟到函数结束）
- 避免：忽略 context 传递
- 避免：过早优化（先 profile）
