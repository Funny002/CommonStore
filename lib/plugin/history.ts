import type { Plugin, Store } from '../core';
import { is } from 'immutable';

/**
 * 历史记录插件配置选项
 */
export interface HistoryOptions {
  /** 最大历史记录数，默认 50 */
  maxHistorySize?: number;
}

/**
 * 历史记录 API 接口
 */
interface HistoryAPI {
  /** 检查是否可以撤销 */
  readonly canUndo: () => boolean;

  /** 检查是否可以重做 */
  readonly canRedo: () => boolean;

  /** 执行撤销操作 */
  readonly undo: () => boolean;

  /** 执行重做操作 */
  readonly redo: () => boolean;

  /** 清空历史记录 */
  readonly clear: () => void;

  /** 获取历史记录信息 */
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

/**
 * 历史记录插件 提供 undo/redo 功能，基于 Immutable.js 的快照机制
 * @param options - 插件配置选项
 * @returns 插件实例
 */
export const historyPlugin = (options: HistoryOptions = {}): Plugin<Store> => {
  const {maxHistorySize = 50} = options;

  let historyStack: unknown[] = [];
  let currentIndex = 0;
  let recordDisabled = false;
  let storeInstance: Store | null = null;

  /**
   * 推送新状态到历史栈
   * @param newSnapshot - 新的状态快照
   */
  const pushState = (newSnapshot: unknown) => {
    if (recordDisabled || !storeInstance) return;

    const currentSnapshot = historyStack[currentIndex];
    if (is(currentSnapshot, newSnapshot)) return;

    // 如果当前不在栈顶，删除后面的历史
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

  /**
   * 应用指定索引的状态
   * @param targetIndex - 目标状态索引
   * @returns 是否成功应用
   */
  const applyState = (targetIndex: number): boolean => {
    if (!storeInstance) return false;
    if (targetIndex < 0 || targetIndex >= historyStack.length) return false;
    if (targetIndex === currentIndex) return false;

    const targetSnapshot = historyStack[targetIndex];
    const currentSnapshot = historyStack[currentIndex];
    if (is(targetSnapshot, currentSnapshot)) return false;

    // 临时禁用记录，避免循环触发
    recordDisabled = true;
    try {
      storeInstance.data.set([], targetSnapshot);
      currentIndex = targetIndex;
      return true;
    } finally {
      recordDisabled = false;
    }
  };

  /**
   * 创建历史记录 API
   * @param store - Store 实例
   * @returns 历史记录 API 对象
   */
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

    /**
     * 安装插件
     * 初始化历史栈并注册相关 actions
     */
    install(store: Store) {
      storeInstance = store;

      const initialState = store.data.getRaw();
      historyStack = [initialState];
      currentIndex = 0;
      recordDisabled = false;

      if (!store.history) {
        store.history = createHistoryAPI(store);
      }

      // 注册 undo action
      store.actions.register('history.undo', () => {
        if (store.history?.undo()) {
          return {success: true, action: 'undo'};
        }
        throw new Error('无法撤销：没有更早的历史记录');
      });

      // 注册 redo action
      store.actions.register('history.redo', () => {
        if (store.history?.redo()) {
          return {success: true, action: 'redo'};
        }
        throw new Error('无法重做：没有更新的历史记录');
      });

      // 注册 clear action
      store.actions.register('history.clear', () => {
        store.history?.clear();
        return {success: true, action: 'clear'};
      });
    },

    /**
     * 卸载插件
     * 清理所有注册的 actions 和内部状态
     */
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

    /**
     * 数据变更时自动记录快照
     */
    onDataChange() {
      if (!storeInstance || recordDisabled) return;
      const newSnapshot = storeInstance.data.getRaw();
      pushState(newSnapshot);
    },
  };
};
