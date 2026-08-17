# Solution notes

Personal notes on how the provided applications sit in the Block 1–6 solution. Not an assessment deliverable.

The two application folders are the **product**. Blocks 1–6 do not replace them. The assessment gives those folders as source code only; everything else is the DevSecOps wrapping built around them.

```text
country-flags-app-main     →  React SPA (what the user sees)
country-service-main       →  Spring Boot API (country data)

Block 1  scans them
Block 2  gates PRs that change them
Block 3  packages and runs them
Block 6  designs how they should live in a growing org
```

## What each folder is

| Folder | Role | User journey |
|---|---|---|
| `country-flags-app-main` | Frontend. Lists flags, click through to a country detail page. Calls `GET /api/countries`. | Browser |
| `country-service-main` | Backend. Serves that API, stores countries in H2, seeds from restcountries.com on boot. | JSON API on port 8081 |

Without those two directories there is nothing to scan, containerize, or architect. The rest of the repo exists because those apps exist.

## How each block uses them

**Block 1 — Security Automation**  
The orchestrator is generic, but CI points it at these trees:

- `--path country-flags-app-main` (JS/React: secrets, risky patterns, npm deps)
- `--path country-service-main` (Java: secrets, risky patterns, Maven deps)

That is why there are two internal scan steps, not one.

**Block 2 — Pipeline Security**  
`secure-pipeline.yml` checks out the repo, then scans **those same paths** plus the whole tree with Semgrep and Trivy. A High finding in the React app or the Spring API is what fails the quality gate.

**Block 3 — Container Security**  
This is the first time the provided source becomes runnable artifacts:

- `application/Dockerfile` copies `country-flags-app-main`, builds the SPA, serves it from nginx
- `country-service-main/Dockerfile` builds the Spring JAR into a distroless image
- `infrastructure/docker-compose.yml` runs those two images as `web` and `api`

The provided apps did not come with Dockerfiles. The runtime was added around them.

**Blocks 4 and 5**  
Skipped. If they had been done, Terraform/IR would still have been about hosting and operating **these two services**.

**Block 6 — Architecture**  
The design is not abstract. Current-state findings (CORS on `:3000`, H2 console, Security 2.7.0 on Boot 3, no `/api` proxy) come from reading **these** codebases. The target (CloudFront + S3 for the SPA, Fargate + RDS for the API) is the production shape of the same two apps.

## One picture

```text
Provided (product source — not written as part of this assessment)
  country-flags-app-main/     SPA source
  country-service-main/       API source

Built around them
  scripts/                    Block 1  → scans the source
  .github/workflows/          Block 2  → gates changes to the source
  application/Dockerfile      Block 3  → packages the SPA
  country-service-main/Dockerfile  Block 3  → packages the API
  infrastructure/             Block 3  → runs both locally
  docs/architecture-design.md Block 6  → target life of both
```

If asked “where is the application?”, the answer is: **those two folders**.  
If asked “what was added?”, the answer is: **the security automation, pipeline, containers, and the architecture for how that application should grow.**
