const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const root = __dirname ? path.resolve(__dirname, '..') : '..';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const cleaned = script.replace(/loadCategories\(\)\.then\(run\);/, '');
const wrapper = `${cleaned}\nreturn { loadCategories, getCategories: () => categories, sanitizeHost, createCategorySection, run, TIMEOUT_MS };`;

const dummy = () => ({
  appendChild() {},
  addEventListener() {},
  classList: { add() {} },
  setAttribute() {},
  set innerHTML(_) {},
  get innerHTML() { return ''; },
  set textContent(_) {},
  get textContent() { return ''; },
});

function setup(query, data) {
  const document = {
    getElementById: () => dummy(),
    createElement: () => dummy(),
    querySelector: () => dummy(),
  };
  const location = new URL('https://example.com/' + query);
  const env = {
    window: undefined,
    document,
    location,
    URLSearchParams,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(data) }),
    Image: class {
      set src(url) {
        if (url.includes('blocked')) {
          this.onerror && this.onerror();
        } else {
          this.onload && this.onload();
        }
      }
    },
    setTimeout,
    clearTimeout,
    console,
  };
  const fn = new Function(
    'window',
    'document',
    'location',
    'URLSearchParams',
    'fetch',
    'Image',
    'setTimeout',
    'clearTimeout',
    'console',
    wrapper,
  );
  return fn(
    env.window,
    env.document,
    env.location,
    env.URLSearchParams,
    env.fetch,
    env.Image,
    env.setTimeout,
    env.clearTimeout,
    env.console,
  );
}

const categoriesData = JSON.parse(
  fs.readFileSync(path.join(root, 'categories.json'), 'utf8')
);

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setupSpy(query, data, hooks = {}) {
  let spans = [];
  let innerHTMLUsed = false;
  const summaryEl = dummy();
  Object.defineProperty(summaryEl, 'textContent', {
    set(v) { summaryEl._text = v; },
    get() { return summaryEl._text; },
  });
  const document = {
    getElementById: (id) => (id === 'summary' ? summaryEl : dummy()),
    createElement: (tag) => {
      const el = {
        tag,
        attrs: {},
        classList: {
          added: [],
          add(c) { this.added.push(c); },
        },
        appendChild() {},
        setAttribute(name, value) { this.attrs[name] = value; },
      };
      Object.defineProperty(el, 'textContent', {
        set(v) { el._text = v; },
        get() { return el._text; },
      });
      if (tag === 'div') {
        Object.defineProperty(el, 'innerHTML', {
          set() { innerHTMLUsed = true; },
        });
      }
      if (tag === 'span') spans.push(el);
      return el;
    },
    querySelector: (selector) => {
      const m = /\[data-host="([^"]+)"\]/.exec(selector);
      if (m) {
        return spans.find((s) => s.attrs['data-host'] === m[1]) || dummy();
      }
      return dummy();
    },
  };
  const location = new URL('https://example.com/' + query);
  const env = {
    window: undefined,
    document,
    location,
    URLSearchParams,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(data) }),
    Image: class {
      set src(url) {
        if (url.includes('blocked')) {
          this.onerror && this.onerror();
        } else {
          this.onload && this.onload();
        }
      }
    },
    setTimeout,
    clearTimeout,
    console,
  };
  const customWrapper = `${cleaned}\nreturn { loadCategories, getCategories: () => categories, sanitizeHost, createCategorySection, run, TIMEOUT_MS };`;
  const fn = new Function(
    'window',
    'document',
    'location',
    'URLSearchParams',
    'fetch',
    'Image',
    'setTimeout',
    'clearTimeout',
    'console',
    customWrapper,
  );
  const res = fn(
    env.window,
    env.document,
    env.location,
    env.URLSearchParams,
    env.fetch,
    env.Image,
    env.setTimeout,
    env.clearTimeout,
    env.console,
  );
  return { ...res, spans, summaryEl, innerHTMLUsed: () => innerHTMLUsed };
}

test('loads categories.json without custom param', async () => {
  const { loadCategories, getCategories } = setup('', clone(categoriesData));
  await loadCategories();
  assert.deepStrictEqual(getCategories(), categoriesData);
});

test('appends custom hosts when query param present', async () => {
  const custom = ['https://example.com/ad.js'];
  const { loadCategories, getCategories } = setup(
    '?custom=' + encodeURIComponent(custom.join(',')),
    clone(categoriesData),
  );
  await loadCategories();
  const expected = clone(categoriesData);
  expected.push({ name: 'Custom Hosts', hosts: custom });
  assert.deepStrictEqual(getCategories(), expected);
});

test('handles custom host containing <script> safely', async () => {
  const malicious = 'https://example.com/<script>alert(1)</script>.js';
  const { loadCategories, spans, innerHTMLUsed } = setupSpy(
    '?custom=' + encodeURIComponent(malicious),
    [],
  );
  await loadCategories();
  assert.strictEqual(innerHTMLUsed(), false);
  assert.ok(spans.some((s) => s._text === malicious.replace(/^https?:\/\//, '')));
});

test('sanitizeHost escapes quotes', () => {
  const { sanitizeHost } = setup('', []);
  assert.strictEqual(
    sanitizeHost('https://exa"mple.com/ad.js'),
    'https://exa&quot;mple.com/ad.js',
  );
});

test('createCategorySection builds host row', () => {
  const { createCategorySection, spans } = setupSpy('', []);
  const host = 'https://ad.example.com/script.js';
  createCategorySection({ name: 'Ads', hosts: [host] });
  const [hostSpan, statusSpan] = spans;
  assert.strictEqual(hostSpan._text, 'ad.example.com/script.js');
  assert.strictEqual(statusSpan.attrs['data-host'], host);
});

test('run summarizes blocked and allowed hosts', async () => {
  const data = [
    { name: 'Test', hosts: ['https://blocked.com/a.js', 'https://allowed.com/b.js'] },
  ];
  const { loadCategories, run, spans, summaryEl } = setupSpy('', data);
  // custom Image implementation: block URLs containing "blocked"
  await loadCategories();
  await run();
  const statusSpans = spans.filter((s) => 'data-host' in s.attrs);
  const blockedSpan = statusSpans.find((s) => s.attrs['data-host'].includes('blocked'));
  const allowedSpan = statusSpans.find((s) => s.attrs['data-host'].includes('allowed'));
  assert.strictEqual(blockedSpan._text, 'Blocked');
  assert.ok(blockedSpan.classList.added.includes('ok'));
  assert.strictEqual(allowedSpan._text, 'Allowed');
  assert.ok(allowedSpan.classList.added.includes('fail'));
  assert.strictEqual(summaryEl.textContent, 'Blocked 1 / 2 (50%)');
});
