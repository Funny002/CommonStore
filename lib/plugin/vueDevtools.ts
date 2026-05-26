/**
 * Vue DevTools 集成插件
 *
 * 将 Store 集成到 Vue DevTools，提供 Inspector 状态面板和 Timeline 时间线。
 * 支持状态的树形浏览、在线编辑和 action 执行时间线追踪。
 */
import type { Plugin, Store } from "../core";

/**
 * Vue DevTools 插件配置选项
 */
export interface VueDevtoolsOptions {
  /** Inspector 面板中显示的标签名，默认 'CommonStore' */
  inspectorLabel?: string;
  /** Timeline 面板中显示的图层标签名，默认 'Actions' */
  timelineLabel?: string;
}

/** Vue DevTools API 接口 */
interface DevtoolsApi {
  addInspector(options: InspectorOptions): void;
  addTimelineLayer(options: TimelineLayerOptions): void;
  addTimelineEvent(options: TimelineEventOptions): void;
  sendInspectorTree(inspectorId: string): void;
  sendInspectorState(inspectorId: string): void;
  now(): number;
  on: {
    getInspectorTree: (handler: (payload: InspectorTreePayload) => void) => void;
    getInspectorState: (handler: (payload: InspectorStatePayload) => void) => void;
    editInspectorState: (handler: (payload: EditInspectorStatePayload) => void) => void;
    inspectTimelineEvent: (handler: (payload: InspectTimelineEventPayload) => void) => void;
  };
}

/** Inspector 面板配置 */
interface InspectorOptions {
  id: string;
  label: string;
  icon: string;
  treeFilterPlaceholder?: string;
  stateFilterPlaceholder?: string;
}

/** Timeline 图层配置 */
interface TimelineLayerOptions {
  id: string;
  label: string;
  color: number;
}

/** Timeline 事件配置 */
interface TimelineEventOptions {
  layerId: string;
  event: {
    time: number;
    title: string;
    subtitle?: string;
    data?: Record<string, unknown>;
    groupId?: string;
    logType?: "default" | "warning" | "error";
  };
}

/** Inspector 树节点 */
interface InspectorNode {
  id: string;
  label: string;
  children?: InspectorNode[];
  tags?: Array<{ label: string; textColor: number; backgroundColor: number }>;
}

/** getInspectorTree 回调的载荷 */
interface InspectorTreePayload {
  app: unknown;
  inspectorId: string;
  rootNodes: InspectorNode[];
}

/** Inspector 状态项 */
interface InspectorStateItem {
  key: string;
  value: unknown;
  editable: boolean;
}

/** getInspectorState 回调的载荷 */
interface InspectorStatePayload {
  app: unknown;
  inspectorId: string;
  nodeId: string;
  state: Record<string, InspectorStateItem[]>;
}

/** editInspectorState 回调的载荷 */
interface EditInspectorStatePayload {
  app: unknown;
  inspectorId: string;
  nodeId: string;
  path: string[];
  state: { value: unknown; newKey?: string; remove?: boolean };
  set: (obj: unknown, path: string[], value: unknown) => void;
}

/** inspectTimelineEvent 回调的载荷 */
interface InspectTimelineEventPayload {
  layerId: string;
  data: Record<string, unknown>;
}

/** Vue DevTools 全局 Hook 接口 */
interface DevtoolsHook {
  on(event: string, handler: (api: DevtoolsApi) => void): void;
  once?(event: string, handler: (api: DevtoolsApi) => void): void;
  emit(event: string, api: DevtoolsApi): void;
}

declare global {
  var __VUE_DEVTOOLS_GLOBAL_HOOK__: DevtoolsHook | undefined;
}

/** Inspector 面板标识符 */
const INSPECTOR_ID = "common-store";
/** Timeline 图层标识符 */
const TIMELINE_LAYER_ID = "common-store:actions";

/** 各类型值的标签颜色配置 */
const TAG_COLORS: Record<string, { textColor: number; backgroundColor: number }> = {
  object: { textColor: 0xffffff, backgroundColor: 0x4fc08d },
  array: { textColor: 0xffffff, backgroundColor: 0xe6a23c },
  string: { textColor: 0xffffff, backgroundColor: 0x409eff },
  number: { textColor: 0xffffff, backgroundColor: 0xf56c6c },
  boolean: { textColor: 0xffffff, backgroundColor: 0x909399 },
  null: { textColor: 0xffffff, backgroundColor: 0x909399 },
  function: { textColor: 0xffffff, backgroundColor: 0xb37feb },
};

/** Timeline 事件分组计数器，确保每组 action 有唯一 groupId */
let actionGroupCounter = 0;

/** 获取值的类型标签颜色 */
function getTypeTag(value: unknown): { textColor: number; backgroundColor: number } | undefined {
  if (value === null) return TAG_COLORS.null;
  if (Array.isArray(value)) return TAG_COLORS.array;
  const t = typeof value;
  if (t === "object") return TAG_COLORS.object;
  if (t === "string") return TAG_COLORS.string;
  if (t === "number") return TAG_COLORS.number;
  if (t === "boolean") return TAG_COLORS.boolean;
  if (t === "function") return TAG_COLORS.function;
  return undefined;
}

/** 将状态路径数组转换为 Inspector 节点 ID */
function pathToNodeId(path: string[]): string {
  return path.length === 0 ? "__root__" : path.join(".");
}

/** 将 Inspector 节点 ID 转换回状态路径数组 */
function nodeIdToPath(nodeId: string): string[] {
  if (nodeId === "__root__") return [];
  return nodeId.split(".");
}

/** 递归构建 Inspector 状态树 */
function buildTree(state: Record<string, unknown>, basePath: string[] = []): InspectorNode[] {
  const nodes: InspectorNode[] = [];
  for (const key of Object.keys(state).sort()) {
    const value = state[key];
    const nodePath = [...basePath, key];
    const node: InspectorNode = {
      id: pathToNodeId(nodePath),
      label: `${key}: ${formatValue(value)}`,
    };

    const tag = getTypeTag(value);
    if (tag) {
      node.tags = [{ label: typeof value === "object" && value !== null ? (Array.isArray(value) ? "array" : "object") : typeof value, ...tag }];
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      node.children = buildTree(value as Record<string, unknown>, nodePath);
    } else if (Array.isArray(value)) {
      node.children = (value as unknown[]).map((item, idx) => {
        const itemNode: InspectorNode = {
          id: pathToNodeId([...nodePath, String(idx)]),
          label: `${idx}: ${formatValue(item)}`,
        };
        const itemTag = getTypeTag(item);
        if (itemTag) {
          itemNode.tags = [{ label: typeof item === "object" && item !== null ? (Array.isArray(item) ? "array" : "object") : typeof item, ...itemTag }];
        }
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          itemNode.children = buildTree(item as Record<string, unknown>, [...nodePath, String(idx)]);
        }
        return itemNode;
      });
    }
    nodes.push(node);
  }
  return nodes;
}

/** 格式化状态值用于 Inspector 显示，超过 30 字符的字符串会截断 */
function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === "function") return "function";
  if (typeof value === "object") {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return `{ ${Object.keys(value as object)
      .slice(0, 3)
      .join(", ")}${Object.keys(value as object).length > 3 ? ", ..." : ""} }`;
  }
  return String(value);
}

/** 构建 Inspector 状态下各个属性的可编辑项列表 */
function buildStateItems(data: Record<string, unknown>): InspectorStateItem[] {
  return Object.keys(data)
    .sort()
    .map((key) => ({
      key,
      value: data[key],
      editable: true,
    }));
}

/**
 * Vue DevTools 插件 — 将 Store 集成到 Vue DevTools，提供 Inspector 状态面板和 Timeline 时间线
 * @param options - 插件配置选项
 * @returns 插件实例
 */
export const VueDevtools = (options: VueDevtoolsOptions = {}): Plugin<Store> => {
  const opts = {
    inspectorLabel: "CommonStore",
    timelineLabel: "Actions",
    ...options,
  };

  /** Store 实例引用 */
  let storeInstance: Store | null = null;
  /** Vue DevTools API 实例 */
  let api: DevtoolsApi | null = null;
  /** 标记 DevTools 是否已完成初始化设置 */
  let isSetup = false;

  /** 获取指定路径的状态值 */
  const getStateValueAt = (path: string[]): unknown => {
    if (!storeInstance) return undefined;
    return path.length === 0 ? storeInstance.getState() : storeInstance.getState(path);
  };

  /** 刷新 Inspector 面板的树结构和状态显示 */
  const refreshInspector = () => {
    if (!api || !isSetup) return;
    api.sendInspectorTree(INSPECTOR_ID);
    api.sendInspectorState(INSPECTOR_ID);
  };

  /** 初始化 DevTools 面板和事件监听 */
  const setupDevtools = (devtoolsApi: DevtoolsApi) => {
    api = devtoolsApi;

    api.addInspector({
      id: INSPECTOR_ID,
      label: opts.inspectorLabel,
      icon: "storage",
      treeFilterPlaceholder: "Search state...",
      stateFilterPlaceholder: "Filter...",
    });

    api.addTimelineLayer({
      id: TIMELINE_LAYER_ID,
      label: opts.timelineLabel,
      color: 0x4fc08d,
    });

    // 响应获取 Inspector 树结构的请求
    api.on.getInspectorTree((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID) return;
      const state = storeInstance?.getState();
      if (state && typeof state === "object") {
        payload.rootNodes = buildTree(state as Record<string, unknown>);
      }
    });

    // 响应获取 Inspector 节点状态的请求
    api.on.getInspectorState((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID) return;
      const path = nodeIdToPath(payload.nodeId);
      const value = getStateValueAt(path);
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        payload.state = {
          state: buildStateItems(value as Record<string, unknown>),
        };
      }
    });

    // 响应编辑 Inspector 状态的请求
    api.on.editInspectorState((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID || !storeInstance) return;
      const nodePath = nodeIdToPath(payload.nodeId);
      const targetKey = payload.path[1] ?? payload.path[0];
      const fullPath = [...nodePath, targetKey];

      if (payload.state.remove) {
        storeInstance.data.delete(fullPath);
        refreshInspector();
        return;
      }

      storeInstance.data.set(fullPath, payload.state.value);
      refreshInspector();
    });

    // 响应查看 Timeline 事件详情的请求
    api.on.inspectTimelineEvent((payload) => {
      if (payload.layerId !== TIMELINE_LAYER_ID) return;
    });

    isSetup = true;
    refreshInspector();
  };

  /** 从 Vue DevTools 全局 Hook 获取 DevTools API */
  const getDevtoolsFromHook = (): Promise<DevtoolsApi | null> => {
    return new Promise((resolve) => {
      const hook = globalThis.__VUE_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) {
        resolve(null);
        return;
      }
      const timeout = setTimeout(() => resolve(null), 3000);
      hook.once?.("init", (devtoolsApi: DevtoolsApi) => {
        clearTimeout(timeout);
        resolve(devtoolsApi);
      });
    });
  };

  return {
    name: "vue-devtools",
    version: "1.0.0",

    /**
     * 安装插件 — 异步等待 DevTools 初始化完成后设置面板
     */
    install(store: Store) {
      storeInstance = store;

      getDevtoolsFromHook().then((devtoolsApi) => {
        if (devtoolsApi && !isSetup) {
          setupDevtools(devtoolsApi);
        }
      });
    },

    /**
     * 卸载插件 — 清理内部状态
     */
    uninstall() {
      isSetup = false;
      api = null;
      storeInstance = null;
    },

    /**
     * Action 执行前 — 向 Timeline 发送 "start" 事件
     */
    beforeAction(actionName: string, args: unknown[]) {
      if (!api || !isSetup) return;
      actionGroupCounter++;
      const groupId = `${actionName}-${actionGroupCounter}`;

      api.addTimelineEvent({
        layerId: TIMELINE_LAYER_ID,
        event: {
          time: api.now(),
          title: actionName,
          subtitle: "start",
          data: { args: args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))) },
          groupId,
        },
      });
    },

    /**
     * Action 成功后 — 刷新 Inspector 面板
     */
    afterAction(_actionName: string, _result: unknown) {
      if (!api || !isSetup || !storeInstance) return;
      refreshInspector();
    },

    /**
     * Action 出错时 — 向 Timeline 发送错误事件
     */
    onError(actionName: string, error: Error) {
      if (!api || !isSetup) return;
      api.addTimelineEvent({
        layerId: TIMELINE_LAYER_ID,
        event: {
          time: api.now(),
          title: actionName,
          subtitle: `Error: ${error.message}`,
          data: { error: error.message },
          logType: "error",
        },
      });
    },

    /**
     * 数据变更时 — 刷新 Inspector 面板以反映最新状态
     */
    onDataChange() {
      if (!api || !isSetup) return;
      refreshInspector();
    },
  };
};
