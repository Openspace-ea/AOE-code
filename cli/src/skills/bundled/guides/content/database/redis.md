# Redis 最佳实践

## 连接管理

### 连接配置
```javascript
// Node.js - 使用 ioredis
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'password',
  db: 0,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
});

// 使用连接池
const Redis = require('ioredis');
const cluster = new Redis.Cluster([
  { host: 'localhost', port: 6379 },
  { host: 'localhost', port: 6380 }
]);
```

### 连接池配置
```javascript
// 使用 ioredis 连接池
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  // 连接池配置
  connectionPool: {
    min: 5,
    max: 20
  }
});
```

## 数据结构

### 字符串 (String)
```javascript
// 基本操作
await redis.set('key', 'value');
await redis.get('key');

// 设置过期时间
await redis.set('key', 'value', 'EX', 3600);  // 1小时过期

// 原子操作
await redis.incr('counter');
await redis.incrby('counter', 10);
await redis.decr('counter');

// 批量操作
await redis.mset({ key1: 'value1', key2: 'value2' });
await redis.mget(['key1', 'key2']);
```

### 哈希 (Hash)
```javascript
// 设置哈希字段
await redis.hset('user:1', {
  name: 'John',
  email: 'john@example.com',
  age: 30
});

// 获取哈希字段
await redis.hget('user:1', 'name');
await redis.hgetall('user:1');

// 原子操作
await redis.hincrby('user:1', 'age', 1);
```

### 列表 (List)
```javascript
// 添加元素
await redis.lpush('queue', 'task1', 'task2');
await redis.rpush('queue', 'task3');

// 获取元素
await redis.lrange('queue', 0, -1);  // 获取所有
await redis.lpop('queue');            // 左边弹出
await redis.rpop('queue');            // 右边弹出

// 阻塞操作
await redis.blpop('queue', 30);  // 阻塞30秒
```

### 集合 (Set)
```javascript
// 添加元素
await redis.sadd('tags', 'javascript', 'nodejs', 'redis');

// 获取元素
await redis.smembers('tags');
await redis.sismember('tags', 'javascript');

// 集合操作
await redis.sinter('tags1', 'tags2');    // 交集
await redis.sunion('tags1', 'tags2');    // 并集
await redis.sdiff('tags1', 'tags2');     // 差集
```

### 有序集合 (Sorted Set)
```javascript
// 添加元素
await redis.zadd('leaderboard', 100, 'player1');
await redis.zadd('leaderboard', 200, 'player2');

// 获取元素
await redis.zrange('leaderboard', 0, -1);           // 所有
await redis.zrevrange('leaderboard', 0, 9);          // 前10名
await redis.zrangebyscore('leaderboard', 100, 200);   // 分数范围

// 原子操作
await redis.zincrby('leaderboard', 10, 'player1');
```

## 缓存策略

### 缓存模式
```javascript
// Cache-Aside 模式
async function getUser(id) {
  // 1. 先查缓存
  const cached = await redis.get(`user:${id}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. 缓存未命中，查数据库
  const user = await db.getUser(id);
  
  // 3. 写入缓存
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
  
  return user;
}

// Write-Through 模式
async function updateUser(id, data) {
  // 1. 更新数据库
  await db.updateUser(id, data);
  
  // 2. 更新缓存
  await redis.set(`user:${id}`, JSON.stringify(data), 'EX', 3600);
}

// Write-Behind 模式
async function updateUserAsync(id, data) {
  // 1. 立即更新缓存
  await redis.set(`user:${id}`, JSON.stringify(data), 'EX', 3600);
  
  // 2. 异步更新数据库
  queue.publish('user.update', { id, data });
}
```

### 缓存失效
```javascript
// TTL 过期
await redis.set('key', 'value', 'EX', 3600);

// 手动删除
await redis.del('key');

// 批量删除
await redis.del('key1', 'key2', 'key3');

// 模式匹配删除
const keys = await redis.keys('user:*');
if (keys.length > 0) {
  await redis.del(...keys);
}
```

## 性能优化

### 批量操作
```javascript
// 使用 pipeline
const pipeline = redis.pipeline();
for (let i = 0; i < 1000; i++) {
  pipeline.set(`key:${i}`, `value:${i}`);
}
await pipeline.exec();

// 使用 mget/mset
await redis.mset({
  key1: 'value1',
  key2: 'value2',
  key3: 'value3'
});

const values = await redis.mget(['key1', 'key2', 'key3']);
```

### 内存优化
```javascript
// 使用压缩
const zlib = require('zlib');

async function setCompressed(key, value) {
  const compressed = zlib.gzipSync(JSON.stringify(value));
  await redis.set(key, compressed);
}

async function getCompressed(key) {
  const compressed = await redis.getBuffer(key);
  if (!compressed) return null;
  const decompressed = zlib.gunzipSync(compressed);
  return JSON.parse(decompressed);
}

// 使用哈希代替多个键
// ❌ 多个键
await redis.set('user:1:name', 'John');
await redis.set('user:1:email', 'john@example.com');

// ✅ 单个哈希
await redis.hset('user:1', { name: 'John', email: 'john@example.com' });
```

## 分布式锁

### 基本锁实现
```javascript
async function acquireLock(key, ttl = 30000) {
  const value = Date.now() + ttl;
  const result = await redis.set(key, value, 'NX', 'PX', ttl);
  return result === 'OK' ? value : null;
}

async function releaseLock(key, value) {
  const currentValue = await redis.get(key);
  if (currentValue === String(value)) {
    await redis.del(key);
    return true;
  }
  return false;
}

// 使用锁
async function withLock(key, fn, ttl = 30000) {
  const lockValue = await acquireLock(key, ttl);
  if (!lockValue) {
    throw new Error('Could not acquire lock');
  }
  
  try {
    return await fn();
  } finally {
    await releaseLock(key, lockValue);
  }
}
```

### Redlock 算法
```javascript
const Redlock = require('redlock');

const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 3,
  retryDelay: 200,
  retryJitter: 200
});

async function withRedlock(key, fn, ttl = 30000) {
  const lock = await redlock.acquire([key], ttl);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
```

## 消息队列

### 发布/订阅
```javascript
// 订阅
redis.subscribe('channel');
redis.on('message', (channel, message) => {
  console.log(`Received ${message} from ${channel}`);
});

// 发布
await redis.publish('channel', 'message');
```

### 流 (Stream)
```javascript
// 添加消息
await redis.xadd('mystream', '*', 'field1', 'value1');

// 读取消息
await redis.xread('COUNT', 10, 'STREAMS', 'mystream', '0');

// 消费者组
await redis.xgroup('CREATE', 'mystream', 'mygroup', '0');
await redis.xreadgroup('GROUP', 'mygroup', 'consumer1', 'COUNT', 10, 'STREAMS', 'mystream', '>');
```

## 性能监控

### 监控指标
```javascript
// 服务器信息
await redis.info();

// 内存使用
await redis.info('memory');

// 客户端连接
await redis.info('clients');

// 命令统计
await redis.info('commandstats');

// 慢查询日志
await redis.slowlog('GET', 10);
```

### 内存优化
```javascript
// 查看内存使用
await redis.memory('usage', 'key');

// 内存碎片率
const info = await redis.info('memory');
const frag = info.match(/mem_fragmentation_ratio:(\d+\.\d+)/)[1];

// 内存淘汰策略
// noeviction: 不淘汰，返回错误
// allkeys-lru: 淘汰所有键的最近最少使用
// volatile-lru: 淘汰有过期时间的键的最近最少使用
// allkeys-random: 随机淘汰
// volatile-random: 随机淘汰有过期时间的键
// volatile-ttl: 淘汰有最短过期时间的键
```

## 备份恢复

### RDB 快照
```bash
# 手动触发快照
redis-cli BGSAVE

# 配置自动快照
# redis.conf
save 900 1      # 900秒内有1个键变化
save 300 10     # 300秒内有10个键变化
save 60 10000   # 60秒内有10000个键变化
```

### AOF 持久化
```bash
# 配置 AOF
# redis.conf
appendonly yes
appendfsync everysec  # 每秒同步

# 重写 AOF
redis-cli BGREWRITEAOF
```

### 恢复
```bash
# 从 RDB 恢复
# 复制 dump.rdb 到 Redis 数据目录
redis-server

# 从 AOF 恢复
# 复制 appendonly.aof 到 Redis 数据目录
redis-server --appendonly yes
```

## 安全最佳实践

### 访问控制
```bash
# 配置密码
# redis.conf
requirepass strong_password

# 使用 ACL (Redis 6+)
ACL SETUSER app_user on >password ~* +@all
ACL SETUSER readonly_user on >password ~* +@read
```

### 网络安全
```bash
# 绑定地址
# redis.conf
bind 127.0.0.1

# 启用 TLS
# redis.conf
tls-port 6379
tls-cert-file /etc/redis/redis.crt
tls-key-file /etc/redis/redis.key
```

## 常见问题

### 内存溢出
```javascript
// 查看内存使用
await redis.info('memory');

// 设置最大内存
// redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### 连接问题
```javascript
// 连接超时
const redis = new Redis({
  connectTimeout: 10000,
  maxRetriesPerRequest: 3
});

// 重连策略
const redis = new Redis({
  retryStrategy(times) {
    if (times > 3) {
      return null;  // 停止重试
    }
    return Math.min(times * 100, 3000);
  }
});
```
