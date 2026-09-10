# 单元测试最佳实践

## 测试原则

### FIRST 原则
- **Fast**: 测试应该快速执行
- **Independent**: 测试应该相互独立
- **Repeatable**: 测试应该可重复
- **Self-Validating**: 测试应该自动验证结果
- **Timely**: 测试应该及时编写

### AAA 模式
```javascript
test('should calculate total correctly', () => {
  // Arrange - 准备测试数据
  const items = [
    { price: 10, quantity: 2 },
    { price: 20, quantity: 1 }
  ];
  
  // Act - 执行被测试的功能
  const total = calculateTotal(items);
  
  // Assert - 验证结果
  expect(total).toBe(40);
});
```

## JavaScript/TypeScript 测试

### Jest 配置
```json
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
```

### 基本测试
```typescript
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

// math.test.ts
import { add, divide } from './math';

describe('Math functions', () => {
  describe('add', () => {
    test('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });
    
    test('should add negative numbers', () => {
      expect(add(-2, -3)).toBe(-5);
    });
    
    test('should add zero', () => {
      expect(add(5, 0)).toBe(5);
    });
  });
  
  describe('divide', () => {
    test('should divide two numbers', () => {
      expect(divide(10, 2)).toBe(5);
    });
    
    test('should throw error for division by zero', () => {
      expect(() => divide(10, 0)).toThrow('Division by zero');
    });
  });
});
```

### 异步测试
```typescript
// async.test.ts
describe('Async operations', () => {
  test('should fetch user data', async () => {
    const user = await fetchUser(1);
    expect(user).toEqual({
      id: 1,
      name: 'John Doe'
    });
  });
  
  test('should handle fetch error', async () => {
    await expect(fetchUser(999)).rejects.toThrow('User not found');
  });
  
  test('should fetch with callback', (done) => {
    fetchUser(1, (user) => {
      expect(user.name).toBe('John Doe');
      done();
    });
  });
});
```

### Mock 和 Stub
```typescript
// mock.test.ts
describe('Mock functions', () => {
  test('should mock function', () => {
    const mockFn = jest.fn();
    mockFn.mockReturnValue(42);
    
    expect(mockFn()).toBe(42);
    expect(mockFn).toHaveBeenCalled();
  });
  
  test('should mock module', () => {
    jest.mock('./api');
    const api = require('./api');
    api.fetchUser.mockResolvedValue({ id: 1, name: 'John' });
    
    return expect(getUser(1)).resolves.toEqual({ id: 1, name: 'John' });
  });
  
  test('should spy on method', () => {
    const spy = jest.spyOn(console, 'log');
    console.log('test');
    
    expect(spy).toHaveBeenCalledWith('test');
    spy.mockRestore();
  });
});
```

## Python 测试

### pytest 配置
```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --cov=src --cov-report=html
```

### 基本测试
```python
# test_math.py
import pytest
from math import add, divide

class TestAdd:
    def test_add_positive_numbers(self):
        assert add(2, 3) == 5
    
    def test_add_negative_numbers(self):
        assert add(-2, -3) == -5
    
    def test_add_zero(self):
        assert add(5, 0) == 5

class TestDivide:
    def test_divide_numbers(self):
        assert divide(10, 2) == 5
    
    def test_divide_by_zero(self):
        with pytest.raises(ValueError, match="Division by zero"):
            divide(10, 0)
```

### Fixtures
```python
# conftest.py
import pytest
from database import Database

@pytest.fixture
def db():
    """创建测试数据库连接"""
    database = Database(':memory:')
    yield database
    database.close()

@pytest.fixture
def sample_user(db):
    """创建测试用户"""
    user = db.create_user(name='John', email='john@example.com')
    return user

# test_user.py
def test_create_user(db, sample_user):
    assert sample_user.name == 'John'
    assert sample_user.email == 'john@example.com'

def test_find_user(db, sample_user):
    user = db.find_user(sample_user.id)
    assert user is not None
```

### Mock
```python
# test_api.py
from unittest.mock import patch, MagicMock

@patch('api.requests.get')
def test_fetch_user(mock_get):
    mock_get.return_value = MagicMock(
        status_code=200,
        json=lambda: {'id': 1, 'name': 'John'}
    )
    
    user = fetch_user(1)
    assert user['name'] == 'John'
    mock_get.assert_called_once_with('http://api.example.com/users/1')
```

## 测试覆盖率

### 覆盖率指标
- **行覆盖率**: 执行的代码行百分比
- **分支覆盖率**: 执行的分支百分比
- **函数覆盖率**: 调用的函数百分比
- **语句覆盖率**: 执行的语句百分比

### 覆盖率配置
```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 覆盖率报告
```bash
# 生成覆盖率报告
npm test -- --coverage

# 查看 HTML 报告
open coverage/index.html
```

## 测试命名规范

### 命名模式
```javascript
// 模式: should [预期行为] when [条件]
test('should return user when valid id is provided', () => {});
test('should throw error when user not found', () => {});
test('should return empty array when no users exist', () => {});

// 或者: [被测试功能] should [行为]
test('getUser should return user data', () => {});
test('getUser should throw for invalid id', () => {});
```

### 测试组织
```javascript
describe('UserService', () => {
  describe('getUser', () => {
    test('should return user by id', () => {});
    test('should throw for invalid id', () => {});
    test('should return null for non-existent user', () => {});
  });
  
  describe('createUser', () => {
    test('should create user with valid data', () => {});
    test('should throw for duplicate email', () => {});
    test('should validate required fields', () => {});
  });
});
```

## 测试工具

### 常用断言
```javascript
// 相等性
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toStrictEqual(expected);

// 比较
expect(value).toBeGreaterThan(5);
expect(value).toBeGreaterThanOrEqual(5);
expect(value).toBeLessThan(10);
expect(value).toBeLessThanOrEqual(10);

// 匹配
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');
expect(array).toContain(item);

// 类型
expect(value).toBeInstanceOf(Array);
expect(value).toBeInstanceOf(Object);

// 真假
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();
```

### 测试工具库
```javascript
// faker.js - 生成假数据
const { faker } = require('@faker-js/faker');

const user = {
  name: faker.person.fullName(),
  email: faker.internet.email(),
  phone: faker.phone.number()
};

// supertest - HTTP 测试
const request = require('supertest');
const app = require('./app');

describe('API', () => {
  test('GET /users', async () => {
    const response = await request(app)
      .get('/users')
      .expect(200);
    
    expect(response.body).toBeInstanceOf(Array);
  });
});
```

## 常见问题

### 测试隔离
```javascript
// 每个测试前重置状态
beforeEach(() => {
  // 清理数据库
  // 重置 mocks
  // 清理文件系统
});

// 每个测试后清理
afterEach(() => {
  jest.restoreAllMocks();
});
```

### 异步测试
```javascript
// 使用 async/await
test('async test', async () => {
  const result = await asyncFunction();
  expect(result).toBe('value');
});

// 使用 Promise
test('promise test', () => {
  return asyncFunction().then(result => {
    expect(result).toBe('value');
  });
});

// 使用 done 回调
test('callback test', (done) => {
  asyncFunction((result) => {
    expect(result).toBe('value');
    done();
  });
});
```

### 性能测试
```javascript
test('should process large dataset quickly', () => {
  const largeArray = Array.from({ length: 1000000 }, (_, i) => i);
  
  const start = Date.now();
  const result = processArray(largeArray);
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(1000); // 应该在1秒内完成
  expect(result).toBeDefined();
});
```
