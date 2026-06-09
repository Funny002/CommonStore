/**
 * Demo 渲染函数 — 负责所有 UI 更新
 */
import type { Store } from "../lib";
import { qs, $$, managedSubscriptions, addLog } from "./shared";
import { nextTreeNodeId } from "./demoData";

export function renderState(store: Store) {
  try {
    const s = store.getState();
    qs("#state-view").innerHTML = JSON.stringify(s, null, 2);
  } catch {
    qs("#state-view").innerHTML = "Error reading state";
  }
}

export function renderTodoList(store: Store) {
  const items = store.getState<Array<{ id: number; text: string; done: boolean }>>("items");
  if (!items || !Array.isArray(items)) {
    qs("#todo-list").innerHTML = "";
    return;
  }
  let html = "";
  items.forEach((item, i) => {
    html += `<div class="todo-item">
      <label><input type="checkbox" data-idx="${i}" ${item.done ? "checked" : ""}> <span class="${item.done ? "done-text" : ""}">${item.text}</span></label>
      <span style="font-size:10px;color:var(--text2)">#${item.id}</span>
      <button class="sm" data-delidx="${i}" style="margin-left:auto">x</button>
    </div>`;
  });
  qs("#todo-list").innerHTML = html || '<span style="font-size:12px;color:var(--text2)">列表为空</span>';

  $$("#todo-list input[type=checkbox]").forEach((el) => {
    const inputEl = el as HTMLInputElement;
    inputEl.addEventListener("change", () => {
      const i = parseInt(inputEl.dataset.idx || "0", 10);
      store.data.update(`items.${i}.done`, (v: unknown) => !v);
      addLog(`toggleTodo items[${i}].done`, "data");
      refreshAll(store);
    });
  });

  $$("#todo-list button[data-delidx]").forEach((el: HTMLElement) => {
    el.addEventListener("click", () => {
      const i = parseInt(el.dataset.delidx || "0", 10);
      const item = store.getState(`items.${i}`);
      store.data.remove("items", i);
      addLog(`remove items[${i}] = ${item ? JSON.stringify(item) : "?"}`, "data");
      refreshAll(store);
    });
  });
}

export function renderTree(nodes?: unknown, depth = 0): string {
  if (!nodes || !Array.isArray(nodes)) return "";
  return (nodes as Array<{ id: string; name: string; children: unknown }>)
    .map((n, i) => {
      const prefix = depth > 0 ? "\u251C ".repeat(depth - 1) + "\u2514 " : "";
      const children = renderTree(n.children, depth + 1);
      return `<div class="tree-node">
      <div class="node-row">
        <span class="node-name">${prefix}${n.name}</span>
        <span class="node-id" style="margin-left:auto">${n.id}</span>
        <button class="sm info" data-addchild="${n.id}">+子</button>
        <button class="sm danger" data-delchild="${i}" data-depth="${depth}">x</button>
      </div>
      ${children}
    </div>`;
    })
    .join("");
}

export function renderTreeView(store: Store) {
  const tree = store.getState("tree");
  const html = renderTree(tree) || '<span style="font-size:12px;color:var(--text2)">树为空</span>';
  qs("#tree-view").innerHTML = html;

  $$("#tree-view button[data-addchild]").forEach((el: HTMLElement) => {
    el.addEventListener("click", () => {
      const parentId = el.dataset.addchild || "";
      type TreeNode = { id: string; name: string; children: TreeNode[] };
      const treeData = store.getState<TreeNode[]>("tree");
      if (!treeData) return;
      function findNode(nodes: TreeNode[]): number | null {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (!node) continue;
          if (node.id === parentId) return i;
          const childIdx = findNode(node.children);
          if (childIdx !== null) return i;
        }
        return null;
      }
      const idx = findNode(treeData);
      if (idx !== null) {
        const childName = prompt("子节点名称:");
        if (childName) {
          store.data.push(`tree.${idx}.children`, { id: nextTreeNodeId(), name: childName, children: [] });
          addLog(`添加子节点: ${childName}`, "data");
          refreshAll(store);
        }
      }
    });
  });

  $$("#tree-view button[data-delchild]").forEach((el: HTMLElement) => {
    el.addEventListener("click", () => {
      const i = parseInt(el.dataset.delchild || "0", 10);
      const depth = parseInt(el.dataset.depth || "0", 10);
      if (depth === 0) {
        const node = store.getState(`tree.${i}`);
        store.data.remove("tree", i);
        addLog(`删除根节点: ${node ? (node as any).name : `索引${i}`}`, "data");
      }
      refreshAll(store);
    });
  });
}

export function renderActList(store: Store) {
  const names = store.actions.getActionNames();
  const demoOnly = names.filter((n: string) => !n.startsWith("history."));
  qs("#act-list").innerHTML = demoOnly.map((n: string) => `<div>${n}</div>`).join("");
  const all = store.actions.getActionNames();
  qs("#act-select").innerHTML = all.map((n: string) => `<option value="${n}">${n}</option>`).join("");
}

export function renderHistoryInfo(store: Store) {
  if (store.history) {
    const info = store.history.getInfo();
    qs("#history-info").innerHTML = `当前: ${info.currentIndex + 1} / ${info.stackSize}`;
    qs("#history-info-bottom").innerHTML = `${info.currentIndex + 1}/${info.stackSize}`;
    const pct = info.stackSize > 0 ? ((info.currentIndex + 1) / info.stackSize) * 100 : 0;
    qs("#history-fill").style.width = `${Math.max(pct, 1)}%`;
    (qs("#btn-undo") as HTMLButtonElement).disabled = !info.canUndo;
    (qs("#btn-redo") as HTMLButtonElement).disabled = !info.canRedo;
    (qs("#btn-undo-bottom") as HTMLButtonElement).disabled = !info.canUndo;
    (qs("#btn-redo-bottom") as HTMLButtonElement).disabled = !info.canRedo;
  }
}

export function updatePluginBadges(store: Store) {
  const plugins = store.plugins.getPlugins();
  const names = plugins.map((p: { name: string }) => p.name);
  ["logger", "history", "persist", "redux-devtools", "vue-devtools"].forEach((name) => {
    const badgeMap: Record<string, string> = {
      logger: "badge-logger",
      history: "badge-history",
      persist: "badge-persist",
      "redux-devtools": "badge-redux",
      "vue-devtools": "badge-vue",
    };
    const el = qs(`#${badgeMap[name]}`);
    if (names.includes(name)) {
      el.classList.remove("badge-off");
      el.classList.add("badge-on");
    } else {
      el.classList.remove("badge-on");
      el.classList.add("badge-off");
    }
  });
}

export function renderCurrentSubs() {
  if (managedSubscriptions.length === 0) {
    qs("#current-subs").innerHTML = '<span style="font-size:11px;color:var(--text2)">暂无订阅</span>';
    return;
  }
  let html = "";
  managedSubscriptions.forEach((s, i) => {
    html += `<div class="sub-row">
      ${s.path}
      <button class="sm danger" data-subidx="${i}">取消</button>
    </div>`;
  });
  qs("#current-subs").innerHTML = html;
  $$("#current-subs button[data-subidx]").forEach((el: HTMLElement) => {
    el.addEventListener("click", () => {
      const i = parseInt(el.dataset.subidx || "0", 10);
      managedSubscriptions[i].unsubscribe();
      managedSubscriptions.splice(i, 1);
      renderCurrentSubs();
    });
  });
}

export function refreshAll(store: Store) {
  renderState(store);
  renderTodoList(store);
  renderTreeView(store);
  renderActList(store);
  renderHistoryInfo(store);
  updatePluginBadges(store);
}
