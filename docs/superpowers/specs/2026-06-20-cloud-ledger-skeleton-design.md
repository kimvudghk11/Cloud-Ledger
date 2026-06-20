# Cloud-Ledger 초기 골격 설계

> **작성일:** 2026-06-20  
> **범위:** 프로젝트 골격 (빈 뼈대) — 실제 기능 구현은 이후 단계  
> **목적:** DDD + CQRS + TypeORM + Schema-per-tenant 학습용 사이드 프로젝트

---

## 1. 프로젝트 개요

AWS 비용 분석 및 알림 SaaS. 여러 테넌트(고객사)가 자신의 AWS 계정을 연결하고, 리소스별 비용을 모니터링하며 예산 초과·미사용 리소스 알림을 받는 서비스.

**학습 목표:**
- DDD Bounded Context 구조 직접 설계·구현
- CQRS (Command/Query 분리) 패턴 체득
- Domain Events를 통한 Context 간 느슨한 결합
- TypeORM Schema-per-tenant 멀티 테넌트 구현
- AWS SDK v3 (AssumeRole 기반 멀티 계정) 연동

---

## 2. 핵심 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| Framework | NestJS | DDD 모듈 구조와 잘 맞음 |
| Language | TypeScript | 타입 안전성 |
| ORM | TypeORM | 회사와 동일, schema-per-tenant 검증됨 |
| DB | PostgreSQL | 스키마 분리, JSONB, 시계열 파티셔닝 지원 |
| 패턴 | CQRS + Domain Events | `@nestjs/cqrs` 활용 |
| 멀티 테넌트 | Schema-per-tenant | 격리 강함, 학습 가치 높음 |
| AWS 연결 | Cross-account IAM AssumeRole | AWS 실무 표준 패턴 |
| CI/CD | GitHub Actions | PR 자동 검증, 배포 자동화 학습 |

---

## 3. DDD Bounded Contexts

### 3-1. Infrastructure Context
AWS 리소스 수집·관리 담당. 테넌트의 AWS 계정을 등록하고 리소스를 Discovery.

**Aggregate Root:** `AwsAccount`  
**Child Entities:** `AwsResource`  
**Domain Events 발행:**
- `AwsAccountRegisteredEvent` — 계정 등록 완료 시
- `AwsResourceUnusedEvent` — 미사용 리소스 감지 시

### 3-2. Billing Context
AWS Cost Explorer API를 통한 비용 수집·분석 담당.

**Aggregate Root:** `BudgetConfig`  
**Entities:** `CostRecord`  
**Domain Events 수신:** `AwsAccountRegisteredEvent` → 비용 수집 초기화

### 3-3. Alert Context
알림 규칙 관리 및 알림 발송 담당 (Slack, Email 등).

**Aggregate Root:** `AlertRule`  
**Entities:** `AlertHistory`  
**Domain Events 수신:**
- `AwsResourceUnusedEvent` → 미사용 리소스 알림
- `BudgetExceededEvent` → 예산 초과 알림

### 3-4. Report Context
주기적 리포트 생성 담당.

**Aggregate Root:** `Report`  
**Domain Events 수신:** 월말 이벤트 → 리포트 생성

---

## 4. 폴더 구조

```
src/
├── contexts/
│   ├── infrastructure/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── aws-account.entity.ts      ← Aggregate Root
│   │   │   │   └── aws-resource.entity.ts     ← Child Entity
│   │   │   ├── value-objects/
│   │   │   │   └── aws-region.vo.ts
│   │   │   ├── events/
│   │   │   │   ├── aws-account-registered.event.ts
│   │   │   │   └── aws-resource-unused.event.ts
│   │   │   └── repositories/
│   │   │       └── aws-account.repository.ts  ← 인터페이스
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   └── register-aws-account.command.ts
│   │   │   ├── queries/
│   │   │   │   └── get-aws-accounts.query.ts
│   │   │   └── handlers/
│   │   │       ├── register-aws-account.handler.ts
│   │   │       └── get-aws-accounts.handler.ts
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   └── typeorm-aws-account.repository.ts  ← 구현체
│   │   │   └── aws/
│   │   │       └── sts.client.ts              ← AssumeRole
│   │   ├── interface/
│   │   │   ├── controllers/
│   │   │   │   └── aws-account.controller.ts
│   │   │   └── dtos/
│   │   │       └── register-aws-account.dto.ts
│   │   └── infrastructure.module.ts
│   │
│   ├── billing/           ← 동일 구조
│   ├── alert/             ← 동일 구조
│   └── report/            ← 동일 구조
│
├── shared/
│   ├── database/
│   │   ├── tenant-datasource.service.ts   ← schema-per-tenant 핵심
│   │   └── database.module.ts
│   ├── tenant/
│   │   ├── tenant.entity.ts
│   │   ├── tenant.middleware.ts           ← 헤더에서 tenantId 추출
│   │   └── tenant.module.ts
│   └── config/
│       └── configuration.ts
│
├── app.module.ts
└── main.ts

database/
└── ddl/
    └── schema.sql         ← 날짜 기록 유지, 항상 최신 상태
```

---

## 5. CQRS 요청 흐름

```
HTTP Request
  └─ Controller (interface/)
       └─ CommandBus.execute(RegisterAwsAccountCommand)
            └─ RegisterAwsAccountHandler (application/handlers/)
                 ├─ AwsAccountRepository.save(account)  ← 인터페이스 호출
                 │    └─ TypeOrmAwsAccountRepository    ← 실제 TypeORM 구현
                 └─ EventBus.publish(AwsAccountRegisteredEvent)
                      ├─ BillingContext: BillingInitHandler
                      └─ AlertContext: DefaultAlertRuleHandler
```

---

## 6. Schema-per-tenant 구조

```
public 스키마 (공통)
  └─ tenants            ← 테넌트 목록
  └─ tenant_schemas     ← 테넌트별 스키마 이름 매핑

tenant_acme 스키마 (테넌트 A)
  └─ aws_accounts
  └─ aws_resources
  └─ cost_records
  └─ ...

tenant_xyz 스키마 (테넌트 B)
  └─ aws_accounts
  └─ ...
```

**TenantDatasourceService 흐름:**
1. 요청 헤더 `x-tenant-id` 추출 (TenantMiddleware)
2. `Map<tenantId, DataSource>` 에서 DataSource 조회
3. 없으면 새 DataSource 생성 (`search_path = tenant_{slug}`)
4. Repository가 해당 DataSource 사용

---

## 7. AWS 계정 연결 (AssumeRole)

테넌트가 자신의 AWS 계정에 IAM Role을 생성하고 Role ARN을 등록.  
서비스는 `sts:AssumeRole`로 해당 계정의 임시 자격증명을 발급받아 사용.

```
AwsAccount 엔티티
  - roleArn: "arn:aws:iam::123456789:role/CloudLedgerRole"
  - externalId: "unique-external-id"     ← confused deputy 공격 방지
  - regions: ["ap-northeast-2", "us-east-1"]
  - enabledServices: ["EC2", "RDS", "S3", "CloudFront", "ACM", "Route53", ...]
```

---

## 8. 환경변수 구조

```env
# PostgreSQL (공통 메타 DB)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=cloud_ledger

# AWS (서비스 자체 계정 — AssumeRole 호출용)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_ROLE_SESSION_NAME=cloud-ledger-session
# ※ AWS_REGION 없음 — 리전은 AwsAccount.regions[] 에서 관리
```

---

## 9. 지원 AWS 서비스 목록 (enabledServices)

```
EC2, RDS, S3, CloudFront, ACM, Route53,
Lambda, ECS, EKS, ElastiCache, DynamoDB,
SQS, SNS, API Gateway, CloudWatch
```

사용자가 계정 등록 시 원하는 서비스만 선택. 미선택 서비스는 수집하지 않음.

---

## 10. 학습 진행 방식

> **이 프로젝트는 코드를 직접 작성하며 학습하는 것이 목적입니다.**

- **Claude는 코드를 대신 작성하지 않습니다** — 예시 코드를 보여주고 설명
- **예시 코드에는 상세 주석 필수** — WHY 중심으로 (왜 이렇게 쓰는지)
- **Step-by-step 진행** — 한 번에 한 개념씩, 작성 완료 확인 후 다음 단계
- **커밋은 직접** — 각 단계 완료 후 직접 git commit
- **DDL 파일은 예외** — `database/ddl/schema.sql`은 참고 문서로 제공

### Step 순서 (골격 기준)
```
Step 1.  NestJS 프로젝트 초기화 (nest new)                        ✅ 완료
Step 2.  패키지 설치 (typeorm, cqrs, config, pg, aws-sdk)         ✅ 완료
Step 3.  환경변수 설정 (.env + ConfigModule)
Step 4.  shared/database — TenantDatasourceService 작성
Step 5.  shared/tenant — Tenant 엔티티 + Middleware 작성
Step 6.  InfrastructureContext domain 레이어 (Entity, VO, Event, Repository 인터페이스)
Step 7.  InfrastructureContext application 레이어 (Command, Query, Handler)
Step 8.  InfrastructureContext infrastructure 레이어 (TypeORM 구현체, STS Client)
Step 9.  InfrastructureContext interface 레이어 (Controller, DTO)
Step 10. BillingContext 골격 (동일 패턴 반복)
Step 11. AlertContext 골격
Step 12. ReportContext 골격
Step 13. AppModule 전체 연결
Step 14. GitHub Actions CI 워크플로우 작성 (lint + type-check + test)
Step 15. GitHub Actions CD 워크플로우 작성 (main 브랜치 push 시 배포)
```

---

## 11. GitHub Actions CI/CD

### CI (Continuous Integration)
PR 생성·업데이트 시 자동 실행. 코드 품질 검증.

```
.github/workflows/ci.yml

트리거: pull_request (main 브랜치 대상)
실행:
  1. lint      — ESLint 검사
  2. type-check — tsc --noEmit
  3. test      — npm run test (단위 테스트)
```

### CD (Continuous Deployment)
main 브랜치에 push(merge) 시 자동 실행.

```
.github/workflows/cd.yml

트리거: push to main
실행:
  1. CI 재실행 (lint + type-check + test)
  2. build    — npm run build
  3. deploy   — 배포 대상은 추후 결정 (EC2, ECS, Railway 등)
```

### 학습 포인트
- `jobs`, `steps`, `uses`, `env`, `secrets` 개념
- `actions/checkout`, `actions/setup-node` 공식 액션 사용법
- GitHub Secrets에 AWS 자격증명 등록 방법
- 워크플로우 캐싱 (`actions/cache`) 으로 npm install 속도 개선

---

## 12. DDL 파일 관리 규칙

- 위치: `database/ddl/schema.sql`
- 스키마 변경 시 상단에 날짜 주석 추가: `-- [YYYY-MM-DD] 변경 내용`
- 항상 현재 최신 상태를 반영
- TypeORM 마이그레이션의 사람이 읽을 수 있는 참고 문서 역할
