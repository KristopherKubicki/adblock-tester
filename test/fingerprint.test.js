const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = __dirname ? path.resolve(__dirname, "..") : "..";
const html = fs.readFileSync(path.join(root, "fingerprint.html"), "utf8");

const scriptMatch = /<script>([\s\S]*?)<\/script>/.exec(html);
const script = scriptMatch ? scriptMatch[1] : "";

test("fingerprint page mentions canvas and fonts", () => {
  assert.ok(html.includes("Canvas Image"));
  assert.ok(html.includes("Canvas Hash"));
  assert.ok(html.includes("Fonts"));
});

test("script defines getCanvasInfo", () => {
  assert.ok(/function getCanvasInfo/.test(script));
});
