const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const root = __dirname ? path.resolve(__dirname, '..') : '..';
const html = fs.readFileSync(path.join(root, 'bots.html'), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];

// simple test to verify Software WebGL check present

test('bots page includes software WebGL check', () => {
  assert.ok(/Software WebGL/.test(script));
});
