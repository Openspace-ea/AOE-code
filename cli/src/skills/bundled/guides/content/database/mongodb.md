# MongoDB 最佳实践

## 连接管理

### 连接配置
```javascript
// Node.js - 使用 Mongoose
const mongoose = require('mongoose');

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,          // 最大连接数
  serverSelectionTimeoutMS: 5000,  // 服务器选择超时
  socketTimeoutMS: 45000,   // Socket 超时
  family: 4                 // 使用 IPv4
};

mongoose.connect('mongodb://localhost:27017/mydb', options);

// 使用原生驱动
const { MongoClient } = require('mongodb');

const client = new MongoClient('mongodb://localhost:27017', {
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 5000
});
```

### 连接池大小建议
- **小型应用**: 5-10 连接
- **中型应用**: 10-20 连接
- **大型应用**: 20-50 连接

## 数据建模

### 嵌入 vs 引用
```javascript
// 嵌入文档（适合一对一、一对少量关系）
const userSchema = new mongoose.Schema({
  name: String,
  address: {
    street: String,
    city: String,
    zip: String
  }
});

// 引用文档（适合一对多、多对多关系）
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number
  }]
});
```

### 设计原则
1. **频繁查询的数据嵌入在一起**
2. **数据量大的集合使用引用**
3. **避免过度嵌套（建议最多 3 层）**
4. **考虑文档大小限制（16MB）**

## 查询优化

### 索引策略
```javascript
// 创建索引
db.users.createIndex({ email: 1 });
db.users.createIndex({ status: 1, created_at: -1 });

// 复合索引
db.orders.createIndex({ userId: 1, status: 1, createdAt: -1 });

// 文本索引
db.articles.createIndex({ title: 'text', content: 'text' });

// 地理空间索引
db.places.createIndex({ location: '2dsphere' });

// TTL 索引（自动过期）
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });

// 部分索引
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { status: 'active' } }
);
```

### 查询优化技巧
```javascript
// ❌ 避免全表扫描
db.users.find({});

// ✅ 使用索引字段查询
db.users.find({ status: 'active' });

// ❌ 避免 $where（性能差）
db.users.find({ $where: 'this.age > 18' });

// ✅ 使用标准查询操作符
db.users.find({ age: { $gt: 18 } });

// ❌ 避免 $regex 以通配符开头
db.users.find({ name: /.*john/ });

// ✅ 使用前缀匹配
db.users.find({ name: /^john/ });

// ✅ 使用投影减少数据传输
db.users.find({}, { name: 1, email: 1 });
```

### EXPLAIN 分析
```javascript
// 分析查询执行计划
db.users.find({ status: 'active' }).explain('executionStats');

// 关注的字段：
// stage: COLLSCAN (全表扫描) → 需要索引
// stage: IXSCAN (索引扫描) → 良好
// totalDocsExamined: 扫描文档数越少越好
// executionTimeMillis: 执行时间
```

## 聚合管道

### 常用聚合操作
```javascript
// 基本聚合
db.orders.aggregate([
  { $match: { status: 'completed' } },
  { $group: {
    _id: '$userId',
    totalAmount: { $sum: '$amount' },
    orderCount: { $sum: 1 }
  }},
  { $sort: { totalAmount: -1 } },
  { $limit: 10 }
]);

// 关联查询
db.orders.aggregate([
  { $lookup: {
    from: 'users',
    localField: 'userId',
    foreignField: '_id',
    as: 'user'
  }},
  { $unwind: '$user' },
  { $project: {
    orderId: '$_id',
    userName: '$user.name',
    amount: 1
  }}
]);

// 分页
db.products.aggregate([
  { $skip: 20 },
  { $limit: 10 }
]);
```

### 聚合优化
```javascript
// ✅ 尽早过滤
db.orders.aggregate([
  { $match: { status: 'completed' } },  // 放在最前面
  { $group: { ... } }
]);

// ✅ 使用索引字段进行 $match 和 $sort
db.orders.aggregate([
  { $match: { userId: ObjectId('...') } },
  { $sort: { createdAt: -1 } }
]);

// ❌ 避免在聚合中使用 $where
db.users.aggregate([
  { $match: { $where: 'this.age > 18' } }
]);
```

## 事务处理

### 多文档事务
```javascript
async function transferMoney(fromId, toId, amount) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const fromAccount = await Account.findById(fromId).session(session);
    const toAccount = await Account.findById(toId).session(session);
    
    if (fromAccount.balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    fromAccount.balance -= amount;
    toAccount.balance += amount;
    
    await fromAccount.save({ session });
    await toAccount.save({ session });
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 事务最佳实践
```javascript
// 使用 withTransaction 辅助函数
async function runTransaction(operations) {
  const session = await client.startSession();
  
  try {
    await session.withTransaction(async () => {
      await operations(session);
    });
  } finally {
    await session.endSession();
  }
}
```

## 性能监控

### 性能指标
```javascript
// 查看数据库状态
db.stats();

// 查看集合状态
db.users.stats();

// 查看索引大小
db.users.stats().indexSizes;

// 查看当前操作
db.currentOp();

// 查看慢查询
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(10);
```

### 连接监控
```javascript
// 查看服务器状态
db.serverStatus();

// 查看连接数
db.serverStatus().connections;

// 查看当前操作
db.currentOp(true);
```

## 备份恢复

### 逻辑备份
```bash
# 备份单个数据库
mongodump --db mydb --out /backup/

# 备份所有数据库
mongodump --out /backup/

# 备份特定集合
mongodump --db mydb --collection users --out /backup/

# 压缩备份
mongodump --db mydb --gzip --out /backup/
```

### 物理备份
```bash
# 使用文件系统快照
# 1. 锁定写入
db.fsyncLock();

# 2. 创建快照

# 3. 解锁
db.fsyncUnlock();
```

### 恢复
```bash
# 恢复单个数据库
mongorestore --db mydb /backup/mydb/

# 恢复所有数据库
mongorestore /backup/

# 恢复特定集合
mongorestore --db mydb --collection users /backup/mydb/users.bson
```

## 安全最佳实践

### 用户权限
```javascript
// 创建用户
db.createUser({
  user: 'app_user',
  pwd: 'strong_password',
  roles: [
    { role: 'readWrite', db: 'mydb' }
  ]
});

// 创建只读用户
db.createUser({
  user: 'readonly_user',
  pwd: 'strong_password',
  roles: [
    { role: 'read', db: 'mydb' }
  ]
});

// 修改用户角色
db.updateUser('app_user', {
  roles: [
    { role: 'readWrite', db: 'mydb' },
    { role: 'read', db: 'other_db' }
  ]
});
```

### 认证配置
```yaml
# mongod.conf
security:
  authorization: enabled
  
net:
  bindIp: 127.0.0.1
  port: 27017
  ssl:
    mode: requireSSL
    PEMKeyFile: /etc/ssl/mongodb.pem
```

## 常见问题

### 数据库维护
```javascript
// 修复数据库
db.repairDatabase();

// 压缩集合
db.runCommand({ compact: 'users' });

// 重建索引
db.users.reIndex();
```

### 性能优化
```javascript
// 使用 explain 分析查询
db.users.find({ status: 'active' }).explain('executionStats');

// 查看慢查询
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(10);

// 禁用分析
db.setProfilingLevel(0);
```
