/**
 * Redux DevTools 集成插件
 *
 * 将 Store 连接到 Redux DevTools Extension，提供时间旅行、action 回放、状态导入/导出等功能。
 */
import type { Plugin, Store } from "../core";

/**
 * Redux DevTools 插件配置选项
 */
export interface ReduxDevtoolsOptions {
  /** 在 DevTools 中显示的名称，默认 'CommonStore' */
  name?: string;
  /** 最大保留的 action 数量，默认 50 */
  maxAge?: number;
  /** 延迟发送毫秒数，默认 0 */
  latency?: number;
  /** 功能开关对象 */
  features?: Record<string, boolean | string>;
  /** 序列化配置 */
  serialize?:
    | boolean
    | {
        options?: Record<string, boolean | ((val: unknown) => unknown)>;
        immutable?: unknown;
      };
  /** 在发送前过滤 action 数据的函数 */
  actionSanitizer?: (action: Record<string, unknown>) => Record<string, unknown>;
  /** 在发送前过滤 state 数据的函数 */
  stateSanitizer?: (state: unknown) => unknown;
}

/** DevTools 扩展连接接口 */
interface DevToolsConnection {
  send(action: Record<string, unknown> | null, state: unknown): void;
  init(state: unknown): void;
  subscribe(listener: (message: DevToolsMessage) => void): () => void;
  unsubscribe(): void;
  error(message: string): void;
}

/** DevTools 消息结构 */
interface DevToolsMessage {
  type: string;
  payload?: {
    type: string;
    [key: string]: unknown;
  };
  state?: string;
}

/** 插件默认配置 */
const defaultOptions = {
  name: "CommonStore",
  maxAge: 50,
  latency: 0,
};

/**
 * Redux DevTools 插件 — 将 Store 集成到 Redux DevTools Extension，支持时间旅行和 action 回放
 * @param options - 插件配置选项
 * @returns 插件实例
 */
export const ReduxDevtools = (options: ReduxDevtoolsOptions = {}): Plugin<Store> => {
  const opts = { ...defaultOptions, ...options };
  /** Store 实例引用 */
  let storeInstance: Store | null = null;
  /** DevTools 扩展连接 */
  let connection: DevToolsConnection | null = null;
  /** 标记正在从 DevTools 应用状态，避免循环通知 */
  let isApplyingFromDevtools = false;
  /** 取消订阅回调 */
  let unsubscribe: (() => void) | null = null;
  /** 记录每个 action 的开始时间，用于计算耗时 */
  const startTimeMap = new Map<string, number>();

  /** 获取 Redux DevTools 扩展连接 */
  const getConnection = (): DevToolsConnection | null => {
    const g = typeof window !== "undefined" ? (window as any) : (globalThis as any);
    if (!g) return null;
    const ext = g.__REDUX_DEVTOOLS_EXTENSION__;
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

  /** 向 DevTools 发送 action 和当前状态 */
  const sendToDevtools = (action: Record<string, unknown> | null, state: unknown) => {
    if (!connection || isApplyingFromDevtools) return;
    const sanitizedState = opts.stateSanitizer ? opts.stateSanitizer(state) : state;
    connection.send(action, sanitizedState);
  };

  /** 处理来自 DevTools 扩展的消息 */
  const handleMessage = (message: DevToolsMessage) => {
    if (!storeInstance) return;

    if (message.type === "DISPATCH") {
      const payloadType = message.payload?.type;
      const parsedState = message.state ? JSON.parse(message.state) : null;

      switch (payloadType) {
        case "JUMP_TO_STATE":
        case "JUMP_TO_ACTION":
          if (parsedState) {
            applyState(parsedState);
          }
          break;

        case "IMPORT_STATE": {
          const computedStates = (message.payload as any)?.nextLiftedState?.computedStates;
          if (computedStates && computedStates.length > 0) {
            const lastState = computedStates[computedStates.length - 1].state;
            applyState(lastState);
            connection?.send(null, (message.payload as any).nextLiftedState);
          }
          break;
        }

        case "RESET":
          applyState(parsedState ?? {});
          break;

        case "COMMIT":
          connection?.init(storeInstance.getState());
          break;

        case "ROLLBACK":
          if (parsedState) {
            applyState(parsedState);
            connection?.init(storeInstance.getState());
          }
          break;
      }
    } else if (message.type === "ACTION") {
      try {
        const payload = typeof message.payload === "string" ? JSON.parse(message.payload) : message.payload;
        if (payload && typeof payload === "object" && (payload as Record<string, unknown>).type) {
          isApplyingFromDevtools = true;
          storeInstance.dispatch((payload as Record<string, unknown>).type as string);
        }
      } catch {
        // 忽略无效的 action 负载
      } finally {
        isApplyingFromDevtools = false;
      }
    }
  };

  /** 应用指定状态到 Store */
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
    name: "redux-devtools",
    version: "1.0.0",

    /**
     * 安装插件 — 连接 DevTools 扩展并初始化
     */
    install(store: Store) {
      storeInstance = store;
      connection = getConnection();

      if (!connection) return;

      connection.init(store.getState());
      unsubscribe = connection.subscribe(handleMessage);
    },

    /**
     * 卸载插件 — 断开连接并清理内部状态
     */
    uninstall() {
      unsubscribe?.();
      unsubscribe = null;

      if (connection) {
        try {
          connection.unsubscribe();
        } catch {
          // 连接已断开时可能抛出异常，忽略
        }
      }
      connection = null;
      storeInstance = null;
      startTimeMap.clear();
    },

    /**
     * Action 执行前 — 记录开始时间
     */
    beforeAction(actionName: string) {
      startTimeMap.set(actionName, Date.now());
    },

    /**
     * Action 成功后 — 向 DevTools 发送 action 和新状态
     */
    afterAction(actionName: string, _result: unknown, args: unknown[]) {
      if (!storeInstance) return;
      const action = opts.actionSanitizer ? opts.actionSanitizer({ type: actionName, args }) : { type: actionName, args };
      sendToDevtools(action, storeInstance.getState());
    },

    /**
     * Action 出错时 — 向 DevTools 发送错误信息
     */
    onError(actionName: string, error: Error) {
      if (!connection || isApplyingFromDevtools) return;
      connection.error(`Action "${actionName}" failed: ${error.message}`);
    },
  };
};
