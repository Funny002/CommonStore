import { describe, it, expect } from "vitest";
import { Utils } from "../../lib";

const { randNum, randDigits } = Utils;

describe("数字工具函数", () => {
  describe("randNum", () => {
    it("应该生成 [min, max] 范围内的整数", () => {
      for (let i = 0; i < 100; i++) {
        const n = randNum(1, 10);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(10);
      }
    });

    it("min 等于 max 时应该返回该值", () => {
      for (let i = 0; i < 20; i++) {
        expect(randNum(5, 5)).toBe(5);
      }
    });

    it("应该支持负数范围", () => {
      for (let i = 0; i < 100; i++) {
        const n = randNum(-10, -1);
        expect(n).toBeGreaterThanOrEqual(-10);
        expect(n).toBeLessThanOrEqual(-1);
      }
    });

    it("min > max 时应该抛出错误", () => {
      expect(() => randNum(10, 1)).toThrow("randNum: min must be <= max");
    });

    it("非整数参数应该抛出错误", () => {
      expect(() => randNum(1.5, 10)).toThrow("randNum: min and max must be integers");
      expect(() => randNum(1, 10.5)).toThrow("randNum: min and max must be integers");
    });

    it("NaN 参数应该抛出错误", () => {
      expect(() => randNum(NaN, 10)).toThrow("randNum: min and max must be integers");
      expect(() => randNum(1, NaN)).toThrow("randNum: min and max must be integers");
    });

    it("范围覆盖应该均匀", () => {
      const counts: Record<number, number> = {};
      for (let i = 0; i < 1000; i++) {
        const n = randNum(0, 4);
        counts[n] = (counts[n] || 0) + 1;
      }
      // 5 个数字各至少应出现 50 次（统计上几乎必然）
      for (let i = 0; i <= 4; i++) {
        expect(counts[i]).toBeGreaterThan(50);
      }
    });
  });

  describe("randDigits", () => {
    it("应该生成 0-9 范围内的整数", () => {
      for (let i = 0; i < 100; i++) {
        const d = randDigits();
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(9);
      }
    });

    it("应该有一定分布多样性", () => {
      const digits = new Set<number>();
      for (let i = 0; i < 200; i++) {
        digits.add(randDigits());
      }
      expect(digits.size).toBeGreaterThanOrEqual(7);
    });
  });
});
