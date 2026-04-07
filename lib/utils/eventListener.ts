export type EventFunction = (...args: any[]) => void

export class EventListener {
  private _listener: Map<string, EventFunction []>;

  constructor() {
    this._listener = new Map();
  }

  emit(eventName: string, ...args: any[]) {
    const list = this._listener.get(eventName) || [];
    for (const listener of list) {
      listener(...args);
    }
  }

  on(eventName: string, listener: EventFunction) {
    this._listener.set(eventName, [...(this._listener.get(eventName) || []), listener]);
  }

  off(eventName: string, listener: EventFunction) {
    const list = this._listener.get(eventName) || [];
    this._listener.set(eventName, list.filter(l => l !== listener));
  }

  once(eventName: string, listener: EventFunction) {
    const onceListener = (...args: any[]) => {
      this.off(eventName, onceListener);
      listener(...args);
    };
    this.on(eventName, onceListener);
  }

  removeAll(eventName: string) {
    this._listener.delete(eventName);
  }

  clear() {
    this._listener.clear();
  }
}
