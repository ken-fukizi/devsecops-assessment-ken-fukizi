# Block 6 — Current State

As-built from the provided apps plus Blocks 1–3. This is a laptop topology with security gates, not a production environment.

```mermaid
flowchart TB
    subgraph people [People]
        DEV[Developer]
        PR[Pull request reviewer]
    end

    subgraph sdlc [SDLC - already built]
        GH[GitHub repo]
        WF1[secure-pipeline.yml]
        WF2[container-security.yml]
        ORCH[security-scan.js]
        GH --> WF1
        GH --> WF2
        WF1 --> ORCH
        WF1 --> SEMG[Semgrep]
        WF1 --> TRFS[Trivy filesystem]
        WF2 --> IMG[Build API + Web images]
        IMG --> TRIM[Trivy image]
        WF1 --> GATE[FAIL / WARN / PASS]
        TRIM --> GATE
    end

    subgraph runtime [Local runtime - Compose]
        BR[Browser]
        WEB[web: nginx-unprivileged :8080<br/>read-only, cap_drop ALL, UID 101]
        API[api: distroless Java :8081<br/>read-only, cap_drop ALL, nonroot]
        H2[(H2 mem<br/>sa / password)]
        RC[restcountries.com]
        BR -->|:8080| WEB
        BR -.->|broken path: api is not in browser DNS<br/>and nginx does not proxy /api| API
        API --> H2
        API -->|blocking seed on boot| RC
    end

    DEV --> GH
    PR --> GH
    GATE -.->|does not deploy| runtime
```

## Legend

- Solid arrows are paths that work today.
- Dashed arrows are intended paths that do not work as designed.

## Design notes

- Blocks 1–3 already give a usable security signal. The architecture problem is runtime topology and environment, not “add more scanners.”
- Highest-priority defects: no `/api` reverse proxy, CORS origin mismatch (`:3000` vs `:8080`), H2 console + plaintext password, Spring Security 2.7.0 on Boot 3.4.3 with no filter chain.
- Compose hardening (`read_only`, `no-new-privileges`, tmpfs) should survive into the target runtime as ECS task constraints.
