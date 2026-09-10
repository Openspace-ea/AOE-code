# 测试最佳实践

## 测试金字塔
- **单元测试**（多）：快速，隔离，覆盖核心逻辑
- **集成测试**（中）：验证模块交互
- **E2E 测试**（少）：验证完整流程

## 单元测试
```typescript
// Vitest / Jest
describe('UserService', () => {
  it('should create user with valid data', async () => {
    const repo = { save: vi.fn().mockResolvedValue({ id: 1 }) }
    const service = new UserService(repo)
    const user = await service.create({ name: 'Alice', email: 'a@b.com' })
    expect(user.id).toBe(1)
    expect(repo.save).toHaveBeenCalledOnce()
  })

  it('should throw on duplicate email', async () => {
    const repo = { save: vi.fn().mockRejectedValue(new DuplicateError()) }
    const service = new UserService(repo)
    await expect(service.create({ name: 'Alice', email: 'a@b.com' }))
      .rejects.toThrow(DuplicateError)
  })
})
```

## 集成测试
```python
# pytest
@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

def test_create_user(db):
    user = UserService(db).create("Alice", "a@b.com")
    assert user.name == "Alice"
    assert db.get(User, user.id) is not None
```

## E2E 测试
```typescript
// Playwright
test('user can login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', 'user@example.com')
  await page.fill('[name=password]', 'password')
  await page.click('button[type=submit]')
  await expect(page).toHaveURL('/dashboard')
})
```

## 测试策略
- TDD：先写测试，再写实现
- Mock 外部依赖（API、数据库）
- 快照测试：UI 组件回归
- 代码覆盖率：目标 80%+，关注关键路径

## 常见反模式
- 避免：测试实现细节（测行为，不测内部）
- 避免：过度 mock（失去集成测试价值）
- 避免：测试间依赖（每个测试独立）
- 避免：忽略边界条件
