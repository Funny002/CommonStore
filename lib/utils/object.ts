/**
 * 获取值的类型字符串
 * @param target - 待检测的值
 * @param lower - 是否转换为小写，默认 true
 * @returns 类型字符串，如 'object'、'array'、'string' 等
 */
export function getType(target: any, lower = true): string {
  return (val => lower ? val.toLowerCase() : val)(Object.prototype.toString.call(target).slice(8, -1));
}

/**
 * 判断是否为普通对象
 * @param target - 待检测的值
 * @returns 是否为对象类型
 */
export const isObject = (target: any): target is Object => getType(target) === 'object';

/**
 * 判断是否为数组
 * @param target - 待检测的值
 * @returns 是否为数组
 */
export const isArray = (target: any): target is Array<any> => Array.isArray(target);

/**
 * 判断是否为字符串
 * @param target - 待检测的值
 * @returns 是否为字符串
 */
export const isString = (target: any): target is string => getType(target) === 'string';

/**
 * 判断是否为有限数字
 * @param target - 待检测的值
 * @returns 是否为有限数字
 */
export const isNumber = (target: any): target is number => Number.isFinite(target);

/**
 * 判断是否为函数
 * @param target - 待检测的值
 * @returns 是否为函数
 */
export const isFunction = (target: any): target is Function => getType(target) === 'function';

/**
 * 判断值是否为空
 * 对象：没有属性
 * 字符串：去除空格后为空
 * 数组：长度为 0
 * @param target - 待检测的值
 * @returns 是否为空
 */
export const isEmpty = (target: any): boolean => {
  if (isObject(target)) return !Object.keys(target).length;
  if (isString(target)) return !target.trim().length;
  if (isArray(target)) return !target.length;
  return false;
};
