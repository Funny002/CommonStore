# 工具函数

```typescript
import { Utils } from 'common-store';
```

## 类型判断

| 函数 | 说明 |
|------|------|
| `getType(target, lower?)` | 获取类型字符串，如 `'object'`、`'array'` |
| `isObject(target)` | 是否为普通对象 |
| `isArray(target)` | 是否为数组 |
| `isString(target)` | 是否为字符串 |
| `isNumber(target)` | 是否为有限数字 (NaN/Infinity 返回 false) |
| `isFunction(target)` | 是否为函数（含 async function） |
| `isEmpty(target)` | 是否为空（空对象/空字符串/空数组） |

```typescript
Utils.getType({});            // 'object'
Utils.getType([], false);     // 'Array'
Utils.isObject({});           // true
Utils.isObject([]);           // false
Utils.isNumber(42);           // true
Utils.isNumber(NaN);          // false
Utils.isFunction(async () => {}); // true
Utils.isEmpty({});            // true
Utils.isEmpty('   ');         // true
Utils.isEmpty([1]);           // false
```

## 字符串工具

| 函数 | 说明 |
|------|------|
| `randomChar()` | 随机返回一个 `[A-Za-z0-9]` 字符 |
| `randomString(long)` | 生成指定长度随机字符串 |
| `generateId(format?, prefix?)` | 生成格式化 ID |

`generateId` 格式说明：
- `x` = 随机字母数字 `[A-Za-z0-9]`
- `y` = 随机数字 `[0-9]`
- `n` = 空字符

```typescript
Utils.randomString(10);         // "aB3xY7kL9p"
Utils.generateId();             // "aB3-xY7"
Utils.generateId('xxx-xxx', 'user'); // "user_aB3-xY7"
Utils.generateId('yyy-xxx');    // "123-aB3"
Utils.generateId('xyx-yxy');    // "a1b-c2d"
```

## 函数工具

| 函数 | 说明 |
|------|------|
| `debounce(fn, delay)` | 防抖，连续调用只执行最后一次 |
| `throttle(fn, delay)` | 节流，按固定间隔执行（leading-edge） |

```typescript
const save = Utils.debounce(() => console.log('saved'), 300);
save(); save(); save();  // 只执行最后一次

const onResize = Utils.throttle(() => console.log('resize'), 100);
window.addEventListener('resize', onResize); // 每 100ms 最多一次
```
