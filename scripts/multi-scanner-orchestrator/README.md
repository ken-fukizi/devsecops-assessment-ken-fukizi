# Block 1 - Multi-Scanner Orchestrator

This folder contains a security automation script that orchestrates multiple scanners and aggregates findings into one report.

## What this demonstrates

- Security automation with one command
- Multi-scanner orchestration and output normalization
- Risk-based quality gate with pass, warn, fail decisions
- Practical false-positive handling for secret detection

## Scanners used

Internal scanners (always available):

- `internal-secret-detector` for hardcoded secrets
- `internal-code-pattern-scan` for risky code patterns
- `internal-dependency-policy-scan` for weak dependency version pinning

External scanners (auto-detected, optional):

- `semgrep` for SAST
- `gitleaks` for secrets
- `trivy` for vulnerability, secret, and misconfiguration scan

If external tools are not installed, the script marks them as `skipped` and continues with internal scanners.

## Usage

From this folder:

```powershell
node security-scan.js --path ..\.. --format table
```

JSON report output:

```powershell
node security-scan.js --path ..\.. --format json --output report.json
```

Run internal scanners only:

```powershell
node security-scan.js --path ..\.. --no-external --fail-on high
```

## Quality gate logic

- `pass`: no findings
- `warn`: findings exist, but all are below `--fail-on` threshold
- `fail`: at least one finding meets or exceeds `--fail-on` threshold

Default threshold is `high`.

## Test cases

1. Insecure fixture should fail because it contains a hardcoded key and `eval`.
2. Secure fixture should pass with no findings.
3. False-positive fixture should pass because placeholder-like values are filtered.

Run tests:

```powershell
node --test tests/security-scan.test.js
```

## Interview talking points

- Why aggregation matters: one report, one decision signal, less noise.
- Why internal plus external scanners: resilient local execution and stronger CI coverage.
- Why confidence and filtering matter: fewer false positives means better developer adoption.
