# SQL 优化最佳实践

## 索引策略
- 主键自动聚簇索引
- WHERE / JOIN / ORDER BY 列创建索引
- 复合索引：最左前缀原则
- 覆盖索引：包含查询所需所有列
- 避免过多索引（影响写入性能）

## 查询优化
- `EXPLAIN ANALYZE` 分析执行计划
- 避免 `SELECT *`（只查需要的列）
- 避免在 WHERE 中对列使用函数
- 使用 EXISTS 替代 IN（大数据集）
- LIMIT 限制返回行数

## 常见反模式
- N+1 查询：用 JOIN 或批量查询
- 隐式类型转换：确保类型匹配
- 前导通配符：`LIKE '%abc'` 无法使用索引
- 大表全表扫描：添加合适索引

## 代码示例

```sql
-- 好：使用索引
SELECT id, name FROM users WHERE email = 'user@example.com';

-- 好：覆盖索引
CREATE INDEX idx_users_email_name ON users(email, name);

-- 好：分页优化（大偏移量）
-- 差：SELECT * FROM orders LIMIT 10 OFFSET 100000;
-- 好：
SELECT * FROM orders WHERE id > 100000 ORDER BY id LIMIT 10;

-- 好：批量插入
INSERT INTO users (name, email) VALUES
  ('Alice', 'a@b.com'),
  ('Bob', 'c@d.com');
```

## 连接优化
- INNER JOIN vs LEFT JOIN：按需选择
- 连接条件列加索引
- 小表驱动大表
- 避免笛卡尔积

## 事务
- 保持事务短小
- 合理的隔离级别
- 避免长事务（锁竞争）
- 死锁检测与重试
