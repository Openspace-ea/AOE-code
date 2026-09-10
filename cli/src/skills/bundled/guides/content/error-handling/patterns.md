# 错误处理最佳实践

## 错误处理原则

### 1. 明确区分错误类型
```javascript
// 业务错误（可预期）
class BusinessError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.isOperational = true;
  }
}

// 系统错误（不可预期）
class SystemError extends Error {
  constructor(message, originalError) {
    super(message);
    this.originalError = originalError;
    this.isOperational = false;
  }
}
```

### 2. 错误处理层次
```
┌─────────────────────────────────────┐
│          全局错误处理器              │
├─────────────────────────────────────┤
│          中间件错误处理              │
├─────────────────────────────────────┤
│          函数级错误处理              │
├─────────────────────────────────────┤
│          底层错误捕获                │
└─────────────────────────────────────┘
```

## JavaScript/TypeScript 错误处理

### 基本错误处理
```javascript
// 同步错误处理
function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError('Invalid JSON format');
    }
    throw error;
  }
}

// 异步错误处理
async function fetchUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new TimeoutError('Request timed out');
    }
    throw new NetworkError('Failed to fetch user', error);
  }
}
```

### Promise 错误处理
```javascript
// 链式 Promise
fetchUser(1)
  .then(user => fetchOrders(user.id))
  .then(orders => processOrders(orders))
  .catch(error => {
    logger.error('Pipeline failed', { error });
    throw error;
  });

// Promise.all 错误处理
async function fetchMultipleUsers(ids) {
  try {
    const users = await Promise.all(
      ids.map(id => fetchUser(id))
    );
    return users;
  } catch (error) {
    // 任何一个失败都会进入这里
    logger.error('Failed to fetch users', { ids, error });
    throw error;
  }
}

// Promise.allSettled - 获取所有结果
async function fetchMultipleUsersSafe(ids) {
  const results = await Promise.allSettled(
    ids.map(id => fetchUser(id))
  );
  
  const successful = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
  
  const failed = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason);
  
  return { successful, failed };
}
```

### 自定义错误类
```javascript
// 基础错误类
class AppError extends Error {
  constructor(message, statusCode, code, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 验证错误
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

// 未找到错误
class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} with id ${id} not found`, 404, 'NOT_FOUND');
  }
}

// 认证错误
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

// 授权错误
class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

// 冲突错误
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

// 限流错误
class RateLimitError extends AppError {
  constructor(retryAfter) {
    super('Too many requests', 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}
```

## Express 错误处理

### 错误处理中间件
```javascript
// 错误处理中间件
app.use((err, req, res, next) => {
  // 记录错误
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    requestId: req.id
  });
  
  // 确定状态码
  const statusCode = err.statusCode || 500;
  
  // 构建错误响应
  const errorResponse = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.isOperational ? err.message : 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err.details
      })
    }
  };
  
  // 添加请求ID
  if (req.id) {
    errorResponse.error.requestId = req.id;
  }
  
  // 发送错误响应
  res.status(statusCode).json(errorResponse);
});
```

### 异步错误包装
```javascript
// 异步中间件包装器
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 使用
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await UserService.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User', req.params.id);
  }
  res.json(user);
}));
```

## React 错误处理

### 错误边界
```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // 发送错误到监控服务
    reportError(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// 使用
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

### Hook 错误处理
```jsx
function useAsync(asyncFunction, immediate = true) {
  const [state, setState] = useState({
    loading: immediate,
    error: null,
    data: null
  });
  
  const execute = useCallback(async (...args) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await asyncFunction(...args);
      setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      setState({ loading: false, error, data: null });
      throw error;
    }
  }, [asyncFunction]);
  
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);
  
  return { ...state, execute };
}

// 使用
function UserProfile({ userId }) {
  const { loading, error, data: user } = useAsync(
    () => fetchUser(userId)
  );
  
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserCard user={user} />;
}
```

## 错误恢复策略

### 重试机制
```javascript
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    retryIf = () => true
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries && retryIf(error)) {
        const waitTime = delay * Math.pow(backoff, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

// 使用
const data = await withRetry(
  () => fetchFromAPI('/data'),
  {
    maxRetries: 3,
    retryIf: (error) => error.statusCode >= 500
  }
);
```

### 熔断器
```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// 使用
const breaker = new CircuitBreaker({ failureThreshold: 3 });
const data = await breaker.execute(() => fetchFromAPI('/data'));
```

### 降级策略
```javascript
async function getDataWithFallback(primaryFn, fallbackFn) {
  try {
    return await primaryFn();
  } catch (error) {
    console.warn('Primary source failed, trying fallback:', error.message);
    return await fallbackFn();
  }
}

// 使用
const data = await getDataWithFallback(
  () => fetchFromAPI('/data'),
  () => fetchFromCache('data')
);
```

## 错误监控

### 错误上报
```javascript
class ErrorReporter {
  constructor(config) {
    this.dsn = config.dsn;
    this.environment = config.environment;
  }
  
  captureError(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        url: window?.location?.href,
        userAgent: navigator?.userAgent
      }
    };
    
    // 发送到监控服务
    this.sendToService(errorData);
  }
  
  captureMessage(message, level = 'info') {
    this.captureError(new Error(message), { level });
  }
  
  async sendToService(data) {
    try {
      await fetch(this.dsn, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Failed to report error:', error);
    }
  }
}

// 使用
const reporter = new ErrorReporter({
  dsn: 'https://monitor.example.com/errors',
  environment: process.env.NODE_ENV
});
```

### 错误聚合
```javascript
class ErrorAggregator {
  constructor(windowMs = 60000) {
    this.errors = new Map();
    this.windowMs = windowMs;
  }
  
  add(error) {
    const key = this.getErrorKey(error);
    const existing = this.errors.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = Date.now();
    } else {
      this.errors.set(key, {
        error,
        count: 1,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now()
      });
    }
    
    this.cleanup();
  }
  
  getErrorKey(error) {
    return `${error.name}:${error.message}:${error.stack?.split('\n')[1]}`;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.errors) {
      if (now - entry.lastOccurrence > this.windowMs) {
        this.errors.delete(key);
      }
    }
  }
  
  getSummary() {
    return Array.from(this.errors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}
```

## 常见错误模式

### 1. 未处理的 Promise 拒绝
```javascript
// ❌ 错误
fetchData().then(data => process(data));

// ✅ 正确
fetchData()
  .then(data => process(data))
  .catch(error => {
    logger.error('Failed to fetch data', { error });
    // 处理错误
  });

// ✅ 更好
try {
  const data = await fetchData();
  process(data);
} catch (error) {
  logger.error('Failed to fetch data', { error });
  // 处理错误
}
```

### 2. 错误吞没
```javascript
// ❌ 错误 - 吞没错误
try {
  await riskyOperation();
} catch (error) {
  // 什么都不做
}

// ✅ 正确 - 记录并处理
try {
  await riskyOperation();
} catch (error) {
  logger.error('Risky operation failed', { error });
  // 处理错误或重新抛出
  throw error;
}
```

### 3. 过度宽泛的错误捕获
```javascript
// ❌ 错误 - 捕获所有错误
try {
  await operation();
} catch (error) {
  // 处理所有类型的错误
}

// ✅ 正确 - 针对性捕获
try {
  await operation();
} catch (error) {
  if (error instanceof ValidationError) {
    // 处理验证错误
  } else if (error instanceof NetworkError) {
    // 处理网络错误
  } else {
    // 其他错误重新抛出
    throw error;
  }
}
```

## 错误处理检查清单

- [ ] 是否区分了业务错误和系统错误？
- [ ] 是否有全局错误处理器？
- [ ] 是否捕获了未处理的 Promise 拒绝？
- [ ] 是否有错误重试机制？
- [ ] 是否有错误降级策略？
- [ ] 是否记录了足够的错误上下文？
- [ ] 是否有错误监控和上报？
- [ ] 是否在生产环境隐藏了敏感信息？
- [ ] 是否有用户友好的错误消息？
- [ ] 是否测试了错误场景？
