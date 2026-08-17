# Block 2 - Pipeline Security

This block implements a security-integrated CI pipeline in GitHub Actions.

## Workflow file

- [.github/workflows/secure-pipeline.yml](.github/workflows/secure-pipeline.yml)

## Security controls implemented

1. Multi-scanner strategy (3 scanners):
   - Internal Multi-Scanner Orchestrator for project-specific baseline checks
   - Semgrep for SAST rules across source code
   - Trivy for dependency, secret, and misconfiguration scan
2. Standardized report outputs in JSON for machine processing.
3. Centralized quality gate logic to produce one decision signal.
4. Security report artifact upload for review and audit trail.

## Quality gate policy

- FAIL when at least one Critical or High finding exists.
- WARN when findings exist but none are Critical or High.
- PASS when there are zero findings.

Gate logic is enforced in the workflow step:

- Aggregate findings and enforce quality gate

## Example outcomes

### Example 1 - PASS

- Internal scans: zero findings
- Semgrep: zero findings
- Trivy: zero findings
- Result: PASS, workflow succeeds

### Example 2 - WARN

- Internal scans: medium findings only
- Semgrep: warning findings only
- Trivy: low findings only
- Result: WARN, workflow succeeds but summary flags issues

### Example 3 - FAIL

- Any scanner reports High or Critical finding
- Result: FAIL, workflow exits non-zero and blocks merge/deploy

## Files produced by pipeline

- reports/security/internal-frontend.json
- reports/security/internal-backend.json
- reports/security/semgrep.json
- reports/security/trivy.json

These are uploaded as a workflow artifact named security-reports.
