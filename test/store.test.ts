import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Plugin } from '../lib';
import { Store } from '../lib';

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('构造函数', () => {
    it('应该能够创建不带初始状态的 Store 实例', () => {
      const emptyStore = new Store();
      expect(emptyStore).toBeDefined();
      expect(emptyStore.getState()).toEqual({});
    });

    it('应该能够创建带初始状态的 Store 实例', () => {
      const initialState = {
        user: {name: 'Alice', age: 25},
        count: 0,
      };
      const storeWithState = new Store(initialState);
      expect(storeWithState.getState()).toEqual(initialState);
    });

    it('应该正确初始化 data、actions 和 plugins 管理器', () => {
      expect(store.data).toBeDefined();
      expect(store.actions).toBeDefined();
      expect(store.plugins).toBeDefined();
    });
  });

  describe('getState', () => {
    it('不传参数时应该返回整个状态树', () => {
      const initialState = {a: 1, b: 2};
      const testStore = new Store(initialState);
      expect(testStore.getState()).toEqual(initialState);
    });

    it('应该通过字符串路径获取嵌套数据', () => {
      const initialState = {
        user: {
          profile: {
            name: 'Bob',
          },
        },
      };
      const testStore = new Store(initialState);
      expect(testStore.getState('user.profile.name')).toBe('Bob');
    });

    it('应该通过数组路径获取嵌套数据', () => {
      const initialState = {
        items: [1, 2, 3],
      };
      const testStore = new Store(initialState);
      expect(testStore.getState(['items', 1])).toBe(2);
    });

    it('访问不存在的路径应该返回 undefined', () => {
      const testStore = new Store({a: 1});
      expect(testStore.getState('nonexistent')).toBeUndefined();
      expect(testStore.getState('a.b.c')).toBeUndefined();
    });

    it('应该支持泛型类型推断', () => {
      interface UserState {
        name: string;
        age: number;
      }

      const initialState = {
        user: {name: 'Charlie', age: 30} as UserState,
      };
      const testStore = new Store(initialState);
      const user = testStore.getState<UserState>('user');
      expect(user).toBeDefined();
      expect(user?.name).toBe('Charlie');
      expect(user?.age).toBe(30);
    });
  });

  describe('dispatch (Action 执行)', () => {
    it('应该能够注册并执行 action', async () => {
      const testStore = new Store({count: 0});
      testStore.actions.register('increment', (store) => {
        const current = store.getState<number>('count') || 0;
        store.data.set('count', current + 1);
        return store.getState('count');
      });

      const result = await testStore.dispatch('increment');
      expect(result).toBe(1);
      expect(testStore.getState('count')).toBe(1);
    });

    it('应该能够传递参数给 action', async () => {
      const testStore = new Store({value: 0});
      testStore.actions.register('add', (store, amount: number) => {
        const current = store.getState<number>('value') || 0;
        store.data.set('value', current + amount);
        return store.getState('value');
      });

      const result = await testStore.dispatch('add', 5);
      expect(result).toBe(5);
    });

    it('执行未注册的 action 应该抛出错误', async () => {
      await expect(store.dispatch('nonexistent')).rejects.toThrow(
        'Action "nonexistent" not found',
      );
    });

    it('action 执行失败应该抛出错误', async () => {
      store.actions.register('fail', () => {
        throw new Error('Action failed');
      });

      await expect(store.dispatch('fail')).rejects.toThrow('Action failed');
    });

    it('应该支持异步 action', async () => {
      store.actions.register('asyncAction', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'completed';
      });

      const result = await store.dispatch('asyncAction');
      expect(result).toBe('completed');
    });
  });

  describe('ActionManager 独立方法', () => {
    it('应该能够注销 action', () => {
      store.actions.register('temp', () => 'ok');
      expect(store.actions.has('temp')).toBe(true);

      store.actions.unregister('temp');
      expect(store.actions.has('temp')).toBe(false);
    });

    it('注销不存在的 action 应该抛出错误', () => {
      expect(() => store.actions.unregister('unknown')).toThrow(
        'Action "unknown" is not registered',
      );
    });

    it('应该能够获取所有已注册的 action 名称', () => {
      store.actions.register('a', () => {});
      store.actions.register('b', () => {});
      expect(store.actions.getActionNames()).toEqual(['a', 'b']);
    });
  });

  describe('DataManager 核心方法（通过 store.data）', () => {
    it('set 方法应该能修改数据并触发变更通知', () => {
      const onDataChange = vi.fn();
      const plugin: Plugin = {name: 'watcher', onDataChange};
      store.use(plugin);

      store.data.set('user.name', 'John');
      expect(store.getState('user.name')).toBe('John');
      expect(onDataChange).toHaveBeenCalledWith(['user', 'name'], 'John', undefined);
    });

    it('delete 方法应该能删除数据', () => {
      store.data.set('temp', 'value');
      expect(store.getState('temp')).toBe('value');

      const result = store.data.delete('temp');
      expect(result).toBe(true);
      expect(store.getState('temp')).toBeUndefined();

      // 删除不存在的路径返回 false
      expect(store.data.delete('nonexistent')).toBe(false);
    });

    it('update 方法应该能基于旧值更新数据', () => {
      store.data.set('counter', 10);
      store.data.update('counter', (old) => (old as number) + 5);
      expect(store.getState('counter')).toBe(15);
    });

    it('merge 方法应该能深度合并对象', () => {
      store.data.set('profile', {name: 'Alice', age: 25});
      store.data.merge('profile', {age: 26, city: 'NYC'});
      expect(store.getState('profile')).toEqual({name: 'Alice', age: 26, city: 'NYC'});
    });

    it('push / pop 方法应该能操作数组', () => {
      store.data.set('list', [1, 2]);
      store.data.push('list', 3);
      expect(store.getState('list')).toEqual([1, 2, 3]);

      const popped = store.data.pop('list');
      expect(popped).toBe(3);
      expect(store.getState('list')).toEqual([1, 2]);

      // 对非数组使用 pop 返回 undefined
      store.data.set('notArray', 'string');
      expect(store.data.pop('notArray')).toBeUndefined();
    });

    it('find 和 findAll 方法应该能查找符合条件的节点', () => {
      const state = {
        users: [
          {id: 1, name: 'Alice', role: 'admin'},
          {id: 2, name: 'Bob', role: 'user'},
          {id: 3, name: 'Charlie', role: 'admin'},
        ],
      };
      const testStore = new Store(state);

      // 查找第一个 admin
      // @ts-ignore
      const firstAdmin = testStore.data.find((value, _key, _path) => value?.role === 'admin', true) as any;
      expect(firstAdmin?.name).toBe('Alice');

      // 查找所有 admin
      // @ts-ignore
      const allAdmins = testStore.data.findAll((value, _key, _path) => value?.role === 'admin', true) as any[];
      expect(allAdmins.length).toBe(2);
      expect(allAdmins[0].name).toBe('Alice');
      expect(allAdmins[1].name).toBe('Charlie');
    });

    it('clear 方法应该清空所有数据', () => {
      store.data.set('a', 1);
      store.data.set('b', 2);
      store.data.clear();
      expect(store.getState()).toEqual({});
    });
  });

  describe('插件系统 (use)', () => {
    it('应该能够注册插件', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        install: vi.fn(),
      };

      const result = store.use(plugin);
      expect(result).toBe(store); // 支持链式调用
      expect(plugin.install).toHaveBeenCalledWith(store);
    });

    it('应该能够注册多个插件', () => {
      const plugin1: Plugin = {name: 'plugin-1', install: vi.fn()};
      const plugin2: Plugin = {name: 'plugin-2', install: vi.fn()};

      store.use(plugin1, plugin2);
      expect(plugin1.install).toHaveBeenCalled();
      expect(plugin2.install).toHaveBeenCalled();
    });

    it('重复注册同一个插件应该抛出错误', () => {
      const plugin: Plugin = {name: 'duplicate-plugin'};
      store.use(plugin);

      expect(() => store.use(plugin)).toThrow(
        'Plugins already registered: duplicate-plugin',
      );
    });

    it('插件的 beforeAction 钩子应该能够修改参数', async () => {
      const plugin: Plugin = {
        name: 'modifier-plugin',
        beforeAction: (actionName, args) => {
          if (actionName === 'multiply') {
            // @ts-ignore
            return [args[0] * 2];
          }
        },
      };

      store.use(plugin);
      store.actions.register('multiply', (_store, factor: number) => {
        return factor;
      });

      const result = await store.dispatch('multiply', 5);
      expect(result).toBe(10); // 5 * 2 = 10
    });

    it('插件的 afterAction 钩子应该在 action 执行后调用', async () => {
      const afterActionMock = vi.fn();
      const plugin: Plugin = {
        name: 'logger-plugin',
        afterAction: afterActionMock,
      };

      store.use(plugin);
      store.actions.register('test', () => 'result');

      await store.dispatch('test');
      expect(afterActionMock).toHaveBeenCalledWith('test', 'result', []);
    });

    it('插件的 onError 钩子应该在 action 出错时调用', async () => {
      const onErrorMock = vi.fn();
      const plugin: Plugin = {
        name: 'error-handler',
        onError: onErrorMock,
      };

      store.use(plugin);
      store.actions.register('error', () => {
        throw new Error('Test error');
      });

      await expect(store.dispatch('error')).rejects.toThrow('Test error');
      expect(onErrorMock).toHaveBeenCalled();
      expect(onErrorMock.mock.calls[0][1].message).toBe('Test error');
    });

    it('插件的 onDataChange 钩子应该在数据变更时调用', () => {
      const onDataChangeMock = vi.fn();
      const plugin: Plugin = {
        name: 'data-watcher',
        onDataChange: onDataChangeMock,
      };

      store.use(plugin);
      store.data.set('key', 'value');

      expect(onDataChangeMock).toHaveBeenCalled();
      expect(onDataChangeMock.mock.calls[0][0]).toEqual(['key']);
      expect(onDataChangeMock.mock.calls[0][1]).toBe('value');
      expect(onDataChangeMock.mock.calls[0][2]).toBeUndefined();
    });

    it('应该能够卸载插件 (eject)', () => {
      const uninstallMock = vi.fn();
      const plugin: Plugin = {
        name: 'removable',
        install: () => {},
        uninstall: uninstallMock,
      };
      store.use(plugin);
      expect(store.plugins.getPlugins().length).toBe(1);

      const result = store.plugins.eject('removable');
      expect(result).toBe(true);
      expect(uninstallMock).toHaveBeenCalled();
      expect(store.plugins.getPlugins().length).toBe(0);

      // 再次卸载返回 false
      expect(store.plugins.eject('removable')).toBe(false);
    });

    it('卸载被依赖的插件应该抛出错误', () => {
      const basePlugin: Plugin = {name: 'base'};
      const dependentPlugin: Plugin = {name: 'dependent', dependencies: ['base']};
      store.use(basePlugin, dependentPlugin);

      expect(() => store.plugins.eject('base')).toThrow(
        'Cannot eject "base" because plugin "dependent" depends on it',
      );
    });

    it('插件依赖关系应该正确处理（拓扑排序）', async () => {
      const executionOrder: string[] = [];

      const basePlugin: Plugin = {
        name: 'base',
        beforeAction: () => {
          executionOrder.push('base-before');
        },
      };

      const dependentPlugin: Plugin = {
        name: 'dependent',
        dependencies: ['base'],
        beforeAction: () => {
          executionOrder.push('dependent-before');
        },
      };

      store.use(basePlugin, dependentPlugin);
      store.actions.register('test', () => 'done');

      await store.dispatch('test');

      expect(executionOrder).toEqual(['base-before', 'dependent-before']);
    });

    it('循环依赖的插件应该抛出错误', () => {
      const pluginA: Plugin = {name: 'A', dependencies: ['B']};
      const pluginB: Plugin = {name: 'B', dependencies: ['A']};

      expect(() => store.use(pluginA, pluginB)).toThrow(/Circular dependency/);
    });
  });

  describe('事件监听 (继承自 EventListener)', () => {
    it('应该能够注册和触发事件', () => {
      const listener = vi.fn();
      store.on('customEvent', listener);
      store.emit('customEvent', 'arg1', 'arg2');

      expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('应该能够移除事件监听器', () => {
      const listener = vi.fn();
      store.on('event', listener);
      store.off('event', listener);
      store.emit('event');

      expect(listener).not.toHaveBeenCalled();
    });

    it('应该支持 once 一次性监听器', () => {
      const listener = vi.fn();
      store.once('onceEvent', listener);

      store.emit('onceEvent');
      store.emit('onceEvent');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('应该能够移除所有指定事件的监听器', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      store.on('multiEvent', listener1);
      store.on('multiEvent', listener2);

      store.removeAll('multiEvent');
      store.emit('multiEvent');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('应该能够清空所有事件监听器', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      store.on('event1', listener1);
      store.on('event2', listener2);

      store.clear();
      store.emit('event1');
      store.emit('event2');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('集成测试', () => {
    it('应该能够完整地使用 Store：注册 action、插件、数据变更', async () => {
      const initialState = {counter: 0, history: [] as string[]};
      const testStore = new Store(initialState);

      // 注册日志插件
      const logs: string[] = [];
      const loggerPlugin: Plugin = {
        name: 'logger',
        afterAction: (actionName, result) => {
          logs.push(`Action ${actionName} completed with result: ${result}`);
        },
        onDataChange: (path, newValue) => {
          logs.push(`Data changed at ${path.join('.')}: ${newValue}`);
        },
      };
      testStore.use(loggerPlugin);

      // 注册 action
      testStore.actions.register('increment', (store) => {
        const current = store.getState<number>('counter') || 0;
        store.data.set('counter', current + 1);
        store.data.update('history', (h: any) => [...(h || []), `incremented to ${current + 1}`]);
        return store.getState('counter');
      });

      // 执行 action
      const result = await testStore.dispatch('increment');

      // 验证结果
      expect(result).toBe(1);
      expect(testStore.getState('counter')).toBe(1);
      expect(testStore.getState('history')).toEqual(['incremented to 1']);
      expect(logs).toContain('Action increment completed with result: 1');
      expect(logs).toContain('Data changed at counter: 1');
      expect(logs).toContain('Data changed at history: incremented to 1');
    });

    it('应该支持链式调用 use 方法', () => {
      const plugin1: Plugin = {name: 'p1'};
      const plugin2: Plugin = {name: 'p2'};
      const plugin3: Plugin = {name: 'p3'};

      const result = store.use(plugin1).use(plugin2).use(plugin3);
      expect(result).toBe(store);
      expect(store.plugins.getPlugins().length).toBe(3);
    });
  });

  describe('边界情况', () => {
    it('应该能够处理空对象作为初始状态', () => {
      const emptyStore = new Store({});
      expect(emptyStore.getState()).toEqual({});
    });

    it('应该能够处理 null 或 undefined 作为初始状态', () => {
      const nullStore = new Store(null as any);
      expect(nullStore.getState()).toEqual({});

      const undefinedStore = new Store(undefined);
      expect(undefinedStore.getState()).toEqual({});
    });

    it('应该能够处理复杂嵌套的数据结构', () => {
      const complexState = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
        array: [
          {id: 1, name: 'first'},
          {id: 2, name: 'second'},
        ],
      };
      const testStore = new Store(complexState);

      expect(testStore.getState('level1.level2.level3.value')).toBe('deep');
      expect(testStore.getState(['array', 0, 'name'])).toBe('first');
    });

    it('多次数据变更应该正确触发插件钩子', () => {
      const changeCount = {count: 0};
      const plugin: Plugin = {
        name: 'counter',
        onDataChange: () => {
          changeCount.count++;
        },
      };

      store.use(plugin);
      store.data.set('a', 1);
      store.data.set('b', 2);
      store.data.set('c', 3);

      expect(changeCount.count).toBe(3);
    });

    it('多个插件同时修改 beforeAction 参数应该按注册顺序依次生效', async () => {
      // @ts-ignore
      const plugin1: Plugin = {name: 'double', beforeAction: (_name, args) => [args[0] * 2]};
      // @ts-ignore
      const plugin2: Plugin = {name: 'addOne', beforeAction: (_name, args) => [args[0] + 1]};
      store.use(plugin1, plugin2);
      store.actions.register('compute', (_store, x: number) => x);

      const result = await store.dispatch('compute', 3);
      // 3 -> *2 = 6 -> +1 = 7
      expect(result).toBe(7);
    });

    it('插件缺少依赖时应该抛出明确错误', () => {
      const plugin: Plugin = {name: 'missingDep', dependencies: ['notExist']};
      expect(() => store.use(plugin)).toThrow(
        'Missing dependency "notExist" for plugin "missingDep"',
      );
    });
  });
});
