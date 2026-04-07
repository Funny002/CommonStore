/**
 * 事件处理函数类型
 */
export type EventFunction = (...args: any[]) => void

/**
 * 事件监听器类
 * 支持 on、off、once、emit 等标准事件方法
 */
export class EventListener {
  private _listener: Map<string, EventFunction []>;

  /**
   * 构造函数，初始化事件映射表
   */
  constructor() {
    this._listener = new Map();
  }

  /**
   * 触发指定事件
   * @param eventName - 事件名称
   * @param args - 传递给监听器的参数
   */
  emit(eventName: string, ...args: any[]) {
    const list = this._listener.get(eventName) || [];
    for (const listener of list) {
      listener(...args);
    }
  }

  /**
   * 注册事件监听器
   * @param eventName - 事件名称
   * @param listener - 监听函数
   */
  on(eventName: string, listener: EventFunction) {
    this._listener.set(eventName, [...(this._listener.get(eventName) || []), listener]);
  }

  /**
   * 移除事件监听器
   * @param eventName - 事件名称
   * @param listener - 要移除的监听函数
   */
  off(eventName: string, listener: EventFunction) {
    const list = this._listener.get(eventName) || [];
    this._listener.set(eventName, list.filter(l => l !== listener));
  }

  /**
   * 注册一次性事件监听器，触发后自动移除
   * @param eventName - 事件名称
   * @param listener - 监听函数
   */
  once(eventName: string, listener: EventFunction) {
    const onceListener = (...args: any[]) => {
      this.off(eventName, onceListener);
      listener(...args);
    };
    this.on(eventName, onceListener);
  }

  /**
   * 移除指定事件的所有监听器
   * @param eventName - 事件名称
   */
  removeAll(eventName: string) {
    this._listener.delete(eventName);
  }

  /**
   * 清空所有事件的监听器
   */
  clear() {
    this._listener.clear();
  }
}
