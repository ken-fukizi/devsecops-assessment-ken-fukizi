# Block 3 - Container Security

This block secures the provided applications through hardened container builds, secure deployment configuration, and image vulnerability scanning.

## Deliverables

- [application/Dockerfile](../application/Dockerfile)
- [infrastructure/docker-compose.yml](../infrastructure/docker-compose.yml)
- [country-service-main/Dockerfile](../country-service-main/Dockerfile)
- [.github/workflows/container-security.yml](../.github/workflows/container-security.yml)

## Security measures implemented

1. Multi-stage builds
   - Frontend image builds static assets in a Node build stage and serves from a minimal nginx runtime image.
   - Backend image builds with Maven and runs from distroless Java runtime.
2. Non-root runtime
   - Frontend runs as UID 101 in nginx unprivileged image.
   - Backend runs as nonroot user in distroless image.
3. Minimal runtime footprint
   - Build tools are excluded from runtime images.
   - Runtime images contain only application artifacts.
4. Runtime hardening in deployment config
   - `read_only: true`
   - `cap_drop: [ALL]`
   - `security_opt: [no-new-privileges:true]`
   - `tmpfs` mounts for writable ephemeral paths only.
5. Security headers
   - Frontend nginx config enforces CSP and common secure headers.
6. Scanning integration
   - Trivy scans both API and Web images in GitHub Actions.
   - Container quality gate fails on Critical or High vulnerabilities.

## How to run locally

From repository root:

```powershell
docker compose -f infrastructure/docker-compose.yml up --build
```

Application endpoints:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8081/api/countries`

## Quality gate behavior

- PASS: no vulnerabilities found
- WARN: only Medium/Low vulnerabilities found
- FAIL: one or more Critical/High vulnerabilities found

## Why these choices

- Distroless and unprivileged images reduce attack surface.
- Capability dropping and no-new-privileges reduce post-compromise blast radius.
- Read-only filesystem constrains tampering at runtime.
- CI-based scanning ensures vulnerabilities are caught before promotion.
