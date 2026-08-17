# Block 6 — Target Runtime Architecture

Production-shaped runtime for a growing team. Two deployable units, one public origin.

```mermaid
flowchart TB
    USERS[Internet users] --> CF[CloudFront<br/>TLS 1.2+ / WAF / caching]

    subgraph edge [Public edge - one origin hostname]
        CF -->|SPA objects| S3[S3 static origin<br/>block public ACLs, OAC only]
        CF -->|/api/*| ALB[ALB HTTPS]
    end

    subgraph vpc [VPC]
        subgraph pub [Public subnets]
            ALB
        end
        subgraph priv [Private subnets]
            ECS[ECS Fargate<br/>country-api distroless nonroot]
            RDS[(RDS PostgreSQL<br/>encryption at rest, no public IP)]
            ECS --> RDS
        end
        ECS --> SM[Secrets Manager]
        ECS --> CW[CloudWatch logs / metrics / traces]
    end

    ALB --> ECS
    ECS -->|sync job with timeouts| RC[restcountries.com]

    subgraph ci [Deploy path]
        GHA[GitHub Actions OIDC] --> ECR[ECR immutable tags]
        ECR --> ECS
        GHA --> CF
        GHA --> S3
    end
```

## Legend

- Browser never learns about ECS, RDS, or Docker network names.
- `/api` is same-origin. CORS is not the primary control.
- Secrets never enter the image or the git repo.

## Design notes

- CloudFront + S3 replaces long-running nginx in **production**. nginx remains for **local Compose** with a reverse proxy added.
- ECS Fargate is the default compute. EKS is a Phase 4 revisit, not the opening move.
- Cache `GET /api/countries` at the edge. That is the scalability control for a read-mostly catalog.
- Min 2 Fargate tasks in prod for availability during deploys and host recycling.
