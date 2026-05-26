# Common Store

<p>
  <a href="https://www.npmjs.com/package/common-store"><img src="https://img.shields.io/badge/npm-v0.0.1-blue" alt="npm version"></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6" alt="TypeScript">
</p>

基于 Immutable.js 的状态管理库，通过 Data、Action、Plugin 三模块分离实现完整的状态管理器。

采用 **模块化 + 插件化** 架构：数据存储、逻辑处理、功能扩展各司其职，通过一致的插件接口实现 Logger、History undo/redo、Persist 持久化等功能的热插拔。

## 特性

| 特性 | 说明 |
|------|------|
| **不可变数据** | 基于 Immutable.js `Map` / `List`，引用比对零成本 |
| **插件架构** | 6 个生命周期钩子拦截 action 执行与数据变更 |
| **模块设计** | Data / Action / Plugin 职责分离，可独立测试 |
| **批量更新** | `batch()` 合并多次变更为一次通知 |
| **路径订阅** | `subscribe(path, cb)` 精确监听任意路径变化 |
| **内置插件** | History (undo/redo), Logger, Persist |
| **类型安全** | 完整 TypeScript 泛型，编译期捕获类型错误 |
| **零外部依赖** | 仅依赖 `immutable` 一个运行时包 |

## 安装

```bash
npm install common-store
```

## 快速示例

```typescript
import { Store, Logger, History } from 'common-store';

// 创建 Store
const store = new Store({ count: 0, user: { name: 'Alice' } });

// 修改数据
store.data.set('count', 10);
store.data.update('user.name', () => 'Bob');

// 注册并执行 Action
store.actions.register('increment', (s, step = 1) => {
  const cur = s.getState<number>('count') ?? 0;
  s.data.set('count', cur + step);
  return s.getState('count');
});
await store.dispatch('increment', 5); // count: 15

// 订阅特定路径
store.subscribe('count', (val, old) => console.log(`count: ${old} -> ${val}`));

// 使用插件
store.use(Logger());   // 控制台日志
store.use(History());  // undo/redo 支持
```

## 核心概念

### Data — 数据存储

基于 Immutable.js 的不可变数据层，支持嵌套路径读写、深度合并、数组操作和批量更新。

```typescript
store.data.set('user.addresses[0].city', 'Beijing');
store.data.merge('user', { age: 26 });
store.data.batch(() => { /* 多个变更，一次通知 */ });
```

### Action — 数据处理

注册命名的处理函数，封装业务逻辑。支持同步/异步，通过插件系统可拦截执行全过程。

```typescript
store.actions.register('fetchUser', async (s, id: string) => {
  const res = await fetch(`/api/users/${id}`);
  s.data.set('user', await res.json());
});
```

### Plugin — 功能扩展

通过 6 个生命周期钩子实现中间件、日志、持久化等功能的热插拔。

```typescript
store.use(Logger({ logActions: true }));
store.use(Persist({ key: 'my-app', paths: ['user'] }));
```

## 插件钩子

| 钩子 | 触发时机 | 可修改 |
|------|----------|--------|
| `install` | 插件注册 | — |
| `uninstall` | 插件卸载 | — |
| `beforeAction` | action 执行前 | 参数 |
| `afterAction` | action 成功后 | — |
| `onError` | action 异常时 | — |
| `onDataChange` | 数据变更时 | — |

插件可声明依赖关系，PluginManager 自动拓扑排序：

```typescript
const pluginA: Plugin = { name: 'A' };
const pluginB: Plugin = { name: 'B', dependencies: ['A'] };
store.use(pluginA, pluginB); // A 的钩子先于 B 执行
```

## 文档导航

### 入门
- [快速开始](docs/getting-started.md) — 安装与基础使用

### API 参考
- [Store / DataManager / ActionManager / PluginManager](docs/api/store.md)
- [EventListener 事件系统](docs/api/event-listener.md)
- [工具函数](docs/api/utils.md)

### 内置插件
- [Logger 插件](docs/plugins/logger.md) — Action 和数据变更日志
- [History 插件](docs/plugins/history.md) — Undo/Redo
- [Persist 插件](docs/plugins/persist.md) — 状态持久化


---

MIT License © 2026
