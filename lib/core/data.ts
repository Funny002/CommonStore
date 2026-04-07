import { List, fromJS, Map, is } from 'immutable';

export type DataManagerPath = (string | number)[];
export type DataChangeCallback = (path: string[], newValue: unknown, oldValue: unknown) => void;

export class DataManager {
  private state: Map<string, unknown>;
  private readonly onChange: DataChangeCallback;

  private static handlerPath(path: string | DataManagerPath): DataManagerPath {
    if (Array.isArray(path)) return path;
    return path.split('.').filter(segment => segment.trim().length > 0);
  }

  private static toJS<T>(value: unknown): T {
    if (value && typeof (value as any).toJS === 'function') {
      return (value as any).toJS();
    }
    return value as T;
  }

  // 递归遍历，visit 返回 true 时停止遍历；默认传入原始 Immutable 值
  private static traverse(node: unknown, currentPath: string[], visit: (value: unknown, key: string, path: string[]) => boolean): boolean {
    if (Map.isMap(node)) {
      for (const [key, value] of (node as Map<string, unknown>).entries()) {
        const keys = currentPath.concat(key);
        if (visit(value, key, keys)) return true;
        if (this.traverse(value, keys, visit)) return true;
      }
    } else if (List.isList(node)) {
      for (const [idx, value] of (node as List<unknown>).entries()) {
        const keys = currentPath.concat(String(idx));
        if (visit(value, String(idx), keys)) return true;
        if (this.traverse(value, keys, visit)) return true;
      }
    }
    return false;
  }

  constructor(initialState: unknown = {}, onChange: DataChangeCallback) {
    this.state = fromJS(initialState) as Map<string, unknown>;
    this.onChange = onChange;
  }

  // 获取 JS 原生值（深转换，注意性能）
  get<T = unknown>(path?: string | DataManagerPath): T | undefined {
    if (!path) return DataManager.toJS(this.state);
    const keys = DataManager.handlerPath(path);
    const value = this.state.getIn(keys);
    return value !== undefined ? DataManager.toJS(value) : undefined;
  }

  // 获取原始 Immutable 对象（性能友好）
  getRaw(path?: string | DataManagerPath): unknown {
    if (!path) return this.state;
    const keys = DataManager.handlerPath(path);
    return this.state.getIn(keys);
  }

  private setInternal(path: DataManagerPath, value: unknown, notify = true): this {
    const oldValue = this.state.getIn(path);
    const newImmutable = fromJS(value);
    if (is(oldValue, newImmutable)) return this;
    this.state = this.state.setIn(path, newImmutable);
    if (notify) this.onChange(path.map(String), newImmutable, oldValue);
    return this;
  }

  set(path: string | DataManagerPath, value: unknown): this {
    return this.setInternal(DataManager.handlerPath(path), value);
  }

  delete(path: string | DataManagerPath): boolean {
    const keys = DataManager.handlerPath(path);
    if (!this.state.hasIn(keys)) return false;
    const oldValue = this.state.getIn(keys);
    this.state = this.state.deleteIn(keys);
    this.onChange(keys.map(String), undefined, oldValue);
    return true;
  }

  update(path: string | DataManagerPath, updater: (old: unknown) => unknown): this {
    const keys = DataManager.handlerPath(path);
    const oldValue = this.state.getIn(keys);
    const newValue = updater(DataManager.toJS(oldValue));
    return this.setInternal(keys, newValue);
  }

  merge(path: string | DataManagerPath, value: Record<string, unknown>): this {
    const keys = DataManager.handlerPath(path);
    const existing = this.state.getIn(keys);
    const toMerge = fromJS(value) as Map<string, unknown>;
    let newState: Map<string, unknown>;
    if (Map.isMap(existing)) {
      newState = this.state.setIn(keys, existing.mergeDeep(toMerge));
    } else {
      newState = this.state.setIn(keys, toMerge);
    }
    if (is(newState, this.state)) return this;
    const oldValue = this.state.getIn(keys);
    this.state = newState;
    this.onChange(keys.map(String), this.state.getIn(keys), oldValue);
    return this;
  }

  push(path: string | DataManagerPath, value: unknown): this {
    const keys = DataManager.handlerPath(path);
    const existing = this.state.getIn(keys);
    let newList: List<unknown>;
    if (List.isList(existing)) {
      newList = existing.push(fromJS(value));
    } else {
      newList = List([fromJS(value)]);
    }
    const oldValue = this.state.getIn(keys);
    this.state = this.state.setIn(keys, newList);
    this.onChange(keys.map(String), newList, oldValue);
    return this;
  }

  pop(path: string | DataManagerPath): unknown {
    const keys = DataManager.handlerPath(path);
    const existing = this.state.getIn(keys);
    if (!List.isList(existing) || existing.size === 0) return undefined;
    const last = existing.last();
    const newList = existing.pop();
    this.state = this.state.setIn(keys, newList);
    this.onChange(keys.map(String), newList, existing);
    return DataManager.toJS(last);
  }

  // 查找单个，默认 predicate 接收原始 Immutable 值（高性能）
  find(predicate: (value: unknown, key: string, path: string[]) => boolean, convertToJs = false): unknown {
    let result: unknown = null;
    DataManager.traverse(this.state, [], (value, key, path) => {
      const testValue = convertToJs ? DataManager.toJS(value) : value;
      if (predicate(testValue, key, path)) {
        result = testValue;
        return true;
      }
      return false;
    });
    return result;
  }

  // 查找所有，默认 predicate 接收原始 Immutable 值
  findAll(predicate: (value: unknown, key: string, path: string[]) => boolean, convertToJs = false): unknown[] {
    const results: unknown[] = [];
    DataManager.traverse(this.state, [], (value, key, path) => {
      const testValue = convertToJs ? DataManager.toJS(value) : value;
      if (predicate(testValue, key, path)) {
        results.push(testValue);
      }
      return false;
    });
    return results;
  }

  clear(): void {
    const oldState = this.state;
    this.state = fromJS({}) as Map<string, unknown>;
    this.onChange([], this.state, oldState);
  }
}
