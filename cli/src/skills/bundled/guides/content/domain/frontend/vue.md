# Vue 3 最佳实践

## 组合式 API
- 使用 `<script setup>` 语法糖，更简洁
- 用 `ref` 处理基本类型，`reactive` 处理对象
- 用 `computed` 派生状态，`watch` / `watchEffect` 处理副作用
- 提取可复用逻辑到组合函数（composables）

## 组件设计
- 单文件组件（SFC）结构：`<script setup>` → `<template>` → `<style>`
- Props 用 `defineProps` + TypeScript 类型声明
- Emits 用 `defineEmits` 声明
- 使用 `v-bind="$attrs` 透传属性

## 状态管理
- 简单场景用 `ref` / `reactive` + provide/inject
- 中型项目用 Pinia（推荐替代 Vuex）
- Pinia store 按功能模块拆分

## 性能优化
- `v-once` / `v-memo` 减少不必要的更新
- `shallowRef` / `shallowReactive` 处理大型只读数据
- `defineAsyncComponent` 异步组件加载
- 列表渲染始终提供 `:key`

## 常见反模式
- 避免：在 `reactive` 中解构丢失响应性
- 避免：在 `watch` 中修改被监听的状态（死循环）
- 避免：过度使用 `toRefs` / `toRef`
- 避免：在模板中使用复杂表达式（提取为 computed）

## 代码示例

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Props {
  userId: string
  limit?: number
}

const props = withDefaults(defineProps<Props>(), { limit: 10 })
const emit = defineEmits<{
  select: [id: string]
}>()

const items = ref<Item[]>([])
const loading = ref(false)

const sortedItems = computed(() =>
  [...items.value].sort((a, b) => a.name.localeCompare(b.name))
)

onMounted(async () => {
  loading.value = true
  items.value = await fetchItems(props.userId, props.limit)
  loading.value = false
})
</script>
```

## Vue Router
- 使用 `createRouter` + `createWebHistory`
- 路由懒加载：`() => import('./views/Home.vue')`
- 导航守卫用 `beforeEach` 处理权限
- 命名路由和命名视图组织复杂布局
