/**
 * 数据基本读写操作面板
 */
import type { Store } from "../../lib";
import { qs, addLog } from "../shared";
import { refreshAll } from "../render";

const UPDATE_OPS: Record<string, (v: unknown) => unknown> = {
  "v=>v+1": (v) => (v as number) + 1,
  "v=>v*2": (v) => (v as number) * 2,
  "v=>0": () => 0,
};

export function initDataOps(store: Store) {
  qs("#btn-set").addEventListener("click", () => {
    const path = (qs("#set-path") as HTMLInputElement).value;
    let val: unknown = (qs("#set-value") as HTMLInputElement).value;
    try {
      val = JSON.parse(val as string);
    } catch {
      /* use as string */
    }
    store.data.set(path, val);
    addLog(`set "${path}" = ${JSON.stringify(val)}`, "data");
    refreshAll(store);
  });

  qs("#btn-get").addEventListener("click", () => {
    const path = (qs("#get-path") as HTMLInputElement).value;
    const v = store.getState(path);
    qs("#get-result").innerHTML = JSON.stringify(v, null, 2);
  });

  qs("#btn-has").addEventListener("click", () => {
    const path = (qs("#has-path") as HTMLInputElement).value;
    const result = store.data.has(path);
    qs("#has-result").innerHTML = result ? "存在" : "不存在";
  });

  qs("#btn-delete").addEventListener("click", () => {
    const path = (qs("#delete-path") as HTMLInputElement).value;
    const ok = store.data.delete(path);
    qs("#delete-result").innerHTML = ok ? "已删除" : "路径不存在";
    if (ok) {
      addLog(`delete "${path}"`, "data");
      refreshAll(store);
    }
  });

  qs("#btn-update").addEventListener("click", () => {
    const path = (qs("#update-path") as HTMLInputElement).value;
    const op = (qs("#update-op") as HTMLSelectElement).value;
    const fn = UPDATE_OPS[op];
    if (!fn) return;
    store.data.update(path, fn);
    addLog(`update "${path}" with ${op}`, "data");
    refreshAll(store);
  });

  qs("#btn-merge").addEventListener("click", () => {
    const path = (qs("#merge-path") as HTMLInputElement).value;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse((qs("#merge-json") as HTMLInputElement).value);
    } catch {
      return;
    }
    store.data.merge(path, obj);
    addLog(`merge "${path}" with ${JSON.stringify(obj)}`, "data");
    refreshAll(store);
  });

  qs("#btn-find").addEventListener("click", () => {
    const key = (qs("#find-key") as HTMLInputElement).value;
    const v = (qs("#find-val") as HTMLInputElement).value;
    const result = store.data.find((val, k) => k === key && val === v);
    qs("#find-result").innerHTML = result ? JSON.stringify(result, null, 2) : "未找到";
  });

  qs("#btn-findAll").addEventListener("click", () => {
    const key = (qs("#find-key") as HTMLInputElement).value;
    const v = (qs("#find-val") as HTMLInputElement).value;
    const results = store.data.findAll((val, k) => k === key && val === v);
    qs("#find-result").innerHTML = results.length ? results.map((r) => JSON.stringify(r)).join("\n") : "未找到";
  });
}
