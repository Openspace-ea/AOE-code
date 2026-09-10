# React 最佳实践

## 组件模式
- 使用函数组件 + Hooks，不使用 class 组件
- 保持组件小而专注（单一职责）
- 提取自定义 Hook 封装可复用的状态逻辑
- 使用 `forwardRef` 暴露组件内部 DOM 或方法

## 性能优化
- `React.memo` 用于纯展示组件，避免不必要的重渲染
- `useCallback` / `useMemo` 保持引用稳定性
- `React.lazy` + `Suspense` 实现代码分割
- 虚拟列表用 `react-window` 或 `@tanstack/react-virtual`
- 避免在渲染中创建新对象/数组

## 状态管理
- 本地状态优先，按需提升
- 简单全局状态用 Zustand / Jotai
- 服务端状态用 TanStack Query / SWR
- 避免用 Context 管理高频更新的状态

## 常见反模式
- 避免：useEffect 用于派生状态（应内联计算）
- 避免：index 作为动态列表的 key
- 避免：在循环或条件中调用 Hook
- 避免：过度使用 useRef 存储可变值

## 代码示例

```tsx
// 自定义 Hook 模式
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

// 条件渲染模式
function UserAvatar({ user }: { user: User | null }) {
  if (!user) return <DefaultAvatar />
  return <img src={user.avatar} alt={user.name} />
}

// 表单处理模式
function useForm<T>(initialValues: T) {
  const [values, setValues] = useState(initialValues)
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues(prev => ({ ...prev, [e.target.name]: e.target.value }))
    },
    [],
  )
  return { values, handleChange, setValues }
}
```

## TypeScript 要点
- 使用 `React.FC` 或直接函数声明（两者皆可，保持一致）
- Props 接口用 `type` 而非 `interface`（除非需要合并）
- 泛型组件用 `<T,>` 尾逗号避免 JSX 解析歧义
- 事件处理器类型：`React.ChangeEvent<HTMLInputElement>`
