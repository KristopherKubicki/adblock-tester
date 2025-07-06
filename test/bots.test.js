const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = __dirname ? path.resolve(__dirname, "..") : "..";
const html = fs.readFileSync(path.join(root, "bots.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const wrapper = `${script}\nreturn { checks, flagged };\n//# sourceURL=bots.inline.js`;

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

function setup(navigatorProps = {}, windowProps = {}) {
  const resultsEl = createEl("div");
  const summaryEl = createEl("div");
  const document = {
    createElement: createEl,
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
  const windowObj = Object.assign({}, windowProps);
  const fn = new Function("navigator", "window", "document", wrapper);
  const res = fn(navigatorObj, windowObj, document);
  res.summary = summaryEl.textContent;
  return res;
}

test("includes new checks", () => {
  const { checks } = setup();
  const names = checks.map((c) => c.name);
  assert.ok(names.includes("Missing permissions API"));
  assert.ok(names.includes("No Chrome object"));
});

test("flags when permissions and chrome missing", () => {
  const { flagged } = setup({ permissions: undefined }, { chrome: undefined });
  assert.strictEqual(flagged, 2);
});
