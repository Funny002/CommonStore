import { List, Map, fromJS, is } from 'immutable';

export type DataPath = (string | number)[];
export type DataChangeCallback = (path: string[], newValue: unknown, oldValue: unknown) => void;

type ImmutableData = Map<string, unknown>;

function normalizePath(path: string | DataPath): DataPath {
  if (Array.isArray(path)) return path;
  return path.split('.').filter(segment => segment.trim().length > 0);
}

function toJS<T>(value: unknown): T {
  if (value && typeof (value as any).toJS === 'function') {
    return (value as any).toJS();
  }
  return value as T;
}

/**
 * 深度遍历 Immutable 结构，支持提前终止。
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

export class DataManager {
  private state: ImmutableData;
  private readonly onChange: DataChangeCallback;

  constructor(initialState: unknown = {}, onChange: DataChangeCallback) {
    this.state = fromJS(initialState) as ImmutableData;
    this.onChange = onChange;
  }

  // ---------- 读操作 ----------
  get<T = unknown>(path?: string | DataPath): T | undefined {
    if (!path) return toJS<T>(this.state);
    const keys = normalizePath(path);
    const value = this.state.getIn(keys);
    return value !== undefined ? toJS<T>(value) : undefined;
  }

  getRaw(path?: string | DataPath): unknown {
    if (!path) return this.state;
    const keys = normalizePath(path);
    return this.state.getIn(keys);
  }

  set(path: string | DataPath, value: unknown): this {
    return this.setInternal(normalizePath(path), value);
  }

  delete(path: string | DataPath): boolean {
    const keys = normalizePath(path);
    if (!this.state.hasIn(keys)) return false;
    const oldValue = this.state.getIn(keys);
    this.state = this.state.deleteIn(keys);
    this.notify(keys, undefined, oldValue);
    return true;
  }

  update(path: string | DataPath, updater: (old: unknown) => unknown): this {
    const keys = normalizePath(path);
    const oldValue = this.state.getIn(keys);
    const newValue = updater(toJS(oldValue));
    return this.setInternal(keys, newValue);
  }

  merge(path: string | DataPath, value: Record<string, unknown>): this {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    const toMerge = fromJS(value) as ImmutableData;
    let newState: ImmutableData;
    if (Map.isMap(existing)) {
      newState = this.state.setIn(keys, (existing as ImmutableData).mergeDeep(toMerge));
    } else {
      newState = this.state.setIn(keys, toMerge);
    }
    if (is(newState, this.state)) return this;
    const oldValue = this.state.getIn(keys);
    this.state = newState;
    this.notify(keys, this.state.getIn(keys), oldValue);
    return this;
  }

  push(path: string | DataPath, value: unknown): this {
    const keys = normalizePath(path);
    const existing = this.state.getIn(keys);
    const newList = List.isList(existing) ? (existing as List<unknown>).push(fromJS(value)) : List([fromJS(value)]);
    const oldValue = this.state.getIn(keys);
    this.state = this.state.setIn(keys, newList);
    this.notify(keys, newList, oldValue);
    return this;
  }

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

  clear(): void {
    const oldState = this.state;
    this.state = fromJS({}) as ImmutableData;
    this.notify([], this.state, oldState);
  }

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

  private notify(keys: DataPath, newValue: unknown, oldValue: unknown): void {
    const pathStrings = keys.map(String);
    this.onChange(pathStrings, newValue !== undefined ? toJS(newValue) : undefined, oldValue !== undefined ? toJS(oldValue) : undefined);
  }
}
