import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PluginSetupFunction } from "@vue/devtools-kit";
type DevToolsAPI = Parameters<PluginSetupFunction>[0];
import { Store } from "../../lib";
import { VueDevtools } from "../../lib/vue-devtools";

const { mockApi, mockSetupDevtoolsPlugin, resetMockApi } = vi.hoisted(() => {
  let _onGetInspectorTree: Function = () => {};
  let _onGetInspectorState: Function = () => {};
  let _onEditInspectorState: Function = () => {};
  let _onInspectTimelineEvent: Function = () => {};
  let _onTimelineCleared: Function = () => {};

  const api = {
    addInspector: vi.fn(),
    addTimelineLayer: vi.fn(),
    addTimelineEvent: vi.fn(),
    sendInspectorTree: vi.fn(),
    sendInspectorState: vi.fn(),
    now: vi.fn(() => Date.now()),
    notifyComponentUpdate: vi.fn(),
    getComponentBounds: vi.fn(),
    getComponentName: vi.fn(),
    getComponentInstances: vi.fn(),
    highlightElement: vi.fn(),
    unhighlightElement: vi.fn(),
    getSettings: vi.fn(() => ({})),
    setSettings: vi.fn(),
    selectInspectorNode: vi.fn(),
    on: {
      getInspectorTree: vi.fn((h: Function) => { _onGetInspectorTree = h; }),
      getInspectorState: vi.fn((h: Function) => { _onGetInspectorState = h; }),
      editInspectorState: vi.fn((h: Function) => { _onEditInspectorState = h; }),
      inspectTimelineEvent: vi.fn((h: Function) => { _onInspectTimelineEvent = h; }),
      timelineCleared: vi.fn((h: Function) => { _onTimelineCleared = h; }),
    },
  };

  return {
    mockApi: {
      ...api,
      get _onGetInspectorTree() { return _onGetInspectorTree; },
      get _onGetInspectorState() { return _onGetInspectorState; },
      get _onEditInspectorState() { return _onEditInspectorState; },
      get _onInspectTimelineEvent() { return _onInspectTimelineEvent; },
      get _onTimelineCleared() { return _onTimelineCleared; },
    },
    mockSetupDevtoolsPlugin: vi.fn((_desc: any, setupFn: Function) => { setupFn(api); }),
    resetMockApi() {
      _onGetInspectorTree = () => {};
      _onGetInspectorState = () => {};
      _onEditInspectorState = () => {};
      _onInspectTimelineEvent = () => {};
      _onTimelineCleared = () => {};
    },
  };
});

vi.mock("@vue/devtools-kit", () => ({
  setupDevToolsPlugin: mockSetupDevtoolsPlugin,
}));

describe("VueDevtools 插件", () => {
  let store: Store;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockApi();
    mockSetupDevtoolsPlugin.mockImplementation((_desc: any, setupFn: Function) => { setupFn(mockApi); });
    store = new Store({ count: 0, user: { name: "Alice", age: 25 }, items: [1, 2, 3] });
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ============================================================
  // setupDevtoolsPlugin 路径
  // ============================================================
  describe("setupDevtoolsPlugin 路径", () => {
    const fakeApp = { uid: 1 };

    const install = (options?: Parameters<typeof VueDevtools>[1]) => {
      const plugin = VueDevtools(fakeApp, options);
      store.use(plugin);
      return plugin;
    };

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
      const plugin = VueDevtools(fakeApp, {
        inspectorLabel: "MyStore",
        timelineLabel: "MyActions",
      });
      expect(plugin.name).toBe("vue-devtools");
    });

    it("安装后应通过 setupDevtoolsPlugin 注册", () => {
      install({ inspectorLabel: "MyStore" });
      expect(mockSetupDevtoolsPlugin).toHaveBeenCalled();
    });

    it("安装后应注册 Inspector 和 Timeline", () => {
      install({ inspectorLabel: "MyStore" });

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

    it("应注册 Inspector 刷新 action 按钮", () => {
      install();
      const call = (mockApi.addInspector as any).mock.calls[0][0];
      expect(call.actions).toBeDefined();
      expect(call.actions.length).toBeGreaterThan(0);
      expect(call.actions[0].icon).toBe("refresh");
    });

    it("应注册 timelineCleared 回调", () => {
      install();
      expect(mockApi.on.timelineCleared).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getInspectorTree - 状态树
  // ============================================================
  describe("getInspectorTree - 状态树", () => {
    const fakeApp = { uid: 1 };

    const install = () => {
      const plugin = VueDevtools(fakeApp);
      store.use(plugin);
      return plugin;
    };

    it("应构建正确的状态树结构", () => {
      install();
      const payload: any = { app: fakeApp, inspectorId: "common-store", rootNodes: [], filter: "" };
      mockApi._onGetInspectorTree(payload);

      expect(payload.rootNodes.length).toBeGreaterThan(0);
      const countNode = payload.rootNodes.find((n: any) => n.label.includes("count"));
      expect(countNode).toBeDefined();
    });

    it("应正确展开嵌套对象", () => {
      install();
      const payload: any = { app: fakeApp, inspectorId: "common-store", rootNodes: [], filter: "" };
      mockApi._onGetInspectorTree(payload);

      const userNode = payload.rootNodes.find((n: any) => n.label.includes("user"));
      expect(userNode).toBeDefined();
      expect(userNode.children).toBeDefined();
      expect(userNode.children.length).toBeGreaterThan(0);
    });

    it("应正确处理数组", () => {
      install();
      const payload: any = { app: fakeApp, inspectorId: "common-store", rootNodes: [], filter: "" };
      mockApi._onGetInspectorTree(payload);

      const itemsNode = payload.rootNodes.find((n: any) => n.label.includes("items"));
      expect(itemsNode).toBeDefined();
      expect(itemsNode.tags).toBeDefined();
      expect(itemsNode.tags[0].label).toBe("array");
    });

    it("应正确处理数组中包含对象的元素", () => {
      const objStore = new Store({
        users: [
          { name: "Alice", role: "admin" },
          { name: "Bob", role: "user" },
        ],
      });
      const plugin = VueDevtools(fakeApp);
      objStore.use(plugin);

      const payload: any = { app: fakeApp, inspectorId: "common-store", rootNodes: [], filter: "" };
      mockApi._onGetInspectorTree(payload);

      const usersNode = payload.rootNodes.find((n: any) => n.label.includes("users"));
      expect(usersNode).toBeDefined();
      expect(usersNode.tags[0].label).toBe("array");
      expect(usersNode.children).toBeDefined();
      expect(usersNode.children.length).toBe(2);
      expect(usersNode.children[0].children).toBeDefined();
    });

    it("应支持 filter 过滤节点", () => {
      install();
      const payload: any = { app: fakeApp, inspectorId: "common-store", rootNodes: [], filter: "count" };
      mockApi._onGetInspectorTree(payload);

      expect(payload.rootNodes.some((n: any) => n.label.includes("count"))).toBe(true);
    });

    it("filter 不匹配时应尝试递归子节点", () => {
      install();
      const payload: any = { app: fakeApp, inspectorId: "common-store", rootNodes: [], filter: "name" };
      mockApi._onGetInspectorTree(payload);

      // "user" 节点本身不含 "name"，但其子节点包含，应保留
      const userNode = payload.rootNodes.find((n: any) => n.id === "user");
      expect(userNode).toBeDefined();
      expect(userNode.children).toBeDefined();
    });

    it("不属于本插件的 inspectorId 不应构建树", () => {
      install();
      const payload: any = { app: fakeApp, inspectorId: "other-inspector", rootNodes: [], filter: "" };
      mockApi._onGetInspectorTree(payload);

      expect(payload.rootNodes).toEqual([]);
    });

    it("app 不匹配时应跳过（scoping）", () => {
      install();
      const payload: any = { app: { uid: 999 }, inspectorId: "common-store", rootNodes: [], filter: "" };
      mockApi._onGetInspectorTree(payload);

      expect(payload.rootNodes).toEqual([]);
    });
  });

  // ============================================================
  // getInspectorState - 节点状态
  // ============================================================
  describe("getInspectorState - 节点状态", () => {
    const fakeApp = { uid: 1 };

    const install = () => {
      const plugin = VueDevtools(fakeApp);
      store.use(plugin);
      return plugin;
    };

    it("应返回对象节点的状态列表", () => {
      install();
      const payload: any = {
        app: fakeApp,
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

    it("非对象节点不应返回状态", () => {
      install();
      const payload: any = {
        app: fakeApp,
        inspectorId: "common-store",
        nodeId: "count",
        state: {},
      };
      mockApi._onGetInspectorState(payload);

      expect(payload.state.state).toBeUndefined();
    });

    it("app 不匹配时应跳过", () => {
      install();
      const payload: any = {
        app: { uid: 999 },
        inspectorId: "common-store",
        nodeId: "user",
        state: {},
      };
      mockApi._onGetInspectorState(payload);

      expect(payload.state.state).toBeUndefined();
    });
  });

  // ============================================================
  // editInspectorState - 状态编辑
  // ============================================================
  describe("editInspectorState - 状态编辑", () => {
    const fakeApp = { uid: 1 };

    const install = () => {
      const plugin = VueDevtools(fakeApp);
      store.use(plugin);
      return plugin;
    };

    it("应正确编辑状态值", () => {
      install();
      const payload: any = {
        app: fakeApp,
        inspectorId: "common-store",
        nodeId: "user",
        path: ["state", "name"],
        state: { value: "Bob" },
        set: vi.fn(),
      };
      mockApi._onEditInspectorState(payload);

      expect(store.getState("user.name")).toBe("Bob");
    });

    it("remove 应删除指定路径", () => {
      install();
      const payload: any = {
        app: fakeApp,
        inspectorId: "common-store",
        nodeId: "user",
        path: ["state", "age"],
        state: { remove: true },
        set: vi.fn(),
      };
      mockApi._onEditInspectorState(payload);

      expect(store.getState("user.age")).toBeUndefined();
    });

    it("编辑后应刷新 inspector", () => {
      install();
      (mockApi.sendInspectorTree as any).mockClear();
      (mockApi.sendInspectorState as any).mockClear();

      const payload: any = {
        app: fakeApp,
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

    it("不属于本插件的 inspectorId 不应处理", () => {
      install();
      const payload: any = {
        app: fakeApp,
        inspectorId: "other-inspector",
        nodeId: "user",
        path: ["state", "name"],
        state: { value: "ShouldNotChange" },
        set: vi.fn(),
      };
      mockApi._onEditInspectorState(payload);

      expect(store.getState("user.name")).toBe("Alice");
    });

    it("app 不匹配时应跳过", () => {
      install();
      const payload: any = {
        app: { uid: 999 },
        inspectorId: "common-store",
        nodeId: "user",
        path: ["state", "name"],
        state: { value: "ShouldNotChange" },
        set: vi.fn(),
      };
      mockApi._onEditInspectorState(payload);

      expect(store.getState("user.name")).toBe("Alice");
    });
  });

  // ============================================================
  // Timeline - 时间线分组
  // ============================================================
  describe("Timeline - 时间线分组", () => {
    const fakeApp = { uid: 1 };

    const install = () => {
      const plugin = VueDevtools(fakeApp);
      store.use(plugin);
      return plugin;
    };

    it("beforeAction 应发送 start 事件", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

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

    it("afterAction 应发送 end 事件并与 start 共享 groupId", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

      plugin.beforeAction?.("loadData", []);
      plugin.afterAction?.("loadData", "result");

      const calls = (mockApi.addTimelineEvent as any).mock.calls;
      expect(calls.length).toBe(2);

      const startCall = calls[0][0];
      const endCall = calls[1][0];

      expect(startCall.event.groupId).toBeDefined();
      expect(endCall.event.groupId).toBeDefined();
      expect(startCall.event.groupId).toBe(endCall.event.groupId);
      expect(startCall.event.subtitle).toBe("start");
      expect(endCall.event.subtitle).toBe("end");
    });

    it("afterAction 的 end 事件应包含 result 数据", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

      plugin.beforeAction?.("compute", []);
      plugin.afterAction?.("compute", { sum: 100 });

      const calls = (mockApi.addTimelineEvent as any).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[1][0].event.data.result).toBeDefined();
    });

    it("onError 应发送 error 事件并与 start 共享 groupId", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

      plugin.beforeAction?.("failingAction", []);
      plugin.onError?.("failingAction", new Error("Test error"));

      const calls = (mockApi.addTimelineEvent as any).mock.calls;
      expect(calls.length).toBe(2);

      const startCall = calls[0][0];
      const errorCall = calls[1][0];

      expect(startCall.event.groupId).toBe(errorCall.event.groupId);
      expect(errorCall.event.logType).toBe("error");
      expect(errorCall.event.data.error).toBe("Test error");
    });

    it("连续同名 action 应正确配对 start/end（LIFO）", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

      plugin.beforeAction?.("multiAction", ["a"]);
      plugin.beforeAction?.("multiAction", ["b"]);
      plugin.afterAction?.("multiAction", "resultB");
      plugin.afterAction?.("multiAction", "resultA");

      const calls = (mockApi.addTimelineEvent as any).mock.calls;
      expect(calls.length).toBe(4);

      // LIFO: afterAction 第1个配对 beforeAction 第2个
      expect(calls[2][0].event.groupId).toBe(calls[1][0].event.groupId);
      expect(calls[3][0].event.groupId).toBe(calls[0][0].event.groupId);
      expect(calls[2][0].event.groupId).not.toBe(calls[0][0].event.groupId);
    });

    it("不同名 action 应使用独立的 groupId 栈", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

      plugin.beforeAction?.("actionA", []);
      plugin.beforeAction?.("actionB", []);
      plugin.afterAction?.("actionA", "rA");
      plugin.afterAction?.("actionB", "rB");

      const calls = (mockApi.addTimelineEvent as any).mock.calls;
      expect(calls[0][0].event.groupId).toBe(calls[2][0].event.groupId);
      expect(calls[1][0].event.groupId).toBe(calls[3][0].event.groupId);
    });

    it("afterAction 无匹配 start 时应静默跳过", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

      expect(() => plugin.afterAction?.("neverStarted", "result")).not.toThrow();
      expect(mockApi.addTimelineEvent).not.toHaveBeenCalled();
    });

    it("timelineCleared 应重置分组状态", () => {
      const plugin = install();
      (mockApi.addTimelineEvent as any).mockClear();

      plugin.beforeAction?.("test", []);
      expect((mockApi.addTimelineEvent as any).mock.calls.length).toBe(1);

      mockApi._onTimelineCleared({});

      // 清除后 afterAction 应找不到匹配的 groupId
      (mockApi.addTimelineEvent as any).mockClear();
      plugin.afterAction?.("test", "orphan");
      expect((mockApi.addTimelineEvent as any).mock.calls.length).toBe(0);

      // 新 beforeAction 应正常工作
      plugin.beforeAction?.("test", []);
      plugin.afterAction?.("test", "done");
      const calls = (mockApi.addTimelineEvent as any).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0].event.groupId).toBe(calls[1][0].event.groupId);
    });
  });

  // ============================================================
  // afterAction / onDataChange 刷新
  // ============================================================
  describe("afterAction / onDataChange 刷新", () => {
    const fakeApp = { uid: 1 };

    const install = () => {
      const plugin = VueDevtools(fakeApp);
      store.use(plugin);
      return plugin;
    };

    it("afterAction 应刷新 inspector", () => {
      const plugin = install();
      (mockApi.sendInspectorTree as any).mockClear();
      (mockApi.sendInspectorState as any).mockClear();

      plugin.beforeAction?.("testAction", []);
      plugin.afterAction?.("testAction", "result");

      expect(mockApi.sendInspectorTree).toHaveBeenCalledWith("common-store");
      expect(mockApi.sendInspectorState).toHaveBeenCalledWith("common-store");
    });

    it("onDataChange 应刷新 inspector", () => {
      install();
      (mockApi.sendInspectorTree as any).mockClear();
      (mockApi.sendInspectorState as any).mockClear();

      store.data.set("count", 100);

      expect(mockApi.sendInspectorTree).toHaveBeenCalledWith("common-store");
      expect(mockApi.sendInspectorState).toHaveBeenCalledWith("common-store");
    });
  });

  // ============================================================
  // inspectTimelineEvent
  // ============================================================
  describe("inspectTimelineEvent", () => {
    const fakeApp = { uid: 1 };

    const install = () => {
      const plugin = VueDevtools(fakeApp);
      store.use(plugin);
      return plugin;
    };

    it("应按 layerId 过滤", () => {
      install();
      expect(() =>
        mockApi._onInspectTimelineEvent({
          layerId: "common-store:actions",
          data: {},
        }),
      ).not.toThrow();

      expect(() =>
        mockApi._onInspectTimelineEvent({
          layerId: "other-layer",
          data: {},
        }),
      ).not.toThrow();
    });
  });

  // ============================================================
  // uninstall - 卸载插件
  // ============================================================
  describe("uninstall - 卸载插件", () => {
    const fakeApp = { uid: 1 };

    const install = () => {
      const plugin = VueDevtools(fakeApp);
      store.use(plugin);
      return plugin;
    };

    it("卸载时应清理状态并不抛异常", () => {
      const plugin = install();
      plugin.uninstall?.();
      expect(() => plugin.beforeAction?.("test", [])).not.toThrow();
      expect(() => plugin.afterAction?.("test", "result")).not.toThrow();
    });
  });

  // ============================================================
  // Hook 降级路径测试
  // ============================================================
  describe("Hook 降级路径", () => {
    it("无 app 时应使用 Hook 注册", async () => {
      const hook = {
        on: vi.fn(),
        once: vi.fn((_event: string, handler: Function) => {
          queueMicrotask(() => handler(mockApi));
        }),
        emit: vi.fn(),
      };
      vi.stubGlobal("__VUE_DEVTOOLS_GLOBAL_HOOK__", hook);

      const plugin = VueDevtools(undefined, { inspectorLabel: "HookStore" });
      store.use(plugin);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(hook.once).toHaveBeenCalledWith("init", expect.any(Function));
      expect(mockApi.addInspector).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "common-store",
          label: "HookStore",
        }),
      );
    });

    it("Hook 降级路径的 Timeline 分组应正常工作", async () => {
      const hook = {
        on: vi.fn(),
        once: vi.fn((_event: string, handler: Function) => {
          queueMicrotask(() => handler(mockApi));
        }),
        emit: vi.fn(),
      };
      vi.stubGlobal("__VUE_DEVTOOLS_GLOBAL_HOOK__", hook);

      const plugin = VueDevtools(undefined);
      store.use(plugin);
      await new Promise((resolve) => setTimeout(resolve, 50));

      (mockApi.addTimelineEvent as any).mockClear();

      plugin.beforeAction?.("hookAction", []);
      plugin.afterAction?.("hookAction", "done");

      const calls = (mockApi.addTimelineEvent as any).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0].event.groupId).toBe(calls[1][0].event.groupId);
    });

    it("无 Vue DevTools 环境时应静默跳过（无 hook）", () => {
      const plugin = VueDevtools(undefined);
      expect(() => store.use(plugin)).not.toThrow();
      expect(() => plugin.beforeAction?.("test", [])).not.toThrow();
      expect(() => plugin.afterAction?.("test", "result")).not.toThrow();
    });

    it("Hook 存在但无 init 事件应超时静默处理", async () => {
      vi.stubGlobal("__VUE_DEVTOOLS_GLOBAL_HOOK__", {
        once: vi.fn(() => {}),
        on: vi.fn(() => {}),
      });

      const plugin = VueDevtools(undefined);
      store.use(plugin);

      await new Promise((resolve) => setTimeout(resolve, 3100));
      expect(() => plugin.beforeAction?.("test", [])).not.toThrow();
    }, 5000);
  });
});
