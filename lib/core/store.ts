import type { DataChangeCallback, DataPath } from './data';
import { EventListener } from '../utils';
import { PluginManager, type Plugin } from './plugin';
import { ActionManager } from './action';
import { DataManager } from './data';

/**
 * Store 类
 * 状态管理的核心，继承自 EventListener 支持事件监听
 * 整合了数据管理、动作执行和插件系统
 */
export class Store extends EventListener {
  private readonly _data: DataManager;
  private readonly _actions: ActionManager;
  private readonly _plugins: PluginManager;
  private readonly _initialState: unknown;

  /**
   * 获取数据管理器实例
   */
  get data(): DataManager {
    return this._data;
  }

  /**
   * 获取动作管理器实例
   */
  get actions(): ActionManager {
    return this._actions;
  }

  /**
   * 获取插件管理器实例
   */
  get plugins(): PluginManager {
    return this._plugins;
  }

  /**
   * 构造函数
   * @param initialState - 初始状态数据
   */
  constructor(initialState?: unknown) {
    super();
    this._initialState = initialState ?? {};
    this._plugins = new PluginManager(this);
    this._actions = new ActionManager(this);
    // 数据变更时触发插件的 onDataChange 钩子和订阅通知
    const onDataChange: DataChangeCallback = (path, newValue, oldValue) => {
      this._plugins.triggerDataChange(path, newValue, oldValue);
      this._emitChange(path);
    };
    this._data = new DataManager(this._initialState, onDataChange);
  }

  /**
   * 获取状态数据
   * @param path - 数据路径，不传则返回整个状态树
   * @returns 指定路径的状态数据
   */
  getState<T = unknown>(path?: string | (string | number)[]): T | undefined {
    return this._data.get<T>(path);
  }

  /**
   * 执行指定的 action
   * @param name - action 名称
   * @param args - 传递给 action 的参数
   * @returns action 执行结果
   */
  dispatch<T = any>(name: string, ...args: any[]): Promise<T> {
    return this._actions.dispatch(name, ...args);
  }

  /**
   * 注册插件
   * @param plugins - 要注册的插件数组
   * @returns 当前实例，支持链式调用
   */
  use(...plugins: Parameters<PluginManager['use']>[0][]): this {
    this._plugins.use(...plugins);
    return this;
  }

  /**
   * 移除插件
   * @param plugins - 要移除的插件名称或实例数组
   * @returns 当前实例，支持链式调用
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
   * 重置状态到初始值
   * @param keepPaths - 可选，要保留的路径列表
   * @returns 当前实例，支持链式调用
   */
  reset(keepPaths?: string[]): this {
    this._data.reset(keepPaths);
    return this;
  }

  /**
   * 订阅指定路径的数据变化
   * @param path - 数据路径（字符串或路径数组）
   * @param callback - 回调函数，接收当前值和旧值
   * @returns 取消订阅函数
   */
  subscribe(path: string | DataPath, callback: (value: unknown, oldValue: unknown) => void): () => void {
    const keyStr = Array.isArray(path) ? path.join('.') : path;
    let oldValue = this.getState(path);
    const handler = () => {
      const newValue = this.getState(path);
      callback(newValue, oldValue);
      oldValue = newValue;
    };
    const eventName = `__sub:${keyStr}`;
    this.on(eventName, handler);
    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * 触发订阅通知
   */
  private _emitChange(path: string[]) {
    const pathStr = path.join('.');
    this.emit(`__sub:${pathStr}`);
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path.slice(0, i).join('.');
      if (p) {
        this.emit(`__sub:${p}`);
      }
    }
  }

  /**
   * 清空状态数据
   */
  clear() {
    this._data.clear();
  }

  /**
   * 清空事件监听器
   */
  clearListener() {
    super.clear();
  }
}
