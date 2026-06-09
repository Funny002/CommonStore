/**
 * Vue DevTools 集成插件
 *
 * 将 Store 集成到 Vue DevTools，提供 Inspector 状态面板和 Timeline 时间线。
 * 支持状态的树形浏览、在线编辑和 action 执行时间线追踪。
 *
 * 优先使用 setupDevtoolsPlugin（需传入 Vue app 实例），无 app 时降级到全局 Hook。
 */
import { setupDevToolsPlugin, type PluginSetupFunction, type App, type PluginDescriptor } from '@vue/devtools-kit';
import { nodeIdToPath, buildTree, buildStateItems } from './devtools-helpers';
import type { Plugin, Store } from '../core';

type DevToolsAPI = Parameters<PluginSetupFunction>[0];

/**
 * Vue DevTools 插件配置选项
 */
export interface VueDevtoolsOptions {
  /** Inspector 面板中显示的标签名，默认 'CommonStore' */
  inspectorLabel?: string;
  /** Timeline 面板中显示的图层标签名，默认 'Actions' */
  timelineLabel?: string;
}

/** 插件描述符 ID */
const PLUGIN_ID = 'dev.common-store';
/** Inspector 面板标识符 */
const INSPECTOR_ID = 'common-store';
/** Timeline 图层标识符 */
const TIMELINE_LAYER_ID = 'common-store:actions';

/**
 * Vue DevTools 插件 — 将 Store 集成到 Vue DevTools，提供 Inspector 状态面板和 Timeline 时间线
 * @param app - Vue 3 应用实例（可选；无 app 时降级为 Hook 方式）
 * @param options - 插件配置选项
 * @returns 插件实例
 */
export const VueDevtools = (app?: App, options: VueDevtoolsOptions = {}): Plugin<Store> => {
  const opts = {
    inspectorLabel: 'CommonStore',
    timelineLabel: 'Actions',
    ...options,
  } satisfies { inspectorLabel: string; timelineLabel: string };

  let storeInstance: Store | null = null;
  let api: DevToolsAPI | null = null;
  let isSetup = false;
  /** 抑制 Timeline 事件（编辑状态时） */
  let isTimelineActive = true;
  /** Action 分组计数器 */
  let actionGroupCounter = 0;
  /** actionName → groupId 栈，用于 start/end 事件配对 */
  const groupIdStack = new Map<string, string[]>();

  /** 获取指定路径的状态值 */
  const getStateValueAt = (path: string[]): unknown => {
    if (!storeInstance) return undefined;
    if (path.length === 0) return storeInstance.getState();
    return storeInstance.getState(path);
  };

  /** 刷新 Inspector 面板的树结构和状态显示 */
  const refreshInspector = () => {
    if (!api || !isSetup) return;
    api.sendInspectorTree(INSPECTOR_ID);
    api.sendInspectorState(INSPECTOR_ID);
  };

  /** 入栈 groupId（LIFO） */
  const pushGroupId = (actionName: string) => {
    actionGroupCounter++;
    const groupId = `${actionName}-${actionGroupCounter}`;
    const stack = groupIdStack.get(actionName);
    if (stack) {
      stack.push(groupId);
    } else {
      groupIdStack.set(actionName, [groupId]);
    }
    return groupId;
  };

  /** 出栈 groupId（LIFO），按 action 名称匹配 */
  const popGroupId = (actionName: string): string | null => {
    const stack = groupIdStack.get(actionName);
    if (!stack || stack.length === 0) return null;
    return stack.pop()!;
  };

  /** 向 Timeline 发送事件 */
  const sendTimelineEvent = (actionName: string, type: 'start' | 'end' | 'error', extras?: { result?: unknown; args?: unknown[]; error?: Error }) => {
    if (!api || !isSetup || !isTimelineActive) return;

    const now = api.now();
    let groupId: string | null = null;

    if (type === 'start') {
      groupId = pushGroupId(actionName);
    } else {
      groupId = popGroupId(actionName);
      if (!groupId) return;
    }

    const event: Record<string, unknown> = {
      time: now,
      title: actionName,
      subtitle: type,
      groupId,
    };

    const data: Record<string, unknown> = {};
    if (extras?.args) {
      data.args = extras.args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)));
    }
    if (type === 'end' && extras?.result !== undefined) {
      data.result = typeof extras.result === 'object' ? JSON.stringify(extras.result) : String(extras.result);
    }
    if (type === 'error' && extras?.error) {
      data.error = extras.error.message;
    }
    event.data = data;

    const logType = type === 'error' ? 'error' : 'default';

    api.addTimelineEvent({
      layerId: TIMELINE_LAYER_ID,
      event: {
        time: event.time as number,
        title: event.title as string,
        subtitle: event.subtitle as string,
        data: event.data as Record<string, unknown>,
        groupId: event.groupId as string,
        logType,
      },
    });
  };

  /** 初始化 DevTools 面板和事件监听 */
  const setupDevtools = (devtoolsApi: DevToolsAPI, appRef: App | null) => {
    api = devtoolsApi;

    api.addInspector({
      id: INSPECTOR_ID,
      label: opts.inspectorLabel,
      icon: 'storage',
      treeFilterPlaceholder: 'Search state...',
      stateFilterPlaceholder: 'Filter...',
      actions: [
        {
          icon: 'refresh',
          tooltip: 'Force refresh inspector',
          action: () => {
            refreshInspector();
          },
        },
      ],
    });

    api.addTimelineLayer({
      id: TIMELINE_LAYER_ID,
      label: opts.timelineLabel,
      color: 0x4fc08d,
    });

    api.on.getInspectorTree((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID) return;
      if (appRef && payload.app !== appRef) return;
      const state = storeInstance?.getState();
      if (state && typeof state === 'object') {
        payload.rootNodes = buildTree(state as Record<string, unknown>, payload.filter || undefined);
      }
    });

    api.on.getInspectorState((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID) return;
      if (appRef && payload.app !== appRef) return;
      const path = nodeIdToPath(payload.nodeId);
      const value = getStateValueAt(path);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        payload.state = {
          state: buildStateItems(value as Record<string, unknown>),
        };
      }
    });

    api.on.editInspectorState((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID || !storeInstance) return;
      if (appRef && payload.app !== appRef) return;
      const nodePath = nodeIdToPath(payload.nodeId);
      const targetKey = payload.path[1] ?? payload.path[0];
      const fullPath = [...nodePath, targetKey];

      isTimelineActive = false;
      try {
        if (payload.state.remove) {
          storeInstance.data.delete(fullPath);
        } else {
          storeInstance.data.set(fullPath, payload.state.value);
        }
      } finally {
        isTimelineActive = true;
      }
      refreshInspector();
    });

    api.on.inspectTimelineEvent((payload) => {
      if (payload.layerId !== TIMELINE_LAYER_ID) return;
    });

    api.on.timelineCleared(() => {
      actionGroupCounter = 0;
      groupIdStack.clear();
    });

    isSetup = true;
    refreshInspector();
  };

  /** 从 Vue DevTools 全局 Hook 获取 DevTools API（降级路径） */
  const getDevtoolsFromHook = (): Promise<DevToolsAPI | null> => {
    return new Promise((resolve) => {
      const g = globalThis as unknown as { __VUE_DEVTOOLS_GLOBAL_HOOK__?: any };
      const hook = g.__VUE_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) {
        resolve(null);
        return;
      }
      const timeout = setTimeout(() => resolve(null), 3000);
      const handler = (devtoolsApi: DevToolsAPI) => {
        clearTimeout(timeout);
        resolve(devtoolsApi);
      };
      if (typeof hook.once === 'function') {
        hook.once('init', handler);
      } else if (typeof hook.on === 'function') {
        hook.on('init', handler);
      } else {
        resolve(null);
      }
    });
  };

  return {
    name: 'vue-devtools',
    version: '1.0.0',

    install(store: Store) {
      storeInstance = store;

      if (app) {
        const descriptor: PluginDescriptor = {
          id: PLUGIN_ID,
          label: opts.inspectorLabel,
          app,
          packageName: 'common-store',
          homepage: 'https://github.com/Funny002/CommonStore',
          enableEarlyProxy: true,
        };
        setupDevToolsPlugin(descriptor, (devtoolsApi) => {
          if (!isSetup) {
            setupDevtools(devtoolsApi, app);
          }
        });
      } else {
        getDevtoolsFromHook().then((devtoolsApi) => {
          if (devtoolsApi && !isSetup) {
            setupDevtools(devtoolsApi, null);
          }
        });
      }
    },

    uninstall() {
      isSetup = false;
      isTimelineActive = true;
      api = null;
      storeInstance = null;
      actionGroupCounter = 0;
      groupIdStack.clear();
    },

    beforeAction(actionName: string, args: unknown[]) {
      if (!api || !isSetup) return;
      sendTimelineEvent(actionName, 'start', { args });
    },

    afterAction(actionName: string, result: unknown) {
      if (!api || !isSetup || !storeInstance) return;
      sendTimelineEvent(actionName, 'end', { result });
      refreshInspector();
    },

    onError(actionName: string, error: Error) {
      if (!api || !isSetup) return;
      sendTimelineEvent(actionName, 'error', { error });
    },

    onDataChange() {
      if (!api || !isSetup) return;
      refreshInspector();
    },
  };
};
