/**
 * 函数工具模块
 *
 * 提供防抖（debounce）和节流（throttle）两个高频函数调用控制工具。
 */
/**
 * 创建防抖函数，在连续调用时只执行最后一次
 * @param fn - 需要防抖的函数
 * @param delay - 延迟毫秒数
 * @returns 防抖后的函数（附带 cancel 方法可取消 pending 定时器），每次调用都会重置计时器
 * @template T - 原函数类型
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    clearTimeout(timer);
  };
  return debounced;
}

/**
 * 创建节流函数，在指定间隔内最多执行一次
 * @param fn - 需要节流的函数
 * @param delay - 节流间隔毫秒数
 * @returns 节流后的函数
 * @template T - 原函数类型
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
}
