# Block 1 - Multi-Scanner Orchestrator Architecture

```mermaid
flowchart LR
    Dev[Developer or CI Runner] --> CLI[security-scan.js CLI]

    CLI --> A1[Internal Secret Detector]
    CLI --> A2[Internal Code Pattern Scan]
    CLI --> A3[Internal Dependency Policy Scan]

    CLI --> B1[Semgrep Adapter]
    CLI --> B2[Gitleaks Adapter]
    CLI --> B3[Trivy Adapter]

    B1 --> C1{Tool Installed?}
    B2 --> C2{Tool Installed?}
    B3 --> C3{Tool Installed?}

    C1 -- Yes --> D1[Execute scanner and parse JSON]
    C1 -- No --> E1[Mark as skipped]
    C2 -- Yes --> D2[Execute scanner and parse JSON]
    C2 -- No --> E2[Mark as skipped]
    C3 -- Yes --> D3[Execute scanner and parse JSON]
    C3 -- No --> E3[Mark as skipped]

    A1 --> N[Normalizer and Aggregator]
    A2 --> N
    A3 --> N
    D1 --> N
    D2 --> N
    D3 --> N
    E1 --> N
    E2 --> N
    E3 --> N

    N --> G[Quality Gate Engine]
    G --> H{Severity >= fail-on?}
    H -- Yes --> F1[Decision: FAIL, exit 1]
    H -- No findings --> F2[Decision: PASS, exit 0]
    H -- Findings below threshold --> F3[Decision: WARN, exit 0]

    F1 --> O1[Table output or JSON report]
    F2 --> O1
    F3 --> O1
```

## Legend

- Internal scanners always run and provide baseline coverage.
- External scanners are optional and auto-detected.
- All findings are normalized into one unified schema.
- Quality gate produces a single decision signal for CI usage.

## Design Notes

- This design is resilient in constrained environments because it does not depend on external tools to function.
- The aggregated decision model simplifies pipeline integration in Block 2.
- Output supports both human-readable table format and machine-readable JSON.
