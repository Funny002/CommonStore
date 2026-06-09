import type { Plugin, Store } from '../core';

/** Redux DevTools 连接选项 */
export interface ReduxDevtoolsOptions {
  /** DevTools 面板中显示的实例名称，默认 'CommonStore' */
  name?: string;

  /** DevTools 中保留的最大 action 记录数，默认 50 */
  maxAge?: number;

  /** 延迟报告（毫秒），默认 0 */
  latency?: number;

  /** DevTools 功能开关 */
  features?: Record<string, boolean | string>;

  /**
   * 序列化配置（传递给 Redux DevTools Extension）
   * @see https://github.com/zalmoxisus/redux-devtools-extension/blob/master/docs/API/Arguments.md#serialize
   */
  serialize?:
    | boolean
    | {
        options?: Record<string, boolean | ((val: unknown) => unknown)>;
      };

  /** 自定义 Action 展示格式转换 */
  actionSanitizer?: (action: Record<string, unknown>) => Record<string, unknown>;

  /** 自定义 State 展示格式转换 */
  stateSanitizer?: (state: unknown) => unknown;
}

/** Redux DevTools Extension 连接对象 */
interface DevToolsConnection {
  send(action: Record<string, unknown> | null, state: unknown): void;
  init(state: unknown): void;
  subscribe(listener: (message: DevToolsMessage) => void): () => void;
  unsubscribe(): void;
  error(message: string): void;
}

/** DevTools 消息格式 */
interface DevToolsMessage {
  type: string;
  payload?: {
    type: string;
    [key: string]: unknown;
  };
  state?: string;
}

const defaultOptions = {
  name: 'CommonStore',
  maxAge: 50,
  latency: 0,
};

/**
 * 创建 Redux DevTools 集成插件
 *
 * 安装后自动连接 `window.__REDUX_DEVTOOLS_EXTENSION__`，
 * 将 Store 状态映射为 DevTools 中的 state tree。
 *
 * @param options - 连接配置
 * @returns 插件实例
 */
export const ReduxDevtools = (options: ReduxDevtoolsOptions = {}): Plugin<Store> => {
  const opts = { ...defaultOptions, ...options };
  let storeInstance: Store | null = null;
  let connection: DevToolsConnection | null = null;
  let isApplyingFromDevtools = false;
  let devtoolsUnsubscribe: (() => void) | null = null;

  /**
   * 尝试获取 Redux DevTools Extension 连接
   * @returns 连接对象，不可用时返回 null
   */
  const getConnection = (): DevToolsConnection | null => {
    const win = (globalThis as any).window;
    if (!win) return null;
    const ext = win.__REDUX_DEVTOOLS_EXTENSION__;
    if (!ext) return null;

    const connOptions: Record<string, unknown> = {
      name: opts.name,
      maxAge: opts.maxAge,
      latency: opts.latency,
    };
    if (opts.features) {
      connOptions.features = opts.features;
    }
    if (opts.serialize !== undefined) {
      connOptions.serialize = opts.serialize;
    }

    return ext.connect(connOptions) as DevToolsConnection;
  };

  /**
   * 向 DevTools 发送 Action 和当前状态
   *
   * 当 isApplyingFromDevtools 为 true 时跳过（避免循环同步）。
   */
  const sendToDevtools = (action: Record<string, unknown> | null, state: unknown) => {
    if (!connection || isApplyingFromDevtools) return;
    const sanitizedState = opts.stateSanitizer ? opts.stateSanitizer(state) : state;
    connection.send(action, sanitizedState);
  };

  /**
   * 处理来自 DevTools Extension 的消息
   *
   * 支持的操作：
   * - JUMP_TO_STATE / JUMP_TO_ACTION：时间旅行跳转
   * - IMPORT_STATE：导入完整状态树
   * - RESET：重置到初始状态
   * - COMMIT：提交当前状态
   * - ROLLBACK：回滚到指定状态
   * - ACTION：从 DevTools 面板手动触发 action
   */
  const handleMessage = async (message: DevToolsMessage) => {
    if (!storeInstance) return;

    if (message.type === 'DISPATCH') {
      const payloadType = message.payload?.type;
      const parsedState = message.state ? JSON.parse(message.state) : null;

      switch (payloadType) {
        case 'JUMP_TO_STATE':
        case 'JUMP_TO_ACTION':
          if (parsedState) {
            applyState(parsedState);
          }
          break;

        case 'IMPORT_STATE': {
          const computedStates = (message.payload as any)?.nextLiftedState?.computedStates;
          if (computedStates && computedStates.length > 0) {
            const lastState = computedStates[computedStates.length - 1].state;
            applyState(lastState);
            connection?.send(null, (message.payload as any).nextLiftedState);
          }
          break;
        }

        case 'RESET':
          applyState(parsedState ?? {});
          break;

        case 'COMMIT':
          connection?.init(storeInstance.getState());
          break;

        case 'ROLLBACK':
          if (parsedState) {
            applyState(parsedState);
            connection?.init(storeInstance.getState());
          }
          break;
      }
    } else if (message.type === 'ACTION') {
      try {
        const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : message.payload;
        if (payload && typeof payload === 'object' && (payload as Record<string, unknown>).type) {
          isApplyingFromDevtools = true;
          try {
            await storeInstance.dispatch((payload as Record<string, unknown>).type as string);
          } finally {
            isApplyingFromDevtools = false;
          }
        }
      } catch {}
    }
  };

  /**
   * 将外部状态应用到 Store
   *
   * 应用期间暂停向 DevTools 同步（isApplyingFromDevtools=true）。
   */
  const applyState = (state: unknown) => {
    if (!storeInstance) return;
    isApplyingFromDevtools = true;
    try {
      storeInstance.data.set([], state);
    } finally {
      isApplyingFromDevtools = false;
    }
  };

  return {
    name: 'redux-devtools',
    version: '1.1.0',

    /**
     * 安装插件：连接 DevTools Extension 并初始化
     *
     * 若 DevTools 不可用，静默跳过（无连接时不产生副作用）。
     */
    install(store: Store) {
      storeInstance = store;
      connection = getConnection();

      if (!connection) return;

      connection.init(store.getState());
      devtoolsUnsubscribe = connection.subscribe(handleMessage);
    },

    /**
     * 卸载插件：断开 DevTools 连接并清理内部状态
     */
    uninstall() {
      if (connection) {
        try {
          connection.unsubscribe();
        } catch {}
      }
      devtoolsUnsubscribe?.();
      devtoolsUnsubscribe = null;
      connection = null;
      storeInstance = null;
    },

    /**
     * Action 执行成功后同步到 DevTools
     */
    afterAction(actionName: string, _result: unknown, args: unknown[]) {
      if (!storeInstance) return;
      const action = opts.actionSanitizer ? opts.actionSanitizer({ type: actionName, args }) : { type: actionName, args };
      sendToDevtools(action, storeInstance.getState());
    },

    /**
     * Action 执行出错时向 DevTools 报告错误
     */
    onError(actionName: string, error: Error) {
      if (!connection || isApplyingFromDevtools) return;
      connection.error(`Action "${actionName}" failed: ${error.message}`);
    },
  };
};
