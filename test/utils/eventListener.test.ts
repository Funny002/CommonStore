import { describe, it, expect, vi } from 'vitest';
import { Utils } from '../../lib';

const { EventListener } = Utils;

describe('事件监听器', () => {
  describe('构造函数', () => {
    it('应该创建 EventListener 实例', () => {
      const emitter = new EventListener();
      expect(emitter).toBeInstanceOf(EventListener);
    });

    it('初始化时应该没有监听器', () => {
      const emitter = new EventListener();
      // 通过触发不存在的事件来验证不会报错
      expect(() => emitter.emit('test')).not.toThrow();
    });
  });

  describe('on - 注册事件监听器', () => {
    it('应该能够注册事件监听器', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.on('test', listener);
      emitter.emit('test');
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('应该能够为同一事件注册多个监听器', () => {
      const emitter = new EventListener();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.emit('test');
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('应该能够传递参数给监听器', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.on('test', listener);
      emitter.emit('test', 'arg1', 'arg2', 123);
      
      expect(listener).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('应该支持为不同事件注册不同的监听器', () => {
      const emitter = new EventListener();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.on('event1', listener1);
      emitter.on('event2', listener2);
      
      emitter.emit('event1');
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
    });

    it('应该允许同一个监听器函数注册多次', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.on('test', listener);
      emitter.on('test', listener);
      emitter.emit('test');
      
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('emit - 触发事件', () => {
    it('触发没有监听器的事件不应该报错', () => {
      const emitter = new EventListener();
      expect(() => emitter.emit('nonexistent')).not.toThrow();
    });

    it('应该按注册顺序调用监听器', () => {
      const emitter = new EventListener();
      const callOrder: number[] = [];
      
      emitter.on('test', () => callOrder.push(1));
      emitter.on('test', () => callOrder.push(2));
      emitter.on('test', () => callOrder.push(3));
      
      emitter.emit('test');
      
      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('应该能够多次触发同一事件', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.on('test', listener);
      emitter.emit('test');
      emitter.emit('test');
      emitter.emit('test');
      
      expect(listener).toHaveBeenCalledTimes(3);
    });
  });

  describe('off - 移除事件监听器', () => {
    it('应该能够移除指定的监听器', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.on('test', listener);
      emitter.off('test', listener);
      emitter.emit('test');
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('移除不存在的监听器不应该报错', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      expect(() => emitter.off('test', listener)).not.toThrow();
    });

    it('应该只移除指定的监听器，保留其他监听器', () => {
      const emitter = new EventListener();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.off('test', listener1);
      emitter.emit('test');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('移除监听器后再次注册应该可以正常工作', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.on('test', listener);
      emitter.off('test', listener);
      emitter.on('test', listener);
      emitter.emit('test');
      
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('once - 一次性监听器', () => {
    it('应该在触发一次后自动移除', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.once('test', listener);
      emitter.emit('test');
      emitter.emit('test');
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('应该能够接收参数', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.once('test', listener);
      emitter.emit('test', 'data', 42);
      
      expect(listener).toHaveBeenCalledWith('data', 42);
    });

    it('多个 once 监听器应该都能被触发一次', () => {
      const emitter = new EventListener();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.once('test', listener1);
      emitter.once('test', listener2);
      emitter.emit('test');
      emitter.emit('test');
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('once 和 on 混用时应该正确工作', () => {
      const emitter = new EventListener();
      const onceListener = vi.fn();
      const onListener = vi.fn();
      
      emitter.once('test', onceListener);
      emitter.on('test', onListener);
      
      emitter.emit('test');
      emitter.emit('test');
      
      expect(onceListener).toHaveBeenCalledTimes(1);
      expect(onListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeAll - 移除所有监听器', () => {
    it('应该移除指定事件的所有监听器', () => {
      const emitter = new EventListener();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.removeAll('test');
      emitter.emit('test');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('应该只移除指定事件的监听器，保留其他事件', () => {
      const emitter = new EventListener();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.on('event1', listener1);
      emitter.on('event2', listener2);
      emitter.removeAll('event1');
      
      emitter.emit('event1');
      emitter.emit('event2');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('移除不存在的事件不应该报错', () => {
      const emitter = new EventListener();
      expect(() => emitter.removeAll('nonexistent')).not.toThrow();
    });
  });

  describe('clear - 清空所有监听器', () => {
    it('应该清空所有事件的所有监听器', () => {
      const emitter = new EventListener();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      
      emitter.on('event1', listener1);
      emitter.on('event1', listener2);
      emitter.on('event2', listener3);
      emitter.clear();
      
      emitter.emit('event1');
      emitter.emit('event2');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });

    it('清空后应该能够重新注册监听器', () => {
      const emitter = new EventListener();
      const listener = vi.fn();
      
      emitter.on('test', listener);
      emitter.clear();
      emitter.on('test', listener);
      emitter.emit('test');
      
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('综合场景', () => {
    it('应该支持复杂的事件流', () => {
      const emitter = new EventListener();
      const results: string[] = [];
      
      // 注册多个监听器
      emitter.on('start', () => results.push('start'));
      emitter.on('process', (data) => results.push(`process:${data}`));
      emitter.once('complete', () => results.push('complete'));
      
      // 触发事件
      emitter.emit('start');
      emitter.emit('process', 'data1');
      emitter.emit('process', 'data2');
      emitter.emit('complete');
      emitter.emit('complete'); // 第二次不应该触发
      
      expect(results).toEqual([
        'start',
        'process:data1',
        'process:data2',
        'complete'
      ]);
    });

    it('监听器中修改外部状态应该生效', () => {
      const emitter = new EventListener();
      let count = 0;
      
      emitter.on('increment', () => {
        count++;
      });
      
      emitter.emit('increment');
      emitter.emit('increment');
      emitter.emit('increment');
      
      expect(count).toBe(3);
    });

    it('应该能够在监听器中触发其他事件', () => {
      const emitter = new EventListener();
      const results: string[] = [];
      
      emitter.on('event1', () => {
        results.push('event1');
        emitter.emit('event2');
      });
      
      emitter.on('event2', () => {
        results.push('event2');
      });
      
      emitter.emit('event1');
      
      expect(results).toEqual(['event1', 'event2']);
    });
  });
});
