import type { Plugin, Store } from '../core';

export interface VueDevtoolsOptions {
  inspectorLabel?: string;
  timelineLabel?: string;
}

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

interface InspectorOptions {
  id: string;
  label: string;
  icon: string;
  treeFilterPlaceholder?: string;
  stateFilterPlaceholder?: string;
}

interface TimelineLayerOptions {
  id: string;
  label: string;
  color: number;
}

interface TimelineEventOptions {
  layerId: string;
  event: {
    time: number;
    title: string;
    subtitle?: string;
    data?: Record<string, unknown>;
    groupId?: string;
    logType?: 'default' | 'warning' | 'error';
  };
}

interface InspectorNode {
  id: string;
  label: string;
  children?: InspectorNode[];
  tags?: Array<{ label: string; textColor: number; backgroundColor: number }>;
}

interface InspectorTreePayload {
  app: unknown;
  inspectorId: string;
  rootNodes: InspectorNode[];
}

interface InspectorStateItem {
  key: string;
  value: unknown;
  editable: boolean;
}

interface InspectorStatePayload {
  app: unknown;
  inspectorId: string;
  nodeId: string;
  state: Record<string, InspectorStateItem[]>;
}

interface EditInspectorStatePayload {
  app: unknown;
  inspectorId: string;
  nodeId: string;
  path: string[];
  state: { value: unknown; newKey?: string; remove?: boolean };
  set: (obj: unknown, path: string[], value: unknown) => void;
}

interface InspectTimelineEventPayload {
  layerId: string;
  data: Record<string, unknown>;
}

interface DevtoolsHook {
  on(event: string, handler: (api: DevtoolsApi) => void): void;
  once?(event: string, handler: (api: DevtoolsApi) => void): void;
  emit(event: string, api: DevtoolsApi): void;
}

declare global {
  var __VUE_DEVTOOLS_GLOBAL_HOOK__: DevtoolsHook | undefined;
}

const INSPECTOR_ID = 'common-store';
const TIMELINE_LAYER_ID = 'common-store:actions';

const TAG_COLORS: Record<string, { textColor: number; backgroundColor: number }> = {
  object: { textColor: 0xFFFFFF, backgroundColor: 0x4FC08D },
  array: { textColor: 0xFFFFFF, backgroundColor: 0xE6A23C },
  string: { textColor: 0xFFFFFF, backgroundColor: 0x409EFF },
  number: { textColor: 0xFFFFFF, backgroundColor: 0xF56C6C },
  boolean: { textColor: 0xFFFFFF, backgroundColor: 0x909399 },
  null: { textColor: 0xFFFFFF, backgroundColor: 0x909399 },
  function: { textColor: 0xFFFFFF, backgroundColor: 0xB37FEB },
};

let actionGroupCounter = 0;

function getTypeTag(value: unknown): { textColor: number; backgroundColor: number } | undefined {
  if (value === null) return TAG_COLORS.null;
  if (Array.isArray(value)) return TAG_COLORS.array;
  const t = typeof value;
  if (t === 'object') return TAG_COLORS.object;
  if (t === 'string') return TAG_COLORS.string;
  if (t === 'number') return TAG_COLORS.number;
  if (t === 'boolean') return TAG_COLORS.boolean;
  if (t === 'function') return TAG_COLORS.function;
  return undefined;
}

function pathToNodeId(path: string[]): string {
  return path.length === 0 ? '__root__' : path.join('.');
}

function nodeIdToPath(nodeId: string): string[] {
  if (nodeId === '__root__') return [];
  return nodeId.split('.');
}

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
      node.tags = [{ label: typeof value === 'object' && value !== null
        ? (Array.isArray(value) ? 'array' : 'object')
        : typeof value, ...tag }];
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      node.children = buildTree(value as Record<string, unknown>, nodePath);
    } else if (Array.isArray(value)) {
      node.children = (value as unknown[]).map((item, idx) => {
        const itemNode: InspectorNode = {
          id: pathToNodeId([...nodePath, String(idx)]),
          label: `${idx}: ${formatValue(item)}`,
        };
        const itemTag = getTypeTag(item);
        if (itemTag) {
          itemNode.tags = [{ label: typeof item === 'object' && item !== null
            ? (Array.isArray(item) ? 'array' : 'object')
            : typeof item, ...itemTag }];
        }
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          itemNode.children = buildTree(item as Record<string, unknown>, [...nodePath, String(idx)]);
        }
        return itemNode;
      });
    }
    nodes.push(node);
  }
  return nodes;
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === 'function') return 'function';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return `{ ${Object.keys(value as object).slice(0, 3).join(', ')}${Object.keys(value as object).length > 3 ? ', ...' : ''} }`;
  }
  return String(value);
}

function buildStateItems(data: Record<string, unknown>): InspectorStateItem[] {
  return Object.keys(data).sort().map(key => ({
    key,
    value: data[key],
    editable: true,
  }));
}

export const VueDevtools = (options: VueDevtoolsOptions = {}): Plugin<Store> => {
  const opts = {
    inspectorLabel: 'CommonStore',
    timelineLabel: 'Actions',
    ...options,
  };

  let storeInstance: Store | null = null;
  let api: DevtoolsApi | null = null;
  let isSetup = false;

  const getStateValueAt = (path: string[]): unknown => {
    if (!storeInstance) return undefined;
    return path.length === 0 ? storeInstance.getState() : storeInstance.getState(path);
  };

  const refreshInspector = () => {
    if (!api || !isSetup) return;
    api.sendInspectorTree(INSPECTOR_ID);
    api.sendInspectorState(INSPECTOR_ID);
  };

  const setupDevtools = (devtoolsApi: DevtoolsApi) => {
    api = devtoolsApi;

    api.addInspector({
      id: INSPECTOR_ID,
      label: opts.inspectorLabel,
      icon: 'storage',
      treeFilterPlaceholder: 'Search state...',
      stateFilterPlaceholder: 'Filter...',
    });

    api.addTimelineLayer({
      id: TIMELINE_LAYER_ID,
      label: opts.timelineLabel,
      color: 0x4FC08D,
    });

    api.on.getInspectorTree((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID) return;
      const state = storeInstance?.getState();
      if (state && typeof state === 'object') {
        payload.rootNodes = buildTree(state as Record<string, unknown>);
      }
    });

    api.on.getInspectorState((payload) => {
      if (payload.inspectorId !== INSPECTOR_ID) return;
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

    api.on.inspectTimelineEvent((payload) => {
      if (payload.layerId !== TIMELINE_LAYER_ID) return;
    });

    isSetup = true;
    refreshInspector();
  };

  const getDevtoolsFromHook = (): Promise<DevtoolsApi | null> => {
    return new Promise((resolve) => {
      const hook = globalThis.__VUE_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) {
        resolve(null);
        return;
      }
      const timeout = setTimeout(() => resolve(null), 3000);
      hook.once?.('init', (devtoolsApi: DevtoolsApi) => {
        clearTimeout(timeout);
        resolve(devtoolsApi);
      });
    });
  };

  return {
    name: 'vue-devtools',
    version: '1.0.0',

    install(store: Store) {
      storeInstance = store;

      getDevtoolsFromHook().then((devtoolsApi) => {
        if (devtoolsApi && !isSetup) {
          setupDevtools(devtoolsApi);
        }
      });
    },

    uninstall() {
      isSetup = false;
      api = null;
      storeInstance = null;
    },

    beforeAction(actionName: string, args: unknown[]) {
      if (!api || !isSetup) return;
      actionGroupCounter++;
      const groupId = `${actionName}-${actionGroupCounter}`;

      api.addTimelineEvent({
        layerId: TIMELINE_LAYER_ID,
        event: {
          time: api.now(),
          title: actionName,
          subtitle: 'start',
          data: { args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)) },
          groupId,
        },
      });
    },

    afterAction(_actionName: string, _result: unknown) {
      if (!api || !isSetup || !storeInstance) return;
      refreshInspector();
    },

    onError(actionName: string, error: Error) {
      if (!api || !isSetup) return;
      api.addTimelineEvent({
        layerId: TIMELINE_LAYER_ID,
        event: {
          time: api.now(),
          title: actionName,
          subtitle: `Error: ${error.message}`,
          data: { error: error.message },
          logType: 'error',
        },
      });
    },

    onDataChange() {
      if (!api || !isSetup) return;
      refreshInspector();
    },
  };
};
