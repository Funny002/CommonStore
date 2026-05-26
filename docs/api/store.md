# Store API

## Store

Store 是核心入口，整合 Data、Action、Plugin 三个模块，继承自 EventListener。

```typescript
import { Store } from 'common-store';

const store = new Store({ count: 0 });
```

### 方法

| 方法 | 说明 |
|------|------|
| `getState<T>(path?)` | 获取状态数据，不传 path 返回整个状态树 |
| `dispatch(name, ...args)` | 执行 action |
| `use(...plugins)` | 注册插件，支持链式调用 |
| `eject(...plugins)` | 移除插件，支持链式调用 |
| `reset(keepPaths?)` | 重置到初始状态，可指定保留路径 |
| `subscribe(path, callback)` | 订阅路径变化，返回取消函数 |
| `clear()` | 清空所有状态数据 |
| `clearListener()` | 清空所有事件监听器 |

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `data` | `DataManager` | 数据管理器 |
| `actions` | `ActionManager` | Action 管理器 |
| `plugins` | `PluginManager` | 插件管理器 |

```typescript
// getState
store.getState();                     // 整个状态树
store.getState('user.name');          // 嵌套路径
store.getState<number>('count');      // 泛型

// subscribe
const unsub = store.subscribe('user', (value, oldValue) => {
  console.log('user changed:', value);
});
unsub();

// reset
store.reset();               // 全部重置
store.reset(['session']);    // 保留 session
```

## DataManager

通过 `store.data` 访问，提供不可变数据操作。

### 基本操作

| 方法 | 说明 |
|------|------|
| `get<T>(path?)` | 获取数据（自动转换 JS 对象） |
| `getRaw(path?)` | 获取原始 Immutable 数据 |
| `set(path, value)` | 设置数据 |
| `delete(path)` | 删除数据，返回是否成功 |
| `update(path, updater)` | 基于旧值更新 |
| `merge(path, value)` | 深度合并对象 |
| `has(path)` | 检查路径是否存在 |
| `clear()` | 清空所有数据 |

```typescript
store.data.set('user.name', 'Alice');
store.data.update('count', (old) => (old as number) + 1);
store.data.merge('profile', { age: 25, city: 'NYC' });
store.data.has('user');           // true
store.data.delete('temp');        // 返回 boolean
```

### 数组操作

| 方法 | 说明 |
|------|------|
| `push(path, value)` | 尾部添加 |
| `pop(path)` | 尾部移除并返回 |
| `unshift(path, value)` | 头部添加 |
| `shift(path)` | 头部移除并返回 |
| `insert(path, index, value)` | 指定索引插入 |
| `remove(path, index)` | 指定索引移除 |

```typescript
store.data.set('list', [1, 2]);
store.data.push('list', 3);         // [1, 2, 3]
store.data.unshift('list', 0);      // [0, 1, 2, 3]
store.data.insert('list', 1, 99);   // [0, 99, 1, 2, 3]
store.data.pop('list');             // 3
store.data.shift('list');           // 0
store.data.remove('list', 1);       // 99
```

### 查询

| 方法 | 说明 |
|------|------|
| `find(predicate, convertToJs?)` | 查找第一个匹配节点 |
| `findAll(predicate, convertToJs?)` | 查找所有匹配节点 |

```typescript
store.data.find((value, key, path) => value?.role === 'admin', true);
store.data.findAll((v) => v?.age > 18, true);
```

### 批量操作

```typescript
store.data.batch(() => {
  store.data.set('a', 1);
  store.data.set('b', 2);
});
// 只触发一次 onDataChange
```

## ActionManager

通过 `store.actions` 访问。

| 方法 | 说明 |
|------|------|
| `register(name, handler)` | 注册 action，名称不可重复 |
| `unregister(name)` | 注销 action |
| `has(name)` | 检查是否已注册 |
| `getActionNames()` | 获取所有 action 名称 |
| `dispatch(name, ...args)` | 执行 action |

```typescript
// 同步 action
store.actions.register('set', (store, key, value) => {
  store.data.set(key, value);
});

// 异步 action
store.actions.register('fetch', async (store, url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  store.data.set('data', data);
  return data;
});

// 执行
await store.dispatch('set', 'name', 'Alice');
```

## PluginManager

通过 `store.plugins` 访问。

| 方法 | 说明 |
|------|------|
| `use(...plugins)` | 注册一个或多个插件 |
| `eject(name)` | 按名称卸载插件 |
| `uninstall(...plugins)` | 卸载插件数组 |
| `getPlugins()` | 获取所有已注册的插件列表 |

```typescript
store.use(pluginA, pluginB);
store.plugins.eject('pluginA');
store.plugins.getPlugins(); // [pluginB]
```

## 类型定义

| 类型 | 说明 |
|------|------|
| `Plugin<TStore>` | 插件接口 |
| `ActionHandler<TArgs, TReturn>` | Action 处理器类型 |
| `DataPath` | `(string \| number)[]` 数据路径 |
| `DataChangeCallback` | 变更回调 `(path, newValue, oldValue) => void` |
