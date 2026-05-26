export const initialState = {
  count: 0,
  user: {
    name: 'Alice',
    age: 25,
    email: 'alice@example.com',
    settings: {
      theme: 'light',
      lang: 'zh',
      notifications: true,
    },
  },
  items: [
    { id: 1, text: '学习 CommonStore', done: true },
    { id: 2, text: '编写 Demo 应用', done: false },
    { id: 3, text: '测试插件系统', done: false },
  ],
  tree: [
    {
      id: 'node-1',
      name: '根节点 1',
      children: [
        { id: 'node-1-1', name: '子节点 A', children: [] },
        { id: 'node-1-2', name: '子节点 B', children: [] },
      ],
    },
    {
      id: 'node-2',
      name: '根节点 2',
      children: [] as Array<{ id: string; name: string; children: unknown[] }>,
    },
  ],
  meta: {
    version: '0.0.1',
    createdAt: '2025-01-01',
  },
};

let _nextTodoId = 4;
export function nextTodoId() {
  return _nextTodoId++;
}

let nextNodeNum = 3;
export function nextTreeNodeId() {
  return `node-${nextNodeNum++}`;
}

export function getTypeLabel(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return `array(${val.length})`;
  return typeof val;
}
