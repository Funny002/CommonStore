import { isObject, getIn } from '../utils';
import { produce } from 'immer';

/** 数据路径类型 — 支持字符串索引或数字索引 */
export type DataPath = (string | number)[];

/** 数据变更回调函数 */
export type DataChangeCallback = (path: string[], newValue: unknown, oldValue: unknown) => void;

// ── 内部路径工具 ──

function isRootPath(path?: string | DataPath): boolean {
  return path === undefined || path === null || path === '' || (Array.isArray(path) && path.length === 0);
}

function normalizePath(path: string | DataPath): DataPath {
  if (Array.isArray(path)) return path;
  const segments = path.split('.');
  if (segments.some((s) => s.trim().length === 0)) {
    throw new Error(`Invalid path "${path}": path contains empty segments.`);
  }
  return segments;
}

function walkDraft(draft: Record<string, unknown>, keys: (string | number)[], create: boolean): Record<string, unknown> | null {
  let current: Record<string, unknown> = draft;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = String(keys[i]);
    let next = current[key];
    if (next === undefined || next === null || typeof next !== 'object') {
      if (!create) return null;
      next = typeof keys[i + 1] === 'number' ? [] : {};
      current[key] = next;
    }
    current = next as Record<string, unknown>;
  }
  return current;
}

function setInDraft(draft: Record<string, unknown>, keys: (string | number)[], value: unknown): void {
  if (keys.length === 0) {
    Object.keys(draft).forEach((k) => delete draft[k]);
    Object.assign(draft, value as Record<string, unknown>);
    return;
  }
  walkDraft(draft, keys, true)![String(keys[keys.length - 1])] = value;
}

function delInDraft(draft: Record<string, unknown>, keys: (string | number)[]): void {
  if (keys.length === 0) {
    Object.keys(draft).forEach((k) => delete draft[k]);
    return;
  }
  const leaf = walkDraft(draft, keys, false);
  if (leaf) delete leaf[String(keys[keys.length - 1])];
}

function hasIn(obj: unknown, keys: (string | number)[]): boolean {
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return false;
    if (typeof key === 'number' && Array.isArray(current)) {
      if (key < 0 || key >= (current as unknown[]).length) return false;
      current = (current as unknown[])[key];
    } else if (typeof current === 'object') {
      if (!Object.prototype.hasOwnProperty.call(current, String(key))) return false;
      current = (current as Record<string, unknown>)[String(key)];
    } else {
      return false;
    }
  }
  return true;
}

function deepMergeObj(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (isObject(sv) && isObject(tv)) {
      result[key] = deepMergeObj(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

function traverse(node: unknown, currentPath: string[], visit: (value: unknown, key: string, path: string[]) => boolean): boolean {
  if (isObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      const path = currentPath.concat(key);
      if (visit(value, key, path)) return true;
      if (traverse(value, path, visit)) return true;
    }
  } else if (Array.isArray(node)) {
    for (let idx = 0; idx < node.length; idx++) {
      const value = node[idx];
      const path = currentPath.concat(String(idx));
      if (visit(value, String(idx), path)) return true;
      if (traverse(value, path, visit)) return true;
    }
  }
  return false;
}

// ── DataManager ──

/**
 * 数据管理器
 *
 * 基于 Immer 的不可变状态树，提供路径级 CRUD、数组操作、
 * 批量更新、树遍历查找和重置功能。
 *
 * @example
 * const dm = new DataManager({ count: 0 }, (path, nv) => console.log(path, nv));
 * dm.set('user.name', 'Alice');
 * dm.push('items', 42);
 * const val = dm.get<number>('count');
 */
export class DataManager {
  private state: Record<string, unknown>;
  private readonly initialState: Record<string, unknown>;
  private readonly onChange: DataChangeCallback;
  private batchDepth = 0;

  /**
   * @param initialState - 初始状态数据，默认 {}
   * @param onChange - 数据变更时的回调
   */
  constructor(initialState: unknown = {}, onChange: DataChangeCallback) {
    this.initialState = produce(initialState ?? {}, () => {}) as Record<string, unknown>;
    this.state = this.initialState;
    this.onChange = onChange;
  }

  // ── 读取 ──

  /**
   * 获取指定路径的数据
   * @param path - 路径，不传返回整个状态树
   */
  get<T = unknown>(path?: string | DataPath): T | undefined {
    if (isRootPath(path)) return this.state as T;
    const keys = normalizePath(path as string | DataPath);
    return getIn(this.state, keys) as T | undefined;
  }

  /**
   * 获取指定路径的原始数据（不经过任何转换）
   * @param path - 路径，不传返回整个状态树
   */
  getRaw(path?: string | DataPath): unknown {
    return this.get(path);
  }

  /**
   * 检查指定路径是否存在
   */
  has(path: string | DataPath): boolean {
    if (isRootPath(path)) return true;
    return hasIn(this.state, normalizePath(path));
  }

  // ── 写操作 ──

  /**
   * 设置指定路径的值
   * @returns 当前实例，支持链式调用
   */
  set(path: string | DataPath, value: unknown): this {
    return this.setInternal(normalizePath(path), value);
  }

  /**
   * 删除指定路径的数据
   * @returns 是否成功删除
   */
  delete(path: string | DataPath): boolean {
    const keys = normalizePath(path);
    if (!hasIn(this.state, keys)) return false;
    const oldValue = getIn(this.state, keys);
    this.state = produce(this.state, (draft) => {
      delInDraft(draft as Record<string, unknown>, keys);
    });
    this.notify(keys, oldValue);
    return true;
  }

  /**
   * 基于旧值更新指定路径
   * @param updater - 接收旧值，返回新值
   * @returns 当前实例
   */
  update(path: string | DataPath, updater: (old: unknown) => unknown): this {
    const keys = normalizePath(path);
    return this.setInternal(keys, updater(getIn(this.state, keys)));
  }

  /**
   * 深度合并对象到指定路径
   * @param value - 要合并的对象
   * @returns 当前实例
   */
  merge(path: string | DataPath, value: Record<string, unknown>): this {
    const keys = normalizePath(path);
    const existing = getIn(this.state, keys);
    const merged = isObject(existing) ? deepMergeObj(existing as Record<string, unknown>, value) : value;
    return this.setInternal(keys, merged);
  }

  // ── 数组操作 ──

  /**
   * 向数组末尾追加元素，路径不存在时自动创建空数组
   * @throws 当目标不是数组时抛出 TypeError
   */
  push(path: string | DataPath, value: unknown): this {
    return this.arrayMutate(path, (arr) => [...arr, value]);
  }

  /**
   * 移除并返回数组最后一个元素
   * @returns 被移除的元素，数组为空或非数组时返回 undefined
   */
  pop(path: string | DataPath): unknown {
    return this.arrayExtract(path, (arr) => ({
      newArr: arr.slice(0, -1),
      result: arr[arr.length - 1],
    }));
  }

  /**
   * 向数组头部插入元素，路径不存在时自动创建空数组
   * @throws 当目标不是数组时抛出 TypeError
   */
  unshift(path: string | DataPath, value: unknown): this {
    return this.arrayMutate(path, (arr) => [value, ...arr]);
  }

  /**
   * 移除并返回数组第一个元素
   * @returns 被移除的元素，数组为空或非数组时返回 undefined
   */
  shift(path: string | DataPath): unknown {
    return this.arrayExtract(path, (arr) => ({
      newArr: arr.slice(1),
      result: arr[0],
    }));
  }

  /**
   * 在数组指定索引处插入元素，路径不存在时自动创建空数组
   * @throws 当目标不是数组时抛出 TypeError
   */
  insert(path: string | DataPath, index: number, value: unknown): this {
    return this.arrayMutate(path, (arr) => [...arr.slice(0, index), value, ...arr.slice(index)]);
  }

  /**
   * 移除并返回数组指定索引的元素
   * @returns 被移除的元素，索引无效或非数组时返回 undefined
   */
  remove(path: string | DataPath, index: number): unknown {
    return this.arrayExtract(path, (arr) => {
      if (index < 0 || index >= arr.length) return { newArr: arr, result: undefined };
      return {
        newArr: [...arr.slice(0, index), ...arr.slice(index + 1)],
        result: arr[index],
      };
    });
  }

  // ── 批量 / 重置 / 清理 ──

  /**
   * 重置状态到初始值
   * @param keepPaths - 可选，重置时保留的路径列表
   * @returns 当前实例
   */
  reset(keepPaths?: string[]): this {
    const oldState = this.state;
    if (keepPaths?.length) {
      this.state = produce(this.initialState, (draft) => {
        for (const p of keepPaths) {
          const keys = normalizePath(p);
          if (hasIn(oldState, keys)) {
            setInDraft(draft as Record<string, unknown>, keys, getIn(oldState, keys));
          }
        }
      });
    } else {
      this.state = this.initialState;
    }
    this.notify([], oldState);
    return this;
  }

  /**
   * 批量执行多个数据变更，仅触发一次通知
   *
   * 支持嵌套 batch 调用，仅最外层结束时触发通知。
   *
   * @param fn - 包含变更操作的函数
   * @returns fn 的返回值
   *
   * @example
   * const result = dm.batch(() => {
   *   dm.set('a', 1);
   *   dm.set('b', 2);
   *   return dm.get('b');
   * });
   */
  batch<T>(fn: () => T): T {
    const oldState = this.state;
    this.batchDepth++;
    try {
      return fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.state !== oldState) {
        this.notify([], oldState);
      }
    }
  }

  /**
   * 清空所有状态数据
   */
  clear(): void {
    const oldState = this.state;
    this.state = produce({}, () => {}) as Record<string, unknown>;
    this.notify([], oldState);
  }

  // ── 遍历查找 ──

  /**
   * 查找第一个满足条件的节点
   * @param predicate - 判断函数，接收 (value, key, path)
   * @returns 匹配的值，未找到返回 null
   */
  find(predicate: (value: unknown, key: string, path: string[]) => boolean): unknown {
    let result: unknown = null;
    traverse(this.state, [], (value, key, path) => {
      if (predicate(value, key, path)) {
        result = value;
        return true;
      }
      return false;
    });
    return result;
  }

  /**
   * 查找所有满足条件的节点
   * @param predicate - 判断函数，接收 (value, key, path)
   * @returns 所有匹配值的数组
   */
  findAll(predicate: (value: unknown, key: string, path: string[]) => boolean): unknown[] {
    const results: unknown[] = [];
    traverse(this.state, [], (value, key, path) => {
      if (predicate(value, key, path)) results.push(value);
      return false;
    });
    return results;
  }

  // ── 私有方法 ──

  /**
   * 数组写操作统一入口：不存在时自动创建空数组，存在非数组时抛出
   */
  private arrayMutate(path: string | DataPath, fn: (arr: unknown[]) => unknown[]): this {
    const keys = normalizePath(path);
    const existing = getIn(this.state, keys);
    if (existing !== undefined && !Array.isArray(existing)) {
      throw new TypeError(`Cannot perform array operation on a non-array value at "${keys.join('.')}"`);
    }
    const arr = Array.isArray(existing) ? (existing as unknown[]) : [];
    this.state = produce(this.state, (draft) => {
      setInDraft(draft as Record<string, unknown>, keys, fn(arr));
    });
    this.notify(keys, existing);
    return this;
  }

  /**
   * 数组读写操作统一入口：返回操作结果，无效时返回 undefined
   */
  private arrayExtract(path: string | DataPath, fn: (arr: unknown[]) => { newArr: unknown[]; result: unknown }): unknown {
    const keys = normalizePath(path);
    const existing = getIn(this.state, keys);
    if (!Array.isArray(existing) || (existing as unknown[]).length === 0) return undefined;
    const arr = existing as unknown[];
    const { newArr, result } = fn(arr);
    if (newArr === arr) return result;
    this.state = produce(this.state, (draft) => {
      setInDraft(draft as Record<string, unknown>, keys, newArr);
    });
    this.notify(keys, existing);
    return result;
  }

  /**
   * 内部路径设值，比较后决定是否触发通知
   */
  private setInternal(keys: DataPath, value: unknown): this {
    const oldValue = getIn(this.state, keys);
    const newState = produce(this.state, (draft) => {
      setInDraft(draft as Record<string, unknown>, keys, value);
    });
    if (newState === this.state) return this;
    this.state = newState;
    this.notify(keys, oldValue);
    return this;
  }

  /**
   * 触发变更通知（批量模式下延迟）
   */
  private notify(keys: DataPath, oldValue: unknown): void {
    if (this.batchDepth > 0) return;
    this.onChange(keys.map(String), getIn(this.state, keys), oldValue);
  }
}
