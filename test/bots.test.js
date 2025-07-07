const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = __dirname ? path.resolve(__dirname, "..") : "..";
const html = fs.readFileSync(path.join(root, "bots.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const wrapper = `${script}\nreturn { checks, botReady: window.botReady };\n//# sourceURL=bots.inline.js`;

function createEl(tag) {
  return {
    tag,
    children: [],
    className: "",
    appendChild(node) {
      this.children.push(node);
    },
    set textContent(v) {
      this._text = v;
    },
    get textContent() {
      return this._text;
    },
    getContext() {
      return {};
    },
  };
}

function setup(
  navigatorProps = {},
  windowProps = {},
  docHooks = {},
  fetchImpl = () => Promise.resolve({ json: () => ({}) }),
) {
  const resultsEl = createEl("div");
  const summaryEl = createEl("div");
  const document = {
    createElement: docHooks.createElement || createEl,
    getElementById(id) {
      if (id === "results") return resultsEl;
      if (id === "summary") return summaryEl;
      return createEl("div");
    },
  };
  const navigatorObj = Object.assign(
    {
      webdriver: false,
      userAgent: "Mozilla",
      plugins: { length: 1 },
      languages: ["en"],
      cookieEnabled: true,
      hardwareConcurrency: 4,
      permissions: {},
    },
    navigatorProps,
  );
  const windowObj = Object.assign({ fetch: fetchImpl }, windowProps);
  const fn = new Function("navigator", "window", "document", wrapper);
  const res = fn(navigatorObj, windowObj, document);
  res.window = windowObj;
  res.summaryEl = summaryEl;
  return res;
}

test("includes new checks", () => {
  const { checks } = setup();
  const names = checks.map((c) => c.name);
  assert.ok(names.includes("Missing permissions API"));
  assert.ok(names.includes("No Chrome object"));
  assert.ok(names.includes("Software WebGL renderer"));
});

test("flags when permissions and chrome missing", async () => {
  const { botReady, window } = setup(
    { permissions: undefined },
    { chrome: undefined },
  );
  await botReady;
  assert.strictEqual(window.botResults.flagged, 2);
});

test("flags software WebGL renderer", async () => {
  function createCanvas() {
    const el = createEl("canvas");
    el.getContext = () => ({
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }),
      getParameter: (p) => (p === 1 ? "SwiftShader" : "SwiftShader"),
    });
    return el;
  }
  const { botReady, window } = setup(
    {},
    { chrome: {} },
    {
      createElement: (tag) =>
        tag === "canvas" ? createCanvas() : createEl(tag),
    },
  );
  await botReady;
  assert.strictEqual(window.botResults.flagged, 1);
});

test("flags forwarded header", async () => {
  const fetchStub = () =>
    Promise.resolve({
      json: () =>
        Promise.resolve({ headers: { "X-Forwarded-For": "1.2.3.4" } }),
    });
  const { botReady, window } = setup({}, {}, {}, fetchStub);
  await botReady;
  assert.strictEqual(window.botResults.flagged, 1);
});
