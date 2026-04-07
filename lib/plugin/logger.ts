import type { Plugin, Store } from '../core';

/**
 * 日志插件配置选项
 */
export interface LoggerOptions {
  /** 是否记录 action，默认 true */
  logActions?: boolean;

  /** 是否记录数据变更，默认 true */
  logDataChanges?: boolean;

  /** 自定义日志输出对象，默认 console */
  logger?: Pick<Console, 'log' | 'group' | 'groupEnd' | 'error'>;

  /** 是否显示耗时，默认 true */
  showDuration?: boolean;
}

const defaultOptions: Required<LoggerOptions> = {
  logActions: true,
  logDataChanges: true,
  logger: console,
  showDuration: true,
};

/**
 * 日志记录插件 提供 action 执行和数据变更的日志记录功能
 * @param options - 插件配置选项
 * @returns 插件实例
 */
export const loggerPlugin = (options: LoggerOptions = {}): Plugin<Store> => {
  const opts = {...defaultOptions, ...options};
  const startTimeStack: number[] = [];

  return {
    name: 'logger',
    version: '1.0.0',

    /**
     * 安装插件时打印日志
     */
    install() {
      opts.logger.log?.('[Logger] 插件已安装');
    },

    /**
     * 卸载插件时打印日志
     */
    uninstall() {
      opts.logger.log?.('[Logger] 插件已卸载');
    },

    /**
     * Action 执行前记录日志
     * @param actionName - action 名称
     * @param args - 参数数组
     */
    beforeAction(actionName: string, args: unknown[]): void {
      if (!opts.logActions) return;

      const startTime = Date.now();
      startTimeStack.push(startTime);

      opts.logger.group?.(`⚡ Action: ${actionName}`);
      opts.logger.log?.('参数:', args);
      if (opts.showDuration) {
        opts.logger.log?.('开始时间:', new Date(startTime).toISOString());
      }
    },

    /**
     * Action 执行成功后记录日志
     * @param actionName - action 名称
     * @param result - 执行结果
     * @param args - 参数数组
     */
    afterAction(actionName: string, result: unknown, args: unknown[]): void {
      if (!opts.logActions) return;

      const startTime = startTimeStack.pop();
      const duration = startTime !== undefined ? Date.now() - startTime : undefined;

      opts.logger.log?.('✅ 完成');
      opts.logger.log?.('⚡ Action:', actionName);
      opts.logger.log?.('参数:', args);
      opts.logger.log?.('返回值:', result);
      if (opts.showDuration && duration !== undefined) {
        opts.logger.log?.(`⏱️ 耗时: ${duration}ms`);
      }
      opts.logger.groupEnd?.();
    },

    /**
     * Action 执行出错时记录日志
     * @param actionName - action 名称
     * @param error - 错误对象
     * @param args - 参数数组
     */
    onError(actionName: string, error: Error, args: unknown[]): void {
      if (!opts.logActions) return;

      const startTime = startTimeStack.pop();
      const duration = startTime !== undefined ? Date.now() - startTime : undefined;

      opts.logger.group?.(`❌ Action 失败: ${actionName}`);
      opts.logger.error?.('错误:', error);
      opts.logger.log?.('参数:', args);
      if (opts.showDuration && duration !== undefined) {
        opts.logger.log?.(`⏱️ 耗时: ${duration}ms`);
      }
      opts.logger.groupEnd?.();
    },

    /**
     * 数据变更时记录日志
     * @param path - 变更路径
     * @param newValue - 新值
     * @param oldValue - 旧值
     */
    onDataChange(path: string[], newValue: unknown, oldValue: unknown): void {
      if (!opts.logDataChanges) return;

      const pathStr = path.length ? path.join('.') : '根路径';
      opts.logger.group?.(`📦 数据变更: ${pathStr}`);
      opts.logger.log?.('旧值:', oldValue);
      opts.logger.log?.('新值:', newValue);
      opts.logger.groupEnd?.();
    },
  };
};
