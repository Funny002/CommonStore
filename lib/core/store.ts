import type { DataChangeCallback } from './data';
import { EventListener } from '../utils';
import { PluginManager } from './plugin';
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
  constructor(initialState?: Record<string, unknown> | any) {
    super();
    this._plugins = new PluginManager(this);
    this._actions = new ActionManager(this);
    // 数据变更时触发插件的 onDataChange 钩子
    const onDataChange: DataChangeCallback = (path, newValue, oldValue) => {
      this._plugins.triggerDataChange(path, newValue, oldValue);
    };
    this._data = new DataManager(initialState ?? {}, onDataChange);
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


}
