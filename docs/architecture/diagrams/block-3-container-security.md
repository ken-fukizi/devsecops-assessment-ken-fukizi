# Block 3 - Container Security Architecture

```mermaid
flowchart TD
    SRC[Source code: frontend and backend] --> B1[Build frontend multi-stage image]
    SRC --> B2[Build backend multi-stage image]

    B1 --> R1[Frontend runtime: nginx unprivileged]
    B2 --> R2[Backend runtime: distroless java nonroot]

    R1 --> D[Docker Compose deployment]
    R2 --> D

    D --> H1[Runtime hardening: read-only fs]
    D --> H2[Runtime hardening: cap_drop ALL]
    D --> H3[Runtime hardening: no-new-privileges]
    D --> H4[Runtime hardening: tmpfs for writable paths]

    R1 --> S1[Trivy image scan]
    R2 --> S2[Trivy image scan]

    S1 --> G{Container quality gate}
    S2 --> G

    G -->|Critical or High| F[FAIL build]
    G -->|Only Medium or Low| W[WARN]
    G -->|No vulnerabilities| P[PASS]
```

## Design intent

- Secure images by design using minimal non-root runtimes.
- Harden runtime with least privilege controls.
- Catch container vulnerabilities early with CI scanning and policy gate.
