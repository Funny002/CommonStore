/**
 * 底部快捷操作栏
 */
import type { Store } from "../../lib";
import { qs, addLog } from "../shared";
import { refreshAll } from "../render";

export function initFooter(store: Store) {
  qs("#btn-quick-dispatch").addEventListener("click", async () => {
    const name = (qs("#quick-action") as HTMLSelectElement).value;
    const rawArgs = (qs("#quick-args") as HTMLInputElement).value;
    const args: unknown[] = rawArgs
      ? rawArgs.split(",").map((s: string) => {
          const t = s.trim();
          if (!t) return undefined;
          try {
            return JSON.parse(t);
          } catch {
            return t;
          }
        })
      : [];
    const btn = qs("#btn-quick-dispatch") as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = "执行中...";
    try {
      const r = await store.dispatch(name, ...args);
      addLog(`执行 "${name}": ${JSON.stringify(r)}`, "data");
    } catch (e) {
      addLog(`执行 "${name}" 出错: ${(e as Error).message}`, "error");
    }
    btn.disabled = false;
    btn.innerHTML = "执行";
    refreshAll(store);
  });

  qs("#btn-undo-bottom").addEventListener("click", () => {
    if (store.history?.canUndo()) {
      store.history.undo();
      addLog("undo", "info");
      refreshAll(store);
    }
  });

  qs("#btn-redo-bottom").addEventListener("click", () => {
    if (store.history?.canRedo()) {
      store.history.redo();
      addLog("redo", "info");
      refreshAll(store);
    }
  });

  qs("#btn-export").addEventListener("click", () => {
    const json = JSON.stringify(store.getState(), null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => {
        addLog("状态 JSON 已复制到剪贴板", "info");
      })
      .catch(() => {
        addLog("复制失败", "error");
      });
  });
}
