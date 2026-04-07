export function randomChars() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return chars[Math.floor(Math.random() * chars.length)];
}

export function randomString(long: number): string {
  return Array.from({length: long}).map(randomChars).join('');
}

export function generateId(format = 'xxx-xxx', prefix?: string) {
  return (prefix ? `${prefix}_` : '') + format.replace(/[yxn]/g, (match: string): string => {
    if (match === 'y') return Math.floor(Math.random() * 10).toString();
    if (match === 'x') return randomChars();
    return '';
  });
}
