import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Store, Persist } from "../../lib";

describe("Persist 持久化插件", () => {
  let store: Store;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.useFakeTimers();
    store = new Store({ count: 0, name: "test" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockStorage = (): Storage => ({
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
    clear: vi.fn(() => {
      mockStorage = {};
    }),
    key: vi.fn((_index: number) => ""),
    get length() {
      return Object.keys(mockStorage).length;
    },
  });

  it("应该使用默认配置创建插件", () => {
    const plugin = Persist();
    expect(plugin.name).toBe("persist");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.install).toBeDefined();
    expect(plugin.uninstall).toBeDefined();
    expect(plugin.onDataChange).toBeDefined();
  });

  it("安装时应该从存储恢复状态", () => {
    const mockStorageInstance = createMockStorage();
    mockStorage["test-store"] = JSON.stringify({ count: 42, name: "restored" });

    const plugin = Persist({ key: "test-store", storage: mockStorageInstance });
    store.use(plugin);

    expect(store.getState("count")).toBe(42);
    expect(store.getState("name")).toBe("restored");
  });

  it("没有保存数据时不应该修改状态", () => {
    const mockStorageInstance = createMockStorage();

    const plugin = Persist({ key: "test-store", storage: mockStorageInstance });
    store.use(plugin);

    expect(store.getState("count")).toBe(0);
    expect(store.getState("name")).toBe("test");
  });

  it("数据变更后应该保存到存储", () => {
    const mockStorageInstance = createMockStorage();
    const plugin = Persist({ key: "test-store", storage: mockStorageInstance, debounce: 100 });
    store.use(plugin);

    store.data.set("count", 10);

    vi.advanceTimersByTime(100);
    expect(mockStorageInstance.setItem).toHaveBeenCalled();
    const saved = JSON.parse(mockStorage["test-store"]);
    expect(saved.count).toBe(10);
  });

  it("应该支持白名单路径", () => {
    const mockStorageInstance = createMockStorage();
    const plugin = Persist({ key: "test-store", storage: mockStorageInstance, paths: ["count"], debounce: 100 });
    store.use(plugin);

    store.data.set("count", 99);
    store.data.set("name", "changed");

    vi.advanceTimersByTime(100);
    const saved = JSON.parse(mockStorage["test-store"]);
    expect(saved.count).toBe(99);
    expect(saved.name).toBeUndefined();
  });

  it("恢复状态时应该只恢复白名单路径", () => {
    const mockStorageInstance = createMockStorage();
    mockStorage["test-store"] = JSON.stringify({ count: 50, name: "should-not-restore" });

    const plugin = Persist({ key: "test-store", storage: mockStorageInstance, paths: ["count"] });
    store.use(plugin);

    expect(store.getState("count")).toBe(50);
    expect(store.getState("name")).toBe("test");
  });

  it("损坏的存储数据不应该影响状态", () => {
    const mockStorageInstance = createMockStorage();
    mockStorage["test-store"] = "{invalid json}";

    const plugin = Persist({ key: "test-store", storage: mockStorageInstance });
    store.use(plugin);

    expect(store.getState("count")).toBe(0);
  });

  it("卸载后不应该继续保存", () => {
    const mockStorageInstance = createMockStorage();
    const plugin = Persist({ key: "test-store", storage: mockStorageInstance, debounce: 100 });
    store.use(plugin);

    store.plugins.eject("persist");

    const flushCallCount = mockStorageInstance.setItem.mock.calls.length;
    store.data.set("count", 100);

    vi.advanceTimersByTime(100);
    expect(mockStorageInstance.setItem).toHaveBeenCalledTimes(flushCallCount);
  });
});
