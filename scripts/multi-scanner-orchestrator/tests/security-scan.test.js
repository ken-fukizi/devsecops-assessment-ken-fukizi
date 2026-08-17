const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptPath = path.resolve(__dirname, "..", "security-scan.js");

function runScanOnFixture(fixtureName) {
  const targetPath = path.resolve(__dirname, "fixtures", fixtureName);
  const args = [
    scriptPath,
    "--path",
    targetPath,
    "--format",
    "json",
    "--no-external",
    "--fail-on",
    "high",
  ];

  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
  });

  let report = null;
  if (result.stdout && result.stdout.trim().startsWith("{")) {
    report = JSON.parse(result.stdout);
  }

  return { result, report };
}

test("insecure fixture returns fail", () => {
  const { result, report } = runScanOnFixture("insecure");

  assert.ok(report, "Expected JSON report in stdout");
  assert.strictEqual(result.status, 1, "Expected failing exit code");
  assert.strictEqual(report.summary.decision, "fail");
  assert.ok(report.summary.totalFindings >= 2, "Expected at least two findings");
});

test("secure fixture returns pass", () => {
  const { result, report } = runScanOnFixture("secure");

  assert.ok(report, "Expected JSON report in stdout");
  assert.strictEqual(result.status, 0, "Expected success exit code");
  assert.strictEqual(report.summary.decision, "pass");
  assert.strictEqual(report.summary.totalFindings, 0);
});

test("false-positive fixture is filtered and returns pass", () => {
  const { result, report } = runScanOnFixture("false-positive");

  assert.ok(report, "Expected JSON report in stdout");
  assert.strictEqual(result.status, 0, "Expected success exit code");
  assert.strictEqual(report.summary.decision, "pass");
  assert.strictEqual(report.summary.totalFindings, 0);
});
