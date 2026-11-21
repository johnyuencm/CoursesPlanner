// A small DOM, so React's client renderer can run in a test (#145). The project has no DOM library.
// shortcut: it has only what React and the planner board use, and no layout; use a DOM library (such as jsdom) when a test needs more, for example layout or scroll.

const HTML_NS = "http://www.w3.org/1999/xhtml";
const FOCUSABLE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
type Listener = (event: object) => void;
type ListenerOptions = boolean | { capture?: boolean };
const listenerKey = (type: string, options?: ListenerOptions) => `${type}:${typeof options === "object" ? Boolean(options.capture) : Boolean(options)}`;

class FakeNode {
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];
  readonly listeners = new Map<string, Listener[]>();
  constructor(readonly nodeType: number, readonly nodeName: string, readonly ownerDocument: FakeDocument | null) {}
  get firstChild(): FakeNode | null { return this.childNodes[0] ?? null; }
  get lastChild(): FakeNode | null { return this.childNodes.at(-1) ?? null; }
  get nextSibling(): FakeNode | null {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  insertBefore<T extends FakeNode>(child: T, before: FakeNode | null): T {
    child.parentNode?.removeChild(child);
    this.childNodes.splice(before ? this.childNodes.indexOf(before) : this.childNodes.length, 0, child);
    child.parentNode = this;
    return child;
  }
  appendChild<T extends FakeNode>(child: T): T { return this.insertBefore(child, null); }
  removeChild<T extends FakeNode>(child: T): T {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    child.parentNode = null;
    return child;
  }
  contains(node: FakeNode | null): boolean { return node !== null && (node === this || this.contains(node.parentNode)); }
  get textContent(): string { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(text: string) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    if (text) this.appendChild(new FakeText(text, this.ownerDocument));
  }
  addEventListener(type: string, listener: Listener, options?: ListenerOptions) {
    const key = listenerKey(type, options);
    this.listeners.set(key, [...(this.listeners.get(key) ?? []), listener]);
  }
  removeEventListener(type: string, listener: Listener, options?: ListenerOptions) {
    const key = listenerKey(type, options);
    this.listeners.set(key, (this.listeners.get(key) ?? []).filter((item) => item !== listener));
  }
  /** The elements below this node, in document order. */
  *elements(): Generator<FakeElement> {
    for (const child of this.childNodes) {
      if (child instanceof FakeElement) yield child;
      yield* child.elements();
    }
  }
}

class FakeText extends FakeNode {
  constructor(public nodeValue: string, ownerDocument: FakeDocument | null) { super(3, "#text", ownerDocument); }
  override get textContent(): string { return this.nodeValue; }
  override set textContent(text: string) { this.nodeValue = text; }
}

export class FakeElement extends FakeNode {
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = {};
  constructor(readonly namespaceURI: string, localName: string, ownerDocument: FakeDocument) {
    super(1, namespaceURI === HTML_NS ? localName.toUpperCase() : localName, ownerDocument);
  }
  get tagName(): string { return this.nodeName; }
  /** The options below a select. React reads them to mark the selected option (#147). */
  get options(): FakeElement[] { return [...this.elements()].filter((element) => element.nodeName === "OPTION"); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
  setAttribute(name: string, value: unknown) { this.attributes.set(name, String(value)); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  get tabIndex(): number { return Number(this.getAttribute("tabindex") ?? (FOCUSABLE.has(this.nodeName) ? 0 : -1)); }
  set tabIndex(value: number) { this.setAttribute("tabindex", value); }
  /** A control takes focus unless it is disabled. Any other element, such as a heading, takes focus only with tabindex -1.
   *  Stricter than a browser, which also focuses tabindex 0: a test fails if code puts a heading in the Tab order (#145). */
  focus() {
    if (FOCUSABLE.has(this.nodeName) ? !this.hasAttribute("disabled") : this.getAttribute("tabindex") === "-1") this.ownerDocument!.focused = this;
  }
  /** Like a browser: capture listeners from the top down, then bubble listeners from this element up. */
  click() {
    const path: FakeNode[] = [];
    for (let node: FakeNode | null = this; node; node = node.parentNode) path.push(node);
    const event = { type: "click", target: this, timeStamp: Date.now(), defaultPrevented: false, preventDefault() { event.defaultPrevented = true; }, stopPropagation() {} };
    for (const node of [...path].reverse()) for (const listener of node.listeners.get("click:true") ?? []) listener(event);
    for (const node of path) for (const listener of node.listeners.get("click:false") ?? []) listener(event);
  }
}

export class FakeDocument extends FakeNode {
  focused: FakeElement | null = null;
  defaultView: object | null = null;
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  constructor() {
    super(9, "#document", null);
    this.documentElement = this.appendChild(this.createElement("html"));
    this.body = this.documentElement.appendChild(this.createElement("body"));
  }
  /** Like a browser: when the focused element leaves the document, the body has focus. */
  get activeElement(): FakeElement { return this.focused && this.contains(this.focused) ? this.focused : this.body; }
  createElement(name: string) { return new FakeElement(HTML_NS, name, this); }
  createElementNS(namespace: string, name: string) { return new FakeElement(namespace, name, this); }
  createTextNode(text: string) { return new FakeText(text, this); }
  getElementById(id: string): FakeElement | null {
    for (const element of this.elements()) if (element.getAttribute("id") === id) return element;
    return null;
  }
  /** Tag names joined by spaces only (descendant selectors), such as "main h1". */
  querySelector(selector: string): FakeElement | null {
    const tags = selector.toUpperCase().split(" ");
    const under = (node: FakeNode | null, index: number): boolean => index < 0 || (node !== null && under(node.parentNode, node.nodeName === tags[index] ? index - 1 : index));
    for (const element of this.elements()) if (element.nodeName === tags.at(-1) && under(element.parentNode, tags.length - 2)) return element;
    return null;
  }
}

/** A document, and a window with it and an in-memory localStorage. */
export function createFakeDom() {
  const document = new FakeDocument();
  const items = new Map<string, string>();
  const window = {
    document,
    HTMLIFrameElement: class {}, // React looks for iframes around the focused element.
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { items.set(key, String(value)); },
      removeItem: (key: string) => { items.delete(key); },
    },
    addEventListener() {},
    removeEventListener() {},
    // A link (next/link) waits for an idle moment through self.setTimeout; in a browser, self is the window (#147).
    setTimeout,
    clearTimeout,
  };
  document.defaultView = window;
  return { document, window };
}
