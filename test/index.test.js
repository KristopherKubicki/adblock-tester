const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { test } = require("node:test");

const root = __dirname ? path.resolve(__dirname, "..") : "..";
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const cleaned = script.replace(/loadCategories\(\)\.then\(run\);/, "");
const wrapper = `${cleaned}\nreturn { loadCategories, getCategories: () => categories, sanitizeHost, createCategorySection, createExtraSection, runExtraTests, run, testHost, TIMEOUT_MS, getSummary: () => resultsSummary };\n//# sourceURL=index.inline.js`;

const dummy = () => ({
  childNodes: [],
  appendChild(node) { this.childNodes.push(node); },
  addEventListener() {},
  classList: { add() {} },
  setAttribute() {},
  style: { width: 0, height: 0 },
  width: 0,
  height: 0,
  set innerHTML(_) {},
  get innerHTML() {
    return "";
  },
  set textContent(_) {},
  get textContent() {
    return "";
  },
});

function setup(query, data, hooks = {}) {
  const document = {
    getElementById: () => dummy(),
    createElement: () => dummy(),
    querySelector: () => dummy(),
  };
  const location = new URL("https://example.com/" + query);
  const env = {
    window: {},
    document,
    location,
    URLSearchParams,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(data) }),
    Image: hooks.Image ||
      class {
        constructor() {
          this.width = 0;
          this.height = 0;
        }
        set src(url) {
          if (url.includes("blocked")) {
            this.onerror && this.onerror();
          } else {
            this.onload && this.onload();
          }
        }
      },
    setTimeout: hooks.setTimeout || setTimeout,
    clearTimeout: hooks.clearTimeout || clearTimeout,
    console,
  };
  const fn = new Function(
    "window",
    "document",
    "location",
    "URLSearchParams",
    "fetch",
    "Image",
    "setTimeout",
    "clearTimeout",
    "console",
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
  fs.readFileSync(path.join(root, "categories.json"), "utf8"),
);

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setupSpy(query, data, hooks = {}) {
  let spans = [];
  let divs = [];
  let innerHTMLUsed = false;
  const summaryEl = dummy();
  Object.defineProperty(summaryEl, "textContent", {
    set(v) {
      summaryEl._text = v;
    },
    get() {
      return summaryEl._text;
    },
  });
  const adBait = hooks.adBait || dummy();
  const document = {
    getElementById: (id) => {
      if (id === "summary") return summaryEl;
      if (id === "adBait") return adBait;
      if (id === "extraResults") return dummy();
      return dummy();
    },
    createElement: (tag) => {
      const el = {
        tag,
        attrs: {},
        classList: {
          added: [],
          add(c) {
            this.added.push(c);
          },
        },
        childNodes: [],
        appendChild(node) {
          this.childNodes.push(node);
        },
        setAttribute(name, value) {
          this.attrs[name] = value;
        },
      };
      Object.defineProperty(el, "textContent", {
        set(v) {
          el._text = v;
        },
        get() {
          return el._text;
        },
      });
      if (tag === "div") {
        divs.push(el);
        Object.defineProperty(el, "innerHTML", {
          set() {
            innerHTMLUsed = true;
          },
        });
      }
      if (tag === "span") spans.push(el);
      return el;
    },
    querySelector: (selector) => {
      const hostMatch = /\[data-host="([^"]+)"\]/.exec(selector);
      if (hostMatch) {
        return spans.find((s) => s.attrs["data-host"] === hostMatch[1]) || dummy();
      }
      const extraMatch = /\[data-extra="([^"]+)"\]/.exec(selector);
      if (extraMatch) {
        return spans.find((s) => s.attrs["data-extra"] === extraMatch[1]) || dummy();
      }
      return dummy();
    },
  };
  const location = new URL("https://example.com/" + query);
  const env = {
    window: {},
    document,
    location,
    URLSearchParams,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(data) }),
    Image: hooks.Image ||
      class {
        constructor() {
          this.width = 0;
          this.height = 0;
        }
        set src(url) {
          if (url.includes("blocked")) {
            this.onerror && this.onerror();
          } else {
            this.onload && this.onload();
          }
        }
      },
    setTimeout: hooks.setTimeout || setTimeout,
    clearTimeout: hooks.clearTimeout || clearTimeout,
    console,
  };
  const customWrapper = `${cleaned}\nreturn { loadCategories, getCategories: () => categories, sanitizeHost, createCategorySection, createExtraSection, runExtraTests, run, testHost, TIMEOUT_MS };\n//# sourceURL=index.inline.js`;
  const fn = new Function(
    "window",
    "document",
    "location",
    "URLSearchParams",
    "fetch",
    "Image",
    "setTimeout",
    "clearTimeout",
    "console",
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
  return { ...res, spans, divs, summaryEl, innerHTMLUsed: () => innerHTMLUsed, env };
}

test("loads categories.json without custom param", async () => {
  const { loadCategories, getCategories } = setup("", clone(categoriesData));
  await loadCategories();
  assert.deepStrictEqual(getCategories(), categoriesData);
});

test("appends custom hosts when query param present", async () => {
  const custom = ["https://example.com/ad.js"];
  const { loadCategories, getCategories } = setup(
    "?custom=" + encodeURIComponent(custom.join(",")),
    clone(categoriesData),
  );
  await loadCategories();
  const expected = clone(categoriesData);
  expected.push({ name: "Custom Hosts", hosts: custom });
  assert.deepStrictEqual(getCategories(), expected);
});

test("handles custom host containing <script> safely", async () => {
  const malicious = "https://example.com/<script>alert(1)</script>.js";
  const { loadCategories, innerHTMLUsed } = setupSpy(
    "?custom=" + encodeURIComponent(malicious),
    [],
  );
  await loadCategories();
  assert.strictEqual(innerHTMLUsed(), false);
});

test("sanitizeHost escapes quotes", () => {
  const { sanitizeHost } = setup("", []);
  assert.strictEqual(
    sanitizeHost('https://exa"mple.com/ad.js'),
    "https://exa&quot;mple.com/ad.js",
  );
});

test("createCategorySection sets up log container", () => {
  const { createCategorySection, divs } = setupSpy("", []);
  createCategorySection({ name: "Ads", hosts: [] });
  assert.ok(divs.some((d) => d.className === "host-log"));
});

test("TIMEOUT_MS defaults to 5000", () => {
  const { TIMEOUT_MS } = setup("", []);
  assert.strictEqual(TIMEOUT_MS, 5000);
});

test("TIMEOUT_MS accepts query param", () => {
  const { TIMEOUT_MS } = setup("?timeout=1500", []);
  assert.strictEqual(TIMEOUT_MS, 1500);
});

test("TIMEOUT_MS ignores invalid values", () => {
  const { TIMEOUT_MS: bad } = setup("?timeout=foo", []);
  const { TIMEOUT_MS: negative } = setup("?timeout=-10", []);
  assert.strictEqual(bad, 5000);
  assert.strictEqual(negative, 5000);
});

test("custom hosts trim spaces", async () => {
  const hosts = [
    "https://x.com/a.js",
    "https://y.com/b.js",
  ];
  const q =
    "?custom=" +
    encodeURIComponent("  https://x.com/a.js , https://y.com/b.js ");
  const { loadCategories, getCategories } = setup(q, clone(categoriesData));
  await loadCategories();
  const expected = clone(categoriesData);
  expected.push({ name: "Custom Hosts", hosts });
  assert.deepStrictEqual(getCategories(), expected);
});

test("run handles all blocked hosts", async () => {
  const data = [
    { name: "Test", hosts: ["https://blocked.com/a.js"] },
  ];
  const { loadCategories, run, spans, summaryEl } = setupSpy("", data);
  await loadCategories();
  await run();
  assert.ok(spans.some((s) => s._text === "Blocked"));
  assert.strictEqual(summaryEl.textContent, "Blocked 1 / 1 (100%)");
});

test("run handles all allowed hosts", async () => {
  const data = [
    { name: "Test", hosts: ["https://allowed.com/a.js"] },
  ];
  const { loadCategories, run, spans, summaryEl } = setupSpy("", data);
  await loadCategories();
  await run();
  assert.ok(spans.some((s) => s._text === "Allowed"));
  assert.strictEqual(summaryEl.textContent, "Blocked 0 / 1 (0%)");
});

test("run summarizes blocked and allowed hosts", async () => {
  const data = [
    {
      name: "Test",
      hosts: ["https://blocked.com/a.js", "https://allowed.com/b.js"],
    },
  ];
  const { loadCategories, run, spans, summaryEl } = setupSpy("", data);
  await loadCategories();
  await run();
  const statuses = spans.map((s) => s._text);
  assert.ok(statuses.includes("Blocked"));
  assert.ok(statuses.includes("Allowed"));
  assert.strictEqual(summaryEl.textContent, "Blocked 1 / 2 (50%)");
});

test("getSummary returns last summary", async () => {
  const data = [
    { name: "Test", hosts: ["https://blocked.com/a.js"] },
  ];
  const { loadCategories, run, getSummary } = setup("", data);
  await loadCategories();
  await run();
  assert.strictEqual(getSummary(), "Blocked 1 / 1 (100%)");
});

test("testHost resolves false on load", async () => {
  const { testHost } = setup("", []);
  const res = await testHost("https://allowed.com/a.js");
  assert.strictEqual(res, false);
});

test("testHost resolves true on error", async () => {
  const { testHost } = setup("", []);
  const res = await testHost("https://blocked.com/a.js");
  assert.strictEqual(res, true);
});

test("testHost resolves true on timeout", async () => {
  let timer;
  let callback;
  const hooks = {
    Image: class {
      set src(_) {}
    },
    setTimeout(fn, ms) {
      callback = fn;
      timer = 1;
      return timer;
    },
    clearTimeout() {},
  };
  const { testHost } = setupSpy("?timeout=1", [], hooks);
  const promise = testHost("https://timeout.com/a.js");
  callback();
  const res = await promise;
  assert.strictEqual(res, true);
});

test("createExtraSection builds extra rows", () => {
  const { createExtraSection, spans } = setupSpy("", []);
  createExtraSection();
  const extras = spans.filter((s) => "data-extra" in s.attrs);
  // two tests defined in page
  assert.strictEqual(extras.length, 2);
});

test("runExtraTests reports inline and element blocks", () => {
  const adBait = { offsetHeight: 0 };
  const { createExtraSection, runExtraTests, spans, env } = setupSpy("", [], {
    adBait,
  });
  env.window.__adBaitLoaded = undefined;
  createExtraSection();
  runExtraTests();
  const extras = Object.fromEntries(
    spans
      .filter((s) => "data-extra" in s.attrs)
      .map((s) => [s.attrs["data-extra"], s])
  );
  assert.strictEqual(extras["inline-script"]._text, "Blocked");
  assert.ok(extras["inline-script"].classList.added.includes("ok"));
  assert.strictEqual(extras["element-hiding"]._text, "Blocked");
  assert.ok(extras["element-hiding"].classList.added.includes("ok"));
});
