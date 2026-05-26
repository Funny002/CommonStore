import { Store, Logger, History, Persist, ReduxDevtools, VueDevtools } from '../lib';
import { initialState, nextTodoId, nextTreeNodeId } from './demoData';
import { registerDemoActions } from './demoActions';
import { $ } from './jQueryLike';

const store = new Store(initialState);
const loggerPlugin = Logger();
const historyPlugin = History({ maxHistorySize: 50 });
const persistPlugin = Persist({ key: 'commonstore-demo', debounce: 500 });
const reduxPlugin = ReduxDevtools({ name: 'CommonStoreDemo' });
const vuePlugin = VueDevtools({ inspectorLabel: 'CommonStore Demo' });

store.use(loggerPlugin, historyPlugin, persistPlugin, reduxPlugin, vuePlugin);
registerDemoActions(store);

const logEntries: string[] = [];
const MAX_LOG = 50;

function addLog(msg: string, type: 'info' | 'data' | 'error' = 'info') {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  let css = 'log-info';
  if (type === 'data') css = 'log-data';
  if (type === 'error') css = 'log-error';
  logEntries.push(`<div class="log-item"><span class="log-time">${time}</span><span class="${css}">${msg}</span></div>`);
  if (logEntries.length > MAX_LOG) logEntries.shift();
  $('#log-list').html(logEntries.slice(-20).join(''));
}

const subNotifications: string[] = [];
function addSubNotification(path: string, newVal: unknown, oldVal: unknown) {
  const nv = typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal);
  const ov = typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal);
  subNotifications.unshift(`<div class="sub-item">${path}: <span style="color:var(--danger)">${ov}</span> → <span style="color:var(--accent)">${nv}</span></div>`);
  if (subNotifications.length > 20) subNotifications.pop();
  $('#sub-list').html(subNotifications.join(''));
}

const managedSubscriptions: Array<{ path: string; unsubscribe: () => void }> = [];

function renderState() {
  try {
    const s = store.getState();
    $('#state-view').html(JSON.stringify(s, null, 2));
  } catch {
    $('#state-view').html('Error reading state');
  }
}

function renderTodoList() {
  const items = store.getState<Array<{ id: number; text: string; done: boolean }>>('items');
  if (!items || !Array.isArray(items)) { $('#todo-list').html(''); return; }
  let html = '';
  items.forEach((item, i) => {
    html += `<div class="todo-item">
      <label><input type="checkbox" data-idx="${i}" ${item.done ? 'checked' : ''}> <span class="${item.done ? 'done-text' : ''}">${item.text}</span></label>
      <span style="font-size:10px;color:var(--text2)">#${item.id}</span>
      <button class="sm" data-delidx="${i}" style="margin-left:auto">x</button>
    </div>`;
  });
  $('#todo-list').html(html || '<span style="font-size:12px;color:var(--text2)">列表为空</span>');

  $$('#todo-list input[type=checkbox]').forEach((el) => {
    const inputEl = el as HTMLInputElement;
    inputEl.addEventListener('change', () => {
      const i = parseInt(inputEl.dataset.idx || '0', 10);
      store.data.update(`items.${i}.done`, (v) => !v);
      addLog(`toggleTodo items[${i}].done`, 'data');
      renderTodoList();
      renderState();
    });
  });

  $$('#todo-list button[data-delidx]').forEach((el: HTMLElement) => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.delidx || '0', 10);
      const item = store.getState(`items.${i}`);
      store.data.remove('items', i);
      addLog(`remove items[${i}] = ${item ? JSON.stringify(item) : '?'}`, 'data');
      renderTodoList();
      renderState();
      renderHistoryInfo();
    });
  });
}

function renderTree(nodes?: unknown, depth = 0): string {
  if (!nodes || !Array.isArray(nodes)) return '';
  return (nodes as Array<{ id: string; name: string; children: unknown }>).map((n, i) => {
    const prefix = depth > 0 ? '├ '.repeat(depth - 1) + '└ ' : '';
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
  }).join('');
}

function renderTreeView() {
  const tree = store.getState('tree');
  const html = renderTree(tree) || '<span style="font-size:12px;color:var(--text2)">树为空</span>';
  $('#tree-view').html(html);

  $$('#tree-view button[data-addchild]').forEach((el: HTMLElement) => {
    el.addEventListener('click', () => {
      const parentId = el.dataset.addchild || '';
      type TreeNode = { id: string; name: string; children: TreeNode[] };
      const treeData = store.getState<TreeNode[]>('tree');
      if (!treeData) return;
      function findNode(nodes: TreeNode[]): number | null {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i]!.id === parentId) return i;
          const childIdx = findNode(nodes[i]!.children);
          if (childIdx !== null) return i;
        }
        return null;
      }
      const idx = findNode(treeData);
      if (idx !== null) {
        const childName = prompt('子节点名称:');
        if (childName) {
          store.data.push(`tree.${idx}.children`, { id: nextTreeNodeId(), name: childName, children: [] });
          addLog(`添加子节点: ${childName}`, 'data');
          renderTreeView();
          renderState();
          renderHistoryInfo();
        }
      }
    });
  });

  $$('#tree-view button[data-delchild]').forEach((el: HTMLElement) => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.delchild || '0', 10);
      const depth = parseInt(el.dataset.depth || '0', 10);
      if (depth === 0) {
        const node = store.getState(`tree.${i}`);
        store.data.remove('tree', i);
        addLog(`删除根节点: ${node ? (node as any).name : `索引${i}`}`, 'data');
      }
      renderTreeView();
      renderState();
      renderHistoryInfo();
    });
  });
}

function renderActList() {
  const names = store.actions.getActionNames();
  const demoOnly = names.filter((n) => !n.startsWith('history.'));
  $('#act-list').html(demoOnly.map((n) => `<div>${n}</div>`).join(''));
  const all = store.actions.getActionNames();
  $('#act-select').html(all.map((n) => `<option value="${n}">${n}</option>`).join(''));
}

function renderHistoryInfo() {
  if (store.history) {
    const info = store.history.getInfo();
    $('#history-info').html(`当前: ${info.currentIndex + 1} / ${info.stackSize}`);
    $('#history-info-bottom').html(`${info.currentIndex + 1}/${info.stackSize}`);
    const pct = info.stackSize > 0 ? ((info.currentIndex + 1) / info.stackSize * 100) : 0;
    ($('#history-fill') as any).css('width', `${Math.max(pct, 1)}%`);
    $('#btn-undo').prop('disabled', !info.canUndo);
    $('#btn-redo').prop('disabled', !info.canRedo);
    $('#btn-undo-bottom').prop('disabled', !info.canUndo);
    $('#btn-redo-bottom').prop('disabled', !info.canRedo);
  }
}

function updatePluginBadges() {
  const plugins = store.plugins.getPlugins();
  const names = plugins.map((p) => p.name);
  ['logger', 'history', 'persist', 'redux-devtools', 'vue-devtools'].forEach((name) => {
    const badgeMap: Record<string, string> = {
      'logger': 'badge-logger',
      'history': 'badge-history',
      'persist': 'badge-persist',
      'redux-devtools': 'badge-redux',
      'vue-devtools': 'badge-vue',
    };
    const el = $(`#${badgeMap[name]}`) as any;
    if (names.includes(name)) {
      el.removeClass('badge-off').addClass('badge-on');
    } else {
      el.removeClass('badge-on').addClass('badge-off');
    }
  });
}

function refreshAll() {
  renderState();
  renderTodoList();
  renderTreeView();
  renderActList();
  renderHistoryInfo();
  updatePluginBadges();
}

function $$(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(selector));
}

function initNavTabs() {
  $$('#sidebar .nav-item').forEach((el) => {
    el.addEventListener('click', function () {
      $$('#sidebar .nav-item').forEach((n) => n.classList.remove('active'));
      this.classList.add('active');
      $$('#content .section').forEach((s) => s.classList.remove('active'));
      const sectionId = 'sec-' + (this as HTMLElement).dataset.section;
      const sec = document.getElementById(sectionId);
      if (sec) sec.classList.add('active');
    });
  });
}

function initDataOps() {
  $('#btn-set').on('click', () => {
    const path = $('#set-path').val();
    let val: unknown = $('#set-value').val();
    try { val = JSON.parse(val as string); } catch { /* use as string */ }
    store.data.set(path, val);
    addLog(`set "${path}" = ${JSON.stringify(val)}`, 'data');
    refreshAll();
  });

  $('#btn-get').on('click', () => {
    const path = $('#get-path').val();
    const v = store.getState(path);
    $('#get-result').html(JSON.stringify(v, null, 2));
  });

  $('#btn-has').on('click', () => {
    const path = $('#has-path').val();
    const result = store.data.has(path);
    $('#has-result').html(result ? '存在' : '不存在');
  });

  $('#btn-delete').on('click', () => {
    const path = $('#delete-path').val();
    const ok = store.data.delete(path);
    $('#delete-result').html(ok ? '已删除' : '路径不存在');
    if (ok) { addLog(`delete "${path}"`, 'data'); refreshAll(); }
  });

  $('#btn-update').on('click', () => {
    const path = $('#update-path').val();
    const op = $('#update-op').val();
    let fn: (v: unknown) => unknown;
    try { fn = eval(`(${op})`); } catch { return; }
    store.data.update(path, fn);
    addLog(`update "${path}" with ${op}`, 'data');
    refreshAll();
  });

  $('#btn-merge').on('click', () => {
    const path = $('#merge-path').val();
    let obj: Record<string, unknown>;
    try { obj = JSON.parse($('#merge-json').val()); } catch { return; }
    store.data.merge(path, obj);
    addLog(`merge "${path}" with ${JSON.stringify(obj)}`, 'data');
    refreshAll();
  });

  $('#btn-find').on('click', () => {
    const key = $('#find-key').val();
    const v = $('#find-val').val();
    const result = store.data.find((val, k) => k === key && val === v, true);
    $('#find-result').html(result ? JSON.stringify(result, null, 2) : '未找到');
  });

  $('#btn-findAll').on('click', () => {
    const key = $('#find-key').val();
    const v = $('#find-val').val();
    const results = store.data.findAll((val, k) => k === key && val === v, true);
    $('#find-result').html(results.length ? results.map((r) => JSON.stringify(r)).join('\n') : '未找到');
  });
}

function initArrayOps() {
  $('#btn-push').on('click', () => {
    const text = $('#todo-input').val() || '新项';
    const id = nextTodoId();
    store.data.push('items', { id, text, done: false });
    addLog(`push items: ${text}`, 'data');
    refreshAll();
  });

  $('#btn-unshift').on('click', () => {
    const text = $('#todo-input').val() || '新项';
    const id = nextTodoId();
    store.data.unshift('items', { id, text, done: false });
    addLog(`unshift items: ${text}`, 'data');
    refreshAll();
  });

  $('#btn-pop').on('click', () => {
    const removed = store.data.pop('items');
    addLog(`pop items: ${JSON.stringify(removed)}`, 'data');
    refreshAll();
  });

  $('#btn-shift').on('click', () => {
    const removed = store.data.shift('items');
    addLog(`shift items: ${JSON.stringify(removed)}`, 'data');
    refreshAll();
  });

  $('#btn-insert').on('click', () => {
    const idx = parseInt($('#insert-idx').val() || '0', 10);
    const text = $('#insert-val').val() || '新项';
    store.data.insert('items', idx, { id: nextTodoId(), text, done: false });
    addLog(`insert items[${idx}]: ${text}`, 'data');
    refreshAll();
  });

  $('#btn-remove').on('click', () => {
    const idx = parseInt($('#remove-idx').val() || '0', 10);
    const removed = store.data.remove('items', idx);
    addLog(`remove items[${idx}]: ${JSON.stringify(removed)}`, 'data');
    refreshAll();
  });
}

function initTreeOps() {
  $('#btn-tree-push').on('click', () => {
    const name = $('#tree-name').val() || '新节点';
    store.data.push('tree', { id: nextTreeNodeId(), name, children: [] });
    addLog(`push tree: ${name}`, 'data');
    refreshAll();
  });

  $('#btn-tree-pop').on('click', () => {
    const removed = store.data.pop('tree');
    addLog(`pop tree: ${JSON.stringify(removed)}`, 'data');
    refreshAll();
  });
}

function initActionSystem() {
  $('#btn-register').on('click', () => {
    const name = $('#act-name').val();
    if (store.actions.has(name)) {
      $('#act-register-result').html('已存在!');
      return;
    }
    store.actions.register(name, (s, val?: unknown) => {
      s.data.set('count', val ?? 0);
      return 'ok';
    });
    $('#act-register-result').html('注册成功');
    addLog(`注册 Action: ${name}`, 'info');
    refreshAll();
  });

  $('#btn-dispatch').on('click', async () => {
    const name = $('#act-select').val();
    if (!name) return;
    const rawArgs = $('#act-args').val();
    const args: unknown[] = rawArgs ? rawArgs.split(',').map((s: string) => {
      const t = s.trim();
      try { return JSON.parse(t); } catch { return t; }
    }) : [];
    $('#act-result').html('执行中...');
    try {
      const r = await store.dispatch(name, ...args);
      $('#act-result').html(`结果: ${JSON.stringify(r, null, 2)}`);
      addLog(`dispatch "${name}" -> ${JSON.stringify(r)}`, 'data');
    } catch (e) {
      $('#act-result').html(`错误: ${(e as Error).message}`);
      addLog(`dispatch "${name}" 出错: ${(e as Error).message}`, 'error');
    }
    refreshAll();
  });
}

function initSubscribeSystem() {
  $('#btn-subscribe').on('click', () => {
    const path = $('#sub-path').val();
    if (!path) return;
    const unsub = store.subscribe(path, (nv, ov) => {
      addSubNotification(path, nv, ov);
    });
    managedSubscriptions.push({ path, unsubscribe: unsub });
    addLog(`订阅: ${path}`, 'info');
    renderCurrentSubs();
  });
}

function renderCurrentSubs() {
  if (managedSubscriptions.length === 0) {
    $('#current-subs').html('<span style="font-size:11px;color:var(--text2)">暂无订阅</span>');
    return;
  }
  let html = '';
  managedSubscriptions.forEach((s, i) => {
    html += `<div class="sub-row">
      ${s.path}
      <button class="sm danger" data-subidx="${i}">取消</button>
    </div>`;
  });
  $('#current-subs').html(html);
  $$('#current-subs button[data-subidx]').forEach((el: HTMLElement) => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.subidx || '0', 10);
      managedSubscriptions[i].unsubscribe();
      addLog(`取消订阅: ${managedSubscriptions[i].path}`, 'info');
      managedSubscriptions.splice(i, 1);
      renderCurrentSubs();
    });
  });
}

function initBatchReset() {
  $('#btn-batch').on('click', () => {
    store.data.batch(() => {
      store.data.update('count', (v) => (v as number) + 1);
      store.data.set('user.age', 26);
      store.data.set('meta.version', '0.0.2');
    });
    addLog('批量操作: count+1, user.age=26, meta.version=0.0.2 (仅触发一次通知)', 'data');
    refreshAll();
  });

  $('#btn-reset').on('click', () => {
    store.reset();
    addLog('reset: 完全重置', 'data');
    refreshAll();
  });

  $('#btn-reset-keep').on('click', () => {
    store.reset(['user']);
    addLog('reset: 重置但保留 user', 'data');
    refreshAll();
  });

  $('#btn-clear').on('click', () => {
    store.clear();
    addLog('clear: 清空所有数据', 'data');
    refreshAll();
  });
}

let loggerEnabled = true;
function initPluginPanel() {
  $('#btn-logger-toggle').on('click', () => {
    if (loggerEnabled) {
      store.eject('logger');
      $('#logger-status').html('状态: 已禁用');
      loggerEnabled = false;
      addLog('Logger 已禁用', 'info');
    } else {
      store.use(Logger());
      $('#logger-status').html('状态: 已启用');
      loggerEnabled = true;
      addLog('Logger 已启用', 'info');
    }
    updatePluginBadges();
  });

  $('#btn-undo').on('click', () => {
    if (store.history?.canUndo()) {
      store.history.undo();
      addLog('undo: 撤销操作', 'info');
      refreshAll();
    }
  });

  $('#btn-redo').on('click', () => {
    if (store.history?.canRedo()) {
      store.history.redo();
      addLog('redo: 重做操作', 'info');
      refreshAll();
    }
  });

  $('#btn-history-clear').on('click', () => {
    store.history?.clear();
    addLog('历史记录已清除', 'info');
    refreshAll();
  });

  $('#btn-persist-save').on('click', () => {
    try {
      localStorage.setItem('commonstore-demo', JSON.stringify(store.getState()));
      $('#persist-status').html('已保存到 localStorage');
      addLog('persist: 手动保存', 'info');
    } catch (e) {
      $('#persist-status').html('保存失败');
    }
  });

  $('#btn-persist-restore').on('click', () => {
    try {
      const raw = localStorage.getItem('commonstore-demo');
      if (raw) {
        store.data.set([], JSON.parse(raw));
        $('#persist-status').html('已从 localStorage 恢复');
        addLog('persist: 恢复状态', 'info');
        refreshAll();
      } else {
        $('#persist-status').html('没有保存的数据');
      }
    } catch {
      $('#persist-status').html('恢复失败');
    }
  });

  $('#btn-persist-clear').on('click', () => {
    localStorage.removeItem('commonstore-demo');
    $('#persist-status').html('存储已清除');
    addLog('persist: 清除存储', 'info');
  });
}

function initFooter() {
  $('#btn-quick-dispatch').on('click', async () => {
    const name = $('#quick-action').val();
    const rawArgs = $('#quick-args').val();
    const args: unknown[] = rawArgs ? rawArgs.split(',').map((s: string) => {
      const t = s.trim();
      if (!t) return undefined;
      try { return JSON.parse(t); } catch { return t; }
    }) : [];
    $('#btn-quick-dispatch').prop('disabled', true);
    $('#btn-quick-dispatch').html('执行中...');
    try {
      const r = await store.dispatch(name, ...args);
      addLog(`执行 "${name}": ${JSON.stringify(r)}`, 'data');
    } catch (e) {
      addLog(`执行 "${name}" 出错: ${(e as Error).message}`, 'error');
    }
    $('#btn-quick-dispatch').prop('disabled', false);
    $('#btn-quick-dispatch').html('执行');
    refreshAll();
  });

  $('#btn-undo-bottom').on('click', () => {
    if (store.history?.canUndo()) { store.history.undo(); addLog('undo', 'info'); refreshAll(); }
  });

  $('#btn-redo-bottom').on('click', () => {
    if (store.history?.canRedo()) { store.history.redo(); addLog('redo', 'info'); refreshAll(); }
  });

  $('#btn-export').on('click', () => {
    const json = JSON.stringify(store.getState(), null, 2);
    navigator.clipboard.writeText(json).then(() => {
      addLog('状态 JSON 已复制到剪贴板', 'info');
    }).catch(() => {
      addLog('复制失败', 'error');
    });
  });
}

function initDefaultSubs() {
  store.subscribe('count', (nv, ov) => addSubNotification('count', nv, ov));
  store.subscribe('user.name', (nv, ov) => addSubNotification('user.name', nv, ov));
  store.subscribe('items', (nv, ov) => {
    const newLen = Array.isArray(nv) ? nv.length : 0;
    const oldLen = Array.isArray(ov) ? ov.length : 0;
    if (newLen !== oldLen) addSubNotification('items.length', newLen, oldLen);
  });
  managedSubscriptions.push({ path: 'count', unsubscribe: () => {} });
  managedSubscriptions.push({ path: 'user.name', unsubscribe: () => {} });
  managedSubscriptions.push({ path: 'items', unsubscribe: () => {} });
}

function initPanels() {
  $('#btn-clear-log').on('click', () => {
    logEntries.length = 0;
    $('#log-list').html('');
  });
}

initNavTabs();
initDataOps();
initArrayOps();
initTreeOps();
initActionSystem();
initSubscribeSystem();
initBatchReset();
initPluginPanel();
initFooter();
initDefaultSubs();
initPanels();

refreshAll();
renderCurrentSubs();
addLog('Demo 应用已初始化，欢迎使用 CommonStore!', 'info');

console.log('CommonStore Demo ready.');
console.log('State:', store.getState());
console.log('Actions:', store.actions.getActionNames());
console.log('Plugins:', store.plugins.getPlugins().map((p) => p.name));
