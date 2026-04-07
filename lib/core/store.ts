import type { DataChangeCallback } from './data';
import { EventListener } from '../utils';
import { PluginManager } from './plugin';
import { ActionManager } from './action';
import { DataManager } from './data';

export class Store extends EventListener {
  private readonly _data: DataManager;
  private readonly _actions: ActionManager;
  private readonly _plugins: PluginManager;

  get data(): DataManager {
    return this._data;
  }

  get actions(): ActionManager {
    return this._actions;
  }

  get plugins(): PluginManager {
    return this._plugins;
  }

  constructor(initialState?: Record<string, unknown> | any) {
    super();
    this._plugins = new PluginManager(this);
    this._actions = new ActionManager(this);
    const onDataChange: DataChangeCallback = (path, newValue, oldValue) => {
      this._plugins.triggerDataChange(path, newValue, oldValue);
    };
    this._data = new DataManager(initialState ?? {}, onDataChange);
  }

  getState<T = unknown>(path?: string | (string | number)[]): T | undefined {
    return this._data.get<T>(path);
  }

  dispatch<T = any>(name: string, ...args: any[]): Promise<T> {
    return this._actions.dispatch(name, ...args);
  }

  use(...plugins: Parameters<PluginManager['use']>[0][]): this {
    this._plugins.use(...plugins);
    return this;
  }
}
