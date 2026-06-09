import { Store, Logger, History, Persist } from "../lib";
import { VueDevtools } from "../lib/vue-devtools";
import { ReduxDevtools } from "../lib/redux-devtools";
import { initialState } from "./demoData";
import { registerDemoActions } from "./demoActions";
import { setStore, qs, logEntries, addLog, addSubNotification, managedSubscriptions } from "./shared";
import { refreshAll, renderCurrentSubs } from "./render";
import { initNavTabs } from "./panels/nav";
import { initDataOps } from "./panels/dataOps";
import { initArrayOps } from "./panels/arrayOps";
import { initTreeOps } from "./panels/treeOps";
import { initActionSystem } from "./panels/actionSystem";
import { initSubscribeSystem } from "./panels/subscribeSystem";
import { initBatchReset } from "./panels/batchReset";
import { initPluginPanel } from "./panels/pluginPanel";
import { initFooter } from "./panels/footer";

const store = new Store(initialState);
setStore(store);

const loggerPlugin = Logger();
const historyPlugin = History({ maxHistorySize: 50 });
const persistPlugin = Persist({ key: "commonstore-demo", debounce: 500 });
const reduxPlugin = ReduxDevtools({ name: "CommonStoreDemo" });
const vuePlugin = VueDevtools(undefined, { inspectorLabel: "CommonStore Demo" });

store.use(loggerPlugin, historyPlugin, persistPlugin, reduxPlugin, vuePlugin);
registerDemoActions(store);

initNavTabs(store);
initDataOps(store);
initArrayOps(store);
initTreeOps(store);
initActionSystem(store);
initSubscribeSystem(store);
initBatchReset(store);
initPluginPanel(store);
initFooter(store);
initDefaultSubs();
initPanels();

refreshAll(store);
renderCurrentSubs();
addLog("Demo 应用已初始化，欢迎使用 CommonStore!", "info");

console.log("CommonStore Demo ready.");
console.log("State:", store.getState());
console.log("Actions:", store.actions.getActionNames());
console.log(
  "Plugins:",
  store.plugins.getPlugins().map((p) => p.name),
);

function initDefaultSubs() {
  const unsub1 = store.subscribe("count", (nv, ov) => addSubNotification("count", nv, ov));
  const unsub2 = store.subscribe("user.name", (nv, ov) => addSubNotification("user.name", nv, ov));
  const unsub3 = store.subscribe("items", (nv, ov) => {
    const newLen = Array.isArray(nv) ? nv.length : 0;
    const oldLen = Array.isArray(ov) ? ov.length : 0;
    if (newLen !== oldLen) addSubNotification("items.length", newLen, oldLen);
  });
  managedSubscriptions.push({ path: "count", unsubscribe: unsub1 });
  managedSubscriptions.push({ path: "user.name", unsubscribe: unsub2 });
  managedSubscriptions.push({ path: "items", unsubscribe: unsub3 });
}

function initPanels() {
  qs("#btn-clear-log").addEventListener("click", () => {
    logEntries.length = 0;
    qs("#log-list").innerHTML = "";
  });
}
