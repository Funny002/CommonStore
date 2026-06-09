/**
 * Action 动作管理模块
 *
 * 提供 Action 的注册、注销、查询和执行功能。
 * Action 执行时自动触发插件的 beforeAction / afterAction / onError 钩子。
 */
import type { Store } from './store';

/**
 * Action 处理器类型定义
 * @template TArgs - 参数类型数组
 * @template TReturn - 返回值类型
 */
export type ActionHandler<TArgs extends unknown[] = unknown[], TReturn = unknown> = (store: Store, ...args: TArgs) => TReturn | Promise<TReturn>;

/** 所有已注册 action 的通用处理函数类型 */
type AnyActionHandler = ActionHandler<unknown[], unknown>;

/**
 * Action 管理器类
 * 提供动作的注册、注销、查询和执行功能
 */
export class ActionManager {
  /** 已注册的 action 映射表 */
  private readonly actions = new Map<string, AnyActionHandler>();
  /** 关联的 Store 实例 */
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
  async dispatch<TArgs extends unknown[], TReturn>(name: string, ...args: TArgs): Promise<TReturn> {
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
      } catch {
        // 插件钩子异常不污染 action 返回结果
      }
      return result as TReturn;
    } catch (error) {
      try {
        this.store.plugins.triggerErrorAction(name, error instanceof Error ? error : new Error(String(error)), processedArgs);
      } catch {
        // 插件钩子异常不覆盖原始 action 错误
      }
      throw error;
    }
  }
}
