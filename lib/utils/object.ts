/**
 * 获取值的类型字符串
 * @param target - 待检测的值
 * @param lower - 是否转换为小写，默认 true
 * @returns 类型字符串，如 'object'、'array'、'string' 等
 */
export function getType(target: unknown, lower = true): string {
  const type = Object.prototype.toString.call(target).slice(8, -1);
  return lower ? type.toLowerCase() : type;
}

/**
 * 判断是否为普通对象
 * @param target - 待检测的值
 * @returns 是否为对象类型
 */
export const isObject = (target: unknown): target is Record<string, unknown> => getType(target) === 'object';

/**
 * 判断是否为数组
 * @param target - 待检测的值
 * @returns 是否为数组
 */
export const isArray = (target: unknown): target is Array<any> => Array.isArray(target);

/**
 * 判断是否为字符串
 * @param target - 待检测的值
 * @returns 是否为字符串
 */
export const isString = (target: unknown): target is string => getType(target) === 'string';

/**
 * 判断是否为有限数字
 * @param target - 待检测的值
 * @returns 是否为有限数字
 */
export const isNumber = (target: unknown): target is number => Number.isFinite(target);

/**
 * 判断是否为函数
 * @param target - 待检测的值
 * @returns 是否为函数
 */
export const isFunction = (target: unknown): target is Function => typeof target === 'function';

/**
 * 判断值是否为空
 * null / undefined：视为空
 * 对象：没有属性
 * 字符串：去除空格后为空
 * 数组：长度为 0
 * 其他：返回 false
 * @param target - 待检测的值
 * @returns 是否为空
 */
export const isEmpty = (target: unknown): boolean => {
  if (target === null || target === undefined) return true;
  if (isObject(target)) return !Object.keys(target).length;
  if (isString(target)) return !target.trim().length;
  if (isArray(target)) return !target.length;
  return false;
};
