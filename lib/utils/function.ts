/**
 * 防抖函数：延迟执行，若在延迟内重复调用则重置计时
 * @param fn - 需要防抖的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 带 cancel 方法的防抖函数
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}

/**
 * 节流函数：固定间隔内只执行一次
 * @param fn - 需要节流的函数
 * @param delay - 间隔时间（毫秒）
 * @returns 带 cancel 方法的节流函数
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let last = 0;
  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
  throttled.cancel = () => {
    last = 0;
  };
  return throttled;
}
