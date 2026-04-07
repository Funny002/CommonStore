export  type DataManagerPath = (string | number)[];

/**
 * 数据管理器接口
 */
export interface DataManager {
  /**
   * 根据路径获取节点值
   * @param path 路径数组或点分隔字符串，如 ['a', 'b', 'c'] 或 'a.b.c'
   * @returns 节点值（可能是 immutable 类型或原始值）
   */
  get(path?: string | DataManagerPath): any;

  /**
   * 在指定路径设置值（新增或修改）
   * @param path 路径
   * @param value 要设置的值（会自动转为 immutable 结构）
   * @returns 更新后的 Data 实例（方便链式调用）
   */
  set(path: string | DataManagerPath, value: any): this;

  /**
   * 删除指定路径的节点
   * @param path 路径
   * @returns 是否删除成功
   */
  delete(path: string | DataManagerPath): boolean;

  /**
   * 更新指定路径的节点（基于当前值生成新值）
   * @param path 路径
   * @param updater (oldValue) => newValue
   * @returns 更新后的 Data 实例
   */
  update(path: string | DataManagerPath, updater: (value: any) => any): this;

  /**
   * 合并数据到指定路径（浅合并对象）
   * @param path 路径
   * @param value 要合并的对象
   * @returns 更新后的 Data 实例
   */
  merge(path: string | DataManagerPath, value: object): this;

  /**
   * 在列表类型的节点末尾添加元素
   * @param path 路径
   * @param value 要添加的元素
   * @returns 更新后的 Data 实例
   */
  push(path: string | DataManagerPath, value: any): this;

  /**
   * 从列表类型的节点末尾移除元素
   * @param path 路径
   * @returns 被移除的元素
   */
  pop(path: string | DataManagerPath): any;

  /**
   * 查询满足条件的节点（深度优先）
   * @param predicate 判断函数 (value, key, path) => boolean
   * @returns 第一个匹配的节点值
   */
  find(predicate: (value: any, key: string, path: string[]) => boolean): any;

  /**
   * 查询所有满足条件的节点
   * @param predicate 判断函数
   * @returns 匹配的节点值数组
   */
  findAll(predicate: (value: any, key: string, path: string[]) => boolean): any[];

  /**
   * 清空数据状态
   */
  clear(): void;
}
