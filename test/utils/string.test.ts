import { describe, it, expect } from 'vitest';
import { Utils } from '../../lib';

const { randomChars, randomString, generateId } = Utils;

describe('字符串工具函数', () => {
  describe('randomChars', () => {
    it('应该返回单个字符', () => {
      const char = randomChars();
      expect(typeof char).toBe('string');
      expect(char.length).toBe(1);
    });

    it('应该返回字母或数字', () => {
      const char = randomChars();
      expect(/[A-Za-z0-9]/.test(char)).toBe(true);
    });

    it('多次调用应该可能返回不同的字符', () => {
      const chars = new Set();
      for (let i = 0; i < 100; i++) {
        chars.add(randomChars());
      }
      // 由于是随机的，100次调用很可能产生多个不同字符
      expect(chars.size).toBeGreaterThan(1);
    });

    it('返回的字符应该在有效字符集中', () => {
      const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      for (let i = 0; i < 50; i++) {
        const char = randomChars();
        expect(validChars).toContain(char);
      }
    });
  });

  describe('randomString', () => {
    it('应该生成指定长度的随机字符串', () => {
      const str = randomString(10);
      expect(typeof str).toBe('string');
      expect(str.length).toBe(10);
    });

    it('生成长度为0的字符串应该返回空字符串', () => {
      const str = randomString(0);
      expect(str).toBe('');
      expect(str.length).toBe(0);
    });

    it('生成的字符串应该只包含字母和数字', () => {
      const str = randomString(20);
      expect(/^[A-Za-z0-9]+$/.test(str)).toBe(true);
    });

    it('多次调用应该生成不同的字符串', () => {
      const strings = new Set();
      for (let i = 0; i < 50; i++) {
        strings.add(randomString(10));
      }
      // 由于是随机的，50次调用几乎肯定会产生不同的字符串
      expect(strings.size).toBeGreaterThan(1);
    });

    it('应该支持生成较长的字符串', () => {
      const str = randomString(1000);
      expect(str.length).toBe(1000);
      expect(/^[A-Za-z0-9]+$/.test(str)).toBe(true);
    });

    it('应该支持生成长度为1的字符串', () => {
      const str = randomString(1);
      expect(str.length).toBe(1);
      expect(/[A-Za-z0-9]/.test(str)).toBe(true);
    });
  });

  describe('generateId', () => {
    it('应该使用默认格式生成ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/);
    });

    it('应该支持自定义格式xxx-xxx', () => {
      const id = generateId('xxx-xxx');
      expect(id).toMatch(/^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/);
      expect(id.length).toBe(7); // 3 + 1(-) + 3
    });

    it('应该支持自定义格式yyy-xxx', () => {
      const id = generateId('yyy-xxx');
      expect(id).toMatch(/^\d{3}-[A-Za-z0-9]{3}$/);
      expect(id.length).toBe(7); // 3 + 1(-) + 3
    });

    it('应该支持自定义格式yyy-yyy', () => {
      const id = generateId('yyy-yyy');
      expect(id).toMatch(/^\d{3}-\d{3}$/);
      expect(id.length).toBe(7);
    });

    it('应该支持添加前缀', () => {
      const id = generateId('xxx-xxx', 'user');
      expect(id).toMatch(/^user_[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/);
      expect(id.startsWith('user_')).toBe(true);
    });

    it('应该支持复杂格式', () => {
      const id = generateId('xxx-yyy-xxx');
      expect(id).toMatch(/^[A-Za-z0-9]{3}-\d{3}-[A-Za-z0-9]{3}$/);
      expect(id.length).toBe(11); // 3 + 1 + 3 + 1 + 3
    });

    it('格式中的n应该被替换为空字符串', () => {
      const id = generateId('xxnx');
      expect(id).toMatch(/^[A-Za-z0-9]{3}$/);
      expect(id.length).toBe(3);
    });

    it('多次调用应该生成不同的ID', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBeGreaterThan(1);
    });

    it('应该支持空格式', () => {
      const id = generateId('');
      expect(id).toBe('');
    });

    it('应该支持只有前缀的情况', () => {
      const id = generateId('', 'prefix');
      expect(id).toBe('prefix_');
    });

    it('混合格式应该正确生成', () => {
      const id = generateId('xyx-yxy');
      expect(id).toMatch(/^[A-Za-z0-9]\d[A-Za-z0-9]-\d[A-Za-z0-9]\d$/);
      expect(id.length).toBe(7);
    });
  });
});
