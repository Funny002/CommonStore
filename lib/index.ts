/**
 * CommonStore — 基于 Immutable.js 的模块化状态管理库
 *
 * 统一导出入口，包含：
 * - 工具函数（Utils）
 * - 内置插件（Logger / History / Persist）
 * - 核心模块（Store）
 *
 */
export * as Utils from './utils';
export * from './plugin';
export * from './core';
