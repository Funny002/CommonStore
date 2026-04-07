import type { Store } from './store';

export type ActionHandler<TArgs extends any[] = any[], TReturn = any> = (store: Store, ...args: TArgs) => TReturn | Promise<TReturn>;

type AnyActionHandler = ActionHandler<any[], any>;

export class ActionManager {
  private readonly actions = new Map<string, AnyActionHandler>();
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  register<TArgs extends any[], TReturn>(name: string, handler: ActionHandler<TArgs, TReturn>): this {
    if (this.actions.has(name)) {
      throw new Error(`Action "${name}" is already registered.`);
    }
    this.actions.set(name, handler as AnyActionHandler);
    return this;
  }

  unregister(name: string): this {
    if (!this.actions.delete(name)) {
      throw new Error(`Action "${name}" is not registered.`);
    }
    return this;
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  getActionNames(): string[] {
    return Array.from(this.actions.keys());
  }

  async dispatch<TArgs extends any[], TReturn>(name: string, ...args: TArgs): Promise<TReturn> {
    const handler = this.actions.get(name);
    if (!handler) {
      const available = this.getActionNames().join(', ');
      throw new Error(`Action "${name}" not found. Available actions: ${available || '(none)'}`);
    }
    const rawBeforeResult = this.store.plugins.triggerBeforeAction(name, args);
    const processedArgs = Array.isArray(rawBeforeResult) ? rawBeforeResult : args;
    try {
      const result = await handler(this.store, ...processedArgs);
      this.store.plugins.triggerAfterAction(name, result, processedArgs);
      return result as TReturn;
    } catch (error) {
      this.store.plugins.triggerErrorAction(name, error instanceof Error ? error : new Error(String(error)), processedArgs);
      throw error;
    }
  }
}
