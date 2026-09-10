# Svelte 最佳实践

## Svelte 5 Runes
- 使用 `$state` 替代 `let` 声明响应式变量
- 使用 `$derived` 替代 `$:` 计算派生值
- 使用 `$effect` 替代 `$:` 副作用
- 使用 `$props` 声明组件属性

## 组件设计
- 单文件组件：`<script>` → `<template>` → `<style>`
- 使用 `$bindable` 实现双向绑定
- Snippet 替代 slot（Svelte 5）
- 保持组件小而专注

## 状态管理
- 简单场景用 `$state` + 模块级共享
- 中型项目用 Svelte stores（`writable` / `readable`）
- 跨组件状态用 `$state` + 导出的 getter/setter

## 性能优化
- Svelte 编译时优化，运行时开销极小
- `{#key}` 块强制重新创建元素
- `transition:` 指令实现声明式动画
- 懒加载组件：动态 `import()`

## 常见反模式
- 避免：在 `$effect` 中修改被追踪的状态（死循环）
- 避免：过度使用 `$effect`（优先用 `$derived`）
- 避免：在循环中使用 index 作为 key（用唯一 ID）

## 代码示例

```svelte
<script>
  let { items = [], onSelect } = $props()

  let filter = $state('')
  let filtered = $derived(
    items.filter(item => item.name.includes(filter))
  )

  $effect(() => {
    console.log(`Filtered to ${filtered.length} items`)
  })
</script>

<input bind:value={filter} placeholder="Filter..." />

{#each filtered as item (item.id)}
  <button onclick={() => onSelect(item)}>
    {item.name}
  </button>
{/each}
```

## SvelteKit
- 文件系统路由：`+page.svelte` / `+layout.svelte`
- 服务端加载：`+page.server.ts` 的 `load` 函数
- Form Actions 处理表单提交
- 使用 `$page` store 访问路由信息
