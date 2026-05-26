import type { Store } from "../lib";
import { nextTodoId } from "./demoData";

export function registerDemoActions(store: Store) {
  store.actions.register("fetchData", async (_store: Store, source: string) => {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    return { source, data: [1, 2, 3], timestamp: Date.now() };
  });

  store.actions.register("compute", (_store: Store, x: number, y: number) => {
    return { x, y, sum: x + y, product: x * y, max: Math.max(x, y) };
  });

  store.actions.register("resetCounter", (s: Store) => {
    s.data.set("count", 0);
    return { success: true, count: 0 };
  });

  store.actions.register("addTodo", (s: Store, text: string) => {
    const id = nextTodoId();
    s.data.push("items", { id, text, done: false });
    return { success: true, id, text };
  });

  store.actions.register("toggleTodo", (s: Store, idx: number) => {
    const items = s.getState<Array<{ id: number; text: string; done: boolean }>>("items");
    if (!items || idx < 0 || idx >= items.length) {
      throw new Error(`索引无效: ${idx}`);
    }
    s.data.update(`items.${idx}.done`, (old) => !old);
    return { success: true, index: idx, done: !items[idx]!.done };
  });

  store.actions.register("addTreeNode", (s: Store, name: string) => {
    const id = `node-${Date.now()}`;
    s.data.push("tree", { id, name, children: [] });
    return { success: true, id, name };
  });
}
