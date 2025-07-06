const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const root = __dirname ? path.resolve(__dirname, '..') : '..';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const cleaned = script.replace(/loadCategories\(\)\.then\(run\);/, '');
const wrapper = `${cleaned}\nreturn { loadCategories, run, getCategories: () => categories };`;

function makeEl() {
  return {
    textContent: '',
    classList: {
      add(cls) {
        this.last = cls;
      },
      last: '',
    },
  };
}

const dummy = () => ({
  appendChild() {},
  addEventListener() {},
  classList: { add() {} },
  set innerHTML(_) {},
  get innerHTML() { return ''; },
  set textContent(_) {},
  get textContent() { return ''; },
});

function setup(query, data, hostStatuses = {}) {
  const hostElements = {};
  const summaryEl = makeEl();
  const document = {
    getElementById: (id) => (id === 'summary' ? summaryEl : dummy()),
    createElement: () => dummy(),
    querySelector: (sel) => {
      const m = /\[data-host="(.*)"\]/.exec(sel);
      if (m) {
        hostElements[m[1]] ||= makeEl();
        return hostElements[m[1]];
      }
      return dummy();
    },
  };
  const location = new URL('https://example.com/' + query);
  class ImageStub {
    set src(url) {
      const clean = url.replace(/([&?])cb=\d+$/, '');
      process.nextTick(() => {
        if (hostStatuses[clean]) {
          this.onerror && this.onerror();
        } else {
          this.onload && this.onload();
        }
      });
    }
  }
  const env = {
    window: undefined,
    document,
    location,
    URLSearchParams,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(data) }),
    Image: ImageStub,
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
  const exports = fn(
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
  return { ...exports, getHostElement: (h) => hostElements[h], summaryEl };
}

const categoriesData = JSON.parse(
  fs.readFileSync(path.join(root, 'categories.json'), 'utf8')
);

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
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

test('run reports host statuses', async () => {
  const statuses = {};
  let blocked = 0;
  categoriesData.forEach((cat, i) => {
    cat.hosts.forEach((h, j) => {
      const b = (i + j) % 2 === 0;
      statuses[h] = b;
      if (b) blocked++;
    });
  });
  const total = categoriesData.reduce((n, c) => n + c.hosts.length, 0);

  const { loadCategories, run, getHostElement, summaryEl } = setup(
    '',
    clone(categoriesData),
    statuses,
  );
  await loadCategories();
  await run();

  categoriesData.forEach((cat, i) => {
    cat.hosts.forEach((h, j) => {
      const el = getHostElement(h);
      assert.strictEqual(el.textContent, statuses[h] ? 'Blocked' : 'Allowed');
      assert.strictEqual(el.classList.last, statuses[h] ? 'ok' : 'fail');
    });
  });

  const pct = Math.round((blocked / total) * 100);
  assert.strictEqual(
    summaryEl.textContent,
    `Blocked ${blocked} / ${total} (${pct}%)`,
  );
});
