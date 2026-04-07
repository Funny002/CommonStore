export function getType(target: any, lower = true): string {
  return (val => lower ? val.toLowerCase() : val)(Object.prototype.toString.call(target).slice(8, -1));
}

export const isObject = (target: any): target is Object => getType(target) === 'object';

export const isArray = (target: any): target is Array<any> => Array.isArray(target);

export const isString = (target: any): target is string => getType(target) === 'string';

export const isNumber = (target: any): target is number => Number.isFinite(target);

export const isFunction = (target: any): target is Function => getType(target) === 'function';

export const isEmpty = (target: any): boolean => {
  if (isObject(target)) return !Object.keys(target).length;
  if (isString(target)) return !target.trim().length;
  if (isArray(target)) return !target.length;
  return false;
};
