const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = __dirname ? path.resolve(__dirname, "..") : "..";
const html = fs.readFileSync(path.join(root, "fingerprint.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const wrapper = `${script}\nreturn { getLocalIPs, getPublicIP, render };\n//# sourceURL=fingerprint.inline.js`;

function setup(hooks = {}) {
  const env = {
    window: {},
    document: {
      getElementById: () => ({ appendChild() {} }),
      createElement: () => ({ style: {}, appendChild() {} }),
      body: { appendChild() {}, removeChild() {} },
    },
    navigator: {
      languages: ["en"],
      userAgent: "ua",
      platform: "test",
      hardwareConcurrency: 4,
      deviceMemory: 4,
      plugins: [],
      geolocation: { getCurrentPosition: (_, err) => err && err() },
      getBattery: () => Promise.resolve({ level: 0.5, charging: false }),
      connection: {},
    },
    screen: { width: 1, height: 1, colorDepth: 8 },
    fetch: hooks.fetch || (() => Promise.resolve({ json: () => ({ ip: "0.0.0.0" }) })),
    RTCPeerConnection: hooks.RTCPeerConnection,
  };
  const fn = new Function(
    "window",
    "document",
    "navigator",
    "screen",
    "fetch",
    "RTCPeerConnection",
    wrapper,
  );
  return fn(
    env.window,
    env.document,
    env.navigator,
    env.screen,
    env.fetch,
    env.RTCPeerConnection,
  );
}

test("getLocalIPs resolves 'n/a' on failure", async () => {
  const { getLocalIPs } = setup({
    RTCPeerConnection: function () {
      return {
        createDataChannel() {},
        onicecandidate: null,
        createOffer() {
          return Promise.reject(new Error("fail"));
        },
        setLocalDescription() {},
        close() {},
      };
    },
  });
  const ip = await getLocalIPs();
  assert.strictEqual(ip, "n/a");
});

test("render resolves even when local IP lookup fails", async () => {
  const { render } = setup({
    RTCPeerConnection: function () {
      return {
        createDataChannel() {},
        onicecandidate: null,
        createOffer() {
          return Promise.reject(new Error("fail"));
        },
        setLocalDescription() {},
        close() {},
      };
    },
  });
  await render();
});

test("getPublicIP resolves 'n/a' on timeout", async () => {
  let callback;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  global.setTimeout = (fn) => {
    callback = fn;
    return 1;
  };
  global.clearTimeout = () => {};
  const { getPublicIP } = setup({
    fetch: (_, opts) =>
      new Promise((resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  });
  const promise = getPublicIP();
  callback();
  const ip = await promise;
  assert.strictEqual(ip, "n/a");
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
});
