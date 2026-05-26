# Persist 插件

状态持久化插件，自动保存状态到 localStorage 并在初始化时恢复。

```typescript
import { Persist } from 'common-store';
```

## 使用

```typescript
store.use(Persist());
```

## 配置

```typescript
interface PersistOptions {
  key?: string;                             // 存储键名，默认 'common-store'
  storage?: Storage;                        // 存储后端，默认 localStorage
  paths?: string[];                         // 白名单路径，不传则保存全部
  serializer?: (value: unknown) => string;  // 自定义序列化，默认 JSON.stringify
  deserializer?: (raw: string) => unknown;  // 自定义反序列化，默认 JSON.parse
  debounce?: number;                        // 防抖间隔(ms)，默认 300
}
```

## 示例

```typescript
// 保存全部状态
store.use(Persist());

// 仅持久化部分路径
store.use(Persist({
  key: 'app-state',
  paths: ['user', 'preferences'],
}));

// 自定义存储
import { mmkv } from 'my-storage';
store.use(Persist({
  storage: mmkv,
  key: 'state',
  debounce: 500,
}));
```

## 行为说明

- **安装时**：从存储中读取数据并合并到 store
- **数据变更时**：防抖写入存储（默认 300ms）
- **白名单**：只保存/恢复指定的路径，其余路径不受影响
- **错误处理**：序列化/反序列化失败或存储配额超限时静默忽略
- **卸载后**：停止保存行为
