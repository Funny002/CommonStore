/**
 * 订阅系统面板
 */
import type { Store } from "../../lib";
import { qs, addLog, addSubNotification, managedSubscriptions } from "../shared";
import { renderCurrentSubs } from "../render";

export function initSubscribeSystem(store: Store) {
  qs("#btn-subscribe").addEventListener("click", () => {
    const path = (qs("#sub-path") as HTMLInputElement).value;
    if (!path) return;
    const unsub = store.subscribe(path, (nv, ov) => {
      addSubNotification(path, nv, ov);
    });
    managedSubscriptions.push({ path, unsubscribe: unsub });
    addLog(`订阅: ${path}`, "info");
    renderCurrentSubs();
  });
}
