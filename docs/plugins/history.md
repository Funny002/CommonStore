# History 插件

提供 undo/redo 功能，基于 Immutable.js 的快照机制。

```typescript
import { History } from 'common-store';
```

## 使用

```typescript
store.use(History());

// 数据变更后自动记录快照
store.data.set('count', 1);
store.data.set('count', 2);

// 撤销
store.history?.undo();
store.history?.redo();
```

## 配置

```typescript
interface HistoryOptions {
  maxHistorySize?: number;  // 最大历史记录数，默认 50
}
```

## API

History 插件会在 Store 上注入 `history` 属性：

| 方法 | 说明 |
|------|------|
| `canUndo()` | 是否可以撤销 |
| `canRedo()` | 是否可以重做 |
| `undo()` | 撤销，返回是否成功 |
| `redo()` | 重做，返回是否成功 |
| `clear()` | 清空历史记录 |
| `getInfo()` | 获取历史信息 `{ stackSize, currentIndex, canUndo, canRedo }` |

## 通过 Action 使用

```typescript
await store.dispatch('history.undo');
await store.dispatch('history.redo');
await store.dispatch('history.clear');
```

## 示例

```typescript
store.use(History({ maxHistorySize: 20 }));

store.data.set('user.name', 'Bob');
store.data.set('user.age', 30);

store.history?.undo();  // user.name 恢复
store.history?.undo();  // user.age 恢复
store.history?.redo();  // user.age 恢复为 30

// 在中间状态进行新变更会截断后续历史
store.data.set('user.name', 'Charlie');
// 此时无法再 redo
```
