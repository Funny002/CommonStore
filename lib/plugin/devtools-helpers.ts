import type { CustomInspectorNode } from '@vue/devtools-kit';

/** 类型 → 标签颜色映射表（Vue DevTools 配色） */
const TAG_COLORS: Record<string, { textColor: number; backgroundColor: number }> = {
  object: { textColor: 0xffffff, backgroundColor: 0x4fc08d },
  array: { textColor: 0xffffff, backgroundColor: 0xe6a23c },
  string: { textColor: 0xffffff, backgroundColor: 0x409eff },
  number: { textColor: 0xffffff, backgroundColor: 0xf56c6c },
  boolean: { textColor: 0xffffff, backgroundColor: 0x909399 },
  null: { textColor: 0xffffff, backgroundColor: 0x909399 },
  function: { textColor: 0xffffff, backgroundColor: 0xb37feb },
};

/**
 * 获取值的类型标签颜色
 * @returns 标签颜色对象，不支持的类型返回 undefined
 */
export function getTypeTag(value: unknown): { textColor: number; backgroundColor: number } | undefined {
  if (value === null) return TAG_COLORS.null;
  if (Array.isArray(value)) return TAG_COLORS.array;
  const t = typeof value;
  if (t === 'object') return TAG_COLORS.object;
  if (t === 'string') return TAG_COLORS.string;
  if (t === 'number') return TAG_COLORS.number;
  if (t === 'boolean') return TAG_COLORS.boolean;
  if (t === 'function') return TAG_COLORS.function;
  return undefined;
}

/**
 * 路径数组 → 节点 ID 字符串
 *
 * 根路径 `[]` 映射为 `'__root__'`，其余以 `.` 连接。
 */
export function pathToNodeId(path: string[]): string {
  return path.length === 0 ? '__root__' : path.join('.');
}

/**
 * 节点 ID 字符串 → 路径数组
 *
 * `'__root__'` 映射为空数组，其余以 `.` 分割。
 */
export function nodeIdToPath(nodeId: string): string[] {
  if (nodeId === '__root__') return [];
  return nodeId.split('.');
}

/**
 * 格式化值用于 Inspector 显示
 *
 * - null / undefined → 字符串直接显示
 * - 字符串超过 30 字符截断并加引号
 * - 数组显示为 `Array(N)`
 * - 对象显示为 `{ key1, key2, key3, ... }`
 * - 其他类型直接 String 转换
 */
export function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === 'function') return 'function';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `Array(${value.length})`;
    const keys = Object.keys(value as object);
    return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''} }`;
  }
  return String(value);
}

/**
 * 构建数组子节点（用于 Inspector 树）
 *
 * 数组元素按索引编号为子节点，支持过滤和嵌套对象展开。
 */
function buildArrayChildren(arr: unknown[], basePath: string[], filter?: string): CustomInspectorNode[] {
  const filterLower = filter?.toLowerCase();
  return arr
    .map((item, idx) => {
      const itemPath = [...basePath, String(idx)];
      const itemNode: CustomInspectorNode = {
        id: pathToNodeId(itemPath),
        label: `${idx}: ${formatValue(item)}`,
      };
      const itemTag = getTypeTag(item);
      if (itemTag) {
        const typeLabel = getTypeLabel(item);
        itemNode.tags = [{ label: typeLabel, ...itemTag }];
      }
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        itemNode.children = buildTree(item as Record<string, unknown>, undefined, itemPath);
      }
      return itemNode;
    })
    .filter((node) => !filterLower || node.label.toLowerCase().includes(filterLower) || (node.children && node.children.length > 0));
}

/**
 * 构建子节点（根据值的类型分发到 buildTree 或 buildArrayChildren）
 */
function buildChildrenNodes(value: unknown, basePath: string[], filter: string): CustomInspectorNode[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return buildTree(value as Record<string, unknown>, filter, basePath);
  }
  if (Array.isArray(value)) {
    return buildArrayChildren(value as unknown[], basePath, filter);
  }
  return [];
}

/**
 * 获取值的类型标签文本
 */
function getTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  return typeof value === 'object' ? (Array.isArray(value) ? 'array' : 'object') : typeof value;
}

/**
 * 构建单个 Inspector 树节点
 */
function buildNode(key: string, value: unknown, nodePath: string[]): CustomInspectorNode {
  const node: CustomInspectorNode = {
    id: pathToNodeId(nodePath),
    label: `${key}: ${formatValue(value)}`,
  };
  const tag = getTypeTag(value);
  if (tag) {
    const typeLabel = getTypeLabel(value);
    node.tags = [{ label: typeLabel, ...tag }];
  }
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      node.children = buildArrayChildren(value as unknown[], nodePath, undefined);
    } else {
      node.children = buildTree(value as Record<string, unknown>, undefined, nodePath);
    }
  }
  return node;
}

/**
 * 构建 Inspector 状态树
 *
 * 递归将状态对象转换为 Vue DevTools 的 CustomInspectorNode 格式。
 * 支持按 key 或 label 过滤。
 *
 * @param state - 状态对象
 * @param filter - 可选的过滤关键词
 * @param basePath - 当前节点在状态树中的路径前缀
 * @returns Inspector 节点数组
 */
export function buildTree(state: Record<string, unknown>, filter?: string, basePath: string[] = []): CustomInspectorNode[] {
  const nodes: CustomInspectorNode[] = [];
  const filterLower = filter?.toLowerCase();

  for (const key of Object.keys(state).sort()) {
    const value = state[key];
    const nodePath = [...basePath, key];
    const label = `${key}: ${formatValue(value)}`;

    if (filterLower && !key.toLowerCase().includes(filterLower) && !label.toLowerCase().includes(filterLower)) {
      const children = buildChildrenNodes(value, nodePath, filterLower);
      if (children.length === 0) continue;
      const node = buildNode(key, value, nodePath);
      node.children = children;
      nodes.push(node);
      continue;
    }

    nodes.push(buildNode(key, value, nodePath));
  }
  return nodes;
}

/**
 * 构建 Inspector 状态编辑条目
 *
 * 将对象的所有 key 展平为可编辑的键值对列表。
 *
 * @param data - 状态对象
 * @returns 可编辑条目数组
 */
export function buildStateItems(data: Record<string, unknown>) {
  return Object.keys(data)
    .sort()
    .map((key) => ({
      key,
      value: data[key],
      editable: true,
    }));
}
