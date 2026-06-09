/**
 * 插件管理面板（Logger 切换 / History undo-redo / Persist 手动保存还原）
 */
import type { Store } from "../../lib";
import { qs, addLog } from "../shared";
import { refreshAll, updatePluginBadges } from "../render";
import { Logger } from "../../lib";

export function initPluginPanel(store: Store) {
  qs("#btn-logger-toggle").addEventListener("click", () => {
    const loggerActive = store.plugins.getPlugins().some((p) => p.name === "logger");
    if (loggerActive) {
      store.eject("logger");
      qs("#logger-status").innerHTML = "状态: 已禁用";
      addLog("Logger 已禁用", "info");
    } else {
      store.use(Logger());
      qs("#logger-status").innerHTML = "状态: 已启用";
      addLog("Logger 已启用", "info");
    }
    updatePluginBadges(store);
  });

  qs("#btn-undo").addEventListener("click", () => {
    if (store.history?.canUndo()) {
      store.history.undo();
      addLog("undo: 撤销操作", "info");
      refreshAll(store);
    }
  });

  qs("#btn-redo").addEventListener("click", () => {
    if (store.history?.canRedo()) {
      store.history.redo();
      addLog("redo: 重做操作", "info");
      refreshAll(store);
    }
  });

  qs("#btn-history-clear").addEventListener("click", () => {
    store.history?.clear();
    addLog("历史记录已清除", "info");
    refreshAll(store);
  });

  qs("#btn-persist-save").addEventListener("click", () => {
    try {
      localStorage.setItem("commonstore-demo", JSON.stringify(store.getState()));
      qs("#persist-status").innerHTML = "已保存到 localStorage";
      addLog("persist: 手动保存", "info");
    } catch {
      qs("#persist-status").innerHTML = "保存失败";
    }
  });

  qs("#btn-persist-restore").addEventListener("click", () => {
    try {
      const raw = localStorage.getItem("commonstore-demo");
      if (raw) {
        store.data.set([], JSON.parse(raw));
        qs("#persist-status").innerHTML = "已从 localStorage 恢复";
        addLog("persist: 恢复状态", "info");
        refreshAll(store);
      } else {
        qs("#persist-status").innerHTML = "没有保存的数据";
      }
    } catch {
      qs("#persist-status").innerHTML = "恢复失败";
    }
  });

  qs("#btn-persist-clear").addEventListener("click", () => {
    localStorage.removeItem("commonstore-demo");
    qs("#persist-status").innerHTML = "存储已清除";
    addLog("persist: 清除存储", "info");
  });
}
