/**
 * 生成一个随机字母数字字符
 * @returns 随机字符（A-Z a-z 0-9）
 */
export function randomChar() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * 生成指定长度的随机字符串
 * @param length - 字符串长度，必须 >= 0 且 <= 100000
 * @returns 随机字符串
 * @throws 当长度不合法时抛出 Error
 */
export function randomString(length: number): string {
  if (length < 0) throw new Error(`randomString: length must be >= 0, got ${length}`);
  if (length > 100_000) throw new Error(`randomString: length must be <= 100000, got ${length}`);
  return Array.from({ length }).map(randomChar).join('');
}

/**
 * 生成格式化的唯一 ID
 *
 * 占位符规则：
 * - `x` 替换为随机字母数字字符（A-Z a-z 0-9）
 * - `y` 替换为随机数字（0-9）
 * - `n` 替换为空字符串（移除）
 *
 * @param format - ID 格式模板，默认 `'xxx-xxx'`
 * @param prefix - 可选前缀，会以 `_` 与 ID 主体连接
 * @returns 格式化后的 ID 字符串
 *
 * @example
 * generateId()                       // 'aB3-xY9'
 * generateId('xxyy')                 // 'aB39'
 * generateId('xxx-xxx', 'user')      // 'user_aB3-xY9'
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
