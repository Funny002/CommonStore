/**
 * 从字母数字字符集中随机选择一个字符
 * @returns 随机字符 [A-Za-z0-9]
 */
export function randomChar() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * 生成指定长度的随机字符串
 * @param length - 字符串长度（0 ≤ length ≤ 100000）
 * @returns 随机字符串 [A-Za-z0-9]
 * @throws 当 length < 0 或 length > 100000 时抛出错误
 */
export function randomString(length: number): string {
  if (length < 0) throw new Error(`randomString: length must be >= 0, got ${length}`);
  if (length > 100_000) throw new Error(`randomString: length must be <= 100000, got ${length}`);
  return Array.from({ length }).map(randomChar).join('');
}

/**
 * 生成格式化 ID
 * 支持自定义格式，如 'xxx-xxx' 或 'yyy-xxx'
 * @param format - 格式模板，x=随机字符[A-Za-z0-9]，y=随机数字，n=空
 * @param prefix - 可选的前缀
 * @returns 生成的 ID
 */
export function generateId(format = 'xxx-xxx', prefix?: string) {
  return (
    (prefix ? `${prefix}_` : '') +
    format.replace(/[yxn]/g, (match: string): string => {
      if (match === 'y') return Math.floor(Math.random() * 10).toString();
      if (match === 'x') return randomChar();
      return '';
    })
  );
}
