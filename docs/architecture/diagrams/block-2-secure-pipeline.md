# Block 2 - Secure Pipeline Architecture

```mermaid
flowchart TD
    T[Trigger: push, pull_request, workflow_dispatch] --> C[Checkout]
    C --> I1[Internal scan: frontend]
    C --> I2[Internal scan: backend]
    C --> S[Semgrep scan]
    C --> R[Trivy fs scan]

    I1 --> A[Aggregate findings]
    I2 --> A
    S --> A
    R --> A

    A --> G{Quality gate}
    G -->|Critical or High| F[Decision: FAIL, exit 1]
    G -->|Only Medium or below| W[Decision: WARN, exit 0]
    G -->|No findings| P[Decision: PASS, exit 0]

    F --> U[Upload reports artifact]
    W --> U
    P --> U
```

## Design intent

- Provide multiple security perspectives in one workflow run.
- Keep scanner outputs machine-readable to support objective gating.
- Publish a single decision signal for release control.
