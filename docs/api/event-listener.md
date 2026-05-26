# EventListener 事件系统

Store 继承自 EventListener，提供标准的事件发布/订阅机制。

```typescript
import { Store } from 'common-store';

const store = new Store();
```

## 方法

| 方法 | 说明 |
|------|------|
| `on(event, listener)` | 注册事件监听器 |
| `off(event, listener)` | 移除事件监听器 |
| `once(event, listener)` | 注册一次性监听器，触发后自动移除 |
| `emit(event, ...args)` | 触发事件 |
| `removeAll(event)` | 移除指定事件的所有监听器 |
| `clear()` | 清空所有事件监听器 |

## 示例

```typescript
// 注册监听器
const handler = (data: any) => {
  console.log('事件触发:', data);
};
store.on('customEvent', handler);

// 触发事件
store.emit('customEvent', { key: 'value' });

// 一次性监听器
store.once('init', () => {
  console.log('仅执行一次');
});

// 移除监听器
store.off('customEvent', handler);
store.removeAll('customEvent');  // 移除指定事件全部监听器
store.clear();                   // 清空所有

// 传递多个参数
store.on('update', (a, b, c) => console.log(a, b, c));
store.emit('update', 1, 2, 3);
```

## 类型定义

```typescript
type EventFunction = (...args: any[]) => void
```
