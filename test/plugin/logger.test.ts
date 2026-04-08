import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store, Logger } from '../../lib';

describe('Logger 日志插件', () => {
  let mockLogger: any;
  let store: Store;

  beforeEach(() => {
    // 创建模拟的 logger 对象
    mockLogger = {
      log: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      error: vi.fn(),
    };

    store = new Store({ count: 0 });
  });

  describe('插件创建', () => {
    it('应该使用默认配置创建插件', () => {
      const plugin = Logger();

      expect(plugin.name).toBe('logger');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.beforeAction).toBeDefined();
      expect(plugin.afterAction).toBeDefined();
      expect(plugin.onError).toBeDefined();
      expect(plugin.onDataChange).toBeDefined();
    });

    it('应该支持自定义配置', () => {
      const plugin = Logger({
        logActions: false,
        logDataChanges: false,
        showDuration: false,
        logger: mockLogger,
      });

      expect(plugin.name).toBe('logger');
    });

    it('应该合并默认配置和自定义配置', () => {
      const plugin = Logger({
        logActions: false,
        logger: mockLogger,
      });

      expect(plugin.name).toBe('logger');
    });
  });

  describe('install - 安装插件', () => {
    it('安装时应该打印日志', () => {
      const plugin = Logger({ logger: mockLogger });

      plugin.install?.(store);

      expect(mockLogger.log).toHaveBeenCalledWith('[Logger] 插件已安装');
    });
  });

  describe('uninstall - 卸载插件', () => {
    it('卸载时应该打印日志', () => {
      const plugin = Logger({ logger: mockLogger });

      plugin.uninstall?.();

      expect(mockLogger.log).toHaveBeenCalledWith('[Logger] 插件已卸载');
    });
  });

  describe('beforeAction - Action 执行前', () => {
    it('logActions 为 true 时应该记录日志', () => {
      const plugin = Logger({ logger: mockLogger, logActions: true });

      plugin.beforeAction?.('testAction', [1, 2, 3]);

      expect(mockLogger.group).toHaveBeenCalledWith('⚡ Action: testAction');
      expect(mockLogger.log).toHaveBeenCalledWith('参数:', [1, 2, 3]);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('logActions 为 false 时不应该记录日志', () => {
      const plugin = Logger({ logger: mockLogger, logActions: false });

      plugin.beforeAction?.('testAction', [1, 2, 3]);

      expect(mockLogger.group).not.toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('showDuration 为 true 时应该记录开始时间', () => {
      const plugin = Logger({ logger: mockLogger, showDuration: true });

      plugin.beforeAction?.('testAction', []);

      const calls = mockLogger.log.mock.calls;
      const hasStartTime = calls.some((call: any[]) => call[0] === '开始时间:');
      expect(hasStartTime).toBe(true);
    });

    it('showDuration 为 false 时不应该记录开始时间', () => {
      const plugin = Logger({ logger: mockLogger, showDuration: false });

      plugin.beforeAction?.('testAction', []);

      const calls = mockLogger.log.mock.calls;
      const hasStartTime = calls.some((call: any[]) => call[0] === '开始时间:');
      expect(hasStartTime).toBe(false);
    });

    it('应该将开始时间压入栈中', () => {
      const plugin = Logger({ logger: mockLogger });

      plugin.beforeAction?.('action1', []);
      plugin.beforeAction?.('action2', []);

      // 验证 group 被调用了两次，说明两次 beforeAction 都执行了
      expect(mockLogger.group).toHaveBeenCalledTimes(2);
    });
  });

  describe('afterAction - Action 执行后', () => {
    it('logActions 为 true 时应该记录日志', () => {
      const plugin = Logger({ logger: mockLogger, logActions: true });

      plugin.beforeAction?.('testAction', [1, 2]);
      plugin.afterAction?.('testAction', 'result', [1, 2]);

      expect(mockLogger.log).toHaveBeenCalledWith('✅ 完成');
      expect(mockLogger.log).toHaveBeenCalledWith('⚡ Action:', 'testAction');
      expect(mockLogger.log).toHaveBeenCalledWith('参数:', [1, 2]);
      expect(mockLogger.log).toHaveBeenCalledWith('返回值:', 'result');
      expect(mockLogger.groupEnd).toHaveBeenCalled();
    });

    it('logActions 为 false 时不应该记录日志', () => {
      const plugin = Logger({ logger: mockLogger, logActions: false });

      plugin.afterAction?.('testAction', 'result', [1, 2]);

      expect(mockLogger.log).not.toHaveBeenCalledWith('✅ 完成');
    });

    it('showDuration 为 true 时应该记录耗时', () => {
      const plugin = Logger({ logger: mockLogger, showDuration: true });

      plugin.beforeAction?.('testAction', []);
      plugin.afterAction?.('testAction', 'result', []);

      const calls = mockLogger.log.mock.calls;
      const hasDuration = calls.some((call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('⏱️ 耗时:'),
      );
      expect(hasDuration).toBe(true);
    });

    it('showDuration 为 false 时不应该记录耗时', () => {
      const plugin = Logger({ logger: mockLogger, showDuration: false });

      plugin.beforeAction?.('testAction', []);
      plugin.afterAction?.('testAction', 'result', []);

      const calls = mockLogger.log.mock.calls;
      const hasDuration = calls.some((call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('⏱️ 耗时:'),
      );
      expect(hasDuration).toBe(false);
    });

    it('应该正确处理返回值', () => {
      const plugin = Logger({ logger: mockLogger });

      plugin.beforeAction?.('testAction', []);
      plugin.afterAction?.('testAction', { success: true, data: [1, 2, 3] }, []);

      expect(mockLogger.log).toHaveBeenCalledWith('返回值:', { success: true, data: [1, 2, 3] });
    });
  });

  describe('onError - Action 执行出错', () => {
    it('logActions 为 true 时应该记录错误日志', () => {
      const plugin = Logger({ logger: mockLogger, logActions: true });
      const error = new Error('Test error');

      plugin.beforeAction?.('testAction', [1, 2]);
      plugin.onError?.('testAction', error, [1, 2]);

      expect(mockLogger.group).toHaveBeenCalledWith('❌ Action 失败: testAction');
      expect(mockLogger.error).toHaveBeenCalledWith('错误:', error);
      expect(mockLogger.log).toHaveBeenCalledWith('参数:', [1, 2]);
      expect(mockLogger.groupEnd).toHaveBeenCalled();
    });

    it('logActions 为 false 时不应该记录错误日志', () => {
      const plugin = Logger({ logger: mockLogger, logActions: false });
      const error = new Error('Test error');

      plugin.onError?.('testAction', error, [1, 2]);

      expect(mockLogger.group).not.toHaveBeenCalledWith('❌ Action 失败: testAction');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('showDuration 为 true 时应该记录耗时', () => {
      const plugin = Logger({ logger: mockLogger, showDuration: true });
      const error = new Error('Test error');

      plugin.beforeAction?.('testAction', []);
      plugin.onError?.('testAction', error, []);

      const calls = mockLogger.log.mock.calls;
      const hasDuration = calls.some((call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('⏱️ 耗时:'),
      );
      expect(hasDuration).toBe(true);
    });

    it('应该记录错误对象', () => {
      const plugin = Logger({ logger: mockLogger });
      const error = new Error('Custom error message');

      plugin.beforeAction?.('testAction', []);
      plugin.onError?.('testAction', error, []);

      expect(mockLogger.error).toHaveBeenCalledWith('错误:', error);
    });
  });

  describe('onDataChange - 数据变更', () => {
    it('logDataChanges 为 true 时应该记录数据变更', () => {
      const plugin = Logger({ logger: mockLogger, logDataChanges: true });

      plugin.onDataChange?.(['user', 'name'], 'Alice', 'Bob');

      expect(mockLogger.group).toHaveBeenCalledWith('📦 数据变更: user.name');
      expect(mockLogger.log).toHaveBeenCalledWith('旧值:', 'Bob');
      expect(mockLogger.log).toHaveBeenCalledWith('新值:', 'Alice');
      expect(mockLogger.groupEnd).toHaveBeenCalled();
    });

    it('logDataChanges 为 false 时不应该记录数据变更', () => {
      const plugin = Logger({ logger: mockLogger, logDataChanges: false });

      plugin.onDataChange?.(['user', 'name'], 'Alice', 'Bob');

      expect(mockLogger.group).not.toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('根路径变更应该显示"根路径"', () => {
      const plugin = Logger({ logger: mockLogger, logDataChanges: true });

      plugin.onDataChange?.([], { count: 1 }, { count: 0 });

      expect(mockLogger.group).toHaveBeenCalledWith('📦 数据变更: 根路径');
    });

    it('应该处理嵌套路径', () => {
      const plugin = Logger({ logger: mockLogger, logDataChanges: true });

      plugin.onDataChange?.(['a', 'b', 'c'], 'new', 'old');

      expect(mockLogger.group).toHaveBeenCalledWith('📦 数据变更: a.b.c');
    });

    it('应该处理复杂的数据类型', () => {
      const plugin = Logger({ logger: mockLogger, logDataChanges: true });
      const oldValue = { items: [1, 2, 3] };
      const newValue = { items: [1, 2, 3, 4] };

      plugin.onDataChange?.(['data'], newValue, oldValue);

      expect(mockLogger.log).toHaveBeenCalledWith('旧值:', oldValue);
      expect(mockLogger.log).toHaveBeenCalledWith('新值:', newValue);
    });

    it('应该处理 undefined 值', () => {
      const plugin = Logger({ logger: mockLogger, logDataChanges: true });

      plugin.onDataChange?.(['key'], 'value', undefined);

      expect(mockLogger.log).toHaveBeenCalledWith('旧值:', undefined);
      expect(mockLogger.log).toHaveBeenCalledWith('新值:', 'value');
    });
  });

  describe('集成测试', () => {
    it('应该能够在 Store 中正常使用', async () => {
      const plugin = Logger({ logger: mockLogger });
      store.use(plugin);

      store.actions.register('increment', (s) => {
        const current = s.getState<number>('count') || 0;
        s.data.set('count', current + 1);
        return s.getState('count');
      });

      await store.dispatch('increment');

      // 验证 install 被调用
      expect(mockLogger.log).toHaveBeenCalledWith('[Logger] 插件已安装');

      // 验证 beforeAction 被调用
      expect(mockLogger.group).toHaveBeenCalledWith(expect.stringContaining('⚡ Action: increment'));

      // 验证 afterAction 被调用
      expect(mockLogger.log).toHaveBeenCalledWith('✅ 完成');

      // 验证 onDataChange 被调用
      expect(mockLogger.group).toHaveBeenCalledWith('📦 数据变更: count');
    });

    it('应该能够处理多个 action 的顺序执行', async () => {
      const plugin = Logger({ logger: mockLogger });
      store.use(plugin);

      store.actions.register('action1', () => 'result1');
      store.actions.register('action2', () => 'result2');

      await store.dispatch('action1');
      await store.dispatch('action2');

      // 验证两个 action 都被记录了
      const groupCalls = mockLogger.group.mock.calls;
      const actionCalls = groupCalls.filter((call: any[]) =>
          call[0] && call[0].includes('⚡ Action:'),
      );
      expect(actionCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('应该能够处理 action 错误',  () => {
      const plugin = Logger({ logger: mockLogger });
      store.use(plugin);

      store.actions.register('failAction', () => {
        throw new Error('Action failed');
      });

      expect(store.dispatch('failAction')).rejects.toThrow('Action failed');

      // 验证 onError 被调用
      expect(mockLogger.group).toHaveBeenCalledWith(expect.stringContaining('❌ Action 失败: failAction'));
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('禁用 logActions 时不应该记录 action 相关日志', async () => {
      const plugin = Logger({ logger: mockLogger, logActions: false });
      store.use(plugin);

      store.actions.register('test', () => 'ok');
      await store.dispatch('test');

      // 不应该有 action 相关的日志
      const groupCalls = mockLogger.group.mock.calls;
      const actionCalls = groupCalls.filter((call: any[]) =>
          call[0] && call[0].includes('⚡ Action:'),
      );
      expect(actionCalls.length).toBe(0);
    });

    it('禁用 logDataChanges 时不应该记录数据变更日志', async () => {
      const plugin = Logger({ logger: mockLogger, logDataChanges: false });
      store.use(plugin);

      store.actions.register('setData', (s) => {
        s.data.set('key', 'value');
      });

      await store.dispatch('setData');

      // 不应该有数据变更相关的日志
      const groupCalls = mockLogger.group.mock.calls;
      const dataChangeCalls = groupCalls.filter((call: any[]) =>
          call[0] && call[0].includes('📦 数据变更:'),
      );
      expect(dataChangeCalls.length).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理没有 beforeAction 直接调用 afterAction 的情况', () => {
      const plugin = Logger({ logger: mockLogger });

      // 直接调用 afterAction，没有对应的 beforeAction
      plugin.afterAction?.('testAction', 'result', []);

      // 不应该报错
      expect(mockLogger.log).toHaveBeenCalledWith('✅ 完成');
    });

    it('应该处理没有 beforeAction 直接调用 onError 的情况', () => {
      const plugin = Logger({ logger: mockLogger });
      const error = new Error('Test');

      // 直接调用 onError，没有对应的 beforeAction
      plugin.onError?.('testAction', error, []);

      // 不应该报错
      expect(mockLogger.group).toHaveBeenCalled();
    });

    it('应该处理空参数数组', () => {
      const plugin = Logger({ logger: mockLogger });

      plugin.beforeAction?.('testAction', []);
      plugin.afterAction?.('testAction', null, []);

      expect(mockLogger.log).toHaveBeenCalledWith('参数:', []);
      expect(mockLogger.log).toHaveBeenCalledWith('返回值:', null);
    });

    it('应该处理 undefined 返回值', () => {
      const plugin = Logger({ logger: mockLogger });

      plugin.beforeAction?.('testAction', []);
      plugin.afterAction?.('testAction', undefined, []);

      expect(mockLogger.log).toHaveBeenCalledWith('返回值:', undefined);
    });

    it('多次连续调用应该正确管理时间栈', () => {
      const plugin = Logger({ logger: mockLogger });

      plugin.beforeAction?.('action1', []);
      plugin.beforeAction?.('action2', []);
      plugin.beforeAction?.('action3', []);

      plugin.afterAction?.('action1', 'r1', []);
      plugin.afterAction?.('action2', 'r2', []);
      plugin.afterAction?.('action3', 'r3', []);

      // 验证所有调用都完成了
      expect(mockLogger.groupEnd).toHaveBeenCalledTimes(3);
    });
  });
});
