# Block 6 — Implementation Priority Roadmap

Risk reduction per week of small-team effort. Phases are sequential on purpose: do not buy EKS before the browser can reach `/api`.

```mermaid
flowchart LR
    P0[Phase 0<br/>Assessment baseline]
    P1[Phase 1 - 30 days<br/>Make the topology true]
    P2[Phase 2 - 90 days<br/>First real environment]
    P3[Phase 3 - 180 days<br/>IaC + IR]
    P4[Phase 4 - evidence driven<br/>EKS / Redis / Auth]

    P0 --> P1 --> P2 --> P3 --> P4
```

```mermaid
flowchart TB
    subgraph p1 [Phase 1 - must fix]
        A1[nginx reverse proxy /api]
        A2[CSP connect-src self]
        A3[Remove H2 console and git passwords]
        A4[Fix or drop Spring Security 2.7.0]
        A5[Swagger off in prod profile]
        A6[RestTemplate timeouts + non-blocking seed]
    end

    subgraph p2 [Phase 2 - first cloud env]
        B1[OIDC + ECR + two AWS accounts]
        B2[CloudFront + S3 + ALB + ECS]
        B3[RDS + Secrets Manager]
        B4[SBOM + Cosign + Dependabot]
        B5[Basic SLO dashboards]
    end

    subgraph p3 [Phase 3 - skipped blocks done properly]
        C1[Terraform + Checkov in PR]
        C2[GuardDuty + Security Hub]
        C3[Runbooks + RDS restore drill]
        C4[WAF tuning]
    end

    subgraph p4 [Phase 4 - only with metrics]
        D1[EKS if 4+ services and a platform team]
        D2[Redis if edge cache is not enough]
        D3[Cognito when write APIs exist]
        D4[Leave CRA if CVE noise stays expensive]
    end

    p1 --> p2 --> p3 --> p4
```

## Priority table

| Order | Item | Closes | Effort |
|---|---|---|---|
| 1 | Same-origin `/api` proxy + CSP | G1, G2 | Small |
| 2 | H2 console off, secrets out of git | G3 | Small |
| 3 | Spring Security aligned or removed; default-deny except GET catalog | G4 | Small |
| 4 | Swagger/OpenAPI profile-gated | G5 | Small |
| 5 | Timeouts and async seed | G6 | Small |
| 6 | OIDC + HTTPS edge + RDS | G7, G8 | Medium |
| 7 | Terraform + policy scan | Skipped Block 4 | Medium |
| 8 | Detection, runbooks, restore drill | Skipped Block 5 | Medium |
| 9 | EKS / Redis / user auth | Scale or product evidence | Large |

## Design notes

- Phase 1 is still Compose. Shipping broken local topology to AWS just reproduces G1 in the cloud.
- Phase 3 is where IaC security and incident response belong. Skipping those assessment blocks was a timebox choice; they are not optional in the target state.
- Phase 4 items are explicitly **not** promised. They need a metric or a product change as a trigger.
