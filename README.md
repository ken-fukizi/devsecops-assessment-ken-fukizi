# DevSecOps Technical Assessment

Public assessment repository for the Country Flags application (React SPA + Spring Boot Country API).

Work is on the `candidate-assessment` branch.

## Blocks completed

| Block | Choice | Status |
|---|---|---|
| 1 | Security Automation — Multi-Scanner Orchestrator | Done |
| 2 | Pipeline Security (GitHub Actions) | Done |
| 3 | Container Security (Dockerfile + Compose) | Done |
| 4 | Infrastructure as Code Security | Skipped |
| 5 | Incident Response Analysis | Skipped |
| 6 | Architecture Design | Done |

Blocks 4 and 5 are deferred on purpose. The 3-hour timebox is four blocks; 1–3 plus 6 is the path that shows programming, pipeline, container, and strategic design. IaC and incident response are sequenced in the [architecture roadmap](docs/architecture-design.md#6-implementation-roadmap) as Phase 3, not omitted from the target state.

## Repository layout

```text
.
├── application/                 # Frontend container (Block 3)
│   ├── Dockerfile
│   └── nginx.conf
├── country-flags-app-main/      # Provided React SPA
├── country-service-main/        # Provided Spring Boot API
│   └── Dockerfile               # Block 3
├── .github/workflows/           # Blocks 2 and 3
│   ├── secure-pipeline.yml
│   └── container-security.yml
├── scripts/                     # Block 1
│   └── multi-scanner-orchestrator/
├── infrastructure/
│   └── docker-compose.yml       # Block 3
└── docs/
    ├── architecture-design.md   # Block 6 (primary design document)
    ├── block-2-pipeline-security.md
    ├── block-3-container-security.md
    └── architecture/diagrams/
```

## Block 6 — architecture design

The architecture work is organized as a design record plus diagrams:

1. [Architecture design](docs/architecture-design.md) — current-state findings, target design, trade-offs, roadmap
2. [Current state diagram](docs/architecture/diagrams/block-6-current-state.md)
3. [Target runtime](docs/architecture/diagrams/block-6-target-runtime.md)
4. [SDLC security controls](docs/architecture/diagrams/block-6-sdlc-security-controls.md)
5. [Trust boundaries](docs/architecture/diagrams/block-6-trust-boundaries.md)
6. [Implementation roadmap](docs/architecture/diagrams/block-6-implementation-roadmap.md)

Headline of the design: keep the Block 1–3 quality gates, fix the broken browser-to-API topology, then grow into HTTPS edge + ECS Fargate + RDS + OIDC. Do not start with Kubernetes.

## How to run

### Security scan (Block 1)

```powershell
cd scripts/multi-scanner-orchestrator
node security-scan.js --path ..\.. --format table
```

Tests:

```powershell
node --test tests/security-scan.test.js
```

### Containers (Block 3)

From the repository root:

```powershell
docker compose -f infrastructure/docker-compose.yml up --build
```

- Frontend: http://localhost:8080
- Backend API (internal Compose network): `api:8081`

The architecture doc calls out that nginx does not yet reverse-proxy `/api`. That is Phase 1 of the roadmap, not an accidental omission from Block 3’s timebox.

## Tooling

GitHub is required. Everything else is chosen and documented per block:

- Block 1: Node orchestrator, optional Semgrep / Gitleaks / Trivy
- Block 2: GitHub Actions, Semgrep, Trivy filesystem scan, fail/warn/pass gate
- Block 3: Distroless Java, nginx-unprivileged, Compose hardening, Trivy image scan
- Block 6: AWS-shaped target (CloudFront, ECS Fargate, RDS) with explicit cheaper/dearer alternatives
