import { describe, it, expect, beforeEach } from 'vitest';
import { Store, History } from '../../lib';

describe('History 历史记录插件', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store({ count: 0, name: 'initial' });
  });

  describe('插件创建', () => {
    it('应该使用默认配置创建插件', () => {
      const plugin = History();

      expect(plugin.name).toBe('history');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.install).toBeDefined();
      expect(plugin.uninstall).toBeDefined();
      expect(plugin.onDataChange).toBeDefined();
    });

    it('应该支持自定义最大历史记录数', () => {
      const plugin = History({ maxHistorySize: 10 });

      expect(plugin.name).toBe('history');
    });
  });

  describe('install - 安装插件', () => {
    it('安装时应该初始化历史栈', () => {
      const plugin = History();
      store.use(plugin);

      expect(store.history).toBeDefined();
      expect(store.history?.getInfo().stackSize).toBe(1);
      expect(store.history?.getInfo().currentIndex).toBe(0);
    });

    it('安装时应该保存初始状态', () => {
      const plugin = History();
      store.use(plugin);

      const info = store.history?.getInfo();
      expect(info?.stackSize).toBe(1);
    });

    it('安装时应该注册 undo action', () => {
      const plugin = History();
      store.use(plugin);

      expect(store.actions.has('history.undo')).toBe(true);
    });

    it('安装时应该注册 redo action', () => {
      const plugin = History();
      store.use(plugin);

      expect(store.actions.has('history.redo')).toBe(true);
    });

    it('安装时应该注册 clear action', () => {
      const plugin = History();
      store.use(plugin);

      expect(store.actions.has('history.clear')).toBe(true);
    });
  });

  describe('uninstall - 卸载插件', () => {
    it('卸载时应该移除所有 actions', () => {
      const plugin = History();
      store.use(plugin);
      plugin.uninstall?.();

      expect(store.actions.has('history.undo')).toBe(false);
      expect(store.actions.has('history.redo')).toBe(false);
      expect(store.actions.has('history.clear')).toBe(false);
    });

    it('卸载时应该删除 history API', () => {
      const plugin = History();
      store.use(plugin);
      plugin.uninstall?.();

      expect(store.history).toBeUndefined();
    });
  });

  describe('canUndo/canRedo - 撤销重做检查', () => {
    it('初始状态下不能撤销也不能重做', () => {
      const plugin = History();
      store.use(plugin);

      expect(store.history?.canUndo()).toBe(false);
      expect(store.history?.canRedo()).toBe(false);
    });

    it('数据变更后应该可以撤销', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 10);

      expect(store.history?.canUndo()).toBe(true);
      expect(store.history?.canRedo()).toBe(false);
    });

    it('撤销后应该可以重做', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 10);
      store.history?.undo();

      expect(store.history?.canUndo()).toBe(false);
      expect(store.history?.canRedo()).toBe(true);
    });

    it('重做后应该可以再次撤销', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 10);
      store.history?.undo();
      store.history?.redo();

      expect(store.history?.canUndo()).toBe(true);
      expect(store.history?.canRedo()).toBe(false);
    });
  });

  describe('undo - 撤销操作', () => {
    it('应该能够撤销数据变更', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 10);
      expect(store.getState('count')).toBe(10);

      store.history?.undo();

      expect(store.getState('count')).toBe(0);
    });

    it('没有可撤销的历史时应该返回 false', () => {
      const plugin = History();
      store.use(plugin);

      const result = store.history?.undo();

      expect(result).toBe(false);
    });

    it('应该能够连续多次撤销', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);
      store.data.set('count', 3);

      store.history?.undo();
      expect(store.getState('count')).toBe(2);

      store.history?.undo();
      expect(store.getState('count')).toBe(1);

      store.history?.undo();
      expect(store.getState('count')).toBe(0);
    });

    it('撤销应该恢复整个状态对象', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 5);
      await new Promise(resolve => setTimeout(resolve, 10)); // 等待快照记录
      store.data.set('name', 'changed');
      await new Promise(resolve => setTimeout(resolve, 10)); // 等待快照记录

      store.history?.undo();

      expect(store.getState('name')).toBe('initial');
      
      store.history?.undo();
      expect(store.getState('count')).toBe(0);
    });
  });

  describe('redo - 重做操作', () => {
    it('应该能够重做撤销的操作', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 10);
      store.history?.undo();
      expect(store.getState('count')).toBe(0);

      store.history?.redo();

      expect(store.getState('count')).toBe(10);
    });

    it('没有可重做的历史时应该返回 false', () => {
      const plugin = History();
      store.use(plugin);

      const result = store.history?.redo();

      expect(result).toBe(false);
    });

    it('应该能够连续多次重做', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);
      store.data.set('count', 3);

      store.history?.undo();
      store.history?.undo();
      store.history?.undo();

      store.history?.redo();
      expect(store.getState('count')).toBe(1);

      store.history?.redo();
      expect(store.getState('count')).toBe(2);

      store.history?.redo();
      expect(store.getState('count')).toBe(3);
    });
  });

  describe('clear - 清空历史', () => {
    it('应该清空所有历史记录', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);
      store.data.set('count', 3);

      store.history?.clear();

      expect(store.history?.getInfo().stackSize).toBe(1);
      expect(store.getState('count')).toBe(3);
    });

    it('清空后不能撤销也不能重做', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.history?.undo();

      store.history?.clear();

      expect(store.history?.canUndo()).toBe(false);
      expect(store.history?.canRedo()).toBe(false);
    });

    it('清空后应该可以继续记录新历史', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.history?.clear();

      store.data.set('count', 2);

      expect(store.history?.canUndo()).toBe(true);
      expect(store.getState('count')).toBe(2);
    });
  });

  describe('getInfo - 获取历史信息', () => {
    it('应该返回正确的历史信息', () => {
      const plugin = History();
      store.use(plugin);

      const info = store.history?.getInfo();

      expect(info).toEqual({
        stackSize: 1,
        currentIndex: 0,
        canUndo: false,
        canRedo: false,
      });
    });

    it('数据变更后应该更新历史信息', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);

      const info = store.history?.getInfo();

      expect(info).toEqual({
        stackSize: 3,
        currentIndex: 2,
        canUndo: true,
        canRedo: false,
      });
    });

    it('撤销后应该正确更新索引', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);
      store.history?.undo();

      const info = store.history?.getInfo();

      expect(info).toEqual({
        stackSize: 3,
        currentIndex: 1,
        canUndo: true,
        canRedo: true,
      });
    });
  });

  describe('actions - 注册的 actions', () => {
    it('应该能够通过 dispatch 调用 history.undo', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 10);

      await store.dispatch('history.undo');

      expect(store.getState('count')).toBe(0);
    });

    it('应该能够通过 dispatch 调用 history.redo', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 10);
      await store.dispatch('history.undo');
      await store.dispatch('history.redo');

      expect(store.getState('count')).toBe(10);
    });

    it('应该能够通过 dispatch 调用 history.clear', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);

      await store.dispatch('history.clear');

      expect(store.history?.getInfo().stackSize).toBe(1);
    });

    it('无法撤销时 history.undo action 应该抛出错误', async () => {
      const plugin = History();
      store.use(plugin);

      await expect(store.dispatch('history.undo')).rejects.toThrow('无法撤销：没有更早的历史记录');
    });

    it('无法重做时 history.redo action 应该抛出错误', async () => {
      const plugin = History();
      store.use(plugin);

      await expect(store.dispatch('history.redo')).rejects.toThrow('无法重做：没有更新的历史记录');
    });
  });

  describe('maxHistorySize - 历史记录大小限制', () => {
    it('应该限制历史记录的最大数量', async () => {
      const plugin = History({ maxHistorySize: 3 });
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);
      store.data.set('count', 3);
      store.data.set('count', 4);

      const info = store.history?.getInfo();
      expect(info?.stackSize).toBeLessThanOrEqual(4); // 初始状态 + 最多3条历史
    });

    it('超出限制后应该能够正常撤销', async () => {
      const plugin = History({ maxHistorySize: 2 });
      store.use(plugin);

      // 初始状态 + 3次变更，但maxHistorySize=2，所以只会保留最近的2条历史
      store.data.set('count', 1);
      store.data.set('count', 2);
      store.data.set('count', 3);

      const info = store.history?.getInfo();
      // 应该是初始状态 + 最多2条历史
      expect(info?.stackSize).toBeLessThanOrEqual(3);

      // 验证可以正常撤销
      if (store.history?.canUndo()) {
        const prevCount = store.getState('count');
        store.history?.undo();
        expect(store.getState('count')).toBeLessThan(prevCount);
      }
    });
  });

  describe('集成测试', () => {
    it('应该能够在 Store 中正常使用', async () => {
      const plugin = History();
      store.use(plugin);

      store.actions.register('increment', (s) => {
        const current = s.getState<number>('count') || 0;
        s.data.set('count', current + 1);
        return s.getState('count');
      });

      await store.dispatch('increment');
      expect(store.getState('count')).toBe(1);

      store.history?.undo();
      expect(store.getState('count')).toBe(0);

      store.history?.redo();
      expect(store.getState('count')).toBe(1);
    });

    it('应该能够处理复杂的数据结构', async () => {
      const complexStore = new Store({
        user: { name: 'Alice', age: 25 },
        items: [1, 2, 3],
      });
      const plugin = History();
      complexStore.use(plugin);

      complexStore.data.set(['user', 'age'], 26);
      await new Promise(resolve => setTimeout(resolve, 10)); // 等待快照记录
      complexStore.data.set(['items', 0], 10);
      await new Promise(resolve => setTimeout(resolve, 10)); // 等待快照记录

      complexStore.history?.undo();
      expect(complexStore.getState(['items', 0])).toBe(1);

      complexStore.history?.undo();
      expect(complexStore.getState(['user', 'age'])).toBe(25);

      complexStore.history?.redo();
      expect(complexStore.getState(['user', 'age'])).toBe(26);
      
      complexStore.history?.redo();
      expect(complexStore.getState(['items', 0])).toBe(10);
    });

    it('相同值不应该产生新的历史记录', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 5);
      store.data.set('count', 5); // 相同的值

      const info = store.history?.getInfo();
      expect(info?.stackSize).toBe(2); // 初始状态 + 一次变更
    });

    it('在中间状态进行新变更应该截断后续历史', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.data.set('count', 2);
      store.data.set('count', 3);

      store.history?.undo();
      store.history?.undo();

      // 在中间状态进行新变更
      store.data.set('count', 10);

      const info = store.history?.getInfo();
      expect(info?.canRedo).toBe(false);
      expect(store.getState('count')).toBe(10);
    });
  });

  describe('边界情况', () => {
    it('应该能够处理空对象作为初始状态', () => {
      const emptyStore = new Store({});
      const plugin = History();
      emptyStore.use(plugin);

      expect(emptyStore.history?.getInfo().stackSize).toBe(1);
    });

    it('应该能够处理嵌套对象的状态变更', async () => {
      const nestedStore = new Store({ a: { b: { c: 1 } } });
      const plugin = History();
      nestedStore.use(plugin);

      nestedStore.data.set(['a', 'b', 'c'], 2);
      expect(nestedStore.getState(['a', 'b', 'c'])).toBe(2);

      nestedStore.history?.undo();
      expect(nestedStore.getState(['a', 'b', 'c'])).toBe(1);
    });

    it('多次清空后应该仍然正常工作', async () => {
      const plugin = History();
      store.use(plugin);

      store.data.set('count', 1);
      store.history?.clear();
      store.data.set('count', 2);
      store.history?.clear();
      store.data.set('count', 3);

      expect(store.history?.canUndo()).toBe(true);
      expect(store.getState('count')).toBe(3);
    });

    it('卸载后重新安装应该正常工作', async () => {
      const plugin = History();
      store.use(plugin);
      store.data.set('count', 1);
      
      // 使用 plugins.eject 卸载插件
      store.plugins.eject('history');
      
      // 重新安装
      const newPlugin = History();
      store.use(newPlugin);
      store.data.set('count', 2);

      expect(store.history?.canUndo()).toBe(true);
      store.history?.undo();
      expect(store.getState('count')).toBe(1);
    });
  });
});
