import type { Plugin, Store } from '../core';

/** 日志插件配置选项 */
export interface LoggerOptions {
  /** 是否记录 action 执行，默认 true */
  logActions?: boolean;

  /** 是否记录数据变更，默认 true */
  logDataChanges?: boolean;

  /** 自定义日志输出器，需实现 Console 的部分接口 */
  logger?: Pick<Console, 'log' | 'group' | 'groupEnd' | 'error'>;

  /** 是否显示 action 耗时，默认 true */
  showDuration?: boolean;
}

const defaultOptions: Required<LoggerOptions> = {
  logActions: true,
  logDataChanges: true,
  logger: console,
  showDuration: true,
};

/**
 * 创建日志插件
 *
 * @param options - 日志配置
 * @returns 插件实例
 */
export const Logger = (options: LoggerOptions = {}): Plugin<Store> => {
  const opts = { ...defaultOptions, ...options };

  /** Action 开始时间栈，用于计算耗时 */
  const startTimeStack: number[] = [];

  const logDuration = (startTimeStack: number[]) => {
    const startTime = startTimeStack.pop();
    if (startTime !== undefined && opts.showDuration) {
      opts.logger.log?.(`⏱️ 耗时: ${Date.now() - startTime}ms`);
    }
  };

  return {
    name: 'logger',
    version: '1.1.0',

    install() {
      opts.logger.log?.('[Logger] 插件已安装');
    },

    uninstall() {
      opts.logger.log?.('[Logger] 插件已卸载');
    },

    /**
     * Action 执行前：记录开始时间并打开控制台分组
     */
    beforeAction(actionName: string, args: unknown[]): void {
      if (!opts.logActions) return;

      startTimeStack.push(Date.now());

      opts.logger.group?.(`⚡ Action: ${actionName}`);
      opts.logger.log?.('参数:', args);
      if (opts.showDuration) {
        opts.logger.log?.('开始时间:', new Date(Date.now()).toISOString());
      }
    },

    /**
     * Action 执行成功：输出完成信息和耗时
     */
    afterAction(actionName: string, result: unknown, args: unknown[]): void {
      if (!opts.logActions) return;

      logDuration(startTimeStack);
      opts.logger.log?.('✅ 完成');
      opts.logger.log?.('⚡ Action:', actionName);
      opts.logger.log?.('参数:', args);
      opts.logger.log?.('返回值:', result);
      opts.logger.groupEnd?.();
    },

    /**
     * Action 执行失败：输出错误信息和耗时
     */
    onError(actionName: string, error: Error, args: unknown[]): void {
      if (!opts.logActions) return;

      logDuration(startTimeStack);
      opts.logger.group?.(`❌ Action 失败: ${actionName}`);
      opts.logger.error?.('错误:', error);
      opts.logger.log?.('参数:', args);
      opts.logger.groupEnd?.();
    },

    /**
     * 数据变更：以控制台分组形式输出变更路径和新旧值
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
