import type { DataManager, DataManagerPath } from './interface.ts';
import { List, fromJS, Map, is } from 'immutable';
import { isFunction } from '../Utils';

export class Data implements DataManager {
  private state: Map<string, any>;

  private handlerPath(path: string | DataManagerPath): DataManagerPath {
    if (Array.isArray(path)) return path;
    return path.split('.').filter(item => {
      return Boolean(item.trim());
    });
  }

  private handlerToJs(value: any) {
    if (value && isFunction(value.toJS)) return value.toJS();
    return value;
  }

  private handlerTraverse(node: any, currentPath: string[], visit: (value: any, key: string, path: string[]) => boolean) {
    if (Map.isMap(node)) {
      for (let [key, value] of (node as Map<string, any>).entries()) {
        const keys = currentPath.concat(key);
        if (visit(value, key, keys)) return true;
        if (this.handlerTraverse(value, keys, visit)) return true;
      }
    } else if (List.isList(node)) {
      for (let [index, value] of (node as List<any>).entries()) {
        const keys = currentPath.concat(String(index));
        if (visit(value, String(index), keys)) return true;
        if (this.handlerTraverse(value, keys, visit)) return true;
      }
    }
    return false;
  }

  constructor(initialState: any = {}) {
    this.state = fromJS(initialState);
  }

  get(path?: string | DataManagerPath): any {
    if (!path) return this.handlerToJs(this.state);
    const keys = this.handlerPath(path);
    return this.handlerToJs(this.state.getIn(keys));
  }

  set(path: string | DataManagerPath, value: any): this {
    const keys = this.handlerPath(path);
    this.state = this.state.setIn(keys, fromJS(value));
    return this;
  }

  delete(path: string | DataManagerPath): boolean {
    const keys = this.handlerPath(path);
    if (!this.state.hasIn(keys)) return false;
    this.state = this.state.deleteIn(keys);
    return true;
  }

  update(path: string | DataManagerPath, updater: (value: any) => any): this {
    const keys = this.handlerPath(path);
    const oldValue = this.state.getIn(keys);
    const newValue = updater(oldValue);
    this.state = this.state.setIn(keys, fromJS(newValue));
    return this;
  }

  merge(path: string | DataManagerPath, value: object): this {
    const keys = this.handlerPath(path);
    const existing = this.state.getIn(keys);
    const toMerge = fromJS(value) as Map<string, any>;
    let newState: Map<string, any>;
    if (Map.isMap(existing)) {
      newState = this.state.setIn(keys, existing.mergeDeep(toMerge));
    } else {
      newState = this.state.setIn(keys, toMerge);
    }
    if (is(newState, this.state)) return this;
    this.state = newState;
    return this;
  }

  push(path: string | DataManagerPath, value: any): this {
    const keys = this.handlerPath(path);
    const existing = this.state.getIn(keys);
    let newList: List<any>;
    if (List.isList(existing)) {
      newList = existing.push(fromJS(value));
    } else {
      newList = List([fromJS(value)]);
    }
    this.state = this.state.setIn(keys, newList);
    return this;
  }

  pop(path: string | DataManagerPath): any {
    const keys = this.handlerPath(path);
    const existing = this.state.getIn(keys);
    if (!List.isList(existing) || existing.size === 0) return undefined;
    const last = existing.last();
    const newList = existing.pop();
    this.state = this.state.setIn(keys, newList);
    return this.handlerToJs(last);
  }

  find(predicate: (value: any, key: string, path: string[]) => boolean): any {
    let results = null;
    this.handlerTraverse(this.state, [], (value, key, path) => {
      const newValue = this.handlerToJs(value);
      if (predicate(newValue, key, path)) {
        results = newValue;
        return true;
      }
      return false;
    });
    return results;
  }

  findAll(predicate: (value: any, key: string, path: string[]) => boolean): any[] {
    let results: any[] = [];
    this.handlerTraverse(this.state, [], (value, key, path) => {
      const newValue = this.handlerToJs(value);
      if (predicate(newValue, key, path)) {
        results.push(newValue);
      }
      return false;
    });
    return results;
  }

  clear(): void {
    this.state = fromJS({});
  }
}

export * from './interface';
