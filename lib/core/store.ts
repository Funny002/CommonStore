/**
 * Store 核心状态管理模块
 *
 * 状态管理的核心类，继承自 EventListener。
 * 整合了 DataManager、ActionManager 和 PluginManager 三大子系统，
 * 提供统一的状态读写、action 分发、插件管理和路径订阅能力。
 */
import type { DataChangeCallback, DataPath } from './data';
import { PluginManager, type Plugin } from './plugin';
import { EventListener } from '../utils';
import { ActionManager } from './action';
import { DataManager } from './data';

/**
 * Store 类
 * 状态管理的核心，继承自 EventListener 支持事件监听
 * 整合了数据管理、动作执行和插件系统
 */
export class Store extends EventListener {
  /** 数据管理器 */
  private readonly _data: DataManager;
  /** Action 动作管理器 */
  private readonly _actions: ActionManager;
  /** 插件管理器 */
  private readonly _plugins: PluginManager;
  /** 初始状态，用于 reset() 恢复 */
  private readonly _initialState: unknown;
  /** 正在 emit 中的订阅路径集合（防止订阅回调中同步修改自身路径导致无限递归） */
  private readonly _emitting = new Set<string>();

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
      try {
        this._plugins.triggerDataChange(path, newValue, oldValue);
      } finally {
        this._emitChange(path);
      }
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
  dispatch<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
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
   * 触发订阅通知
   * 注意：仅通知路径自身及其祖先路径的订阅者。
   * 当整体替换父路径时（如 set("user", newObj)），后代路径（如 "user.name"）的订阅者不会被通知。
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
