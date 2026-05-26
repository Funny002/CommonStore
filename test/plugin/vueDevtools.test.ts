import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { Store, VueDevtools } from "../../lib";

describe("VueDevtools 插件", () => {
  let store: Store;
  let mockApi: any;
  let hookCallbacks: Record<string, Function[]>;

  beforeAll(() => {
    vi.stubGlobal("window", {});
  });

  beforeEach(() => {
    store = new Store({ count: 0, user: { name: "Alice", age: 25 }, items: [1, 2, 3] });

    hookCallbacks = {};

    mockApi = {
      addInspector: vi.fn(),
      addTimelineLayer: vi.fn(),
      addTimelineEvent: vi.fn(),
      sendInspectorTree: vi.fn(),
      sendInspectorState: vi.fn(),
      now: vi.fn(() => Date.now()),
      on: {
        getInspectorTree: vi.fn((handler: Function) => {
          mockApi._onGetInspectorTree = handler;
        }),
        getInspectorState: vi.fn((handler: Function) => {
          mockApi._onGetInspectorState = handler;
        }),
        editInspectorState: vi.fn((handler: Function) => {
          mockApi._onEditInspectorState = handler;
        }),
        inspectTimelineEvent: vi.fn((handler: Function) => {
          mockApi._onInspectTimelineEvent = handler;
        }),
      },
    };

    vi.stubGlobal("__VUE_DEVTOOLS_GLOBAL_HOOK__", {
      on: vi.fn((event: string, handler: Function) => {
        if (!hookCallbacks[event]) hookCallbacks[event] = [];
        hookCallbacks[event].push(handler);
      }),
      once: vi.fn((event: string, handler: Function) => {
        if (!hookCallbacks[event]) hookCallbacks[event] = [];
        hookCallbacks[event].push(handler);
      }),
      emit: vi.fn((event: string, data?: unknown) => {
        if (hookCallbacks[event]) {
          for (const cb of hookCallbacks[event]) {
            cb(data);
          }
        }
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fireInit = () => {
    if (hookCallbacks["init"]) {
      for (const cb of hookCallbacks["init"]) {
        cb(mockApi);
      }
    }
  };

  const waitForSetup = () => new Promise((resolve) => setTimeout(resolve, 100));

  describe("插件创建", () => {
    it("应该使用默认配置创建插件", () => {
      const plugin = VueDevtools();

      expect(plugin.name).toBe("vue-devtools");
      expect(plugin.version).toBe("1.0.0");
      expect(plugin.install).toBeDefined();
      expect(plugin.uninstall).toBeDefined();
      expect(plugin.beforeAction).toBeDefined();
      expect(plugin.afterAction).toBeDefined();
      expect(plugin.onError).toBeDefined();
      expect(plugin.onDataChange).toBeDefined();
    });

    it("应该支持自定义配置", () => {
      const plugin = VueDevtools({
        inspectorLabel: "MyStore",
        timelineLabel: "MyActions",
      });

      expect(plugin.name).toBe("vue-devtools");
    });
  });

  describe("install - 安装插件", () => {
    it("安装时应注册 DevTools hook 监听", () => {
      const plugin = VueDevtools();
      store.use(plugin);

      const hook = globalThis.__VUE_DEVTOOLS_GLOBAL_HOOK__!;
      expect(hook.once).toHaveBeenCalledWith("init", expect.any(Function));
    });

    it("收到 init 事件后应设置 Inspector 和 Timeline", async () => {
      const plugin = VueDevtools({ inspectorLabel: "MyStore" });
      store.use(plugin);
      fireInit();
      await waitForSetup();

      expect(mockApi.addInspector).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "common-store",
          label: "MyStore",
          icon: "storage",
        }),
      );

      expect(mockApi.addTimelineLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "common-store:actions",
          label: "Actions",
        }),
      );
    });

    it("无 Vue DevTools 环境时应静默跳过", () => {
      vi.unstubAllGlobals();
      const plugin = VueDevtools();
      expect(() => store.use(plugin)).not.toThrow();
    });
  });

  describe("getInspectorTree - 状态树", () => {
    it("应构建正确的状态树结构", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = { app: null, inspectorId: "common-store", rootNodes: [] };
      mockApi._onGetInspectorTree(payload);

      expect(payload.rootNodes.length).toBeGreaterThan(0);
      const countNode = payload.rootNodes.find((n: any) => n.label.includes("count"));
      expect(countNode).toBeDefined();
    });

    it("应正确展开嵌套对象", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = { app: null, inspectorId: "common-store", rootNodes: [] };
      mockApi._onGetInspectorTree(payload);

      const userNode = payload.rootNodes.find((n: any) => n.label.includes("user"));
      expect(userNode).toBeDefined();
      expect(userNode.children).toBeDefined();
      expect(userNode.children.length).toBeGreaterThan(0);
    });

    it("应正确处理数组", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = { app: null, inspectorId: "common-store", rootNodes: [] };
      mockApi._onGetInspectorTree(payload);

      const itemsNode = payload.rootNodes.find((n: any) => n.label.includes("items"));
      expect(itemsNode).toBeDefined();
      expect(itemsNode.tags).toBeDefined();
      expect(itemsNode.tags[0].label).toBe("array");
    });

    it("应正确处理数组中包含对象的元素", async () => {
      const objStore = new Store({
        users: [
          { name: "Alice", role: "admin" },
          { name: "Bob", role: "user" },
        ],
      });
      const plugin = VueDevtools();
      objStore.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = { app: null, inspectorId: "common-store", rootNodes: [] };
      mockApi._onGetInspectorTree(payload);

      const usersNode = payload.rootNodes.find((n: any) => n.label.includes("users"));
      expect(usersNode).toBeDefined();
      expect(usersNode.tags[0].label).toBe("array");
      expect(usersNode.children).toBeDefined();
      expect(usersNode.children.length).toBe(2);
      expect(usersNode.children[0].children).toBeDefined();
    });

    it("不应为不属于本插件的 inspectorId 构建树", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = { app: null, inspectorId: "other-inspector", rootNodes: [] };
      mockApi._onGetInspectorTree(payload);

      expect(payload.rootNodes).toEqual([]);
    });
  });

  describe("getInspectorState - 节点状态", () => {
    it("应返回对象的状态列表", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = {
        app: null,
        inspectorId: "common-store",
        nodeId: "user",
        state: {},
      };
      mockApi._onGetInspectorState(payload);

      expect(payload.state.state).toBeDefined();
      const nameItem = payload.state.state.find((s: any) => s.key === "name");
      expect(nameItem).toBeDefined();
      expect(nameItem.value).toBe("Alice");
      expect(nameItem.editable).toBe(true);
    });

    it("非对象节点不应返回状态", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = {
        app: null,
        inspectorId: "common-store",
        nodeId: "count",
        state: {},
      };
      mockApi._onGetInspectorState(payload);

      expect(payload.state.state).toBeUndefined();
    });
  });

  describe("editInspectorState - 状态编辑", () => {
    it("应正确编辑状态值", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = {
        app: null,
        inspectorId: "common-store",
        nodeId: "user",
        path: ["state", "name"],
        state: { value: "Bob" },
        set: vi.fn(),
      };
      mockApi._onEditInspectorState(payload);

      expect(store.getState("user.name")).toBe("Bob");
    });

    it("remove 应删除指定路径", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const payload: any = {
        app: null,
        inspectorId: "common-store",
        nodeId: "user",
        path: ["state", "age"],
        state: { remove: true },
        set: vi.fn(),
      };
      mockApi._onEditInspectorState(payload);

      expect(store.getState("user.age")).toBeUndefined();
    });

    it("编辑后应刷新 inspector", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      mockApi.sendInspectorTree.mockClear();
      mockApi.sendInspectorState.mockClear();

      const payload: any = {
        app: null,
        inspectorId: "common-store",
        nodeId: "user",
        path: ["state", "name"],
        state: { value: "Charlie" },
        set: vi.fn(),
      };
      mockApi._onEditInspectorState(payload);

      expect(mockApi.sendInspectorTree).toHaveBeenCalledWith("common-store");
      expect(mockApi.sendInspectorState).toHaveBeenCalledWith("common-store");
    });
  });

  describe("Timeline - 时间线事件", () => {
    it("beforeAction 应发送 timeline 事件", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      plugin.beforeAction?.("testAction", ["arg1"]);

      expect(mockApi.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          layerId: "common-store:actions",
          event: expect.objectContaining({
            title: "testAction",
            subtitle: "start",
          }),
        }),
      );
    });

    it("beforeAction 应包含 groupId", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      plugin.beforeAction?.("loadData", []);

      const call = mockApi.addTimelineEvent.mock.calls[0][0];
      expect(call.event.groupId).toBeDefined();
      expect(call.event.groupId).toContain("loadData");
    });

    it("inspectTimelineEvent 应正确处理本层事件", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      expect(() =>
        mockApi._onInspectTimelineEvent({
          layerId: "common-store:actions",
          data: { some: "data" },
        }),
      ).not.toThrow();
    });
  });

  describe("afterAction - action 完成后刷新", () => {
    it("action 完成后应刷新 inspector", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      mockApi.sendInspectorTree.mockClear();
      mockApi.sendInspectorState.mockClear();

      plugin.afterAction?.("testAction", "result");

      expect(mockApi.sendInspectorTree).toHaveBeenCalledWith("common-store");
      expect(mockApi.sendInspectorState).toHaveBeenCalledWith("common-store");
    });
  });

  describe("onError - 错误时间线", () => {
    it("action 出错时应发送错误时间线事件", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      const error = new Error("Test error");
      plugin.onError?.("failedAction", error);

      expect(mockApi.addTimelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          layerId: "common-store:actions",
          event: expect.objectContaining({
            title: "failedAction",
            subtitle: "Error: Test error",
            logType: "error",
          }),
        }),
      );
    });
  });

  describe("onDataChange - 数据变更刷新", () => {
    it("数据变更时应刷新 inspector", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      mockApi.sendInspectorTree.mockClear();
      mockApi.sendInspectorState.mockClear();

      plugin.onDataChange?.(["count"], 1, 0);

      expect(mockApi.sendInspectorTree).toHaveBeenCalledWith("common-store");
      expect(mockApi.sendInspectorState).toHaveBeenCalledWith("common-store");
    });
  });

  describe("uninstall - 卸载插件", () => {
    it("卸载时应清理状态", async () => {
      const plugin = VueDevtools();
      store.use(plugin);
      fireInit();
      await waitForSetup();

      plugin.uninstall?.();

      expect(() => plugin.beforeAction?.("test", [])).not.toThrow();
    });
  });

  describe("无 Vue DevTools 环境", () => {
    it("无 hook 时应静默跳过", () => {
      vi.unstubAllGlobals();
      const plugin = VueDevtools();

      expect(() => store.use(plugin)).not.toThrow();
      expect(() => plugin.beforeAction?.("test", [])).not.toThrow();
      expect(() => plugin.afterAction?.("test", "result")).not.toThrow();
    });

    it("hook 存在但无 init 事件应超时静默处理", async () => {
      vi.stubGlobal("__VUE_DEVTOOLS_GLOBAL_HOOK__", {
        once: vi.fn(() => {}),
      });

      const plugin = VueDevtools();
      store.use(plugin);

      await new Promise((resolve) => setTimeout(resolve, 3100));

      expect(() => plugin.beforeAction?.("test", [])).not.toThrow();
    }, 5000);
  });
});
