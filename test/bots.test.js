const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "bots.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const cleaned = script.replace(/const resultsEl[\s\S]*$/, "");
const wrapper = `${cleaned}\nreturn checks;\n//# sourceURL=bots.inline.js`;

function getChecks(nav, win = {}) {
  const dummyCanvas = {
    getContext: () => ({
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: "foo" }),
      getParameter: () => "SwiftShader",
    }),
  };
  const document = { createElement: () => dummyCanvas };
  const fn = new Function("navigator", "window", "document", wrapper);
  return fn(nav, win, document);
}

test("flags headless user agent", () => {
  const nav = {
    userAgent: "HeadlessChrome",
    plugins: { length: 0 },
    languages: [],
    webdriver: false,
    vendor: "Google Inc.",
  };
  const checks = getChecks(nav, {});
  const headless = checks.find((c) => c.name === "Headless UA");
  assert.ok(headless.fn());
});

test("detects stealth when webdriver false but pluginless", () => {
  const nav = {
    userAgent: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
    plugins: { length: 0 },
    languages: ["en-US"],
    webdriver: false,
    vendor: "Google Inc.",
  };
  const checks = getChecks(nav, {});
  const stealth = checks.find((c) => c.name === "Potential stealth");
  assert.ok(stealth.fn());
});
