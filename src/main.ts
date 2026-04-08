import { Store, History, Logger } from '../lib';
import { $ } from './jQueryLike';

function handlerFunctionMap(map: Record<string, any>, name?: string) {
  function handlerFunc(name: string) {
    map[name] && map[name].apply(map);
  }

  if (name) handlerFunc(name);
  return handlerFunc;
}

/**
 * ===============================================================================================================
 * ===============================================================================================================
 * ===============================================================================================================
 * */

// 创建 Store 实例，初始状态一个树结构
const store = new Store({
  tree: [
    { id: 'node-1', name: '根节点1', children: [] },
    { id: 'node-2', name: '根节点2', children: [] },
  ],
  count: 0,
});

// 加载 Logger 插件
store.use(Logger());

// 加载 History 插件
store.use(History());

$('.btn-item').on('click', function () {
  funcMap($(this).attr('name') || $(this).attr('data-name'));
});

// 创建一个函数映射对象，用于处理按钮点击事件
const funcMap = handlerFunctionMap({
  add(){
    console.log(store.getState('tree.0'));
  }
});

console.log('应用已初始化');

console.log('当前状态:', store.getState());
