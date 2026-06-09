/**
 * Demo 共享工具与全局状态
 */

/** 日志条目的最大保留数 */
export const MAX_LOG = 50;

/** 操作日志条目 */
export const logEntries: string[] = [];

/** 订阅通知条目 */
export const subNotifications: string[] = [];

/** 管理的订阅列表（用于取消导航） */
export const managedSubscriptions: Array<{ path: string; unsubscribe: () => void }> = [];

/** 获取单个 DOM 元素（元素不存在时抛出错误） */
export function qs(selector: string): HTMLElement {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Element not found: "${selector}"`);
  return el as HTMLElement;
}

/** 获取 DOM 元素数组 */
export function $$(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(selector));
}

/** 添加操作日志 */
export function addLog(msg: string, type: "info" | "data" | "error" = "info") {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  let css = "log-info";
  if (type === "data") css = "log-data";
  if (type === "error") css = "log-error";
  logEntries.push(`<div class="log-item"><span class="log-time">${time}</span><span class="${css}">${msg}</span></div>`);
  if (logEntries.length > MAX_LOG) logEntries.shift();
  qs("#log-list").innerHTML = logEntries.slice(-20).join("");
}

/** 添加订阅通知 */
export function addSubNotification(path: string, newVal: unknown, oldVal: unknown) {
  const nv = typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal);
  const ov = typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal);
  subNotifications.unshift(`<div class="sub-item">${path}: <span style="color:var(--danger)">${ov}</span> → <span style="color:var(--accent)">${nv}</span></div>`);
  if (subNotifications.length > 20) subNotifications.pop();
  qs("#sub-list").innerHTML = subNotifications.join("");
}

/** 当前 Store 实例引用（由 main.ts 设置） */
export let store: import("../lib").Store;
export function setStore(s: typeof store) { store = s; }
