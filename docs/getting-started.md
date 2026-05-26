# 快速开始

## 安装

```bash
npm install common-store
```

## 基础用法

```typescript
import { Store, Logger, History } from 'common-store';

// 创建 Store 实例
const store = new Store({
  count: 0,
  user: { name: 'Alice', age: 25 },
  todos: [],
});

// 读取状态
console.log(store.getState('count')); // 0
console.log(store.getState('user'));  // { name: 'Alice', age: 25 }
console.log(store.getState());        // 完整状态树

// 修改数据
store.data.set('count', 10);
store.data.set('user.name', 'Bob');
store.data.update('count', (old) => (old as number) + 5);
store.data.merge('user', { age: 26 });

// 数组操作
store.data.set('todos', ['Learn TypeScript']);
store.data.push('todos', 'Use CommonStore');
store.data.pop('todos');

// 删除数据
store.data.delete('user.age');

// 批量更新（一次通知）
store.data.batch(() => {
  store.data.set('count', 100);
  store.data.set('user.name', 'Charlie');
});

// 注册 Action
store.actions.register('addTodo', (store, text: string) => {
  const todos = store.getState<string[]>('todos') || [];
  store.data.set('todos', [...todos, text]);
  return store.getState('todos');
});

// 执行 Action
await store.dispatch('addTodo', 'Write docs');

// 订阅状态变化
const unsub = store.subscribe('count', (value, oldValue) => {
  console.log('count changed:', oldValue, '->', value);
});
store.data.set('count', 50);
unsub(); // 取消订阅

// 使用插件
store.use(Logger());
store.use(History());
```

## 完整示例

```typescript
import { Store, History } from 'common-store';

interface AppState {
  counter: number;
  entries: string[];
}

const store = new Store<AppState>({ counter: 0, entries: [] });
store.use(History());

store.actions.register('increment', async (s, step = 1) => {
  const current = s.getState<number>('counter') ?? 0;
  s.data.set('counter', current + step);
  s.data.push('entries', `Incremented by ${step}`);
  return s.getState('counter');
});

await store.dispatch('increment', 5);
console.log(store.getState('counter')); // 5

store.history?.undo();
console.log(store.getState('counter')); // 0
```
