# React 最佳实践

## 组件设计原则

### 1. 单一职责
每个组件只负责一个功能，保持组件简洁易懂。

```tsx
// ✅ 好的做法
function UserAvatar({ user }: { user: User }) {
  return <img src={user.avatar} alt={user.name} />
}

function UserName({ user }: { user: User }) {
  return <span>{user.name}</span>
}

// ❌ 不好的做法
function UserInfo({ user }: { user: User }) {
  return (
    <div>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
      <span>{user.email}</span>
      <button onClick={() => follow(user.id)}>关注</button>
    </div>
  )
}
```

### 2. Props 设计
- 使用 TypeScript 接口定义 Props
- 提供合理的默认值
- 避免过多的 props（超过 5 个考虑拆分）

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}

function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children
}: ButtonProps) {
  // ...
}
```

## Hooks 使用规范

### 1. 自定义 Hooks
将复杂逻辑抽取为自定义 Hooks：

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// 使用
function SearchInput() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery)
    }
  }, [debouncedQuery])

  return <input value={query} onChange={e => setQuery(e.target.value)} />
}
```

### 2. useMemo 和 useCallback
只在必要时使用，避免过度优化：

```tsx
// ✅ 正确使用 - 昂贵的计算
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name))
}, [items])

// ✅ 正确使用 - 传递给子组件的回调
const handleClick = useCallback(() => {
  onClick(id)
}, [onClick, id])

// ❌ 不必要的使用 - 简单计算
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName])
```

## 状态管理

### 1. 局部状态优先
只在需要共享时才提升状态：

```tsx
// ✅ 局部状态
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}

// ✅ 提升状态到父组件
function Parent() {
  const [sharedCount, setSharedCount] = useState(0)
  return (
    <>
      <CounterA count={sharedCount} onChange={setSharedCount} />
      <CounterB count={sharedCount} onChange={setSharedCount} />
    </>
  )
}
```

### 2. Context 使用场景
适用于全局主题、语言、用户认证等：

```tsx
const ThemeContext = createContext<'light' | 'dark'>('light')

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  return (
    <ThemeContext.Provider value={theme}>
      <MainLayout />
    </ThemeContext.Provider>
  )
}

function ThemedButton() {
  const theme = useContext(ThemeContext)
  return <button className={`btn-${theme}`}>Click me</button>
}
```

## 性能优化

### 1. 代码分割
使用 React.lazy 进行路由级别的代码分割：

```tsx
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  )
}
```

### 2. 虚拟列表
处理大列表时使用虚拟滚动：

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }: { items: string[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: `${virtualRow.start}px`,
              height: `${virtualRow.size}px`,
              width: '100%',
            }}
          >
            {items[virtualRow.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 测试策略

### 1. 组件测试
使用 React Testing Library：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'

test('increments counter on click', () => {
  render(<Counter />)
  const button = screen.getByRole('button', { name: /count/i })

  fireEvent.click(button)

  expect(button).toHaveTextContent('1')
})
```

### 2. Hook 测试
使用 renderHook：

```tsx
import { renderHook, act } from '@testing-library/react'

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter())

  act(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(1)
})
```
