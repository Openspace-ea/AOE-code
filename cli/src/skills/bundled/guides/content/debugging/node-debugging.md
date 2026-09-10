# Node.js 调试最佳实践

## 调试工具

### Chrome DevTools
```bash
# 启动调试模式
node --inspect app.js

# 启动调试模式并等待连接
node --inspect-brk app.js

# 指定端口
node --inspect=9229 app.js

# 打开 Chrome DevTools
# 访问 chrome://inspect
```

### VSCode 调试
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/src/index.js",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Process",
      "port": 9229,
      "restart": true
    }
  ]
}
```

### 调试命令
```bash
# 使用 debugger 语句
function buggyFunction() {
  debugger;  // 执行到这里会暂停
  // ... 其他代码
}

# 使用 console 调试
console.log('Variable:', variable);
console.table(arrayOfObjects);
console.dir(object, { depth: null });
console.time('timer');
console.timeEnd('timer');
```

## 日志最佳实践

### 日志级别
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// 使用日志
logger.error('Error occurred', { error: err.message, stack: err.stack });
logger.warn('Warning message', { userId: 123 });
logger.info('User logged in', { userId: 123 });
logger.debug('Debug info', { data: someData });
```

### 结构化日志
```javascript
// ❌ 不好的日志
console.log('User logged in');

// ✅ 好的日志
logger.info('User logged in', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// ❌ 不好的错误日志
console.log('Error:', error);

// ✅ 好的错误日志
logger.error('Failed to process payment', {
  error: error.message,
  stack: error.stack,
  orderId: order.id,
  amount: order.amount,
  userId: user.id
});
```

## 错误处理

### 错误类型
```javascript
// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message, errors) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
```

### 错误处理中间件
```javascript
// Express 错误处理
app.use((err, req, res, next) => {
  // 记录错误
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });
  
  // 返回错误响应
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }
  
  // 未知错误
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});
```

### 未捕获异常处理
```javascript
// 未捕获的 Promise 异常
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason.toString(),
    stack: reason.stack
  });
  
  // 优雅关闭
  process.exit(1);
});

// 未捕获的同步异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  
  // 优雅关闭
  process.exit(1);
});
```

## 性能调试

### CPU 分析
```bash
# 使用 Node.js 内置分析器
node --prof app.js

# 生成报告
node --prof-process isolate-*.log > processed.txt

# 使用 Chrome DevTools
node --inspect app.js
# 打开 Chrome DevTools -> Performance -> Record
```

### 内存分析
```javascript
// 监控内存使用
function logMemoryUsage() {
  const usage = process.memoryUsage();
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(usage.external / 1024 / 1024)} MB`
  });
}

// 定期监控
setInterval(logMemoryUsage, 30000);

// 堆快照
const v8 = require('v8');
const fs = require('fs');

function takeHeapSnapshot() {
  const snapshotStream = v8.writeHeapSnapshot();
  console.log(`Heap snapshot written to ${snapshotStream}`);
}
```

### 事件循环延迟
```javascript
// 监控事件循环延迟
const { monitorEventLoopDelay } = require('perf_hooks');

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  console.log({
    min: histogram.min,
    max: histogram.max,
    mean: histogram.mean,
    p50: histogram.percentile(50),
    p99: histogram.percentile(99)
  });
  histogram.reset();
}, 5000);
```

## 调试技巧

### 断点调试
```javascript
// 条件断点
function processItems(items) {
  for (const item of items) {
    // 在 Chrome DevTools 中设置条件断点: item.id === 123
    processItem(item);
  }
}

// 日志点
function calculate(x, y) {
  // 在 Chrome DevTools 中设置日志点: `Result: ${x + y}`
  return x + y;
}
```

### 远程调试
```bash
# Docker 容器调试
docker run -p 9229:9229 --inspect=0.0.0.0:9229 myapp

# 远程服务器调试
ssh -L 9229:localhost:9229 user@server
node --inspect=0.0.0.0:9229 app.js
```

### 调试异步代码
```javascript
// 使用 async_hooks
const async_hooks = require('async_hooks');

const executionContext = new Map();

async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    const context = executionContext.get(triggerAsyncId);
    if (context) {
      executionContext.set(asyncId, context);
    }
  },
  destroy(asyncId) {
    executionContext.delete(asyncId);
  }
}).enable();

function getContext() {
  const asyncId = async_hooks.executionAsyncId();
  return executionContext.get(asyncId);
}
```

## 常见问题

### 内存泄漏
```javascript
// 检测内存泄漏
const used = process.memoryUsage();
console.log(`Memory usage: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);

// 常见泄漏原因：
// 1. 未清理的定时器
// 2. 未移除的事件监听器
// 3. 未释放的闭包引用
// 4. 全局变量累积

// 预防措施：
// 1. 使用 WeakMap/WeakSet
// 2. 及时移除事件监听器
// 3. 清理定时器
// 4. 避免不必要的全局变量
```

### 事件循环阻塞
```javascript
// 检测事件循环阻塞
const start = process.hrtime.bigint();

setImmediate(() => {
  const delay = Number(process.hrtime.bigint() - start) / 1e6;
  if (delay > 100) {
    console.warn(`Event loop blocked for ${delay}ms`);
  }
});

// 解决方案：
// 1. 使用 Worker Threads
// 2. 分解长时间运行的任务
// 3. 使用 setImmediate 或 setTimeout 让出控制权
```

### Promise 调试
```javascript
// 追踪 Promise
const originalPromise = Promise;
const pendingPromises = new Set();

class TrackedPromise extends originalPromise {
  constructor(executor) {
    super((resolve, reject) => {
      const promise = { created: new Date() };
      pendingPromises.add(promise);
      
      executor(
        (value) => {
          pendingPromises.delete(promise);
          resolve(value);
        },
        (reason) => {
          pendingPromises.delete(promise);
          reject(reason);
        }
      );
    });
  }
}

// 定期检查未完成的 Promise
setInterval(() => {
  if (pendingPromises.size > 0) {
    console.warn(`${pendingPromises.size} pending promises`);
  }
}, 10000);
```

## 调试工具推荐

### 命令行工具
- **ndb**: Chrome DevTools 的改进版
- **ironnode**: 基于 Chrome DevTools 的调试器
- **node-inspector**: 旧版调试器

### IDE 调试
- **VSCode**: 内置调试支持
- **WebStorm**: 强大的调试功能
- **Atom**: 需要插件支持

### 在线工具
- **StackBlitz**: 在线调试
- **CodeSandbox**: 在线调试
- **Repl.it**: 在线调试
