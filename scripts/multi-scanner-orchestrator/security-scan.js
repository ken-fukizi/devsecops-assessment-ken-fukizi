#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SCANNER_VERSION = "1.0.0";

const SEVERITY_RANK = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
  unknown: 0,
};

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".java",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".properties",
  ".env",
  ".sh",
  ".ps1",
  ".tf",
  ".tfvars",
  ".md",
]);

const SCANNABLE_BASENAMES = new Set([
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "package.json",
  "pom.xml",
]);

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  "build",
  "coverage",
  ".idea",
  ".vscode",
]);

function printHelp() {
  const help = [
    "Multi-Scanner Orchestrator",
    "",
    "Usage:",
    "  node security-scan.js --path <target> [options]",
    "",
    "Options:",
    "  --path <dir>          Path to scan (default: .)",
    "  --format <table|json> Output format (default: table)",
    "  --output <file>       Write report to file",
    "  --fail-on <severity>  Severity threshold (default: high)",
    "  --no-external         Skip semgrep, gitleaks, trivy",
    "  --max-findings <n>    Max findings shown in table (default: 20)",
    "  --help                Show help",
  ];
  console.log(help.join("\n"));
}

function parseArgs(argv) {
  const options = {
    path: ".",
    format: "table",
    output: null,
    failOn: "high",
    external: true,
    maxFindings: 20,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--path") {
      options.path = argv[++i];
    } else if (arg === "--format") {
      options.format = (argv[++i] || "").toLowerCase();
    } else if (arg === "--output") {
      options.output = argv[++i];
    } else if (arg === "--fail-on") {
      options.failOn = (argv[++i] || "").toLowerCase();
    } else if (arg === "--no-external") {
      options.external = false;
    } else if (arg === "--max-findings") {
      options.maxFindings = Number(argv[++i]);
    } else if (arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["table", "json"].includes(options.format)) {
    throw new Error("--format must be table or json");
  }

  if (!Object.prototype.hasOwnProperty.call(SEVERITY_RANK, options.failOn)) {
    throw new Error("--fail-on must be one of critical, high, medium, low, info, unknown");
  }

  if (!Number.isFinite(options.maxFindings) || options.maxFindings < 1) {
    throw new Error("--max-findings must be a positive number");
  }

  return options;
}

function normalizeSeverity(value) {
  if (!value) {
    return "unknown";
  }
  const sev = String(value).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SEVERITY_RANK, sev)) {
    return sev;
  }
  return "unknown";
}

function toPosixRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function shannonEntropy(input) {
  const counts = new Map();
  for (const c of input) {
    counts.set(c, (counts.get(c) || 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / input.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function likelyFalsePositive(line, candidate) {
  const lowered = `${line} ${candidate}`.toLowerCase();
  if (/example|sample|dummy|placeholder|changeme|not-a-real|fake|test/.test(lowered)) {
    return true;
  }
  return false;
}

async function collectScannableFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.promises.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext) || SCANNABLE_BASENAMES.has(entry.name)) {
        const stat = await fs.promises.stat(fullPath);
        if (stat.size <= 1024 * 1024) {
          files.push(fullPath);
        }
      }
    }
  }

  return files;
}

async function loadFileLines(filePath) {
  const content = await fs.promises.readFile(filePath, "utf8");
  return content.split(/\r?\n/);
}

function makeFinding({ scanner, category, severity, title, file, line, confidence, evidence }) {
  return {
    scanner,
    category,
    severity: normalizeSeverity(severity),
    title,
    file,
    line,
    confidence,
    evidence,
  };
}

async function runInternalSecretScan(rootDir, files) {
  const start = Date.now();
  const findings = [];

  const patterns = [
    {
      id: "AWS_ACCESS_KEY",
      severity: "high",
      confidence: 0.95,
      regex: /AKIA[0-9A-Z]{16}/g,
      title: "Potential AWS access key",
      extractor: (match) => match[0],
    },
    {
      id: "GITHUB_TOKEN",
      severity: "high",
      confidence: 0.9,
      regex: /gh[pousr]_[A-Za-z0-9]{36,255}/g,
      title: "Potential GitHub token",
      extractor: (match) => match[0],
    },
    {
      id: "GENERIC_SECRET_ASSIGNMENT",
      severity: "medium",
      confidence: 0.65,
      regex: /(password|passwd|token|api[_-]?key|secret)\s*[:=]\s*["']([^"']{8,})["']/gi,
      title: "Potential hardcoded secret assignment",
      extractor: (match) => match[2],
    },
  ];

  for (const filePath of files) {
    const relPath = toPosixRelative(rootDir, filePath);
    const lines = await loadFileLines(filePath);

    lines.forEach((lineText, index) => {
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(lineText)) !== null) {
          const candidate = pattern.extractor(match);

          if (likelyFalsePositive(lineText, candidate)) {
            continue;
          }

          if (pattern.id === "GENERIC_SECRET_ASSIGNMENT") {
            const entropy = shannonEntropy(candidate);
            if (entropy < 3.2) {
              continue;
            }
          }

          findings.push(
            makeFinding({
              scanner: "internal-secret-detector",
              category: "secrets",
              severity: pattern.severity,
              title: `${pattern.title} (${pattern.id})`,
              file: relPath,
              line: index + 1,
              confidence: pattern.confidence,
              evidence: lineText.trim().slice(0, 180),
            }),
          );
        }
      }
    });
  }

  return {
    name: "internal-secret-detector",
    status: "completed",
    durationMs: Date.now() - start,
    findings,
    meta: {
      filesScanned: files.length,
    },
  };
}

async function runInternalCodePatternScan(rootDir, files) {
  const start = Date.now();
  const findings = [];

  const patterns = [
    {
      regex: /\beval\s*\(/,
      severity: "high",
      title: "Use of eval detected",
      category: "sast",
    },
    {
      regex: /\bnew\s+Function\s*\(/,
      severity: "high",
      title: "Use of dynamic Function constructor",
      category: "sast",
    },
    {
      regex: /Runtime\.getRuntime\(\)\.exec\s*\(/,
      severity: "high",
      title: "Potential command execution in Java",
      category: "sast",
    },
    {
      regex: /\bProcessBuilder\s*\(/,
      severity: "medium",
      title: "Potential process execution in Java",
      category: "sast",
    },
    {
      regex: /child_process\.(exec|execSync)\s*\(/,
      severity: "medium",
      title: "Potential command execution in Node.js",
      category: "sast",
    },
    {
      regex: /privileged\s*:\s*true/i,
      severity: "high",
      title: "Privileged container setting detected",
      category: "misconfig",
    },
    {
      regex: /allowPrivilegeEscalation\s*:\s*true/i,
      severity: "high",
      title: "allowPrivilegeEscalation=true detected",
      category: "misconfig",
    },
  ];

  for (const filePath of files) {
    const relPath = toPosixRelative(rootDir, filePath);
    const lines = await loadFileLines(filePath);

    lines.forEach((lineText, index) => {
      for (const pattern of patterns) {
        if (pattern.regex.test(lineText)) {
          findings.push(
            makeFinding({
              scanner: "internal-code-pattern-scan",
              category: pattern.category,
              severity: pattern.severity,
              title: pattern.title,
              file: relPath,
              line: index + 1,
              confidence: 0.7,
              evidence: lineText.trim().slice(0, 180),
            }),
          );
        }
      }
    });
  }

  return {
    name: "internal-code-pattern-scan",
    status: "completed",
    durationMs: Date.now() - start,
    findings,
  };
}

async function runInternalDependencyPolicyScan(rootDir, files) {
  const start = Date.now();
  const findings = [];

  const packageJsonFiles = files.filter((f) => path.basename(f) === "package.json");
  for (const filePath of packageJsonFiles) {
    const relPath = toPosixRelative(rootDir, filePath);
    try {
      const raw = await fs.promises.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const sections = ["dependencies", "devDependencies", "peerDependencies"];

      for (const section of sections) {
        const deps = parsed[section] || {};
        for (const [name, version] of Object.entries(deps)) {
          if (
            typeof version === "string" &&
            (version.trim() === "*" || version.toLowerCase() === "latest" || version.startsWith("http"))
          ) {
            findings.push(
              makeFinding({
                scanner: "internal-dependency-policy-scan",
                category: "dependency",
                severity: "medium",
                title: `Dependency ${name} uses weak pinning (${version})`,
                file: relPath,
                line: 1,
                confidence: 0.8,
                evidence: `${section}.${name}=${version}`,
              }),
            );
          }
        }
      }
    } catch (error) {
      findings.push(
        makeFinding({
          scanner: "internal-dependency-policy-scan",
          category: "dependency",
          severity: "low",
          title: "Could not parse package.json",
          file: relPath,
          line: 1,
          confidence: 0.5,
          evidence: String(error.message || error),
        }),
      );
    }
  }

  const pomFiles = files.filter((f) => path.basename(f) === "pom.xml");
  for (const filePath of pomFiles) {
    const relPath = toPosixRelative(rootDir, filePath);
    const raw = await fs.promises.readFile(filePath, "utf8");
    const regex = /<version>\s*(LATEST|RELEASE)\s*<\/version>/gi;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      const line = raw.slice(0, match.index).split(/\r?\n/).length;
      findings.push(
        makeFinding({
          scanner: "internal-dependency-policy-scan",
          category: "dependency",
          severity: "medium",
          title: `Maven dynamic version detected (${match[1]})`,
          file: relPath,
          line,
          confidence: 0.75,
          evidence: match[0],
        }),
      );
    }
  }

  return {
    name: "internal-dependency-policy-scan",
    status: "completed",
    durationMs: Date.now() - start,
    findings,
  };
}

function toolExists(command) {
  const checkCmd = process.platform === "win32" ? "where" : "which";
  const res = spawnSync(checkCmd, [command], { stdio: "ignore" });
  return res.status === 0;
}

function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function completeExternalScanner(name, status, durationMs, findings, error) {
  return {
    name,
    status,
    durationMs,
    findings,
    ...(error ? { error } : {}),
  };
}

function runSemgrepScan(targetPath) {
  const scannerName = "semgrep";
  const startedAt = Date.now();
  if (!toolExists(scannerName)) {
    return completeExternalScanner(scannerName, "skipped", Date.now() - startedAt, [], "Tool not installed");
  }

  const result = runCommand(scannerName, ["scan", "--config", "auto", "--json", "--quiet", targetPath]);
  const parsed = parseJsonSafe(result.stdout || "");

  if (!parsed || !Array.isArray(parsed.results)) {
    return completeExternalScanner(
      scannerName,
      "error",
      Date.now() - startedAt,
      [],
      `Could not parse semgrep output. stderr=${(result.stderr || "").trim()}`,
    );
  }

  const findings = parsed.results.map((item) =>
    makeFinding({
      scanner: scannerName,
      category: "sast",
      severity: normalizeSeverity(item?.extra?.severity),
      title: item?.extra?.message || item?.check_id || "Semgrep finding",
      file: (item?.path || "").split(path.sep).join("/"),
      line: item?.start?.line || 1,
      confidence: 0.8,
      evidence: item?.check_id || "",
    }),
  );

  return completeExternalScanner(scannerName, "completed", Date.now() - startedAt, findings);
}

function mapGitleaksSeverity(description) {
  const lowered = String(description || "").toLowerCase();
  if (/private key|rsa|ssh/.test(lowered)) {
    return "critical";
  }
  if (/password|secret|token|api|credential/.test(lowered)) {
    return "high";
  }
  return "medium";
}

function runGitleaksScan(targetPath) {
  const scannerName = "gitleaks";
  const startedAt = Date.now();
  if (!toolExists(scannerName)) {
    return completeExternalScanner(scannerName, "skipped", Date.now() - startedAt, [], "Tool not installed");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitleaks-"));
  const reportPath = path.join(tempDir, "report.json");

  const result = runCommand(scannerName, [
    "detect",
    "--source",
    targetPath,
    "--report-format",
    "json",
    "--report-path",
    reportPath,
    "--no-banner",
    "--redact",
  ]);

  const reportRaw = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf8") : "[]";
  const parsed = parseJsonSafe(reportRaw);

  if (!Array.isArray(parsed)) {
    return completeExternalScanner(
      scannerName,
      "error",
      Date.now() - startedAt,
      [],
      `Could not parse gitleaks output. stderr=${(result.stderr || "").trim()}`,
    );
  }

  const findings = parsed.map((item) =>
    makeFinding({
      scanner: scannerName,
      category: "secrets",
      severity: mapGitleaksSeverity(item?.Description),
      title: item?.Description || item?.RuleID || "Gitleaks finding",
      file: String(item?.File || "").split(path.sep).join("/"),
      line: item?.StartLine || 1,
      confidence: 0.9,
      evidence: item?.RuleID || "",
    }),
  );

  return completeExternalScanner(scannerName, "completed", Date.now() - startedAt, findings);
}

function runTrivyScan(targetPath) {
  const scannerName = "trivy";
  const startedAt = Date.now();
  if (!toolExists(scannerName)) {
    return completeExternalScanner(scannerName, "skipped", Date.now() - startedAt, [], "Tool not installed");
  }

  const result = runCommand(scannerName, ["fs", "--quiet", "--format", "json", "--scanners", "vuln,secret,misconfig", targetPath]);
  const parsed = parseJsonSafe(result.stdout || "");

  if (!parsed || !Array.isArray(parsed.Results)) {
    return completeExternalScanner(
      scannerName,
      "error",
      Date.now() - startedAt,
      [],
      `Could not parse trivy output. stderr=${(result.stderr || "").trim()}`,
    );
  }

  const findings = [];

  for (const resultItem of parsed.Results) {
    const target = String(resultItem.Target || "").split(path.sep).join("/");

    if (Array.isArray(resultItem.Vulnerabilities)) {
      for (const vuln of resultItem.Vulnerabilities) {
        findings.push(
          makeFinding({
            scanner: scannerName,
            category: "dependency",
            severity: vuln.Severity || "unknown",
            title: vuln.Title || vuln.VulnerabilityID || "Dependency vulnerability",
            file: target,
            line: 1,
            confidence: 0.85,
            evidence: vuln.VulnerabilityID || vuln.PkgName || "",
          }),
        );
      }
    }

    if (Array.isArray(resultItem.Misconfigurations)) {
      for (const misconfig of resultItem.Misconfigurations) {
        findings.push(
          makeFinding({
            scanner: scannerName,
            category: "misconfig",
            severity: misconfig.Severity || "unknown",
            title: misconfig.Title || misconfig.ID || "Misconfiguration",
            file: target,
            line: misconfig?.CauseMetadata?.StartLine || 1,
            confidence: 0.8,
            evidence: misconfig.ID || "",
          }),
        );
      }
    }

    if (Array.isArray(resultItem.Secrets)) {
      for (const secret of resultItem.Secrets) {
        findings.push(
          makeFinding({
            scanner: scannerName,
            category: "secrets",
            severity: secret.Severity || "high",
            title: secret.Title || "Trivy secret finding",
            file: target,
            line: secret.StartLine || 1,
            confidence: 0.85,
            evidence: secret.RuleID || "",
          }),
        );
      }
    }
  }

  return completeExternalScanner(scannerName, "completed", Date.now() - startedAt, findings);
}

function buildReport(scanners, options, targetPath) {
  const allFindings = scanners
    .filter((s) => s.status === "completed")
    .flatMap((s) => s.findings)
    .map((f) => ({
      ...f,
      severity: normalizeSeverity(f.severity),
    }));

  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
  };

  const byCategory = {};
  for (const finding of allFindings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
  }

  const thresholdRank = SEVERITY_RANK[options.failOn];
  const shouldFail = allFindings.some((f) => SEVERITY_RANK[f.severity] >= thresholdRank);
  const decision = allFindings.length === 0 ? "pass" : shouldFail ? "fail" : "warn";

  return {
    metadata: {
      tool: "multi-scanner-orchestrator",
      version: SCANNER_VERSION,
      generatedAt: new Date().toISOString(),
      targetPath,
      failOn: options.failOn,
      outputFormat: options.format,
      externalScannersEnabled: options.external,
    },
    scanners: scanners.map((scanner) => ({
      name: scanner.name,
      status: scanner.status,
      durationMs: scanner.durationMs,
      findings: scanner.findings.length,
      ...(scanner.error ? { error: scanner.error } : {}),
      ...(scanner.meta ? { meta: scanner.meta } : {}),
    })),
    findings: allFindings,
    summary: {
      decision,
      exitCode: decision === "fail" ? 1 : 0,
      totalFindings: allFindings.length,
      bySeverity,
      byCategory,
    },
  };
}

function renderTableReport(report, options) {
  const lines = [];
  lines.push("=== Multi-Scanner Orchestrator ===");
  lines.push(`Target: ${report.metadata.targetPath}`);
  lines.push(`Decision: ${report.summary.decision.toUpperCase()}`);
  lines.push(`Total findings: ${report.summary.totalFindings}`);
  lines.push("");
  lines.push("Severity counts:");

  for (const [severity, count] of Object.entries(report.summary.bySeverity)) {
    lines.push(`  - ${severity}: ${count}`);
  }

  lines.push("");
  lines.push("Scanner status:");
  for (const scanner of report.scanners) {
    const suffix = scanner.error ? ` | ${scanner.error}` : "";
    lines.push(`  - ${scanner.name}: ${scanner.status} (${scanner.findings} findings, ${scanner.durationMs} ms)${suffix}`);
  }

  const findingsToShow = report.findings
    .slice()
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, options.maxFindings);

  if (findingsToShow.length > 0) {
    lines.push("");
    lines.push(`Top findings (max ${options.maxFindings}):`);
    findingsToShow.forEach((finding, idx) => {
      lines.push(
        `  ${idx + 1}. [${finding.severity.toUpperCase()}] ${finding.scanner} | ${finding.title} | ${finding.file}:${finding.line}`,
      );
    });
  }

  return lines.join("\n");
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const targetPath = path.resolve(process.cwd(), options.path);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Scan target does not exist: ${targetPath}`);
  }

  const files = await collectScannableFiles(targetPath);

  const scanners = [];
  scanners.push(await runInternalSecretScan(targetPath, files));
  scanners.push(await runInternalCodePatternScan(targetPath, files));
  scanners.push(await runInternalDependencyPolicyScan(targetPath, files));

  if (options.external) {
    scanners.push(runSemgrepScan(targetPath));
    scanners.push(runGitleaksScan(targetPath));
    scanners.push(runTrivyScan(targetPath));
  }

  const report = buildReport(scanners, options, targetPath);

  let output;
  if (options.format === "json") {
    output = JSON.stringify(report, null, 2);
  } else {
    output = renderTableReport(report, options);
  }

  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, output, "utf8");
  }

  console.log(output);
  process.exit(report.summary.exitCode);
}

run().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(2);
});
