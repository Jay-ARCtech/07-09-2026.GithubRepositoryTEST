// Tiny safe DOM builder. No HTML strings, no innerHTML, anywhere in this
// codebase — every dynamic value (character names, journal text, imported
// save data) reaches the page as a text node, never parsed as markup. That
// is the actual XSS defense, not an escaping convention someone can forget.
// See DESIGN.md §12.

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProp(node, key, value) {
  if (value == null || value === false) return;
  if (key === 'class' || key === 'className') {
    node.setAttribute('class', value);
  } else if (key === 'style' && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (v != null) node.style[k] = v;
    }
  } else if (key.startsWith('on') && typeof value === 'function') {
    node.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (key === 'dataset' && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
  } else if (key in node && typeof node[key] !== 'object' && !(node instanceof SVGElement)) {
    // direct IDL properties (value, disabled, checked, htmlFor, type...) —
    // still never innerHTML: that property is deliberately excluded below.
    if (key === 'innerHTML') return;
    try { node[key] = value; } catch { node.setAttribute(key, value); }
  } else {
    node.setAttribute(key, value);
  }
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
}

/** h('div.vp-panel', {class:'x', onClick:fn}, 'text', childEl) */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) applyProp(node, k, v);
  appendChildren(node, children);
  return node;
}

export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null) continue;
    node.setAttribute(k, v);
  }
  appendChildren(node, children);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(root, ...children) {
  clear(root);
  appendChildren(root, children);
  return root;
}

export function text(value) {
  return document.createTextNode(String(value));
}

export function flash(root, message) {
  const node = h('div', { class: 'vp-flash' }, String(message));
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}
