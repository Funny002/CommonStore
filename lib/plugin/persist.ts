import type { Plugin, Store } from '../core';
import { debounce } from '../utils';

/** 持久化插件配置选项 */
export interface PersistOptions {
  /** Storage 键名，默认 'common-store' */
  key?: string;

  /** 存储实现，默认 localStorage，传 null 禁用持久化 */
  storage?: Storage | null;

  /** 仅持久化的路径列表，空数组表示保存整个状态 */
  paths?: string[];

  /** 自定义序列化器，默认 JSON.stringify */
  serializer?: (value: unknown) => string;

  /** 自定义反序列器，默认 JSON.parse */
  deserializer?: (raw: string) => unknown;

  /** 防抖写入延迟（毫秒），默认 300 */
  debounce?: number;
}

const defaultOptions = {
  key: 'common-store',
  paths: [] as string[],
  serializer: JSON.stringify,
  deserializer: JSON.parse,
  debounce: 300,
};

/**
 * 创建持久化插件
 *
 * @param options - 持久化配置
 * @returns 插件实例
 */
export const Persist = (options: PersistOptions = {}): Plugin<Store> => {
  const resolvedStorage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const opts = {
    ...defaultOptions,
    ...options,
    storage: resolvedStorage,
  };

  let storeInstance: Store | null = null;

  /** 防抖后的保存函数实例 */
  let save: ReturnType<typeof debounce<() => void>>;

  /**
   * 执行实际写入操作
   *
   * 将当前状态（或 path 过滤后的部分）序列化写入 Storage。
   */
  const doSave = () => {
    if (!storeInstance || !opts.storage) return;
    const state = opts.paths.length > 0
      ? Object.fromEntries(opts.paths.map((p) => [p, storeInstance!.getState(p)]))
      : storeInstance.getState();
    try {
      opts.storage.setItem(opts.key, opts.serializer(state));
    } catch (e) {
      console.error('[CommonStore] persist save error:', e);
    }
  };

  /**
   * 从 Storage 读取已保存的状态
   * @returns 解析后的状态对象，失败或不存在返回 null
   */
  const loadSaved = (): Record<string, unknown> | null => {
    if (!opts.storage) return null;
    try {
      const raw = opts.storage.getItem(opts.key);
      if (!raw) return null;
      return opts.deserializer(raw) as Record<string, unknown>;
    } catch (e) {
      console.error('[CommonStore] persist load error:', e);
      return null;
    }
  };

  return {
    name: 'persist',
    version: '1.1.0',

    /**
     * 安装插件：从 Storage 恢复状态并启动防抖写入
     */
    install(store: Store) {
      storeInstance = store;
      save = debounce(doSave, opts.debounce);

      const saved = loadSaved();
      if (saved) {
        if (opts.paths.length > 0) {
          store.data.batch(() => {
            for (const p of opts.paths) {
              if (p in saved) {
                store.data.set(p, saved[p]);
              }
            }
          });
        } else {
          store.data.set([], saved);
        }
      }
    },

    /**
     * 卸载插件：取消待执行的写入并立即保存当前状态
     */
    uninstall() {
      save.cancel();
      doSave();
      storeInstance = null;
    },

    /**
     * 数据变更时触发防抖写入
     */
    onDataChange() {
      save();
    },
  };
};
