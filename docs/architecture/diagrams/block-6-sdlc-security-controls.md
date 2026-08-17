# Block 6 — SDLC Security Controls

Where security sits on the path developers already use. Extends Blocks 1–3; does not replace them.

```mermaid
flowchart TD
    subgraph inner [Inner loop]
        A[Code on laptop] --> B[Unit tests]
        A --> C[security-scan.js]
        A --> D[Compose with /api proxy]
    end

    subgraph pr [Pull request]
        E[Required GitHub checks]
        E --> E1[Orchestrator internal scans]
        E --> E2[Semgrep SAST]
        E --> E3[Trivy fs: vuln + secret + misconfig]
        E --> E4[Checkov / Trivy config - Phase 3]
        E1 --> G{Quality gate}
        E2 --> G
        E3 --> G
        E4 --> G
        G -->|Critical or High| X[Block merge]
        G -->|Warn or Pass| F[Peer review]
    end

    subgraph build [Build and publish]
        F --> H[Multi-stage image build]
        H --> I[Trivy image]
        I --> J[SBOM + Cosign]
        J --> K[ECR]
    end

    subgraph deploy [Promote]
        K --> L[GitHub Environment: dev]
        L --> M[Environment: staging]
        M --> N[Environment: prod<br/>reviewers + OIDC]
        N --> O[Verify signature before serve]
    end

    inner --> pr
```

## Gate policy (unchanged language from Blocks 1–3)

| Decision | Meaning | Pipeline result |
|---|---|---|
| FAIL | Critical or High present | Non-zero exit, merge blocked |
| WARN | Only Medium/Low/Info | Merge allowed, summary flags debt |
| PASS | Zero findings | Merge allowed |

## Design notes

- Developers keep one mental model: fail / warn / pass.
- New tools (Checkov, Cosign) plug into the same aggregator story instead of new dashboards.
- Prod deploy permission is `id-token: write` on that job only. Default `contents: read` stays.
- Exceptions to the gate (unfixed High CVE) expire and are tracked in GitHub, not in Slack.
