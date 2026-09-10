# MySQL 最佳实践

## 连接管理

### 连接池配置
```javascript
// Node.js - 使用连接池
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
  waitForConnections: true,
  connectionLimit: 10,      // 最大连接数
  queueLimit: 0,            // 队列限制（0 = 无限制）
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 使用连接
async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
```

### 连接池大小建议
- **小型应用**: 5-10 连接
- **中型应用**: 10-20 连接
- **大型应用**: 20-50 连接
- **公式**: 连接数 = (CPU 核心数 * 2) + 有效磁盘数

## 查询优化

### 索引策略
```sql
-- 创建复合索引（遵循最左前缀原则）
CREATE INDEX idx_user_status ON users(status, created_at);

-- 覆盖索引（包含查询所需的所有列）
CREATE INDEX idx_covering ON orders(user_id, status, total);

-- 避免过度索引
-- 每个索引都会增加写入开销
```

### 查询优化技巧
```sql
-- ❌ 避免 SELECT *
SELECT * FROM users WHERE id = 1;

-- ✅ 只选择需要的列
SELECT id, name, email FROM users WHERE id = 1;

-- ❌ 避免在 WHERE 子句中使用函数
SELECT * FROM users WHERE YEAR(created_at) = 2024;

-- ✅ 使用范围查询
SELECT * FROM users 
WHERE created_at >= '2024-01-01' 
AND created_at < '2025-01-01';

-- ❌ 避免 OR 条件（可能导致全表扫描）
SELECT * FROM users WHERE status = 'active' OR status = 'pending';

-- ✅ 使用 IN
SELECT * FROM users WHERE status IN ('active', 'pending');
```

### EXPLAIN 分析
```sql
-- 分析查询执行计划
EXPLAIN ANALYZE 
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
GROUP BY u.id;

-- 关注的字段：
-- type: ALL (全表扫描) → 需要优化
-- rows: 扫描行数越少越好
-- Extra: Using filesort, Using temporary → 需要优化
```

## 事务处理

### 事务隔离级别
```sql
-- 查看当前隔离级别
SELECT @@transaction_isolation;

-- 设置隔离级别
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 常用隔离级别：
-- READ UNCOMMITTED: 最低，可能脏读
-- READ COMMITTED: 避免脏读，可能不可重复读
-- REPEATABLE READ: 默认，避免不可重复读
-- SERIALIZABLE: 最高，避免幻读
```

### 事务最佳实践
```javascript
async function transferMoney(fromId, toId, amount) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 检查余额
    const [rows] = await connection.execute(
      'SELECT balance FROM accounts WHERE id = ? FOR UPDATE',
      [fromId]
    );
    
    if (rows[0].balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    // 扣款
    await connection.execute(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [amount, fromId]
    );
    
    // 入账
    await connection.execute(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [amount, toId]
    );
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

## 性能监控

### 慢查询日志
```sql
-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- 超过1秒的查询
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';

-- 查看慢查询统计
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;
```

### 性能指标
```sql
-- 查看连接状态
SHOW STATUS LIKE 'Threads%';

-- 查看查询缓存
SHOW STATUS LIKE 'Qcache%';

-- 查看 InnoDB 缓冲池
SHOW STATUS LIKE 'Innodb_buffer_pool%';

-- 查看表锁
SHOW STATUS LIKE 'Table_locks%';
```

## 备份恢复

### 逻辑备份
```bash
# 备份单个数据库
mysqldump -u root -p mydb > backup.sql

# 备份所有数据库
mysqldump -u root -p --all-databases > all_backup.sql

# 备份特定表
mysqldump -u root -p mydb users orders > tables_backup.sql

# 压缩备份
mysqldump -u root -p mydb | gzip > backup.sql.gz
```

### 物理备份
```bash
# 使用 XtraBackup（推荐）
xtrabackup --backup --target-dir=/backup/

# 恢复
xtrabackup --prepare --target-dir=/backup/
xtrabackup --copy-back --target-dir=/backup/
```

## 安全最佳实践

### 用户权限
```sql
-- 创建专用用户
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'strong_password';

-- 授予最小权限
GRANT SELECT, INSERT, UPDATE, DELETE ON mydb.* TO 'app_user'@'localhost';

-- 撤销权限
REVOKE ALL PRIVILEGES ON mydb.* FROM 'app_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;
```

### SQL 注入防护
```javascript
// ❌ 危险：字符串拼接
const sql = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ 安全：使用参数化查询
const sql = 'SELECT * FROM users WHERE id = ?';
const [rows] = await pool.execute(sql, [userId]);

// ✅ 安全：使用 ORM
const user = await User.findById(userId);
```

## 常见问题

### 死锁处理
```sql
-- 查看死锁信息
SHOW ENGINE INNODB STATUS;

-- 查看当前事务
SELECT * FROM information_schema.INNODB_TRX;

-- 杀死阻塞的进程
KILL <process_id>;
```

### 表优化
```sql
-- 优化表（回收碎片）
OPTIMIZE TABLE users;

-- 分析表（更新统计信息）
ANALYZE TABLE users;

-- 检查表
CHECK TABLE users;
```
