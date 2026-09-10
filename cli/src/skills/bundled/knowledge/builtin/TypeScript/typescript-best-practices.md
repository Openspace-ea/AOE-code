# TypeScript 最佳实践

## 类型定义

### 1. 使用接口定义对象形状

```typescript
// ✅ 好的做法 - 使用 interface
interface User {
  id: string
  name: string
  email: string
  age?: number  // 可选属性
}

// ❌ 不好的做法 - 使用 type（除非需要联合类型或交叉类型）
type User = {
  id: string
  name: string
}
```

### 2. 使用类型别名简化复杂类型

```typescript
// 简化复杂类型
type EventHandler<T> = (event: T) => void
type AsyncCallback<T> = () => Promise<T>
type Nullable<T> = T | null

// 使用
const handleClick: EventHandler<MouseEvent> = (event) => {
  console.log(event.clientX, event.clientY)
}
```

### 3. 泛型约束

```typescript
// 使用 extends 约束泛型
interface HasId {
  id: string
}

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id)
}

// 使用
const users: User[] = [{ id: '1', name: 'Alice', email: 'alice@example.com' }]
const user = findById(users, '1')  // 类型推断为 User | undefined
```

## 函数设计

### 1. 函数重载

```typescript
// 定义重载签名
function format(value: string): string
function format(value: number): string
function format(value: Date): string
function format(value: string | number | Date): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toFixed(2)
  return value.toISOString()
}

// 使用
format('hello')      // OK
format(3.14159)      // OK
format(new Date())   // OK
// format(true)      // Error
```

### 2. 可选链和空值合并

```typescript
interface Config {
  database?: {
    host?: string
    port?: number
  }
}

const config: Config = {}

// ✅ 使用可选链
const host = config.database?.host ?? 'localhost'
const port = config.database?.port ?? 5432

// ❌ 不好的做法
const host2 = config.database ? config.database.host : 'localhost'
```

## 类型守卫

### 1. 自定义类型守卫

```typescript
interface Cat {
  meow(): void
}

interface Dog {
  bark(): void
}

function isCat(animal: Cat | Dog): animal is Cat {
  return (animal as Cat).meow !== undefined
}

function makeSound(animal: Cat | Dog) {
  if (isCat(animal)) {
    animal.meow()  // TypeScript 知道这是 Cat
  } else {
    animal.bark()  // TypeScript 知道这是 Dog
  }
}
```

### 2. 使用 in 操作符

```typescript
function makeSound(animal: Cat | Dog) {
  if ('meow' in animal) {
    animal.meow()  // TypeScript 知道这是 Cat
  } else {
    animal.bark()  // TypeScript 知道这是 Dog
  }
}
```

## 实用工具类型

### 1. Partial 和 Required

```typescript
interface User {
  id: string
  name: string
  email: string
}

// 所有属性变为可选
function updateUser(user: User, updates: Partial<User>): User {
  return { ...user, ...updates }
}

// 所有属性变为必需
type RequiredUser = Required<User>
```

### 2. Pick 和 Omit

```typescript
// 只选择部分属性
type UserPreview = Pick<User, 'id' | 'name'>

// 排除部分属性
type UserWithoutEmail = Omit<User, 'email'>
```

### 3. Record

```typescript
// 创建键值对类型
type UserRoles = Record<string, 'admin' | 'user' | 'guest'>

const roles: UserRoles = {
  alice: 'admin',
  bob: 'user',
}
```

## 模块导出

### 1. 命名导出 vs 默认导出

```typescript
// ✅ 好的做法 - 命名导出
export function createUser(name: string): User {
  return { id: generateId(), name, email: '' }
}

export interface User {
  id: string
  name: string
  email: string
}

// ❌ 不好的做法 - 默认导出（不利于重构和自动导入）
export default function createUser(name: string): User {
  return { id: generateId(), name, email: '' }
}
```

### 2. 导出类型

```typescript
// 导出类型
export type { User, UserRole }

// 或者使用 interface 直接导出
export interface User {
  id: string
  name: string
}
```

## 错误处理

### 1. 使用 Result 类型

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { success: false, error: 'Division by zero' }
  }
  return { success: true, data: a / b }
}

// 使用
const result = divide(10, 2)
if (result.success) {
  console.log(result.data)  // TypeScript 知道这是 number
} else {
  console.error(result.error)  // TypeScript 知道这是 string
}
```

### 2. 自定义错误类

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'AppError'
  }
}

class ValidationError extends AppError {
  constructor(message: string, public fields: string[]) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}
```

## 性能优化

### 1. 使用 as const

```typescript
// ✅ 使用 as const 创建字面量类型
const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  CONTACT: '/contact',
} as const

type Route = typeof ROUTES[keyof typeof ROUTES]
// Route = '/' | '/about' | '/contact'
```

### 2. 避免不必要的类型断言

```typescript
// ❌ 不好的做法
const user = getUser() as User

// ✅ 好的做法 - 使用类型守卫
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj
}

const user = getUser()
if (!isUser(user)) {
  throw new Error('Invalid user')
}
// TypeScript 知道 user 是 User
```

## 配置建议

### tsconfig.json 推荐配置

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  }
}
```
