import { type EventFunction, EventListener } from '../Utils';
import { Action, type ActionManager } from '../action';
import { Plugin, type PluginManager } from '../Plugin';
import { Data, type DataManager } from '../Data';
import type { CoreStore } from './interface';

/* 核心存储器 */
export class Store extends EventListener implements CoreStore {
  _data: DataManager;
  _active: ActionManager;
  _plugins: PluginManager;

  get data() {
    return this._data;
  }

  get plugins() {
    return this._plugins;
  }

  get actions() {
    return this._active;
  }

  constructor(initialState?: Partial<any>) {
    super();
    this._data = new Data(initialState);
    this._active = new Action();
    this._plugins = new Plugin();
  }

  /** use Plugin */
  use(...plugins: PluginManager[]) {
    this._plugins.use(...plugins);
  }

  dispatch(actionName: string, ...args: any[]): void {
  }

  dispatchBatch(...actions: Array<[actionName: string, ...args: any[]]>): void {
  }

  export(): any {
  }

  import(data: any): void {
  }

  subscribe(eventName: string, listener: EventFunction): void {
  }

  unsubscribe(eventName: string, listener: EventFunction): void {
  }
}

export * from './interface';
