/**
 * 数组操作面板（Todo 列表）
 */
import type { Store } from "../../lib";
import { qs, addLog } from "../shared";
import { refreshAll } from "../render";
import { nextTodoId } from "../demoData";

export function initArrayOps(store: Store) {
  qs("#btn-push").addEventListener("click", () => {
    const text = (qs("#todo-input") as HTMLInputElement).value || "新项";
    const id = nextTodoId();
    store.data.push("items", { id, text, done: false });
    addLog(`push items: ${text}`, "data");
    refreshAll(store);
  });

  qs("#btn-unshift").addEventListener("click", () => {
    const text = (qs("#todo-input") as HTMLInputElement).value || "新项";
    const id = nextTodoId();
    store.data.unshift("items", { id, text, done: false });
    addLog(`unshift items: ${text}`, "data");
    refreshAll(store);
  });

  qs("#btn-pop").addEventListener("click", () => {
    const removed = store.data.pop("items");
    addLog(`pop items: ${JSON.stringify(removed)}`, "data");
    refreshAll(store);
  });

  qs("#btn-shift").addEventListener("click", () => {
    const removed = store.data.shift("items");
    addLog(`shift items: ${JSON.stringify(removed)}`, "data");
    refreshAll(store);
  });

  qs("#btn-insert").addEventListener("click", () => {
    const idx = parseInt((qs("#insert-idx") as HTMLInputElement).value || "0", 10);
    const text = (qs("#insert-val") as HTMLInputElement).value || "新项";
    store.data.insert("items", idx, { id: nextTodoId(), text, done: false });
    addLog(`insert items[${idx}]: ${text}`, "data");
    refreshAll(store);
  });

  qs("#btn-remove").addEventListener("click", () => {
    const idx = parseInt((qs("#remove-idx") as HTMLInputElement).value || "0", 10);
    const removed = store.data.remove("items", idx);
    addLog(`remove items[${idx}]: ${JSON.stringify(removed)}`, "data");
    refreshAll(store);
  });
}
