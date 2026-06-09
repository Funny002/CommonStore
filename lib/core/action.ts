import type { Store } from './store';

/**
 * Action 处理器类型
 * @template TArgs - 参数类型元组
 * @template TReturn - 返回值类型
 */
export type ActionHandler<TArgs extends unknown[] = unknown[], TReturn = unknown> = (store: Store, ...args: TArgs) => TReturn | Promise<TReturn>;

/**
 * Action 管理器
 *
 * @example
 * store.actions.register('increment', (store, amount: number) => {
 *   store.data.set('count', store.getState<number>('count')! + amount);
 * });
 * await store.dispatch('increment', 5);
 */
export class ActionManager {
  private readonly actions = new Map<string, ActionHandler>();
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * 注册 action 处理器
   * @param name - action 名称（唯一）
   * @param handler - 处理函数，接收 (store, ...args)
   * @returns 当前实例，支持链式调用
   * @throws 当名称已存在时抛出
   */
  register<TArgs extends unknown[], TReturn>(name: string, handler: ActionHandler<TArgs, TReturn>): this {
    if (this.actions.has(name)) {
      throw new Error(`Action "${name}" is already registered.`);
    }
    this.actions.set(name, handler as ActionHandler);
    return this;
  }

  /**
   * 注销 action
   * @param name - action 名称
   * @returns 当前实例，支持链式调用
   * @throws 当名称不存在时抛出
   */
  unregister(name: string): this {
    if (!this.actions.delete(name)) {
      throw new Error(`Action "${name}" is not registered.`);
    }
    return this;
  }

  /**
   * 检查 action 是否已注册
   */
  has(name: string): boolean {
    return this.actions.has(name);
  }

  /**
   * 获取所有已注册的 action 名称
   */
  getActionNames(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * 执行指定 action
   *
   * 生命周期：
   * 1. triggerBeforeAction（插件可修改参数）
   * 2. 执行 handler
   * 3. 成功 → triggerAfterAction / 失败 → triggerErrorAction
   *
   * @param name - action 名称
   * @param args - 传递给 handler 的参数
   * @returns handler 的执行结果
   * @throws 当 action 不存在或执行出错时抛出
   */
  async dispatch<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    const handler = this.actions.get(name);
    if (!handler) {
      const available = this.getActionNames().join(', ');
      throw new Error(`Action "${name}" not found. Available actions: ${available || '(none)'}`);
    }
    const processedArgs = this.store.plugins.triggerBeforeAction(name, args);
    try {
      const result = await handler(this.store, ...processedArgs);
      try {
        this.store.plugins.triggerAfterAction(name, result, processedArgs);
      } catch (e) {
        console.error(`[CommonStore] afterAction hook error in action "${name}":`, e);
      }
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      try {
        this.store.plugins.triggerErrorAction(name, err, processedArgs);
      } catch (e) {
        console.error(`[CommonStore] onError hook error in action "${name}":`, e);
      }
      throw error;
    }
  }
}
