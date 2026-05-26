import type { Plugin, Store } from '../core';

export interface ReduxDevtoolsOptions {
  name?: string;
  maxAge?: number;
  latency?: number;
  features?: Record<string, boolean | string>;
  serialize?: boolean | {
    options?: Record<string, boolean | ((val: unknown) => unknown)>;
    immutable?: unknown;
  };
  actionSanitizer?: (action: Record<string, unknown>) => Record<string, unknown>;
  stateSanitizer?: (state: unknown) => unknown;
}

interface DevToolsConnection {
  send(action: Record<string, unknown> | null, state: unknown): void;
  init(state: unknown): void;
  subscribe(listener: (message: DevToolsMessage) => void): () => void;
  unsubscribe(): void;
  error(message: string): void;
}

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

export const ReduxDevtools = (options: ReduxDevtoolsOptions = {}): Plugin<Store> => {
  const opts = { ...defaultOptions, ...options };
  let storeInstance: Store | null = null;
  let connection: DevToolsConnection | null = null;
  let isApplyingFromDevtools = false;
  let unsubscribe: (() => void) | null = null;
  const startTimeMap = new Map<string, number>();

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

  const sendToDevtools = (action: Record<string, unknown> | null, state: unknown) => {
    if (!connection || isApplyingFromDevtools) return;
    const sanitizedState = opts.stateSanitizer ? opts.stateSanitizer(state) : state;
    connection.send(action, sanitizedState);
  };

  const handleMessage = (message: DevToolsMessage) => {
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
        const payload = typeof message.payload === 'string'
          ? JSON.parse(message.payload)
          : message.payload;
        if (payload && typeof payload === 'object' && (payload as Record<string, unknown>).type) {
          isApplyingFromDevtools = true;
          storeInstance.dispatch((payload as Record<string, unknown>).type as string);
        }
      } catch {
        // ignore invalid action payloads
      } finally {
        isApplyingFromDevtools = false;
      }
    }
  };

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
    version: '1.0.0',

    install(store: Store) {
      storeInstance = store;
      connection = getConnection();

      if (!connection) return;

      connection.init(store.getState());
      unsubscribe = connection.subscribe(handleMessage);
    },

    uninstall() {
      unsubscribe?.();
      unsubscribe = null;

      if (connection) {
        try {
          connection.unsubscribe();
        } catch {
          // may throw if already disconnected
        }
      }
      connection = null;
      storeInstance = null;
      startTimeMap.clear();
    },

    beforeAction(actionName: string) {
      startTimeMap.set(actionName, Date.now());
    },

    afterAction(actionName: string, _result: unknown, args: unknown[]) {
      if (!storeInstance) return;
      const action = opts.actionSanitizer
        ? opts.actionSanitizer({ type: actionName, args })
        : { type: actionName, args };
      sendToDevtools(action, storeInstance.getState());
    },

    onError(actionName: string, error: Error) {
      if (!connection || isApplyingFromDevtools) return;
      connection.error(`Action "${actionName}" failed: ${error.message}`);
    },
  };
};
