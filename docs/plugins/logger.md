# Logger 插件

记录 action 执行和数据变更的日志。

```typescript
import { Logger } from 'common-store';
```

## 使用

```typescript
store.use(Logger());
```

## 配置

```typescript
interface LoggerOptions {
  logActions?: boolean;       // 是否记录 action，默认 true
  logDataChanges?: boolean;   // 是否记录数据变更，默认 true
  logger?: Console;           // 自定义日志输出对象，默认 console
  showDuration?: boolean;     // 是否显示耗时，默认 true
}
```

## 示例

```typescript
// 默认配置
store.use(Logger());

// 自定义配置
store.use(Logger({
  logActions: true,
  logDataChanges: false,
  showDuration: false,
  logger: console,
}));
```

## 输出示例

```
⚡ Action: increment
  参数: [5]
  开始时间: 2026-05-26T10:00:00.000Z
  ✅ 完成
  ⚡ Action: increment
  参数: [5]
  返回值: 10
  ⏱️ 耗时: 2ms

📦 数据变更: count
  旧值: 5
  新值: 10
```
