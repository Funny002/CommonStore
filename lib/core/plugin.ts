import type { Store } from './store';

export interface Plugin {
  readonly name: string;
  version?: string;
  dependencies?: string[];

  install?(store: Store): void;

  uninstall?(): void;

  beforeAction?(actionName: string, args: unknown[]): unknown[] | void;

  afterAction?(actionName: string, result: unknown, args: unknown[]): void;

  onError?(actionName: string, error: Error, args: unknown[]): void;

  onDataChange?(path: string[], newValue: unknown, oldValue: unknown): void;
}

export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  // 安装单个插件（不对外暴露，内部使用）
  private installPlugin(plugin: Plugin): void {
    const deps = plugin.dependencies || [];
    for (const depName of deps) {
      if (!this.plugins.has(depName)) {
        throw new Error(
          `Plugin "${plugin.name}" depends on "${depName}", which is not installed.`,
        );
      }
    }
    if (plugin.install) {
      plugin.install(this.store);
    }
    this.plugins.set(plugin.name, plugin);
  }

  // 拓扑排序（传入待排序插件集合，以及所有可用插件映射）
  private static topologicalSort(pluginsToSort: Plugin[], allPluginsMap: Map<string, Plugin>): Plugin[] {
    const visited = new Set<string>();
    const tempMark = new Set<string>();
    const result: Plugin[] = [];

    const visit = (plugin: Plugin) => {
      if (tempMark.has(plugin.name)) {
        throw new Error(`Circular dependency detected: ${plugin.name}`);
      }
      if (visited.has(plugin.name)) return;
      tempMark.add(plugin.name);
      const deps = plugin.dependencies || [];
      for (const depName of deps) {
        const dep = allPluginsMap.get(depName);
        if (!dep) {
          throw new Error(`Missing dependency "${depName}" for plugin "${plugin.name}"`);
        }
        visit(dep);
      }
      tempMark.delete(plugin.name);
      visited.add(plugin.name);
      result.push(plugin);
    };

    for (const p of pluginsToSort) {
      if (!visited.has(p.name)) {
        visit(p);
      }
    }
    return result;
  }

  // 注册一个或多个插件（自动处理依赖顺序，重复注册会报错）
  use(...plugins: Plugin[]): void {
    const newPlugins = plugins.filter(p => !this.plugins.has(p.name));
    if (newPlugins.length !== plugins.length) {
      const duplicates = plugins.filter(p => this.plugins.has(p.name)).map(p => p.name);
      throw new Error(`Plugins already registered: ${duplicates.join(', ')}`);
    }

    // 合并所有已知插件（已安装 + 新插件）用于依赖解析
    const allKnown = new Map(this.plugins);
    for (const p of newPlugins) {
      allKnown.set(p.name, p);
    }

    const sorted = PluginManager.topologicalSort(newPlugins, allKnown);
    for (const plugin of sorted) {
      this.installPlugin(plugin);
    }
  }

  eject(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return false;
    // 检查依赖关系
    for (const p of this.plugins.values()) {
      if (p.dependencies?.includes(pluginName)) {
        throw new Error(
          `Cannot eject "${pluginName}" because plugin "${p.name}" depends on it.`,
        );
      }
    }
    if (plugin.uninstall) {
      plugin.uninstall();
    }
    return this.plugins.delete(pluginName);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  // 钩子触发
  triggerBeforeAction(actionName: string, args: unknown[]): unknown[] {
    let current = args;
    for (const p of this.plugins.values()) {
      if (p.beforeAction) {
        const modified = p.beforeAction(actionName, current);
        if (Array.isArray(modified)) {
          current = modified;
        }
      }
    }
    return current;
  }

  triggerAfterAction(actionName: string, result: unknown, args: unknown[]): void {
    for (const p of this.plugins.values()) {
      p.afterAction?.(actionName, result, args);
    }
  }

  triggerErrorAction(actionName: string, error: Error, args: unknown[]): void {
    for (const p of this.plugins.values()) {
      p.onError?.(actionName, error, args);
    }
  }

  triggerDataChange(path: string[], newValue: unknown, oldValue: unknown): void {
    for (const p of this.plugins.values()) {
      p.onDataChange?.(path, newValue, oldValue);
    }
  }
}
