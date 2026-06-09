import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { Store } from "../../lib";
import { ReduxDevtools } from "../../lib/redux-devtools";

describe("ReduxDevtools 插件", () => {
  let store: Store;
  let mockConnection: any;

  beforeAll(() => {
    vi.stubGlobal("window", {});
  });

  beforeEach(() => {
    store = new Store({ count: 0, user: { name: "Alice" } });

    mockConnection = {
      send: vi.fn(),
      init: vi.fn(),
      subscribe: vi.fn(() => {
        mockConnection._unsubscribe = vi.fn();
        return mockConnection._unsubscribe;
      }),
      unsubscribe: vi.fn(),
      error: vi.fn(),
    };

    globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__ = {
      connect: vi.fn(() => mockConnection),
    };
  });

  afterEach(() => {
    delete globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__;
  });

  describe("插件创建", () => {
    it("应该使用默认配置创建插件", () => {
      const plugin = ReduxDevtools();

      expect(plugin.name).toBe("redux-devtools");
      expect(plugin.version).toBe("1.1.0");
      expect(plugin.install).toBeDefined();
      expect(plugin.uninstall).toBeDefined();
      expect(plugin.afterAction).toBeDefined();
      expect(plugin.onError).toBeDefined();
    });

    it("应该支持自定义配置", () => {
      const plugin = ReduxDevtools({
        name: "MyStore",
        maxAge: 100,
        latency: 500,
      });

      expect(plugin.name).toBe("redux-devtools");
    });
  });

  describe("install - 安装插件", () => {
    it("安装时应该连接 DevTools 并发送初始状态", () => {
      const plugin = ReduxDevtools({ name: "TestStore" });
      store.use(plugin);

      const ext = globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__;
      expect(ext.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "TestStore",
          maxAge: 50,
          latency: 0,
        }),
      );
      expect(mockConnection.init).toHaveBeenCalledWith(store.getState());
      expect(mockConnection.subscribe).toHaveBeenCalled();
    });

    it("安装时应使用自定义 maxAge", () => {
      const plugin = ReduxDevtools({ maxAge: 100 });
      store.use(plugin);

      const ext = globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__;
      expect(ext.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          maxAge: 100,
        }),
      );
    });

    it("安装时应传递 features 配置", () => {
      const plugin = ReduxDevtools({
        features: { jump: true, export: true },
      });
      store.use(plugin);

      const ext = globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__;
      expect(ext.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          features: { jump: true, export: true },
        }),
      );
    });

    it("安装时应传递 serialize 配置", () => {
      const plugin = ReduxDevtools({
        serialize: { options: { function: true } },
      });
      store.use(plugin);

      const ext = globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__;
      expect(ext.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          serialize: { options: { function: true } },
        }),
      );
    });

    it("无 DevTools 环境时应静默跳过", () => {
      delete globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__;
      const plugin = ReduxDevtools();
      expect(() => store.use(plugin)).not.toThrow();
    });
  });

  describe("uninstall - 卸载插件", () => {
    it("卸载时应取消订阅并清理连接", () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      const unsub = mockConnection._unsubscribe;
      store.eject("redux-devtools");

      expect(unsub).toHaveBeenCalled();
    });
  });

  describe("afterAction - action 完成后发送状态", () => {
    it("action 执行后应该发送状态到 DevTools", async () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      store.actions.register("increment", () => {
        store.data.set("count", (store.getState("count") as number) + 1);
      });

      await store.dispatch("increment");

      expect(mockConnection.send).toHaveBeenCalledWith({ type: "increment", args: [] }, expect.any(Object));
    });

    it("应该发送包含 action 参数的状态", async () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      store.actions.register("setName", (_s, name: string) => {
        store.data.set("user.name", name);
      });

      await store.dispatch("setName", "Bob");

      expect(mockConnection.send).toHaveBeenCalledWith({ type: "setName", args: ["Bob"] }, expect.any(Object));
    });

    it("actionSanitizer 应正确过滤 action", async () => {
      const plugin = ReduxDevtools({
        actionSanitizer: (action) => ({ type: action.type }),
      });
      store.use(plugin);

      store.actions.register("test", () => {});
      await store.dispatch("test", "arg1", "arg2");

      expect(mockConnection.send).toHaveBeenCalledWith({ type: "test" }, expect.any(Object));
    });

    it("stateSanitizer 应正确过滤 state", async () => {
      const sanitized = { sanitized: true };
      const plugin = ReduxDevtools({
        stateSanitizer: () => sanitized,
      });
      store.use(plugin);

      store.actions.register("test", () => {});
      await store.dispatch("test");

      expect(mockConnection.send).toHaveBeenCalledWith(expect.any(Object), sanitized);
    });
  });

  describe("onError - 错误处理", () => {
    it("action 出错时应发送错误到 DevTools", async () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      store.actions.register("broken", () => {
        throw new Error("Something broke");
      });

      await store.dispatch("broken").catch(() => {});

      expect(mockConnection.error).toHaveBeenCalledWith('Action "broken" failed: Something broke');
    });
  });

  describe("JUMP_TO_STATE - 时间旅行", () => {
    it("收到 JUMP_TO_STATE 时应应用状态", () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "JUMP_TO_STATE" },
        state: JSON.stringify({ count: 999, user: { name: "Restored" } }),
      });

      expect(store.getState("count")).toBe(999);
      expect(store.getState("user.name")).toBe("Restored");
    });

    it("JUMP_TO_ACTION 也应应用状态", () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "JUMP_TO_ACTION" },
        state: JSON.stringify({ count: 42 }),
      });

      expect(store.getState("count")).toBe(42);
    });

    it("时间旅行时不应重复发送到 DevTools", async () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];
      mockConnection.send.mockClear();

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "JUMP_TO_STATE" },
        state: JSON.stringify({ count: 100 }),
      });

      expect(mockConnection.send).not.toHaveBeenCalled();
    });
  });

  describe("IMPORT_STATE - 导入状态", () => {
    it("收到 IMPORT_STATE 应提取并应用状态", () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      const nextLiftedState = {
        computedStates: [{ state: { count: 1 } }, { state: { count: 2 } }, { state: { count: 3, imported: true } }],
      };

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "IMPORT_STATE", nextLiftedState },
        state: JSON.stringify({ count: 3 }),
      });

      expect(store.getState("imported")).toBe(true);
      expect(store.getState("count")).toBe(3);
      expect(mockConnection.send).toHaveBeenCalledWith(null, nextLiftedState);
    });
  });

  describe("RESET - 重置状态", () => {
    it("收到 RESET 应重置到初始状态", () => {
      store.data.set("count", 42);
      const plugin = ReduxDevtools();
      store.use(plugin);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "RESET" },
        state: JSON.stringify({ count: 0, user: { name: "Alice" } }),
      });

      expect(store.getState("count")).toBe(0);
    });

    it("RESET 无 state 时重置到空状态", () => {
      store.data.set("count", 42);
      const plugin = ReduxDevtools();
      store.use(plugin);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "RESET" },
        state: undefined,
      });

      expect(store.getState()).toEqual({});
    });
  });

  describe("COMMIT - 提交状态", () => {
    it("收到 COMMIT 应重新初始化 DevTools", () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      store.data.set("count", 42);
      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "COMMIT" },
      });

      expect(mockConnection.init).toHaveBeenCalledWith(expect.objectContaining({ count: 42 }));
    });
  });

  describe("ROLLBACK - 回滚状态", () => {
    it("收到 ROLLBACK 应回滚并重新初始化", () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      store.data.set("count", 42);
      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      subscribeHandler({
        type: "DISPATCH",
        payload: { type: "ROLLBACK" },
        state: JSON.stringify({ count: 0, user: { name: "Alice" } }),
      });

      expect(store.getState("count")).toBe(0);
      expect(mockConnection.init).toHaveBeenCalled();
    });
  });

  describe("ACTION - 从 DevTools 分发 action", () => {
    it("收到 ACTION 消息应通过 store 分发", async () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      const handler = vi.fn();
      store.actions.register("remoteAction", handler);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      subscribeHandler({
        type: "ACTION",
        payload: JSON.stringify({ type: "remoteAction" }),
      });

      expect(handler).toHaveBeenCalled();
    });

    it("无效 ACTION payload 不应抛出", () => {
      const plugin = ReduxDevtools();
      store.use(plugin);

      const subscribeHandler = mockConnection.subscribe.mock.calls[0][0];

      expect(() =>
        subscribeHandler({
          type: "ACTION",
          payload: "invalid-json[[[",
        }),
      ).not.toThrow();
    });
  });

  describe("无 window 环境", () => {
    it("SSR 环境应静默跳过", () => {
      delete globalThis.window!.__REDUX_DEVTOOLS_EXTENSION__;

      const plugin = ReduxDevtools();
      expect(() => store.use(plugin)).not.toThrow();
    });
  });
});
