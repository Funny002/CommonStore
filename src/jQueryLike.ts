const elementsSymbol = Symbol('elements');

class JQLiteImpl {
  private [elementsSymbol]: HTMLElement[];

  constructor(selector: string | HTMLElement | HTMLElement[]) {
    if (typeof selector === 'string') {
      if (selector.trim().startsWith('<')) {
        // 解析 HTML 字符串创建元素
        const template = document.createElement('template');
        template.innerHTML = selector.trim();
        const fragment = template.content;
        this[elementsSymbol] = Array.from(fragment.children) as HTMLElement[];
      } else {
        // 作为选择器查询
        this[elementsSymbol] = Array.from(document.querySelectorAll(selector));
      }
    } else if (selector instanceof HTMLElement) {
      this[elementsSymbol] = [selector];
    } else if (Array.isArray(selector)) {
      this[elementsSymbol] = selector.filter((el) => el instanceof HTMLElement);
    } else {
      this[elementsSymbol] = [];
    }
  }

  get elements(): HTMLElement[] {
    return this[elementsSymbol];
  }

  get length(): number {
    return this[elementsSymbol].length;
  }

  each(callback: (index: number, element: HTMLElement) => void): this {
    this[elementsSymbol].forEach((el, i) => callback(i, el));
    return this;
  }

  css(prop: string | Record<string, string | number>, value?: string | number): any {
    if (typeof prop === 'string') {
      if (value === undefined) {
        // 获取第一个元素的样式值
        const el = this[elementsSymbol][0];
        if (!el) return undefined;
        return window.getComputedStyle(el).getPropertyValue(prop);
      } else {
        this.each((_, el) => {
          el.style[prop as any] = String(value);
        });
        return this;
      }
    } else {
      // 传入对象批量设置
      const styles = prop;
      this.each((_, el) => {
        Object.entries(styles).forEach(([key, val]) => {
          el.style[key as any] = String(val);
        });
      });
      return this;
    }
  }

  html(content?: string): any {
    if (content === undefined) {
      const el = this[elementsSymbol][0];
      return el ? el.innerHTML : '';
    }
    this.each((_, el) => {
      el.innerHTML = content;
    });
    return this;
  }

  text(content?: string): any {
    if (content === undefined) {
      return this[elementsSymbol].map((el) => el.textContent).join('');
    }
    this.each((_, el) => {
      el.textContent = content;
    });
    return this;
  }

  attr(name: string | Record<string, string | number>, value?: string | number): any {
    if (typeof name === 'string') {
      if (value === undefined) {
        const el = this[elementsSymbol][0];
        return el ? el.getAttribute(name) : null;
      } else {
        this.each((_, el) => {
          el.setAttribute(name, String(value));
        });
        return this;
      }
    } else {
      const attrs = name;
      this.each((_, el) => {
        Object.entries(attrs).forEach(([key, val]) => {
          el.setAttribute(key, String(val));
        });
      });
      return this;
    }
  }

  addClass(className: string): this {
    this.each((_, el) => {
      el.classList.add(...className.split(/\s+/));
    });
    return this;
  }

  removeClass(className: string): this {
    this.each((_, el) => {
      el.classList.remove(...className.split(/\s+/));
    });
    return this;
  }

  hasClass(className: string): boolean {
    for (const el of this[elementsSymbol]) {
      if (el.classList.contains(className)) {
        return true;
      }
    }
    return false;
  }

  on(event: string, handler: (this: HTMLElement, ev: Event) => void): this {
    this.each((_, el) => {
      el.addEventListener(event, handler as EventListener);
    });
    return this;
  }

  off(event: string, handler?: (ev: Event) => void): this {
    this.each((_, el) => {
      el.removeEventListener(event, handler as EventListener);
    });
    return this;
  }

  get(index: number): HTMLElement | undefined {
    return this[elementsSymbol][index];
  }
}

export function $(selector: string | HTMLElement | HTMLElement[]) {
  return new JQLiteImpl(selector);
}
