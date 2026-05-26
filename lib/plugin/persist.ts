import type { Plugin, Store } from '../core';
import { debounce } from '../utils';

export interface PersistOptions {
  key?: string;
  storage?: Storage | null;
  paths?: string[];
  serializer?: (value: unknown) => string;
  deserializer?: (raw: string) => unknown;
  debounce?: number;
}

const defaultOptions = {
  key: 'common-store',
  paths: [] as string[],
  serializer: JSON.stringify,
  deserializer: JSON.parse,
  debounce: 300,
};

export const Persist = (options: PersistOptions = {}): Plugin<Store> => {
  const opts = {
    ...defaultOptions,
    ...options,
    storage: options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null) as Storage,
  } as Required<PersistOptions>;
  let storeInstance: Store | null = null;
  let save: () => void;

  const doSave = () => {
    if (!storeInstance || !opts.storage) return;
    const state = opts.paths.length > 0
      ? Object.fromEntries(opts.paths.map(p => [p, storeInstance!.getState(p)]))
      : storeInstance.getState();
    try {
      opts.storage.setItem(opts.key, opts.serializer(state));
    } catch {
      // Silently fail (e.g. quota exceeded)
    }
  };

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
    name: 'persist',
    version: '1.0.0',

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

    uninstall() {
      storeInstance = null;
    },

    onDataChange() {
      save();
    },
  };
};
