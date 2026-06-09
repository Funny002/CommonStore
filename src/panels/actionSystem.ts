/**
 * Action 系统面板
 */
import type { Store } from "../../lib";
import { qs, addLog } from "../shared";
import { refreshAll } from "../render";

export function initActionSystem(store: Store) {
  qs("#btn-register").addEventListener("click", () => {
    const name = (qs("#act-name") as HTMLInputElement).value;
    if (store.actions.has(name)) {
      qs("#act-register-result").innerHTML = "已存在!";
      return;
    }
    store.actions.register(name, (s, val?: unknown) => {
      s.data.set("count", val ?? 0);
      return "ok";
    });
    qs("#act-register-result").innerHTML = "注册成功";
    addLog(`注册 Action: ${name}`, "info");
    refreshAll(store);
  });

  qs("#btn-dispatch").addEventListener("click", async () => {
    const name = (qs("#act-select") as HTMLSelectElement).value;
    if (!name) return;
    const rawArgs = (qs("#act-args") as HTMLInputElement).value;
    const args: unknown[] = rawArgs
      ? rawArgs.split(",").map((s: string) => {
          const t = s.trim();
          try {
            return JSON.parse(t);
          } catch {
            return t;
          }
        })
      : [];
    qs("#act-result").innerHTML = "执行中...";
    try {
      const r = await store.dispatch(name, ...args);
      qs("#act-result").innerHTML = `结果: ${JSON.stringify(r, null, 2)}`;
      addLog(`dispatch "${name}" -> ${JSON.stringify(r)}`, "data");
    } catch (e) {
      qs("#act-result").innerHTML = `错误: ${(e as Error).message}`;
      addLog(`dispatch "${name}" 出错: ${(e as Error).message}`, "error");
    }
    refreshAll(store);
  });
}
