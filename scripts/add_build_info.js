const fs = require("fs");
const { execSync } = require("child_process");

function getCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch (err) {
    return "unknown";
  }
}

function getBuildTime() {
  return new Date().toISOString();
}

function getVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    return pkg.version || "0.0.0";
  } catch (err) {
    return "0.0.0";
  }
}

function updateIndexHtml() {
  const file = "index.html";
  let html = fs.readFileSync(file, "utf8");
  // Remove any existing build-info block
  html = html.replace(/\n?\s*<div id="build-info"[\s\S]*?<\/div>/, "");
  const info = `Version ${getVersion()} \u2013 commit ${getCommitHash()} \u2013 built ${getBuildTime()}`;
  const injection = `\n  <div id="build-info" style="text-align:center;font-size:.75rem;opacity:.6;">${info}</div>`;
  const updated = html.replace(/(<\/body>)/i, `${injection}\n$1`);
  fs.writeFileSync(file, updated);
}

updateIndexHtml();
