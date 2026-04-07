import type { Store } from './store';

/**
 * Action 处理器类型定义
 * @template TArgs - 参数类型数组
 * @template TReturn - 返回值类型
 */
export type ActionHandler<TArgs extends any[] = any[], TReturn = any> = (store: Store, ...args: TArgs) => TReturn | Promise<TReturn>;

type AnyActionHandler = ActionHandler<any[], any>;

/**
 * Action 管理器类
 * 提供动作的注册、注销、查询和执行功能
 */
export class ActionManager {
  private readonly actions = new Map<string, AnyActionHandler>();
  private readonly store: Store;

  /**
   * 构造函数
   * @param store - Store 实例引用
   */
  constructor(store: Store) {
    this.store = store;
  }

  /**
   * 注册一个 action 处理器
   * @param name - action 名称
   * @param handler - action 处理函数
   * @returns 当前实例，支持链式调用
   * @throws 如果 action 名称已存在
   */
  register<TArgs extends any[], TReturn>(name: string, handler: ActionHandler<TArgs, TReturn>): this {
    if (this.actions.has(name)) {
      throw new Error(`Action "${name}" is already registered.`);
    }
    this.actions.set(name, handler as AnyActionHandler);
    return this;
  }

  /**
   * 注销一个 action
   * @param name - action 名称
   * @returns 当前实例，支持链式调用
   * @throws 如果 action 不存在
   */
  unregister(name: string): this {
    if (!this.actions.delete(name)) {
      throw new Error(`Action "${name}" is not registered.`);
    }
    return this;
  }

  /**
   * 检查 action 是否已注册
   * @param name - action 名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.actions.has(name);
  }

  /**
   * 获取所有已注册的 action 名称列表
   * @returns action 名称数组
   */
  getActionNames(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * 执行指定的 action
   * 会触发插件的 beforeAction、afterAction 和 onError 钩子
   * @param name - action 名称
   * @param args - 传递给 action 的参数
   * @returns action 执行结果
   * @throws 如果 action 不存在或执行出错
   */
  async dispatch<TArgs extends any[], TReturn>(name: string, ...args: TArgs): Promise<TReturn> {
    const handler = this.actions.get(name);
    if (!handler) {
      const available = this.getActionNames().join(', ');
      throw new Error(`Action "${name}" not found. Available actions: ${available || '(none)'}`);
    }
    // 触发 beforeAction 钩子，允许插件修改参数
    const rawBeforeResult = this.store.plugins.triggerBeforeAction(name, args);
    const processedArgs = Array.isArray(rawBeforeResult) ? rawBeforeResult : args;
    try {
      // 执行 action 处理器
      const result = await handler(this.store, ...processedArgs);
      // 触发 afterAction 钩子
      this.store.plugins.triggerAfterAction(name, result, processedArgs);
      return result as TReturn;
    } catch (error) {
      // 触发错误处理钩子
      this.store.plugins.triggerErrorAction(name, error instanceof Error ? error : new Error(String(error)), processedArgs);
      throw error;
    }
  }
}
