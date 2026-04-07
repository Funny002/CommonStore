import type { Store } from './store';

export type ActionHandler<T extends any[] = any[], R = any> = (store: Store, ...args: T) => R | Promise<R>;

export class ActionManager {
  private actions = new Map<string, ActionHandler>();
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  register<T extends any[], R>(name: string, handler: ActionHandler<T, R>): this {
    if (this.actions.has(name)) {
      throw new Error(`Action "${name}" is already registered`);
    }
    this.actions.set(name, handler as ActionHandler);
    return this;
  }

  unregister(name: string): this {
    if (!this.actions.delete(name)) {
      throw new Error(`Action "${name}" not found`);
    }
    return this;
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  getActionNames(): string[] {
    return Array.from(this.actions.keys());
  }

  async dispatch<T extends any[] = any[], R = any>(name: string, ...args: T): Promise<R> {
    const handler = this.actions.get(name);
    if (!handler) {
      const available = this.getActionNames().join(', ');
      throw new Error(`Action "${name}" not found. Available: ${available || 'none'}`);
    }

    // 前置钩子（可修改参数）
    let processedArgs = this.store.plugins.triggerBeforeAction(name, args);
    if (!Array.isArray(processedArgs)) {
      processedArgs = args;
    }

    try {
      const result = await handler(this.store, ...processedArgs);
      // 后置钩子
      this.store.plugins.triggerAfterAction(name, result, processedArgs);
      return result as R;
    } catch (error) {
      // 错误钩子
      this.store.plugins.triggerErrorAction(name, error as Error, processedArgs);
      throw error;
    }
  }
}
