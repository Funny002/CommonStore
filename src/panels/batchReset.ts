/**
 * 批量操作与重置面板
 */
import type { Store } from "../../lib";
import { qs, addLog } from "../shared";
import { refreshAll } from "../render";

export function initBatchReset(store: Store) {
  qs("#btn-batch").addEventListener("click", () => {
    store.data.batch(() => {
      store.data.update("count", (v) => (v as number) + 1);
      store.data.set("user.age", 26);
      store.data.set("meta.version", "0.0.2");
    });
    addLog("批量操作: count+1, user.age=26, meta.version=0.0.2 (仅触发一次通知)", "data");
    refreshAll(store);
  });

  qs("#btn-reset").addEventListener("click", () => {
    store.reset();
    addLog("reset: 完全重置", "data");
    refreshAll(store);
  });

  qs("#btn-reset-keep").addEventListener("click", () => {
    store.reset(["user"]);
    addLog("reset: 重置但保留 user", "data");
    refreshAll(store);
  });

  qs("#btn-clear").addEventListener("click", () => {
    store.clear();
    addLog("clear: 清空所有数据", "data");
    refreshAll(store);
  });
}
