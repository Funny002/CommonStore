/**
 * 导航标签切换模块
 */
import type { Store } from "../../lib";
import { $$ } from "../shared";

export function initNavTabs(_store: Store) {
  $$("#sidebar .nav-item").forEach((el) => {
    el.addEventListener("click", function () {
      $$("#sidebar .nav-item").forEach((n) => n.classList.remove("active"));
      (this as HTMLElement).classList.add("active");
      $$("#content .section").forEach((s) => s.classList.remove("active"));
      const sectionId = "sec-" + (this as HTMLElement).dataset.section;
      const sec = document.getElementById(sectionId);
      if (sec) sec.classList.add("active");
    });
  });
}
