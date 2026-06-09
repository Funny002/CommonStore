import type { Store } from './store';

/**
 * 插件接口
 *
 * 6 个生命周期钩子（均可选）：
 * - `install` / `uninstall` — 安装与卸载
 * - `beforeAction` / `afterAction` / `onError` — 拦截 action 执行
 * - `onDataChange` — 监听数据变更
 *
 * @example
 * const logger: Plugin = {
 *   name: 'logger',
 *   afterAction: (name, result) => console.log(name, result),
 *   onDataChange: (path, nv) => console.log(path.join('.'), nv),
 * };
 */
export interface Plugin<TStore extends Store = Store> {
  /** 唯一名称，用于依赖引用和卸载 */
  readonly name: string;

  /** 版本号（可选） */
  version?: string;

  /** 依赖的插件名称列表（可选），安装时会按拓扑顺序先安装依赖 */
  dependencies?: string[];

  /** 安装插件时调用 */
  install?(store: TStore): void;

  /** 卸载插件时调用 */
  uninstall?(): void;

  /**
   * action 执行前调用，可以修改参数
   * @returns 修改后的参数数组，返回非数组时忽略
   */
  beforeAction?(actionName: string, args: unknown[]): unknown[] | void;

  /** action 执行成功后调用 */
  afterAction?(actionName: string, result: unknown, args: unknown[]): void;

  /** action 执行出错时调用 */
  onError?(actionName: string, error: Error, args: unknown[]): void;

  /** 数据变更时调用 */
  onDataChange?(path: string[], newValue: unknown, oldValue: unknown): void;
}

/**
 * 插件管理器
 *
 * 负责插件的注册、卸载、依赖管理和钩子触发。
 * 单个插件钩子异常不影响其他插件，错误通过 console.error 输出。
 */
export class PluginManager<TStore extends Store = Store> {
  private readonly plugins = new Map<string, Plugin<TStore>>();
  private readonly store: TStore;

  constructor(store: TStore) {
    this.store = store;
  }

  /**
   * 注册一个或多个插件
   *
   * 会自动进行拓扑排序，确保依赖插件先于依赖者安装。
   *
   * @throws 当插件已注册、缺少依赖、存在循环依赖时抛出
   */
  use(...plugins: Array<Plugin<TStore>>): void {
    const newPlugins: Array<Plugin<TStore>> = [];
    const duplicates: string[] = [];
    for (const p of plugins) {
      if (this.plugins.has(p.name)) {
        duplicates.push(p.name);
      } else {
        newPlugins.push(p);
      }
    }
    if (duplicates.length > 0) {
      throw new Error(`Plugins already registered: ${duplicates.join(', ')}`);
    }

    const allPlugins = new Map<string, Plugin<TStore>>(this.plugins);
    for (const p of newPlugins) {
      allPlugins.set(p.name, p);
    }

    const sorted = this.topologicalSort(newPlugins, allPlugins);
    for (const plugin of sorted) {
      if (!this.plugins.has(plugin.name)) {
        this.installOne(plugin);
      }
    }
  }

  /**
   * 卸载指定插件
   *
   * 会检查依赖关系，若有其他插件依赖它则拒绝卸载。
   * uninstall 钩子异常通过 console.error 输出，不影响插件移除。
   *
   * @returns 是否成功卸载
   * @throws 当其他插件依赖它时抛出
   */
  eject(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return false;

    this.checkDependents(pluginName);
    try {
      plugin.uninstall?.();
    } catch (e) {
      console.error(`[CommonStore] Plugin "${pluginName}" uninstall hook error:`, e);
    }
    this.plugins.delete(pluginName);
    return true;
  }

  /**
   * 批量卸载插件
   *
   * 逐个调用 eject，遇到依赖冲突或不存在时抛出。
   */
  uninstall(...plugins: Array<Plugin<TStore>>): void {
    for (const plugin of plugins) {
      this.eject(plugin.name);
    }
  }

  /**
   * 获取所有已注册插件（只读）
   */
  getPlugins(): ReadonlyArray<Plugin<TStore>> {
    return Array.from(this.plugins.values());
  }

  // ── 钩子触发 ──

  /**
   * 触发所有插件的 beforeAction 钩子
   *
   * 插件可返回新参数数组来修改参数。
   * 单个插件异常不影响后续插件，错误输出到 console.error。
   *
   * @returns 修改后的参数数组
   */
  triggerBeforeAction(actionName: string, args: unknown[]): unknown[] {
    let currentArgs = args;
    for (const plugin of this.plugins.values()) {
      try {
        const modified = plugin.beforeAction?.(actionName, currentArgs);
        if (Array.isArray(modified)) {
          currentArgs = modified;
        } else if (modified !== undefined) {
          console.warn(`[CommonStore] Plugin "${plugin.name}" beforeAction returned non-array value, ignored.`);
        }
      } catch (e) {
        console.error(`[CommonStore] Plugin "${plugin.name}" beforeAction hook error:`, e);
      }
    }
    return currentArgs;
  }

  /**
   * 触发所有插件的 afterAction 钩子
   */
  triggerAfterAction(actionName: string, result: unknown, args: unknown[]): void {
    this.invokeHook('afterAction', (p) => p.afterAction?.(actionName, result, args));
  }

  /**
   * 触发所有插件的 onError 钩子
   */
  triggerErrorAction(actionName: string, error: Error, args: unknown[]): void {
    this.invokeHook('onError', (p) => p.onError?.(actionName, error, args));
  }

  /**
   * 触发所有插件的 onDataChange 钩子
   */
  triggerDataChange(path: string[], newValue: unknown, oldValue: unknown): void {
    this.invokeHook('onDataChange', (p) => p.onDataChange?.(path, newValue, oldValue));
  }

  // ── 私有方法 ──

  /**
   * 遍历所有插件安全调用指定钩子，单个异常不影响其它插件
   */
  private invokeHook(hook: string, fn: (plugin: Plugin<TStore>) => void): void {
    for (const plugin of this.plugins.values()) {
      try {
        fn(plugin);
      } catch (e) {
        console.error(`[CommonStore] Plugin "${plugin.name}" ${hook} hook error:`, e);
      }
    }
  }

  /**
   * 检查是否有其他插件依赖指定插件
   * @throws 当存在依赖者时抛出
   */
  private checkDependents(pluginName: string): void {
    const dependents: string[] = [];
    for (const p of this.plugins.values()) {
      if (p.dependencies?.includes(pluginName)) {
        dependents.push(p.name);
      }
    }
    if (dependents.length > 0) {
      throw new Error(`Cannot eject "${pluginName}" because plugins [${dependents.join(', ')}] depend on it.`);
    }
  }

  /**
   * 安装单个插件：校验依赖后调用 install
   * @throws 当依赖未安装时抛出
   */
  private installOne(plugin: Plugin<TStore>): void {
    plugin.install?.(this.store);
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * DFS 拓扑排序，确保依赖插件在依赖者之前安装
   * @returns 排序后的插件数组
   * @throws 检测到循环依赖或缺失依赖时抛出
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
