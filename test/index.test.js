const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const root = __dirname ? path.resolve(__dirname, '..') : '..';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const cleaned = script.replace(/loadCategories\(\)\.then\(run\);/, '');
const wrapper = `${cleaned}\nreturn { loadCategories, getCategories: () => categories };`;

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

function setup(query, data, docOverrides) {
  const document =
    docOverrides || {
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
    Image: class { set src(_) { this.onload && this.onload(); } },
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

test('host names are inserted safely', async () => {
  let innerHTMLUsed = false;
  const instrumented = {
    getElementById: () => dummy(),
    createElement: () => ({
      appendChild() {},
      addEventListener() {},
      classList: { add() {} },
      setAttribute() {},
      set innerHTML(_) {
        innerHTMLUsed = true;
      },
      get innerHTML() {
        return '';
      },
      set textContent(_) {},
      get textContent() {
        return '';
      },
    }),
    querySelector: () => dummy(),
  };
  const hostile = [{ name: 'X', hosts: ['<img src=x>'] }];
  const { loadCategories } = setup('', hostile, instrumented);
  await loadCategories();
  assert.strictEqual(innerHTMLUsed, false);
});
