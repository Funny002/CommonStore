import type { PluginManager } from '../Plugin';
import type { EventFunction } from '../Utils';
import type { DataManager } from '../Data';
import type { ActionManager } from '../action';

export interface CoreStore {
  new(initialState?: Partial<any>): CoreStore;

  /* 数据 */
  data: DataManager;

  /* 插件 */
  plugins: PluginManager;

  /* 动作 */
  actions: ActionManager;

  /* 注入插件 */
  use(...plugins: PluginManager[]): void;

  /* 派发事件 */
  dispatch(actionName: string, ...args: any[]): void;

  /* 批量派发事件 */
  dispatchBatch(...actions: Array<[actionName: string, ...args: any[]]>): void;

  /* 订阅事件 */
  subscribe(eventName: string, listener: EventFunction): void;

  /* 取消订阅 */
  unsubscribe(eventName: string, listener: EventFunction): void;

  /* 导出数据  */
  export(): any;

  /* 导入数据 */
  import(data: any): void;

  /* 清空 */
  clear(): void;
}
