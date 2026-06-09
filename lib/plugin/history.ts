import type { Plugin, Store } from '../core';
import { deepEqual } from '../utils';

/** 历史记录插件配置选项 */
export interface HistoryOptions {
  /** 最大历史记录数，超出后丢弃最早记录，默认 50 */
  maxHistorySize?: number;
}

/** 历史记录公开 API 接口 */
interface HistoryAPI {
  /** 返回当前是否可以撤销 */
  readonly canUndo: () => boolean;

  /** 返回当前是否可以重做 */
  readonly canRedo: () => boolean;

  /**
   * 执行一步撤销
   * @returns 是否成功撤销
   */
  readonly undo: () => boolean;

  /**
   * 执行一步重做
   * @returns 是否成功重做
   */
  readonly redo: () => boolean;

  /**
   * 清空全部历史记录，以当前状态作为新起点
   */
  readonly clear: () => void;

  /** 获取历史栈信息 */
  readonly getInfo: () => {
    /** 历史栈当前大小 */
    stackSize: number;
    /** 当前位置索引 */
    currentIndex: number;
    /** 是否可撤销 */
    canUndo: boolean;
    /** 是否可重做 */
    canRedo: boolean;
  };
}

declare module '../core' {
  interface Store {
    history?: HistoryAPI;
  }
}

/**
 * 创建历史记录插件
 *
 * 安装后会将 `history` API 挂载到 `store.history`，
 * 并注册 `history.undo`、`history.redo`、`history.clear` 三个 action。
 *
 * @param options - 插件配置
 * @returns 插件实例
 */
export const History = (options: HistoryOptions = {}): Plugin<Store> => {
  const { maxHistorySize = 50 } = options;

  /** 历史快照栈 */
  let historyStack: unknown[] = [];

  /** 当前所在的历史栈索引 */
  let currentIndex = 0;

  /** 暂停记录标志（撤销/重做/导入时避免产生新快照） */
  let recordDisabled = false;

  /** Store 实例引用 */
  let storeInstance: Store | null = null;

  /**
   * 推送新快照到历史栈
   *
   * 若与当前快照引用相同则跳过；
   * 若已有相同内容的快照则跳转到对应位置；
   * 若当前不在栈顶则截断后续历史。
   */
  const pushState = (newSnapshot: unknown) => {
    if (recordDisabled || !storeInstance) return;

    const currentSnapshot = historyStack[currentIndex];
    if (currentSnapshot === newSnapshot) return;

    const existingIndex = historyStack.findIndex((s) => deepEqual(s, newSnapshot));
    if (existingIndex !== -1) {
      currentIndex = existingIndex;
      return;
    }

    if (currentIndex < historyStack.length - 1) {
      historyStack = historyStack.slice(0, currentIndex + 1);
    }

    historyStack.push(newSnapshot);
    currentIndex++;

    if (historyStack.length > maxHistorySize) {
      const excess = historyStack.length - maxHistorySize;
      historyStack = historyStack.slice(excess);
      currentIndex -= excess;
    }
  };

  /**
   * 应用指定索引的快照到 Store
   *
   * 应用期间暂停记录，完成后恢复。
   *
   * @returns 是否成功应用
   */
  const applyState = (targetIndex: number): boolean => {
    if (!storeInstance) return false;
    if (targetIndex < 0 || targetIndex >= historyStack.length) return false;
    if (targetIndex === currentIndex) return false;

    const targetSnapshot = historyStack[targetIndex];
    const currentSnapshot = historyStack[currentIndex];
    if (deepEqual(targetSnapshot, currentSnapshot)) return false;

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
      if (currentIndex <= 0) return false;
      return applyState(currentIndex - 1);
    },
    redo: () => {
      if (currentIndex >= historyStack.length - 1) return false;
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
     * 安装插件：初始化历史栈、注入 API、注册 actions
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

      store.actions.register('history.undo', () => {
        if (store.history?.undo()) {
          return { success: true, action: 'undo' };
        }
        throw new Error('无法撤销：没有更早的历史记录');
      });

      store.actions.register('history.redo', () => {
        if (store.history?.redo()) {
          return { success: true, action: 'redo' };
        }
        throw new Error('无法重做：没有更新的历史记录');
      });

      store.actions.register('history.clear', () => {
        store.history?.clear();
        return { success: true, action: 'clear' };
      });
    },

    /**
     * 卸载插件：取消注册 actions、移除 API、清理内部状态
     */
    uninstall() {
      if (!storeInstance) return;
      try {
        storeInstance.actions.unregister('history.undo');
      } catch {}
      try {
        storeInstance.actions.unregister('history.redo');
      } catch {}
      try {
        storeInstance.actions.unregister('history.clear');
      } catch {}

      delete storeInstance.history;

      historyStack = [];
      currentIndex = 0;
      recordDisabled = false;
      storeInstance = null;
    },

    /**
     * 数据变更时自动记录快照（recordDisabled 期间跳过）
     */
    onDataChange() {
      if (!storeInstance || recordDisabled) return;
      const newSnapshot = storeInstance.data.getRaw();
      pushState(newSnapshot);
    },
  };
};
