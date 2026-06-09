/**
 * 生成指定范围内的随机整数（含两端）
 * @param min - 最小值（整数）
 * @param max - 最大值（整数）
 * @returns 随机整数
 * @throws 参数非整数或 min > max 时抛出 Error
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
 * 生成 0-9 的随机数字
 * @returns 随机个位整数
 */
export const randDigits = () => Math.floor(Math.random() * 10);
