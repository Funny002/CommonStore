/**
 * Persist 持久化插件
 *
 * 将 Store 状态自动保存到 Storage（默认 localStorage）并在初始化时恢复。
 * 支持白名单路径过滤、自定义序列化/反序列化和防抖保存。
 */
import type { Plugin, Store } from "../core";
import { debounce } from "../utils";

/**
 * 持久化插件配置选项
 */
export interface PersistOptions {
  /** 存储键名，默认 'common-store' */
  key?: string;
  /** 自定义存储对象，默认使用 localStorage（SSR 环境下为 null） */
  storage?: Storage | null;
  /** 白名单路径列表，为空时持久化全部状态 */
  paths?: string[];
  /** 自定义序列化函数，默认 JSON.stringify */
  serializer?: (value: unknown) => string;
  /** 自定义反序列化函数，默认 JSON.parse */
  deserializer?: (raw: string) => unknown;
  /** 防抖延迟毫秒数，默认 300 */
  debounce?: number;
}

/** 插件默认配置 */
const defaultOptions = {
  key: "common-store",
  paths: [] as string[],
  serializer: JSON.stringify,
  deserializer: JSON.parse,
  debounce: 300,
};

/**
 * 持久化插件 — 将 Store 状态自动保存到 Storage 并在初始化时恢复
 * @param options - 插件配置选项
 * @returns 插件实例
 */
export const Persist = (options: PersistOptions = {}): Plugin<Store> => {
  const resolvedStorage = options.storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  const opts = {
    ...defaultOptions,
    ...options,
    storage: resolvedStorage,
  } as Required<PersistOptions> & { storage: Storage | null };
  /** Store 实例引用 */
  let storeInstance: Store | null = null;
  /** 防抖后的保存函数 */
  let save: () => void;

  /** 执行实际的持久化保存操作 */
  const doSave = () => {
    if (!storeInstance || !opts.storage) return;
    const state = opts.paths.length > 0 ? Object.fromEntries(opts.paths.map((p) => [p, storeInstance!.getState(p)])) : storeInstance.getState();
    try {
      opts.storage.setItem(opts.key, opts.serializer(state));
    } catch {
      // 静默失败（例如存储配额超出）
    }
  };

  /** 从存储中加载已保存的状态数据 */
  const loadSaved = (): Record<string, unknown> | null => {
    if (!opts.storage) return null;
    try {
      const raw = opts.storage.getItem(opts.key);
      if (!raw) return null;
      return opts.deserializer(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  return {
    name: "persist",
    version: "1.0.0",

    /**
     * 安装插件 — 从存储恢复状态并启动防抖保存
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
     * 卸载插件 — 立即执行最后一次保存后清理引用
     */
    uninstall() {
      doSave();
      storeInstance = null;
    },

    /**
     * 数据变更时触发防抖保存
     */
    onDataChange() {
      save();
    },
  };
};
