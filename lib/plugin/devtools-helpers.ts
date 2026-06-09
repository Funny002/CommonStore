/**
 * Vue DevTools 辅助模块
 *
 * 从 vueDevtools.ts 提取的树构建和格式化工具函数，用于 Inspector 面板。
 */
import type { CustomInspectorNode } from '@vue/devtools-kit';

/** 各类型值的标签颜色配置 */
const TAG_COLORS: Record<string, { textColor: number; backgroundColor: number }> = {
  object: { textColor: 0xffffff, backgroundColor: 0x4fc08d },
  array: { textColor: 0xffffff, backgroundColor: 0xe6a23c },
  string: { textColor: 0xffffff, backgroundColor: 0x409eff },
  number: { textColor: 0xffffff, backgroundColor: 0xf56c6c },
  boolean: { textColor: 0xffffff, backgroundColor: 0x909399 },
  null: { textColor: 0xffffff, backgroundColor: 0x909399 },
  function: { textColor: 0xffffff, backgroundColor: 0xb37feb },
};

/** 获取值的类型标签颜色 */
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

/** 将状态路径数组转换为 Inspector 节点 ID */
export function pathToNodeId(path: string[]): string {
  return path.length === 0 ? '__root__' : path.join('.');
}

/** 将 Inspector 节点 ID 转换回状态路径数组 */
export function nodeIdToPath(nodeId: string): string[] {
  if (nodeId === '__root__') return [];
  return nodeId.split('.');
}

/** 格式化状态值用于 Inspector 显示，超过 30 字符的字符串会截断 */
export function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === 'function') return 'function';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return `{ ${Object.keys(value as object)
      .slice(0, 3)
      .join(', ')}${Object.keys(value as object).length > 3 ? ', ...' : ''} }`;
  }
  return String(value);
}

/** 为数组元素构建子节点 */
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

/** 为对象递归构建子节点（用于过滤时递归匹配不匹配的节点） */
function buildChildrenNodes(value: unknown, basePath: string[], filter: string): CustomInspectorNode[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return buildTree(value as Record<string, unknown>, filter, basePath);
  }
  if (Array.isArray(value)) {
    return buildArrayChildren(value as unknown[], basePath, filter);
  }
  return [];
}

/** 获取值的类型标签文字（正确区分 null 与 object） */
function getTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  return typeof value === 'object' ? (Array.isArray(value) ? 'array' : 'object') : typeof value;
}
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
      const node: CustomInspectorNode = {
        id: pathToNodeId(nodePath),
        label,
      };
      const tag = getTypeTag(value);
      if (tag) {
        const typeLabel = getTypeLabel(value);
        node.tags = [{ label: typeLabel, ...tag }];
      }
      node.children = children;
      nodes.push(node);
      continue;
    }

    const node: CustomInspectorNode = {
      id: pathToNodeId(nodePath),
      label,
    };

    const tag = getTypeTag(value);
    if (tag) {
      const typeLabel = getTypeLabel(value);
      node.tags = [{ label: typeLabel, ...tag }];
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      node.children = buildTree(value as Record<string, unknown>, undefined, nodePath);
    } else if (Array.isArray(value)) {
      node.children = buildArrayChildren(value as unknown[], nodePath, undefined);
    }
    nodes.push(node);
  }
  return nodes;
}

/** 构建 Inspector 状态下各个属性的可编辑项列表 */
export function buildStateItems(data: Record<string, unknown>) {
  return Object.keys(data)
    .sort()
    .map((key) => ({
      key,
      value: data[key],
      editable: true,
    }));
}
