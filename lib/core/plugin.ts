import type { Store } from './store';

/**
 * 插件接口定义
 * 插件可以拦截 action 执行、监听数据变更等
 * @template TStore - Store 类型，默认为 Store
 */
export interface Plugin<TSotre extends Store = Store> {
  /** 插件名称，必须唯一 */
  readonly name: string;
  
  /** 插件版本号（可选） */
  version?: string;
  
  /** 依赖的插件名称列表（可选） */
  dependencies?: string[];

  /**
   * 安装插件时调用
   * @param store - Store 实例
   */
  install?(store: TSotre): void;

  /**
   * 卸载插件时调用
   */
  uninstall?(): void;

  /**
   * Action 执行前调用，可以修改参数
   * @param actionName - action 名称
   * @param args - 参数数组
   * @returns 修改后的参数数组，或 void
   */
  beforeAction?(actionName: string, args: unknown[]): unknown[] | void;

  /**
   * Action 执行成功后调用
   * @param actionName - action 名称
   * @param result - 执行结果
   * @param args - 参数数组
   */
  afterAction?(actionName: string, result: unknown, args: unknown[]): void;

  /**
   * Action 执行出错时调用
   * @param actionName - action 名称
   * @param error - 错误对象
   * @param args - 参数数组
   */
  onError?(actionName: string, error: Error, args: unknown[]): void;

  /**
   * 数据变更时调用
   * @param path - 变更路径
   * @param newValue - 新值
   * @param oldValue - 旧值
   */
  onDataChange?(path: string[], newValue: unknown, oldValue: unknown): void;
}

/**
 * 插件管理器类
 * 负责插件的注册、卸载、依赖管理和钩子触发
 * @template TStore - Store 类型，默认为 Store
 */
export class PluginManager<TStore extends Store = Store> {
  private readonly plugins = new Map<string, Plugin<TStore>>();
  private readonly store: TStore;

  /**
   * 构造函数
   * @param store - Store 实例引用
   */
  constructor(store: TStore) {
    this.store = store;
  }

  /**
   * 注册一个或多个插件
   * 会自动处理依赖关系和拓扑排序
   * @param plugins - 要注册的插件数组
   * @throws 如果插件已存在或依赖不满足
   */
  use(...plugins: Array<Plugin<TStore>>): void {
    const newPlugins = plugins.filter(p => !this.plugins.has(p.name));
    if (newPlugins.length !== plugins.length) {
      const duplicates = plugins.filter(p => this.plugins.has(p.name)).map(p => p.name);
      throw new Error(`Plugins already registered: ${duplicates.join(', ')}`);
    }

    const allPlugins = new Map<string, Plugin<TStore>>(this.plugins);
    for (const p of newPlugins) {
      allPlugins.set(p.name, p);
    }

    const sorted = this.topologicalSort(newPlugins, allPlugins);
    for (const plugin of sorted) {
      this.installOne(plugin);
    }
  }

  /**
   * 卸载指定插件
   * 会检查是否有其他插件依赖它
   * @param pluginName - 要卸载的插件名称
   * @returns 是否成功卸载
   * @throws 如果有其他插件依赖该插件
   */
  eject(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return false;

    for (const p of this.plugins.values()) {
      if (p.dependencies?.includes(pluginName)) {
        throw new Error(
          `Cannot eject "${pluginName}" because plugin "${p.name}" depends on it.`,
        );
      }
    }

    try {
      plugin.uninstall?.();
    } finally {
      this.plugins.delete(pluginName);
    }
    return true;
  }

  /**
   * 获取所有已注册的插件列表
   * @returns 只读插件数组
   */
  getPlugins(): ReadonlyArray<Plugin<TStore>> {
    return Array.from(this.plugins.values());
  }

  /**
   * 触发所有插件的 beforeAction 钩子
   * @param actionName - action 名称
   * @param args - 原始参数
   * @returns 可能被插件修改后的参数
   */
  triggerBeforeAction(actionName: string, args: unknown[]): unknown[] {
    let currentArgs = args;
    for (const plugin of this.plugins.values()) {
      const modified = plugin.beforeAction?.(actionName, currentArgs);
      if (Array.isArray(modified)) {
        currentArgs = modified;
      }
    }
    return currentArgs;
  }

  /**
   * 触发所有插件的 afterAction 钩子
   * @param actionName - action 名称
   * @param result - action 执行结果
   * @param args - 参数数组
   */
  triggerAfterAction(actionName: string, result: unknown, args: unknown[]): void {
    for (const plugin of this.plugins.values()) {
      plugin.afterAction?.(actionName, result, args);
    }
  }

  /**
   * 触发所有插件的 onError 钩子
   * @param actionName - action 名称
   * @param error - 错误对象
   * @param args - 参数数组
   */
  triggerErrorAction(actionName: string, error: Error, args: unknown[]): void {
    for (const plugin of this.plugins.values()) {
      plugin.onError?.(actionName, error, args);
    }
  }

  /**
   * 触发所有插件的 onDataChange 钩子
   * @param path - 变更路径
   * @param newValue - 新值
   * @param oldValue - 旧值
   */
  triggerDataChange(path: string[], newValue: unknown, oldValue: unknown): void {
    for (const plugin of this.plugins.values()) {
      plugin.onDataChange?.(path, newValue, oldValue);
    }
  }

  /**
   * 安装单个插件
   * 会验证依赖并调用 install 方法
   * @param plugin - 要安装的插件
   * @throws 如果依赖不满足
   */
  private installOne(plugin: Plugin<TStore>): void {
    const deps = plugin.dependencies ?? [];
    for (const depName of deps) {
      if (!this.plugins.has(depName)) {
        // 理论上拓扑排序已保证依赖存在，此处仅作防御
        throw new Error(
          `Plugin "${plugin.name}" depends on "${depName}", which is not installed.`,
        );
      }
    }
    plugin.install?.(this.store);
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * 对插件进行拓扑排序，确保依赖关系正确
   * @param toSort - 待排序的插件数组
   * @param allPlugins - 所有插件的 Map
   * @returns 排序后的插件数组
   * @throws 如果检测到循环依赖或缺少依赖
   */
  private topologicalSort(toSort: Array<Plugin<TStore>>, allPlugins: Map<string, Plugin<TStore>>): Array<Plugin<TStore>> {
    const visited = new Set<string>();
    const tempMark = new Set<string>();
    const result: Array<Plugin<TStore>> = [];

    const visit = (plugin: Plugin<TStore>) => {
      const name = plugin.name;
      if (tempMark.has(name)) {
        throw new Error(`Circular dependency detected involving "${name}"`);
      }
      if (visited.has(name)) return;

      tempMark.add(name);
      for (const depName of plugin.dependencies ?? []) {
        const dep = allPlugins.get(depName);
        if (!dep) {
          throw new Error(`Missing dependency "${depName}" for plugin "${name}"`);
        }
        visit(dep);
      }
      tempMark.delete(name);
      visited.add(name);
      result.push(plugin);
    };

    for (const plugin of toSort) {
      if (!visited.has(plugin.name)) {
        visit(plugin);
      }
    }
    return result;
  }
}
