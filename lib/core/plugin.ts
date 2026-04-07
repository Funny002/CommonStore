import type { Store } from './store';

export interface Plugin<TSotre extends Store = Store> {
  readonly name: string;
  version?: string;
  dependencies?: string[];

  install?(store: TSotre): void;

  uninstall?(): void;

  beforeAction?(actionName: string, args: unknown[]): unknown[] | void;

  afterAction?(actionName: string, result: unknown, args: unknown[]): void;

  onError?(actionName: string, error: Error, args: unknown[]): void;

  onDataChange?(path: string[], newValue: unknown, oldValue: unknown): void;
}

export class PluginManager<TStore extends Store = Store> {
  private readonly plugins = new Map<string, Plugin<TStore>>();
  private readonly store: TStore;

  constructor(store: TStore) {
    this.store = store;
  }

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

  getPlugins(): ReadonlyArray<Plugin<TStore>> {
    return Array.from(this.plugins.values());
  }

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

  triggerAfterAction(actionName: string, result: unknown, args: unknown[]): void {
    for (const plugin of this.plugins.values()) {
      plugin.afterAction?.(actionName, result, args);
    }
  }

  triggerErrorAction(actionName: string, error: Error, args: unknown[]): void {
    for (const plugin of this.plugins.values()) {
      plugin.onError?.(actionName, error, args);
    }
  }

  triggerDataChange(path: string[], newValue: unknown, oldValue: unknown): void {
    for (const plugin of this.plugins.values()) {
      plugin.onDataChange?.(path, newValue, oldValue);
    }
  }

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
