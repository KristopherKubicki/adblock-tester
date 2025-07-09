const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = __dirname ? path.resolve(__dirname, "..") : "..";
const html = fs.readFileSync(path.join(root, "network.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const wrapper = `${script}\nreturn { runTrace, scan };\n//# sourceURL=network.inline.js`;

function setup(hooks = {}) {
  const traceTarget = { value: "" };
  const traceOutput = { textContent: "" };
  const runTraceBtn = { addEventListener() {} };
  const scanOutput = { textContent: "" };
  const scanBtn = { addEventListener() {} };
  const document = {
    getElementById(id) {
      if (id === "traceTarget") return traceTarget;
      if (id === "traceOutput") return traceOutput;
      if (id === "runTrace") return runTraceBtn;
      if (id === "scanOutput") return scanOutput;
      if (id === "scanBtn") return scanBtn;
      return {};
    },
  };
  const env = {
    fetch:
      hooks.fetch ||
      (() => Promise.resolve({ text: () => Promise.resolve("") })),
    Image: hooks.Image || function () {},
    setTimeout: hooks.setTimeout || setTimeout,
    clearTimeout: hooks.clearTimeout || clearTimeout,
  };
  const fn = new Function(
    "document",
    "fetch",
    "Image",
    "setTimeout",
    "clearTimeout",
    wrapper,
  );
  const res = fn(
    document,
    env.fetch,
    env.Image,
    env.setTimeout,
    env.clearTimeout,
  );
  return Object.assign(res, { traceTarget, traceOutput, scanOutput });
}

test("runTrace writes fetched text", async () => {
  let called;
  const fetch = (url) => {
    called = url;
    return Promise.resolve({ text: () => Promise.resolve("result") });
  };
  const { runTrace, traceTarget, traceOutput } = setup({ fetch });
  traceTarget.value = "example.com";
  await runTrace();
  assert.strictEqual(
    called,
    "https://api.hackertarget.com/mtr/?q=" + encodeURIComponent("example.com"),
  );
  assert.strictEqual(traceOutput.textContent, "result");
});

test("scan reports found addresses", async () => {
  const successes = new Set([1, 3]);
  function FakeImage() {
    this.onload = null;
    this.onerror = null;
  }
  Object.defineProperty(FakeImage.prototype, "src", {
    set(v) {
      const m = v.match(/192\.168\.0\.(\d+)/);
      const idx = m ? parseInt(m[1], 10) : 0;
      queueMicrotask(() => {
        if (successes.has(idx)) {
          this.onload && this.onload();
        } else {
          this.onerror && this.onerror();
        }
      });
    },
  });
  const { scan, scanOutput } = setup({
    Image: FakeImage,
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  await scan();
  assert.strictEqual(
    scanOutput.textContent,
    "Found: http://192.168.0.1, http://192.168.0.3",
  );
});
