import type { Plugin, Store } from '../core';

export interface LoggerOptions {
  logActions?: boolean;
  logDataChanges?: boolean;
  logger?: Pick<Console, 'log' | 'group' | 'groupEnd' | 'error'>;
  showDuration?: boolean;
}

const defaultOptions: Required<LoggerOptions> = {
  logActions: true,
  logDataChanges: true,
  logger: console,
  showDuration: true,
};

export const loggerPlugin = (options: LoggerOptions = {}): Plugin<Store> => {
  const opts = {...defaultOptions, ...options};
  const startTimeStack: number[] = [];

  return {
    name: 'logger',
    version: '1.0.0',

    install() {
      opts.logger.log?.('[Logger] 插件已安装');
    },

    uninstall() {
      opts.logger.log?.('[Logger] 插件已卸载');
    },

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
