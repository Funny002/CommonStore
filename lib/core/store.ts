import { PluginManager } from './plugin.ts';
import { ActionManager } from './action';
import { EventListener } from '../utils';
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

  constructor(initialState?: any) {
    super();
    this._plugins = new PluginManager(this);
    this._actions = new ActionManager(this);
    this._data = new DataManager(initialState, (path, newValue, oldValue) => {
      this.plugins.triggerDataChange(path, newValue, oldValue);
    });
  }
}
