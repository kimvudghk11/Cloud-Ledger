# Cloud-Ledger

AWS 비용 분석 및 알림 SaaS — NestJS + DDD + CQRS + PostgreSQL

---

## 프로젝트 소개

여러 테넌트(고객사)가 자신의 AWS 계정을 연결하고, EC2·RDS·S3·CloudFront 등 리소스별 비용을 모니터링하며 예산 초과·미사용 리소스 알림을 받는 SaaS 서비스.

**학습 목표:** DDD · CQRS · TypeORM · Schema-per-tenant · AWS SDK v3 실전 적용

---

## 기술 스택

| 항목 | 기술 |
|---|---|
| Framework | NestJS |
| Language | TypeScript |
| ORM | TypeORM |
| Database | PostgreSQL |
| 패턴 | DDD + CQRS + Domain Events |
| 멀티 테넌트 | Schema-per-tenant |
| AWS 연결 | Cross-account IAM AssumeRole |

---

## DDD Bounded Contexts

```
InfrastructureContext  → AWS 리소스 수집·관리
BillingContext         → 비용 분석 (Cost Explorer)
AlertContext           → 알림 규칙 관리·발송
ReportContext          → 리포트 생성
```

---

## 폴더 구조

```
src/
├── contexts/
│   ├── infrastructure/
│   │   ├── domain/          # Entity, Value Object, Event, Repository 인터페이스
│   │   ├── application/     # Command, Query, Handler
│   │   ├── infrastructure/  # TypeORM 구현체, AWS SDK 클라이언트
│   │   └── interface/       # Controller, DTO
│   ├── billing/
│   ├── alert/
│   └── report/
└── shared/
    ├── database/            # TenantDatasourceService (schema-per-tenant)
    ├── tenant/              # Tenant 엔티티, Middleware
    └── config/

database/
└── ddl/
    └── schema.sql           # 날짜별 이력 관리 DDL 참고 문서
```

---

## 멀티 테넌트 구조

```
public 스키마        → tenants, tenant_schemas (공통 메타)
tenant_acme 스키마   → aws_accounts, aws_resources, cost_records, ...
tenant_xyz 스키마    → aws_accounts, aws_resources, cost_records, ...
```

요청 헤더 `x-tenant-id` → `TenantMiddleware` → `TenantDatasourceService` → 테넌트 스키마 DataSource 반환

---

## AWS 계정 연결 방식

테넌트가 자신의 AWS 계정에 IAM Role을 생성하고 Role ARN을 등록.
서비스는 `sts:AssumeRole`로 임시 자격증명을 발급받아 해당 계정의 리소스에 접근.

지원 서비스: EC2, RDS, S3, CloudFront, ACM, Route53, Lambda, ECS, EKS, ElastiCache, DynamoDB, SQS, SNS, API Gateway, CloudWatch

---

## 시작하기

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env

# 개발 서버 실행
npm run start:dev
```

### 필요한 환경변수 (`.env`)

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=cloud_ledger

# AWS (서비스 자체 계정 — AssumeRole 호출용)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_ROLE_SESSION_NAME=cloud-ledger-session
```

---

## 설계 문서

- [초기 골격 설계](docs/superpowers/specs/2026-06-20-cloud-ledger-skeleton-design.md)
- [DDL 스키마](database/ddl/schema.sql)

---

## 학습 진행 순서

| Step | 내용 | 상태 |
|---|---|---|
| 1 | NestJS 프로젝트 초기화 | ✅ 완료 |
| 2 | 패키지 설치 | ✅ 완료 |
| 3 | 환경변수 설정 (.env + ConfigModule) | |
| 4 | shared/database — TenantDatasourceService | |
| 5 | shared/tenant — Tenant 엔티티 + Middleware | |
| 6 | InfrastructureContext domain 레이어 | |
| 7 | InfrastructureContext application 레이어 | |
| 8 | InfrastructureContext infrastructure 레이어 | |
| 9 | InfrastructureContext interface 레이어 | |
| 10 | BillingContext 골격 | |
| 11 | AlertContext 골격 | |
| 12 | ReportContext 골격 | |
| 13 | AppModule 전체 연결 | |
| 14 | GitHub Actions CI (lint + type-check + test) | |
| 15 | GitHub Actions CD (build + deploy) | |
