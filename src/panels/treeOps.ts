/**
 * 树结构操作面板
 */
import type { Store } from "../../lib";
import { qs, addLog } from "../shared";
import { refreshAll } from "../render";
import { nextTreeNodeId } from "../demoData";

export function initTreeOps(store: Store) {
  qs("#btn-tree-push").addEventListener("click", () => {
    const name = (qs("#tree-name") as HTMLInputElement).value || "新节点";
    store.data.push("tree", { id: nextTreeNodeId(), name, children: [] });
    addLog(`push tree: ${name}`, "data");
    refreshAll(store);
  });

  qs("#btn-tree-pop").addEventListener("click", () => {
    const removed = store.data.pop("tree");
    addLog(`pop tree: ${JSON.stringify(removed)}`, "data");
    refreshAll(store);
  });
}
