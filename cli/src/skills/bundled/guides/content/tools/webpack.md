# Webpack 5 配置最佳实践

## 核心概念
- Entry → Output → Loader → Plugin
- 模式：`development` / `production`
- Tree Shaking：ES Module 静态分析

## 性能优化
- **代码分割**：`splitChunks` 提取公共依赖
- **懒加载**：动态 `import()` 按需加载
- **缓存**：`contenthash` 文件名 + 长期缓存
- **压缩**：`TerserPlugin`（JS）+ `CssMinimizerPlugin`
- **图片**：`asset/resource` + WebP 转换

## 常用 Loader
- `babel-loader`：ES6+ 转译
- `ts-loader` / `esbuild-loader`：TypeScript
- `css-loader` + `style-loader`：CSS 处理
- `postcss-loader`：CSS 后处理
- `sass-loader`：SCSS 编译

## 常用 Plugin
- `HtmlWebpackPlugin`：生成 HTML
- `MiniCssExtractPlugin`：提取 CSS 文件
- `DefinePlugin`：环境变量注入
- `BundleAnalyzerPlugin`：包体积分析
- `ForkTsCheckerWebpackPlugin`：异步类型检查

## 代码示例

```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/index.tsx',
  output: {
    filename: '[name].[contenthash].js',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'esbuild-loader' },
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
      { test: /\.(png|jpg|gif)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
    new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' }),
  ],
  optimization: {
    splitChunks: { chunks: 'all' },
  },
}
```

## 常见问题
- 构建慢：用 `esbuild-loader` 替代 `babel-loader`
- 包太大：分析 bundle，按需引入库
- HMR 不工作：检查 `devServer.hot` 配置
