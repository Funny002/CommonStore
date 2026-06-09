import { setupDevToolsPlugin, type PluginSetupFunction, type App, type PluginDescriptor } from '@vue/devtools-kit';
import { nodeIdToPath, buildTree, buildStateItems } from './devtools-helpers';
import type { Plugin, Store } from '../core';

/** Vue DevTools 插件 API 类型 */
type DevToolsAPI = Parameters<PluginSetupFunction>[0];

/** Vue DevTools 插件配置选项 */
export interface VueDevtoolsOptions {
  /** Inspector 面板标签，默认 'CommonStore' */
  inspectorLabel?: string;

  /** Timeline 面板标签，默认 'Actions' */
  timelineLabel?: string;
}

const PLUGIN_ID = 'dev.common-store';

const INSPECTOR_ID = 'common-store';

const TIMELINE_LAYER_ID = 'common-store:actions';

/**
 * 创建 Vue DevTools 集成插件
 *
 * @param app - Vue 应用实例（可选，不传则自动检测）
 * @param options - 显示配置
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

  /** 控制 Timeline 事件是否活跃（编辑状态时暂停避免循环） */
  let isTimelineActive = true;

  /** Action分组计数器，用于生成唯一 groupId */
  let actionGroupCounter = 0;

  /** Action 名称 → groupId 栈 映射（支持嵌套同名 action） */
  const groupIdStack = new Map<string, string[]>();

  /**
   * 从 Store 获取指定路径的值
   */
  const getStateValueAt = (path: string[]): unknown => {
    if (!storeInstance) return undefined;
    if (path.length === 0) return storeInstance.getState();
    return storeInstance.getState(path);
  };

  /**
   * 刷新 Inspector 面板（发送 tree 和 state）
   */
  const refreshInspector = () => {
    if (!api || !isSetup) return;
    api.sendInspectorTree(INSPECTOR_ID);
    api.sendInspectorState(INSPECTOR_ID);
  };

  /**
   * 为指定 action 创建新的 groupId 并入栈
   */
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

  /**
   * 从 action 对应的 groupId 栈中弹出最后一个
   */
  const popGroupId = (actionName: string): string | null => {
    const stack = groupIdStack.get(actionName);
    if (!stack || stack.length === 0) return null;
    return stack.pop()!;
  };

  /**
   * 向 Timeline 发送事件
   *
   * @param actionName - Action 名称
   * @param type - 事件类型：start / end / error
   * @param extras - 附加数据（参数、结果、错误）
   */
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

  /**
   * 向 Vue DevTools 注册 Inspector、Timeline 及相关事件处理器
   */
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

    // 构建状态树
    api.on.getInspectorTree((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID) return;
      if (appRef && payload.app !== appRef) return;
      const state = storeInstance?.getState();
      if (state && typeof state === 'object') {
        payload.rootNodes = buildTree(state as Record<string, unknown>, payload.filter || undefined);
      }
    });

    // 获取选中节点的状态
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

    // 在 Inspector 中编辑状态值
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

    // Timeline 事件检查
    api.on.inspectTimelineEvent((payload) => {
      if (payload.layerId !== TIMELINE_LAYER_ID) return;
    });

    // Timeline 清空时重置计数器
    api.on.timelineCleared(() => {
      actionGroupCounter = 0;
      groupIdStack.clear();
    });

    isSetup = true;
    refreshInspector();
  };

  /**
   * 从 Vue DevTools global hook 异步获取 DevTools API
   *
   * 超时 3 秒后返回 null。
   *
   * @returns DevTools API 或 null
   */
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

    /**
     * 安装插件：注册到 Vue DevTools
     *
     * 有 app 实例时通过 setupDevToolsPlugin 注册；
     * 无 app 时从 global hook 异步获取 API。
     */
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

    /**
     * 卸载插件：清理所有 DevTools 注册和内部状态
     *
     * 注意：@vue/devtools-kit 当前不提供 removeInspector /
     * removeTimelineLayer API，卸载后 DevTools UI 可能残留注册项。
     */
    uninstall() {
      isSetup = false;
      isTimelineActive = true;
      api = null;
      storeInstance = null;
      actionGroupCounter = 0;
      groupIdStack.clear();
    },

    /**
     * Action 开始前发送 Timeline start 事件
     */
    beforeAction(actionName: string, args: unknown[]) {
      if (!api || !isSetup) return;
      sendTimelineEvent(actionName, 'start', { args });
    },

    /**
     * Action 完成后发送 Timeline end 事件并刷新 Inspector
     */
    afterAction(actionName: string, result: unknown) {
      if (!api || !isSetup || !storeInstance) return;
      sendTimelineEvent(actionName, 'end', { result });
      refreshInspector();
    },

    /**
     * Action 出错时发送 Timeline error 事件
     */
    onError(actionName: string, error: Error) {
      if (!api || !isSetup) return;
      sendTimelineEvent(actionName, 'error', { error });
    },

    /**
     * 数据变更时刷新 Inspector 面板
     */
    onDataChange() {
      if (!api || !isSetup) return;
      refreshInspector();
    },
  };
};
