/**
 * Data 数据管理模块
 *
 * 基于 Immutable.js 的不可变数据层。
 * 支持嵌套路径读写、深度合并、数组操作、批量更新和树遍历查找。
 */
import { List, Map, fromJS, is } from 'immutable';

/**
 * 数据路径类型，支持字符串数组或数字索引
 */
export type DataPath = (string | number)[];

/**
 * 数据变更回调函数类型
 * @param path - 变更的路径
 * @param newValue - 新值
 * @param oldValue - 旧值
 */
export type DataChangeCallback = (path: string[], newValue: unknown, oldValue: unknown) => void;

/** Immutable.js Map 类型别名 */
type ImmutableData = Map<string, unknown>;

/**
 * 规范化路径，将字符串路径转换为数组格式
 * @param path - 路径，可以是字符串（用.分隔）或数组
 * @returns 标准化后的路径数组
 */
function normalizePath(path: string | DataPath): DataPath {
  if (Array.isArray(path)) return path;
  const segments = path.split('.');
  const filtered = segments.filter((segment) => segment.trim().length > 0);
  if (filtered.length !== segments.length) {
    throw new Error(`Invalid path "${path}": path contains empty segments.`);
  }
  return filtered;
}

/**
 * 将 Immutable 数据转换为普通 JavaScript 对象
 * @param value - 待转换的值
 * @returns 转换后的 JavaScript 值
 */
function toJS<T>(value: unknown): T {
  if (value && typeof (value as any).toJS === 'function') {
    return (value as any).toJS();
  }
  return value as T;
}

/**
 * 递归遍历 Immutable 数据结构
 * @param node - 当前节点
 * @param currentPath - 当前路径
 * @param visit - 访问函数，返回 true 时停止遍历
 * @returns 是否提前终止遍历
 */
function traverse(node: unknown, currentPath: string[], visit: (value: unknown, key: string, path: string[]) => boolean): boolean {
  if (Map.isMap(node)) {
    for (const [key, value] of (node as Map<string, unknown>).entries()) {
      const path = currentPath.concat(key);
      if (visit(value, key, path)) return true;
      if (traverse(value, path, visit)) return true;
    }
  } else if (List.isList(node)) {
    const list = node as List<unknown>;
    for (let idx = 0; idx < list.size; idx++) {
      const value = list.get(idx);
      const path = currentPath.concat(String(idx));
      if (visit(value, String(idx), path)) return true;
      if (traverse(value, path, visit)) return true;
    }
  }
  return false;
}

/**
 * 数据管理器类
 * 基于 Immutable.js 提供不可变数据操作和变更通知
 */
export class DataManager {
  /** 当前状态数据（Immutable Map） */
  private state: ImmutableData;
  /** 初始状态快照，用于 reset() 恢复 */
  private readonly initialState: ImmutableData;
  /** 数据变更回调函数 */
  private readonly onChange: DataChangeCallback;
  /** 批量操作嵌套深度计数，大于 0 时暂不通知 */
  private batchDepth = 0;

  /**
   * 构造函数
   * @param initialState - 初始状态数据
   * @param onChange - 数据变更回调函数
   */
  constructor(initialState: unknown = {}, onChange: DataChangeCallback) {
    this.initialState = fromJS(initialState) as ImmutableData;
    this.state = this.initialState;
    this.onChange = onChange;
  }

  /**
   * 获取指定路径的数据（转换为普通 JS 对象）
   * @param path - 数据路径，不传则返回整个状态树
   * @returns 指定路径的数据值
   */
  get<T = unknown>(path?: string | DataPath): T | undefined {
    if (!path) return toJS<T>(this.state);
    const keys = normalizePath(path);
    const value = this.state.getIn(keys);
    return value !== undefined ? toJS<T>(value) : undefined;
  }

  /**
   * 获取指定路径的原始 Immutable 数据
   * @param path - 数据路径，不传则返回整个状态树
   * @returns 原始 Immutable 数据
   */
  getRaw(path?: string | DataPath): unknown {
    if (path === undefined || path === null || path === '' || (Array.isArray(path) && path.length === 0)) return this.state;
    const keys = normalizePath(path);
    return this.state.getIn(keys);
  }

  /**
   * 检查指定路径是否存在
   * @param path - 数据路径
   * @returns 路径是否存在
   */
  has(path: string | DataPath): boolean {
    if (!path) return true;
    const keys = normalizePath(path);
    return this.state.hasIn(keys);
  }

  /**
   * 设置指定路径的值
   * @param path - 数据路径
   * @param value - 要设置的值
   * @returns 当前实例，支持链式调用
   */
  set(path: string | DataPath, value: unknown): this {
    return this.setInternal(normalizePath(path), value);
  }

  /**
   * 删除指定路径的数据
   * @param path - 数据路径
   * @returns 是否成功删除
   */
  delete(path: string | DataPath): boolean {
    const keys = normalizePath(path);
    if (!this.state.hasIn(keys)) return false;
    const oldValue = this.state.getIn(keys);
    this.state = this.state.deleteIn(keys);
    this.notify(keys, undefined, oldValue);
    return true;
  }

  /**
   * 更新指定路径的值
   * @param path - 数据路径
   * @param updater - 更新函数，接收旧值返回新值
   * @returns 当前实例，支持链式调用
   */
  update(path: string | DataPath, updater: (old: unknown) => unknown): this {
    const keys = normalizePath(path);
    const oldValue = this.state.getIn(keys);
    const newValue = updater(toJS(oldValue));
    return this.setInternal(keys, newValue);
  }

  /**
   * 合并指定路径的对象数据（深度合并）
   * @param path - 数据路径
   * @param value - 要合并的对象
   * @returns 当前实例，支持链式调用
   */
  merge(path: string | DataPath, value: Record<string, unknown>): this {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    const toMerge = fromJS(value) as ImmutableData;
    let newState: ImmutableData;
    if (Map.isMap(existing)) {
      newState = this.state.setIn(keys, existing.mergeDeep(toMerge));
    } else {
      newState = this.state.setIn(keys, toMerge);
    }
    if (is(newState, this.state)) return this;
    const oldValue = this.state.getIn(keys);
    this.state = newState;
    this.notify(keys, this.state.getIn(keys), oldValue);
    return this;
  }

  /**
   * 向指定路径的数组末尾添加元素
   * @param path - 数据路径
   * @param value - 要添加的值
   * @returns 当前实例，支持链式调用
   */
  push(path: string | DataPath, value: unknown): this {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    const newList = List.isList(existing) ? (existing as List<unknown>).push(fromJS(value)) : List([fromJS(value)]);
    const oldValue = this.state.getIn(keys);
    this.state = this.state.setIn(keys, newList);
    this.notify(keys, newList, oldValue);
    return this;
  }

  /**
   * 从指定路径的数组末尾移除并返回最后一个元素
   * @param path - 数据路径
   * @returns 被移除的元素，如果数组为空则返回 undefined
   */
  pop(path: string | DataPath): unknown {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    if (!List.isList(existing) || existing.size === 0) {
      return undefined;
    }
    const last = existing.last();
    const newList = existing.pop();
    this.state = this.state.setIn(keys, newList);
    this.notify(keys, newList, existing);
    return toJS(last);
  }

  /**
   * 向指定路径的数组头部添加元素
   * @param path - 数据路径
   * @param value - 要添加的值
   * @returns 当前实例，支持链式调用
   */
  unshift(path: string | DataPath, value: unknown): this {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    const newList = List.isList(existing) ? (existing as List<unknown>).unshift(fromJS(value)) : List([fromJS(value)]);
    const oldValue = this.state.getIn(keys);
    this.state = this.state.setIn(keys, newList);
    this.notify(keys, newList, oldValue);
    return this;
  }

  /**
   * 从指定路径的数组头部移除并返回第一个元素
   * @param path - 数据路径
   * @returns 被移除的元素，如果数组为空则返回 undefined
   */
  shift(path: string | DataPath): unknown {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    if (!List.isList(existing) || existing.size === 0) return undefined;
    const first = existing.first();
    const newList = existing.shift();
    this.state = this.state.setIn(keys, newList);
    this.notify(keys, newList, existing);
    return toJS(first);
  }

  /**
   * 向指定路径的数组指定索引插入元素
   * @param path - 数据路径
   * @param index - 插入位置的索引
   * @param value - 要插入的值
   * @returns 当前实例，支持链式调用
   */
  insert(path: string | DataPath, index: number, value: unknown): this {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    const newList = List.isList(existing) ? (existing as List<unknown>).insert(index, fromJS(value)) : List([fromJS(value)]);
    const oldValue = this.state.getIn(keys);
    this.state = this.state.setIn(keys, newList);
    this.notify(keys, newList, oldValue);
    return this;
  }

  /**
   * 从指定路径的数组中移除指定索引的元素
   * @param path - 数据路径
   * @param index - 要移除元素的索引
   * @returns 被移除的元素，如果索引无效则返回 undefined
   */
  remove(path: string | DataPath, index: number): unknown {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    if (!List.isList(existing) || index < 0 || index >= existing.size) return undefined;
    const removed = existing.get(index);
    const newList = existing.remove(index);
    this.state = this.state.setIn(keys, newList);
    this.notify(keys, newList, existing);
    return toJS(removed);
  }

  /**
   * 重置状态到初始值
   * @param keepPaths - 可选，要保留的路径列表（这些路径的值不会被重置）
   * @returns 当前实例，支持链式调用
   */
  reset(keepPaths?: string[]): this {
    const oldState = this.state;
    if (keepPaths && keepPaths.length > 0) {
      const keepValues: Array<{ keys: DataPath; value: unknown }> = [];
      for (const p of keepPaths) {
        const keys = normalizePath(p);
        if (this.state.hasIn(keys)) {
          keepValues.push({ keys, value: this.state.getIn(keys) });
        }
      }
      this.state = this.initialState.mergeDeep(fromJS({})) as ImmutableData;
      for (const { keys, value } of keepValues) {
        this.state = this.state.setIn(keys, value) as ImmutableData;
      }
    } else {
      this.state = this.initialState;
    }
    this.notify([], this.state, oldState);
    return this;
  }

  /**
   * 批量执行多个数据变更，所有变更结束后只触发一次通知
   * @param fn - 批量变更函数
   * @returns 当前实例，支持链式调用
   */
  batch(fn: () => void): this {
    const oldState = this.state;
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && !is(oldState, this.state)) {
        this.notify([], this.state, oldState);
      }
    }
    return this;
  }

  /**
   * 查找第一个符合条件的节点
   * @param predicate - 判断函数，接收值、键和路径
   * @param convertToJs - 是否将 Immutable 数据转换为普通 JS 对象
   * @returns 找到的第一个匹配值，未找到返回 null
   */
  find(predicate: (value: unknown, key: string, path: string[]) => boolean, convertToJs = false): unknown {
    let result: unknown = null;
    traverse(this.state, [], (value, key, path) => {
      const testValue = convertToJs ? toJS(value) : value;
      if (predicate(testValue, key, path)) {
        result = testValue;
        return true;
      }
      return false;
    });
    return result;
  }

  /**
   * 查找所有符合条件的节点
   * @param predicate - 判断函数，接收值、键和路径
   * @param convertToJs - 是否将 Immutable 数据转换为普通 JS 对象
   * @returns 所有匹配值的数组
   */
  findAll(predicate: (value: unknown, key: string, path: string[]) => boolean, convertToJs = false): unknown[] {
    const results: unknown[] = [];
    traverse(this.state, [], (value, key, path) => {
      const testValue = convertToJs ? toJS(value) : value;
      if (predicate(testValue, key, path)) {
        results.push(testValue);
      }
      return false;
    });
    return results;
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    const oldState = this.state;
    this.state = fromJS({}) as ImmutableData;
    this.notify([], this.state, oldState);
  }

  /**
   * 内部设置方法，支持可选的通知控制
   * @param keys - 路径数组
   * @param value - 要设置的值
   * @param notify - 是否触发变更通知，默认为 true
   * @returns 当前实例，支持链式调用
   */
  private setInternal(keys: DataPath, value: unknown, notify = true): this {
    const oldValue = this.state.getIn(keys);
    const newImmutable = fromJS(value);
    if (is(oldValue, newImmutable)) return this;

    this.state = this.state.setIn(keys, newImmutable);
    if (notify) {
      this.notify(keys, newImmutable, oldValue);
    }
    return this;
  }

  /**
   * 触发数据变更通知
   * @param keys - 变更的路径数组
   * @param newValue - 新值
   * @param oldValue - 旧值
   */
  private notify(keys: DataPath, newValue: unknown, oldValue: unknown): void {
    if (this.batchDepth > 0) return;
    const pathStrings = keys.map(String);
    this.onChange(pathStrings, newValue !== undefined ? toJS(newValue) : undefined, oldValue !== undefined ? toJS(oldValue) : undefined);
  }
}
