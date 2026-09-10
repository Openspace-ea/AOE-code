# PostgreSQL 最佳实践

## 连接管理

### 连接池配置
```javascript
// Node.js - 使用 pg-pool
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'postgres',
  password: 'password',
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲连接超时
  connectionTimeoutMillis: 2000,  // 连接超时
});

// 使用连接
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}
```

### 连接池大小建议
- **公式**: 连接数 = (CPU 核心数 * 2) + 有效磁盘数
- **小型应用**: 5-10 连接
- **中型应用**: 10-20 连接
- **大型应用**: 20-50 连接

## 查询优化

### 索引策略
```sql
-- B-tree 索引（默认，最常用）
CREATE INDEX idx_users_email ON users(email);

-- 部分索引（只索引符合条件的行）
CREATE INDEX idx_active_users ON users(status) WHERE status = 'active';

-- 表达式索引
CREATE INDEX idx_lower_email ON users(lower(email));

-- 多列索引
CREATE INDEX idx_user_status ON users(status, created_at);

-- GIN 索引（用于数组、JSONB）
CREATE INDEX idx_tags ON articles USING GIN(tags);

-- GiST 索引（用于几何数据、全文搜索）
CREATE INDEX idx_location ON places USING GiST(location);
```

### 查询优化技巧
```sql
-- ❌ 避免 SELECT *
SELECT * FROM users WHERE id = 1;

-- ✅ 只选择需要的列
SELECT id, name, email FROM users WHERE id = 1;

-- ❌ 避免在 WHERE 子句中使用函数
SELECT * FROM users WHERE EXTRACT(YEAR FROM created_at) = 2024;

-- ✅ 使用范围查询
SELECT * FROM users 
WHERE created_at >= '2024-01-01' 
AND created_at < '2025-01-01';

-- ❌ 避免 LIKE '%prefix'（无法使用索引）
SELECT * FROM users WHERE name LIKE '%john';

-- ✅ 使用前缀匹配
SELECT * FROM users WHERE name LIKE 'john%';

-- ✅ 使用全文搜索
SELECT * FROM users WHERE to_tsvector('english', name) @@ to_tsquery('john');
```

### EXPLAIN 分析
```sql
-- 分析查询执行计划
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
GROUP BY u.id;

-- 关注的字段：
-- Seq Scan: 全表扫描 → 需要索引
-- Index Scan: 索引扫描 → 良好
-- Nested Loop / Hash Join / Merge Join: 连接策略
-- Buffers: 缓冲区使用情况
```

## 数据类型

### 常用类型
```sql
-- 整数
SMALLINT    -- 2 字节
INTEGER     -- 4 字节
BIGINT      -- 8 字节

-- 浮点数
REAL        -- 4 字节
DOUBLE PRECISION -- 8 字节
NUMERIC     -- 精确数值

-- 文本
CHAR(n)     -- 固定长度
VARCHAR(n)  -- 可变长度
TEXT        -- 无限长度

-- 日期时间
DATE        -- 日期
TIME        -- 时间
TIMESTAMP   -- 日期时间
TIMESTAMPTZ -- 带时区的日期时间

-- 特殊类型
JSON        -- JSON 数据
JSONB       -- 二进制 JSON（推荐）
UUID        -- UUID
ARRAY       -- 数组
```

### JSONB 使用
```sql
-- 创建包含 JSONB 的表
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  attributes JSONB
);

-- 插入 JSON 数据
INSERT INTO products (name, attributes) VALUES (
  'Laptop',
  '{"brand": "Apple", "ram": 16, "storage": ["SSD", "HDD"]}'
);

-- 查询 JSON 数据
SELECT * FROM products WHERE attributes->>'brand' = 'Apple';
SELECT * FROM products WHERE attributes->'ram' > 8;
SELECT * FROM products WHERE attributes @> '{"storage": ["SSD"]}';

-- 创建 GIN 索引
CREATE INDEX idx_attributes ON products USING GIN(attributes);
```

## 事务处理

### 事务隔离级别
```sql
-- 查看当前隔离级别
SHOW transaction_isolation;

-- 设置隔离级别
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 常用隔离级别：
-- READ UNCOMMITTED: 最低，可能脏读
-- READ COMMITTED: 默认，避免脏读
-- REPEATABLE READ: 避免不可重复读
-- SERIALIZABLE: 最高，避免幻读
```

### 事务最佳实践
```sql
-- 使用 SAVEPOINT
BEGIN;
  INSERT INTO orders (user_id, total) VALUES (1, 100);
  
  SAVEPOINT order_created;
  
  INSERT INTO order_items (order_id, product_id, quantity) VALUES (1, 1, 2);
  
  -- 如果出错，回滚到保存点
  ROLLBACK TO SAVEPOINT order_created;
  
  -- 或者继续
  RELEASE SAVEPOINT order_created;
COMMIT;
```

### CTE (公共表表达式)
```sql
-- 递归 CTE
WITH RECURSIVE category_tree AS (
  SELECT id, name, parent_id, 0 as level
  FROM categories
  WHERE parent_id IS NULL
  
  UNION ALL
  
  SELECT c.id, c.name, c.parent_id, ct.level + 1
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree;

-- 数据修改 CTE
WITH deleted_orders AS (
  DELETE FROM orders
  WHERE created_at < '2023-01-01'
  RETURNING id
)
DELETE FROM order_items WHERE order_id IN (SELECT id FROM deleted_orders);
```

## 性能监控

### 性能指标
```sql
-- 查看数据库大小
SELECT pg_size_pretty(pg_database_size('mydb'));

-- 查看表大小
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- 查看索引使用情况
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 查看慢查询
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 连接监控
```sql
-- 查看当前连接
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  backend_start,
  state,
  query
FROM pg_stat_activity;

-- 查看连接数
SELECT count(*) FROM pg_stat_activity;

-- 终止连接
SELECT pg_terminate_backend(pid);
```

## 备份恢复

### 逻辑备份
```bash
# 备份单个数据库
pg_dump -U postgres -d mydb > backup.sql

# 备份所有数据库
pg_dumpall -U postgres > all_backup.sql

# 备份特定表
pg_dump -U postgres -d mydb -t users -t orders > tables.sql

# 压缩备份
pg_dump -U postgres -d mydb | gzip > backup.sql.gz

# 自定义格式（推荐）
pg_dump -U postgres -d mydb -Fc > backup.dump
```

### 物理备份
```bash
# 使用 pg_basebackup
pg_basebackup -h localhost -U replicator -D /backup/ -Fp -Xs -P

# 使用 Barman（推荐用于生产环境）
barman backup my_server
```

### 恢复
```bash
# 恢复 SQL 备份
psql -U postgres -d mydb < backup.sql

# 恢复自定义格式
pg_restore -U postgres -d mydb backup.dump

# 恢复特定表
pg_restore -U postgres -d mydb -t users backup.dump
```

## 安全最佳实践

### 用户权限
```sql
-- 创建角色
CREATE ROLE app_user WITH LOGIN PASSWORD 'strong_password';

-- 授予数据库权限
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- 授予表权限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- 授予序列权限
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```

### 行级安全
```sql
-- 启用行级安全
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY user_documents ON documents
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::int);

-- 设置当前用户
SET app.current_user_id = '123';
```

## 常见问题

### 死锁处理
```sql
-- 查看死锁信息
SELECT * FROM pg_locks WHERE NOT granted;

-- 查看阻塞的查询
SELECT 
  blocked.pid as blocked_pid,
  blocked.query as blocked_query,
  blocking.pid as blocking_pid,
  blocking.query as blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON blocked.pid = bl.pid
JOIN pg_locks kl ON bl.locktype = kl.locktype
  AND bl.database IS NOT DISTINCT FROM kl.database
  AND bl.relation IS NOT DISTINCT FROM kl.relation
  AND bl.page IS NOT DISTINCT FROM kl.page
  AND bl.tuple IS NOT DISTINCT FROM kl.tuple
  AND bl.transactionid IS NOT DISTINCT FROM kl.transactionid
  AND bl.pid != kl.pid
JOIN pg_stat_activity blocking ON kl.pid = blocking.pid
WHERE NOT bl.granted;
```

### 表维护
```sql
-- 清理死行
VACUUM users;

-- 分析表
ANALYZE users;

-- 完全清理（会锁表）
VACUUM FULL users;

-- 重建索引
REINDEX INDEX idx_users_email;
REINDEX TABLE users;
```
