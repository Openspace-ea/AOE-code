# Python 最佳实践

## 代码风格

### 1. 遵循 PEP 8

```python
# ✅ 好的做法
def calculate_total(price: float, quantity: int) -> float:
    """计算订单总价。"""
    return price * quantity

user_name = "alice"
is_active = True

# ❌ 不好的做法
def CalculateTotal(price,quantity):
    return price*quantity

userName = "alice"
isActive = True
```

### 2. 类型注解

```python
from typing import Optional, List, Dict

def greet(name: str, greeting: str = "Hello") -> str:
    """生成问候语。"""
    return f"{greeting}, {name}!"

def process_items(items: List[str]) -> Dict[str, int]:
    """处理项目列表并返回计数。"""
    result: Dict[str, int] = {}
    for item in items:
        result[item] = result.get(item, 0) + 1
    return result

# 可选类型
def find_user(user_id: int) -> Optional[dict]:
    """查找用户，可能返回 None。"""
    # ...
    return None
```

## 函数设计

### 1. 单一职责

```python
# ✅ 好的做法 - 每个函数只做一件事
def validate_email(email: str) -> bool:
    """验证邮箱格式。"""
    return "@" in email and "." in email.split("@")[1]

def send_welcome_email(email: str) -> None:
    """发送欢迎邮件。"""
    if not validate_email(email):
        raise ValueError(f"Invalid email: {email}")
    # 发送邮件的逻辑

# ❌ 不好的做法 - 一个函数做多件事
def process_user(email: str, name: str) -> bool:
    if "@" not in email:
        return False
    # 发送邮件
    # 创建用户
    # 记录日志
    return True
```

### 2. 使用装饰器

```python
import functools
import time
from typing import Callable, Any

def timer(func: Callable) -> Callable:
    """计时装饰器。"""
    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end - start:.2f} seconds")
        return result
    return wrapper

def retry(max_attempts: int = 3) -> Callable:
    """重试装饰器。"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    print(f"Attempt {attempt + 1} failed: {e}")
        return wrapper
    return decorator

# 使用
@timer
@retry(max_attempts=3)
def fetch_data(url: str) -> dict:
    """获取数据。"""
    # ...
    return {}
```

## 类设计

### 1. 数据类

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import List

@dataclass
class User:
    """用户数据类。"""
    id: int
    name: str
    email: str
    created_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)

    def full_name(self) -> str:
        """获取全名。"""
        return self.name.upper()

# 使用
user = User(id=1, name="Alice", email="alice@example.com")
print(user.full_name())  # ALICE
```

### 2. 抽象基类

```python
from abc import ABC, abstractmethod
from typing import List

class Shape(ABC):
    """形状抽象基类。"""

    @abstractmethod
    def area(self) -> float:
        """计算面积。"""
        pass

    @abstractmethod
    def perimeter(self) -> float:
        """计算周长。"""
        pass

class Circle(Shape):
    """圆形。"""

    def __init__(self, radius: float) -> None:
        self.radius = radius

    def area(self) -> float:
        return 3.14159 * self.radius ** 2

    def perimeter(self) -> float:
        return 2 * 3.14159 * self.radius

# shape = Shape()  # Error: 不能实例化抽象类
circle = Circle(5)
print(circle.area())  # 78.53975
```

## 异常处理

### 1. 自定义异常

```python
class AppError(Exception):
    """应用基础异常。"""

    def __init__(self, message: str, code: str = "UNKNOWN") -> None:
        super().__init__(message)
        self.code = code

class ValidationError(AppError):
    """验证错误。"""

    def __init__(self, message: str, field: str) -> None:
        super().__init__(message, code="VALIDATION_ERROR")
        self.field = field

class NotFoundError(AppError):
    """资源未找到。"""

    def __init__(self, resource: str, id: any) -> None:
        super().__init__(
            f"{resource} with id {id} not found",
            code="NOT_FOUND"
        )
```

### 2. 上下文管理器

```python
from contextlib import contextmanager
from typing import Generator, Any

@contextmanager
def database_connection() -> Generator:
    """数据库连接上下文管理器。"""
    conn = None
    try:
        conn = create_connection()
        yield conn
    except Exception as e:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

# 使用
with database_connection() as conn:
    conn.execute("SELECT * FROM users")
```

## 迭代器和生成器

### 1. 生成器

```python
from typing import Generator

def fibonacci() -> Generator[int, None, None]:
    """斐波那契数列生成器。"""
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# 使用
fib = fibonacci()
for _ in range(10):
    print(next(fib))  # 0, 1, 1, 2, 3, 5, 8, 13, 21, 34
```

### 2. 迭代器协议

```python
from typing import Iterator

class CountDown:
    """倒计时迭代器。"""

    def __init__(self, start: int) -> None:
        self.current = start

    def __iter__(self) -> Iterator[int]:
        return self

    def __next__(self) -> int:
        if self.current <= 0:
            raise StopIteration
        self.current -= 1
        return self.current + 1

# 使用
for num in CountDown(5):
    print(num)  # 5, 4, 3, 2, 1
```

## 模块组织

### 1. 包结构

```
mypackage/
├── __init__.py
├── models/
│   ├── __init__.py
│   ├── user.py
│   └── product.py
├── services/
│   ├── __init__.py
│   ├── auth.py
│   └── payment.py
├── utils/
│   ├── __init__.py
│   ├── validators.py
│   └── helpers.py
└── config.py
```

### 2. __init__.py 导出

```python
# mypackage/__init__.py
from .models.user import User
from .models.product import Product
from .services.auth import AuthService

__all__ = ["User", "Product", "AuthService"]
```

## 虚拟环境

### 1. 使用 venv

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Linux/Mac
source venv/bin/activate
# Windows
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 生成依赖
pip freeze > requirements.txt
```

### 2. 使用 poetry

```bash
# 安装 poetry
curl -sSL https://install.python-poetry.org | python3 -

# 初始化项目
poetry init

# 添加依赖
poetry add requests
poetry add --group dev pytest

# 安装依赖
poetry install

# 运行命令
poetry run python main.py
```

## 测试

### 1. pytest 基础

```python
# test_user.py
import pytest
from mypackage.models.user import User

class TestUser:
    def test_create_user(self) -> None:
        user = User(id=1, name="Alice", email="alice@example.com")
        assert user.name == "Alice"
        assert user.id == 1

    def test_user_full_name(self) -> None:
        user = User(id=1, name="Alice", email="alice@example.com")
        assert user.full_name() == "ALICE"

    def test_invalid_email(self) -> None:
        with pytest.raises(ValueError):
            User(id=1, name="Alice", email="invalid")
```

### 2. 参数化测试

```python
import pytest

@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("world", "WORLD"),
    ("Python", "PYTHON"),
])
def test_upper(input: str, expected: str) -> None:
    assert input.upper() == expected
```

## 常用标准库

### 1. pathlib - 路径操作

```python
from pathlib import Path

# 创建路径
project_dir = Path(__file__).parent.parent
config_file = project_dir / "config" / "settings.json"

# 读取文件
content = config_file.read_text()

# 遍历目录
for py_file in project_dir.glob("**/*.py"):
    print(py_file.name)
```

### 2. dataclasses - 数据类

```python
from dataclasses import dataclass
from typing import List

@dataclass(frozen=True)  # 不可变
class Point:
    x: float
    y: float

    def distance_to(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
```

### 3. typing - 类型提示

```python
from typing import Union, Optional, Callable, TypeVar, Generic

T = TypeVar("T")

class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: List[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()
```
