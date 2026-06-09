import type { DataChangeCallback, DataPath } from './data';
import { PluginManager, type Plugin } from './plugin';
import { EventListener } from '../utils';
import { ActionManager } from './action';
import { DataManager } from './data';

/**
 * Store 类 — 状态管理核心
 *
 * @example
 * const store = new Store({ count: 0 });
 * store.actions.register('inc', (s) => s.data.set('count', s.getState<number>('count')! + 1));
 * store.subscribe('count', (v) => console.log(v));
 * await store.dispatch('inc');
 */
export class Store extends EventListener {
  private readonly _data: DataManager;
  private readonly _actions: ActionManager;
  private readonly _plugins: PluginManager;
  private readonly _emitting = new Set<string>();

  get data(): DataManager {
    return this._data;
  }

  get actions(): ActionManager {
    return this._actions;
  }

  get plugins(): PluginManager {
    return this._plugins;
  }

  /**
   * @param initialState - 初始状态数据，默认 {}
   */
  constructor(initialState?: unknown) {
    super();
    this._plugins = new PluginManager(this);
    this._actions = new ActionManager(this);
    const onDataChange: DataChangeCallback = (path, newValue, oldValue) => {
      try {
        this._plugins.triggerDataChange(path, newValue, oldValue);
      } finally {
        this._emitChange(path);
      }
    };
    this._data = new DataManager(initialState ?? {}, onDataChange);
  }

  /**
   * 获取状态数据
   * @param path - 数据路径（字符串用 `.` 分隔，或数组），不传返回整个状态树
   * @returns 指定路径的值，不存在返回 undefined
   */
  getState<T = unknown>(path?: string | (string | number)[]): T | undefined {
    return this._data.get<T>(path);
  }

  /**
   * 执行指定 action
   * @param name - action 名称
   * @param args - 传递给 action 的参数
   * @returns action 执行结果
   * @throws 当 action 不存在或执行出错时抛出
   */
  dispatch<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    return this._actions.dispatch(name, ...args);
  }

  /**
   * 注册插件（支持链式调用）
   * @param plugins - 要注册的插件列表
   */
  use(...plugins: Plugin[]): this {
    this._plugins.use(...plugins);
    return this;
  }

  /**
   * 移除插件（支持链式调用）
   * @param plugins - 插件名称或插件实例列表
   */
  eject(...plugins: (string | Plugin)[]): this {
    for (const item of plugins) {
      if (typeof item === 'string') {
        this._plugins.eject(item);
      } else {
        this._plugins.eject(item.name);
      }
    }
    return this;
  }

  /**
   * 重置状态到初始值（支持链式调用）
   * @param keepPaths - 要保留的路径列表，其它路径恢复初始值
   */
  reset(keepPaths?: string[]): this {
    this._data.reset(keepPaths);
    return this;
  }

  /**
   * 订阅指定路径的数据变化
   *
   * 路径匹配规则：修改子路径时会通知父路径订阅者。
   * 例如 `subscribe('user', cb)` 会在 `set('user.name', ...)` 时触发。
   *
   * @param path - 数据路径（字符串用 `.` 分隔，或数组），不能为空
   * @param callback - 回调函数，接收 (新值, 旧值)
   * @returns 取消订阅函数
   * @throws 路径为空时抛出
   */
  subscribe(path: string | DataPath, callback: (value: unknown, oldValue: unknown) => void): () => void {
    const keyStr = Array.isArray(path) ? path.join('.') : path;
    if (!keyStr) {
      throw new Error('Cannot subscribe to the root path. Please specify a specific path.');
    }
    let oldValue = this.getState(path);
    const handler = () => {
      if (this._emitting.has(keyStr)) return;
      this._emitting.add(keyStr);
      try {
        const newValue = this.getState(path);
        callback(newValue, oldValue);
        oldValue = newValue;
      } finally {
        this._emitting.delete(keyStr);
      }
    };
    const eventName = `__sub:${keyStr}`;
    this.on(eventName, handler);
    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * 清空所有状态数据
   */
  clear() {
    this._data.clear();
  }

  /**
   * 清空所有事件监听器（含订阅）
   */
  clearListener() {
    this._emitting.clear();
    super.clear();
  }

  /**
   * 发出路径变更通知
   *
   * 通知策略：
   * - 根路径变更（[]）：通知所有订阅者
   * - 子路径变更：通知自身及所有祖先路径的订阅者
   *
   * 注意：当整体替换父路径时（如 set("user", newObj)），
   * 后代路径（如 "user.name"）的订阅者不会被通知。
   */
  private _emitChange(path: string[]) {
    if (path.length === 0) {
      for (const name of this._eventNames()) {
        if (name.startsWith('__sub:')) this.emit(name);
      }
      return;
    }
    const pathStr = path.join('.');
    this.emit(`__sub:${pathStr}`);
    for (let i = path.length - 1; i >= 1; i--) {
      this.emit(`__sub:${path.slice(0, i).join('.')}`);
    }
  }
}
