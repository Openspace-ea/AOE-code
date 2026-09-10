# Python 数据科学与机器学习

## 数据处理
- **Pandas**：DataFrame 操作，数据清洗与转换
  - `read_csv()` / `read_parquet()` 读取数据
  - `groupby()` + `agg()` 分组聚合
  - `merge()` / `join()` 数据合并
  - `apply()` / `map()` 自定义转换
- **Polars**：高性能替代，Rust 实现
  - 惰性执行：`df.lazy().filter(...).collect()`
  - 多线程并行，内存效率高

## 数值计算
- **NumPy**：数组运算基础
  - 向量化操作替代循环
  - 广播机制处理不同形状数组
  - `np.where` 条件选择
- **SciPy**：科学计算，优化，统计

## 机器学习
- **scikit-learn**：传统 ML
  - Pipeline：`Pipeline([('scaler', StandardScaler()), ('model', SVC())])`
  - 交叉验证：`cross_val_score()`
  - 超参搜索：`GridSearchCV` / `RandomizedSearchCV`
- **XGBoost / LightGBM**：梯度提升
- **PyTorch**：深度学习
  - `DataLoader` + `Dataset` 数据管道
  - `torch.compile()` 编译优化（PyTorch 2.0+）

## 代码示例

```python
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score

# 数据处理
df = pd.read_csv('data.csv')
df = df.dropna(subset=['target'])
X = df.drop('target', axis=1)
y = df['target']

# ML Pipeline
pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('model', RandomForestClassifier(n_estimators=100)),
])

scores = cross_val_score(pipeline, X, y, cv=5, scoring='accuracy')
print(f"Accuracy: {scores.mean():.3f} (+/- {scores.std():.3f})")
```

## 最佳实践
- 数据版本管理：DVC / LakeFS
- 实验跟踪：MLflow / Weights & Biases
- 模型部署：ONNX Runtime / TorchServe
- 特征工程：Featuretools / category_encoders
