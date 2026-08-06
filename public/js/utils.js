/**
 * utils.js
 * --------
 * Small helpers used all over the front end. Nothing app-specific lives here
 * except formatting rules (NZ dollars, tonnes, dates).
 */

/**
 * `h` builds a DOM element. It's a tiny alternative to a framework like React —
 * you get composable UI without a build step.
 *
 *   h('div', { class: 'card' }, h('h3', {}, 'Hello'))
 *
 * Special attribute handling:
 *   - `class`     -> className
 *   - `html`      -> innerHTML (only use with trusted/escaped content)
 *   - `on*`       -> event listener, e.g. onclick: () => {}
 *   - `dataset`   -> object of data-* attributes
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        // CSS custom properties (--pct) must go through setProperty —
        // assigning them to el.style silently does nothing.
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** Replace all children of `parent` with `nodes`. */
export function render(parent, ...nodes) {
  parent.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
}

/** Escape a string for safe insertion into innerHTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Formatting -----------------------------------------------------------

/** 12345 -> "12,345" */
export function num(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-NZ');
}

/** 12345 -> "$12,345"; large numbers get abbreviated to keep tiles readable. */
export function money(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${num(v)}`;
}

/** Tonnage with a sensible unit: 0.4 -> "400 kg", 1500 -> "1,500 t" */
export function tonnes(t) {
  const v = Number(t) || 0;
  if (v < 1) return `${num(v * 1000)} kg`;
  return `${num(v)} t`;
}

/** "2026-08-01T..." -> "1 Aug 2026" */
export function date(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2026-08-05T..." -> "2 hours ago" */
export function timeAgo(iso) {
  if (!iso) return '';
  const secs = (Date.now() - new Date(iso).getTime()) / 1000;
  const steps = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month']
  ];
  let value = secs, unit = 'second';
  for (const [size, name] of steps) {
    if (value < size) { unit = name; break; }
    value /= size;
    unit = name;
  }
  const v = Math.floor(value);
  if (unit === 'second' && v < 30) return 'just now';
  return `${v} ${unit}${v === 1 ? '' : 's'} ago`;
}

/** Human label for a price type. */
export function priceLabel(listing) {
  switch (listing.priceType) {
    case 'free': return 'Free to collect';
    case 'pay-to-take': return `They pay $${num(listing.price)}/t`;
    case 'paid': return `$${num(listing.price)}/t`;
    case 'negotiable': return `$${num(listing.price)}/t · negotiable`;
    default: return '—';
  }
}

/** Badge colour class for a price type. */
export function priceBadgeClass(priceType) {
  return {
    free: 'badge-green',
    'pay-to-take': 'badge-amber',
    paid: 'badge-blue',
    negotiable: 'badge'
  }[priceType] || 'badge';
}

/**
 * Convert a very small subset of Markdown into HTML, for AI replies.
 * Supports: **bold**, *italic*, `code`, bullet lists, and paragraphs.
 * Everything is escaped first, so this is safe against injected HTML.
 */
export function miniMarkdown(text) {
  const escaped = esc(text);
  const lines = escaped.split('\n');
  const out = [];
  let inList = false;

  const inline = s => s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/_\(([^)]+)\)_/g, '<em>($1)</em>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (!line.trim()) continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

/** Show a short-lived notification in the bottom-left corner. */
export function toast(message, variant = '') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast ${variant}` }, message);
  box.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

/** Debounce: wait until the user stops typing before running `fn`. */
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** A big loading placeholder. */
export function loadingBlock(label = 'Loading…') {
  return h('div', { class: 'loading' }, h('div', { class: 'spinner' }), label);
}

/** An empty-state placeholder. */
export function emptyBlock(icon, title, message, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'big' }, icon),
    h('h3', {}, title),
    h('p', { class: 'muted' }, message),
    action || null
  );
}
