import { describe, it, expect } from 'vitest';
import { Utils } from '../../lib';

const { getType, isObject, isArray, isString, isNumber, isFunction, isEmpty } = Utils;

describe('对象工具函数', () => {
  describe('getType', () => {
    it('应该返回对象的正确类型', () => {
      expect(getType({})).toBe('object');
      expect(getType({ a: 1 })).toBe('object');
    });

    it('应该返回数组的正确类型', () => {
      expect(getType([])).toBe('array');
      expect(getType([1, 2, 3])).toBe('array');
    });

    it('应该返回字符串的正确类型', () => {
      expect(getType('')).toBe('string');
      expect(getType('hello')).toBe('string');
    });

    it('应该返回数字的正确类型', () => {
      expect(getType(0)).toBe('number');
      expect(getType(123)).toBe('number');
      expect(getType(NaN)).toBe('number');
    });

    it('应该返回函数的正确类型', () => {
      expect(getType(() => {})).toBe('function');
      expect(getType(function () {})).toBe('function');
    });

    it('应该返回null和undefined的正确类型', () => {
      expect(getType(null)).toBe('null');
      expect(getType(undefined)).toBe('undefined');
    });

    it('当lower为false时应该返回大写类型', () => {
      expect(getType({}, false)).toBe('Object');
      expect(getType([], false)).toBe('Array');
      expect(getType('test', false)).toBe('String');
    });
  });

  describe('isObject', () => {
    it('应该对普通对象返回true', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('应该对非对象返回false', () => {
      expect(isObject([])).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject(() => {})).toBe(false);
    });
  });

  describe('isArray', () => {
    it('应该对数组返回true', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(new Array())).toBe(true);
    });

    it('应该对非数组返回false', () => {
      expect(isArray({})).toBe(false);
      expect(isArray('string')).toBe(false);
      expect(isArray(123)).toBe(false);
      expect(isArray(null)).toBe(false);
    });
  });

  describe('isString', () => {
    it('应该对字符串返回true', () => {
      expect(isString('')).toBe(true);
      expect(isString('hello')).toBe(true);
      expect(isString(String('test'))).toBe(true);
    });

    it('应该对非字符串返回false', () => {
      expect(isString(123)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString(null)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('应该对有限数字返回true', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });

    it('应该对非数字和特殊值返回false', () => {
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber(Infinity)).toBe(false);
      expect(isNumber(-Infinity)).toBe(false);
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isFunction', () => {
    it('应该对函数返回true', () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(function () {})).toBe(true);
      expect(isFunction(async () => {})).toBe(true);
      expect(isFunction(class {})).toBe(true);
    });

    it('应该对非函数返回false', () => {
      expect(isFunction({})).toBe(false);
      expect(isFunction([])).toBe(false);
      expect(isFunction('string')).toBe(false);
      expect(isFunction(123)).toBe(false);
    });
  });

  describe('isEmpty', () => {
    it('应该对空对象返回true', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('应该对非空对象返回false', () => {
      expect(isEmpty({ key: 'value' })).toBe(false);
      expect(isEmpty({ a: 1, b: 2 })).toBe(false);
    });

    it('应该对空字符串返回true', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
    });

    it('应该对非空字符串返回false', () => {
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty('  test  ')).toBe(false);
    });

    it('应该对空数组返回true', () => {
      expect(isEmpty([])).toBe(true);
    });

    it('应该对非空数组返回false', () => {
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty([1, 2, 3])).toBe(false);
    });

    it('应该对其他类型返回false', () => {
      expect(isEmpty(123)).toBe(false);
      expect(isEmpty(null)).toBe(false);
      expect(isEmpty(undefined)).toBe(false);
    });
  });
});
