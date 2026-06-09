/**
 * 获取值的内部类型字符串
 * @param target - 待检测的值
 * @param lower - 是否转为小写，默认 true
 * @returns 类型字符串，如 'object'、'array'、'string' 等
 */
export function getType(target: unknown, lower = true): string {
  const type = Object.prototype.toString.call(target).slice(8, -1);
  return lower ? type.toLowerCase() : type;
}

/**
 * 判断是否为普通对象
 * @param target - 待检测的值
 * @returns 类型守卫，是否为 Record
 */
export const isObject = (target: unknown): target is Record<string, unknown> => getType(target) === 'object';

/**
 * 判断是否为数组
 * @param target - 待检测的值
 * @returns 类型守卫
 */
export const isArray = (target: unknown): target is Array<any> => Array.isArray(target);

/**
 * 判断是否为字符串
 * @param target - 待检测的值
 * @returns 类型守卫
 */
export const isString = (target: unknown): target is string => getType(target) === 'string';

/**
 * 判断是否为有限数字
 * @param target - 待检测的值
 * @returns 类型守卫
 */
export const isNumber = (target: unknown): target is number => Number.isFinite(target);

/**
 * 判断是否为函数
 * @param target - 待检测的值
 * @returns 类型守卫
 */
export const isFunction = (target: unknown): target is Function => typeof target === 'function';

/**
 * 判断值是否为空
 *
 * - null / undefined 视为空
 * - 对象：没有自身属性
 * - 字符串：去除空格后为空
 * - 数组：长度为 0
 * - 其他类型：返回 false
 *
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

/**
 * 深度结构相等比较
 *
 * 对两个值进行递归结构比较，不考虑原型链差异。
 * 支持普通对象和数组的深度比较，其他类型使用 === 比较。
 *
 * @param a - 第一个值
 * @param b - 第二个值
 * @returns 是否结构相等
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/**
 * 安全获取嵌套路径的值
 *
 * 沿路径逐层访问对象/数组，任意一层不存在时返回 undefined。
 *
 * @param obj - 根对象
 * @param keys - 路径键数组，数字索引表示数组访问
 * @returns 路径对应的值，不存在则返回 undefined
 *
 * @example
 * getIn({ a: { b: [1, 2] } }, ['a', 'b', 1]) // 2
 * getIn({ a: 1 }, ['a', 'b'])                 // undefined
 */
export function getIn(obj: unknown, keys: (string | number)[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof key === 'number' && Array.isArray(current)) {
      current = (current as unknown[])[key];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[String(key)];
    } else {
      return undefined;
    }
  }
  return current;
}
