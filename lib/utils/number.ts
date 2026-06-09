/**
 * 生成 [min, max] 区间内的随机整数（含两端）
 * @param min - 最小值（整数）
 * @param max - 最大值（整数）
 * @returns min ~ max 范围内的随机整数
 * @throws 当 min > max 或参数为非整数时抛出错误
 */
export const randNum = (min: number, max: number) => {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error(`randNum: min and max must be integers, got ${min}, ${max}`);
  }
  if (min > max) {
    throw new Error(`randNum: min must be <= max, got min=${min}, max=${max}`);
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 生成随机个位数字 0-9
 * @returns 0-9 之间的随机整数
 */
export const randDigits = () => Math.floor(Math.random() * 10);
