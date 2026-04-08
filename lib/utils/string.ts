/**
 * 从字母数字字符集中随机选择一个字符
 * @returns 随机字符 [A-Za-z0-9]
 */
export function randomChars() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * 生成指定长度的随机字符串
 * @param long - 字符串长度
 * @returns 随机字符串 [A-Za-z0-9]
 */
export function randomString(long: number): string {
  return Array.from({length: long}).map(randomChars).join('');
}

/**
 * 生成格式化 ID
 * 支持自定义格式，如 'xxx-xxx' 或 'yyy-xxx'
 * @param format - 格式模板，x=随机字符[A-Za-z0-9]，y=随机数字，n=空
 * @param prefix - 可选的前缀
 * @returns 生成的 ID
 */
export function generateId(format = 'xxx-xxx', prefix?: string) {
  return (prefix ? `${prefix}_` : '') + format.replace(/[yxn]/g, (match: string): string => {
    if (match === 'y') return Math.floor(Math.random() * 10).toString();
    if (match === 'x') return randomChars();
    return '';
  });
}
