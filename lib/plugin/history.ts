// history.plugin.ts
import type { Plugin, Store } from '../core';
import { is } from 'immutable';

export interface HistoryOptions {
  maxHistorySize?: number;
}

interface HistoryAPI {
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
  readonly undo: () => boolean;
  readonly redo: () => boolean;
  readonly clear: () => void;
  readonly getInfo: () => {
    stackSize: number;
    currentIndex: number;
    canUndo: boolean;
    canRedo: boolean;
  };
}

declare module '../core' {
  interface Store {
    history?: HistoryAPI;
  }
}

export const historyPlugin = (options: HistoryOptions = {}): Plugin<Store> => {
  const {maxHistorySize = 50} = options;

  let historyStack: unknown[] = [];
  let currentIndex = 0;
  let recordDisabled = false;
  let storeInstance: Store | null = null;

  const pushState = (newSnapshot: unknown) => {
    if (recordDisabled || !storeInstance) return;

    const currentSnapshot = historyStack[currentIndex];
    if (is(currentSnapshot, newSnapshot)) return;

    if (currentIndex < historyStack.length - 1) {
      historyStack = historyStack.slice(0, currentIndex + 1);
    }

    historyStack.push(newSnapshot);
    currentIndex++;

    // 限制历史长度
    if (historyStack.length > maxHistorySize) {
      const excess = historyStack.length - maxHistorySize;
      historyStack = historyStack.slice(excess);
      currentIndex -= excess;
    }
  };

  const applyState = (targetIndex: number): boolean => {
    if (!storeInstance) return false;
    if (targetIndex < 0 || targetIndex >= historyStack.length) return false;
    if (targetIndex === currentIndex) return false;

    const targetSnapshot = historyStack[targetIndex];
    const currentSnapshot = historyStack[currentIndex];
    if (is(targetSnapshot, currentSnapshot)) return false;

    recordDisabled = true;
    try {
      storeInstance.data.set([], targetSnapshot);
      currentIndex = targetIndex;
      return true;
    } finally {
      recordDisabled = false;
    }
  };

  const createHistoryAPI = (store: Store): HistoryAPI => ({
    canUndo: () => currentIndex > 0,
    canRedo: () => currentIndex < historyStack.length - 1,
    undo: () => {
      if (!createHistoryAPI(store).canUndo()) return false;
      return applyState(currentIndex - 1);
    },
    redo: () => {
      if (!createHistoryAPI(store).canRedo()) return false;
      return applyState(currentIndex + 1);
    },
    clear: () => {
      const currentState = store.data.getRaw();
      historyStack = [currentState];
      currentIndex = 0;
      recordDisabled = false;
    },
    getInfo: () => ({
      stackSize: historyStack.length,
      currentIndex,
      canUndo: currentIndex > 0,
      canRedo: currentIndex < historyStack.length - 1,
    }),
  });

  return {
    name: 'history',
    version: '1.0.0',

    install(store: Store) {
      storeInstance = store;

      const initialState = store.data.getRaw();
      historyStack = [initialState];
      currentIndex = 0;
      recordDisabled = false;

      if (!store.history) {
        store.history = createHistoryAPI(store);
      }

      store.actions.register('history.undo', () => {
        if (store.history?.undo()) {
          return {success: true, action: 'undo'};
        }
        throw new Error('无法撤销：没有更早的历史记录');
      });

      store.actions.register('history.redo', () => {
        if (store.history?.redo()) {
          return {success: true, action: 'redo'};
        }
        throw new Error('无法重做：没有更新的历史记录');
      });

      store.actions.register('history.clear', () => {
        store.history?.clear();
        return {success: true, action: 'clear'};
      });
    },

    uninstall() {
      if (!storeInstance) return;
      // 移除 actions
      storeInstance.actions.unregister('history.undo');
      storeInstance.actions.unregister('history.redo');
      storeInstance.actions.unregister('history.clear');

      delete storeInstance.history;

      // 清理内部状态
      historyStack = [];
      currentIndex = 0;
      recordDisabled = false;
      storeInstance = null;
    },

    onDataChange() {
      if (!storeInstance || recordDisabled) return;
      const newSnapshot = storeInstance.data.getRaw();
      pushState(newSnapshot);
    },
  };
};
