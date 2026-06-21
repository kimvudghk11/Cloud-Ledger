# Cloud-Ledger Step 3-5 구현 계획 (공유 인프라 레이어)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 환경변수(ConfigModule), 멀티테넌트 DataSource 캐시(TenantDatasourceService), 요청별 테넌트 식별(TenantMiddleware)을 구현해 공유 인프라 레이어를 완성한다.

**Architecture:** 모든 요청은 `x-tenant-id` 헤더로 테넌트를 식별한다. TenantMiddleware가 헤더를 파싱해 `AsyncLocalStorage`에 저장하고, TenantDatasourceService가 테넌트별 PostgreSQL 스키마에 연결되는 DataSource를 `Map`으로 캐싱·반환한다. 공용 DataSource(public 스키마)는 TypeOrmModule.forRootAsync로 관리하고, 테넌트별 DataSource는 TenantDatasourceService가 직접 생성한다.

**Tech Stack:** NestJS 11, @nestjs/config 4.x, TypeORM 1.x, PostgreSQL (pg), Node.js 내장 `AsyncLocalStorage`

## Global Constraints

- **학습 프로젝트** — Claude는 예시 코드(상세 주석 포함)를 제공하고, 실제 파일 작성은 직접 한다. 예시 코드를 그대로 복붙하지 않는다.
- 각 Task 완료 후 직접 `git commit`
- `database/ddl/schema.sql` 변경 시 파일 최상단에 `-- [YYYY-MM-DD] 변경 내용` 형식의 날짜 주석 추가
- `synchronize: false` — TypeORM의 자동 스키마 변경 절대 사용 금지
- 타입 체크: `npx tsc --noEmit`으로 컴파일 오류 없어야 함

---

### Task 1: .env + ConfigModule 설정 (Step 3)

**📚 배울 개념:**
- `@nestjs/config`의 `ConfigModule.forRoot()`가 `.env`를 읽는 방식
- 타입 안전한 `configuration()` 팩토리 함수가 왜 필요한가 — `process.env`의 모든 값은 `string | undefined`이므로, 숫자 포트 등을 변환·기본값 처리하는 로직을 한 곳에 모은다
- `isGlobal: true`의 의미 — 모든 하위 모듈에서 `ConfigService`를 별도 import 없이 주입 가능

**Files:**
- Create: `.env`
- Create: `.env.example`
- Create: `src/shared/config/configuration.ts`
- Create: `src/shared/config/configuration.spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Produces: `configuration()` → `{ database: { host, port, username, password, database }, aws: { accessKeyId, secretAccessKey, roleSessionName } }` 반환
- Produces: `ConfigModule`이 `AppModule`에 `isGlobal: true`로 등록 → 모든 모듈에서 `ConfigService` 주입 가능

---

- [ ] **Step 1: .gitignore 작성**

루트에 `.gitignore` 파일을 만든다. `.env`가 포함되어 있어야 실제 자격증명이 git에 올라가지 않는다.

```gitignore
# 빌드 아티팩트
/dist
/node_modules

# 환경변수 — 절대 커밋하지 않는다
.env
.env.local
.env.*.local

# 로그
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

- [ ] **Step 2: .env 파일 작성**

루트에 `.env` 파일을 만든다. (`.gitignore`에 의해 git 추적에서 제외된다.)

```ini
# ─── PostgreSQL (공통 메타 DB) ─────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password_here
DB_DATABASE=cloud_ledger

# ─── AWS (서비스 자체 계정 — STS AssumeRole 호출용) ────────────────────────
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_ROLE_SESSION_NAME=cloud-ledger-session
```

- [ ] **Step 3: .env.example 작성**

`.env`의 값을 비운 사본. 이 파일은 git에 커밋한다 (다른 개발자가 어떤 환경변수가 필요한지 알 수 있도록).

```ini
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=cloud_ledger

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_ROLE_SESSION_NAME=cloud-ledger-session
```

- [ ] **Step 4: configuration.ts 예시 코드를 보고 직접 작성**

`src/shared/config/` 폴더를 만들고 `configuration.ts`를 작성한다.

```typescript
// configuration.ts 예시 코드 (직접 보고 작성할 것)
//
// 왜 이 파일이 필요한가?
// process.env의 모든 값은 string | undefined 타입이다.
// DB_PORT는 숫자인데 환경변수로 읽으면 문자열 "5432"가 온다.
// 이 함수가 문자열 파싱, 숫자 변환, 기본값 설정을 한 곳에서 담당한다.
// ConfigModule에 이 함수를 load하면 ConfigService.get('database.port')로
// 이미 변환된 값을 꺼낼 수 있다.

export default () => ({
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    // parseInt: 문자열 "5432"를 숫자 5432로 변환한다. 두 번째 인수 10은 10진수.
    // parseInt 없이 쓰면 TypeORM이 문자열 포트를 받아 연결에 실패할 수 있다.
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'cloud_ledger',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    roleSessionName:
      process.env.AWS_ROLE_SESSION_NAME ?? 'cloud-ledger-session',
  },
});
```

- [ ] **Step 5: configuration.spec.ts 예시 코드를 보고 직접 작성 후 실패 확인**

`src/shared/config/configuration.spec.ts`를 작성한다.

```typescript
// configuration.spec.ts 예시 코드 (직접 보고 작성할 것)
//
// 왜 이 테스트가 필요한가?
// parseInt, ?? 기본값 등 "변환 로직"이 있는 함수는 반드시 테스트한다.
// number 파싱 실수(NaN이 나오는 경우)는 런타임에 잡기 어렵고
// TypeORM 연결 오류로 나타나 디버깅이 힘들다.

import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 테스트마다 깨끗한 env를 사용한다 — 테스트 간 격리.
    // spread로 복사한 뒤 beforeEach에서 교체하고 afterEach에서 원복한다.
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('DB_PORT를 숫자로 파싱한다', () => {
    process.env.DB_PORT = '5433';
    const config = configuration();
    expect(config.database.port).toBe(5433);
    // 핵심: 문자열이 아닌 number 타입이어야 한다
    expect(typeof config.database.port).toBe('number');
  });

  it('DB_PORT 미설정 시 기본값 5432를 사용한다', () => {
    delete process.env.DB_PORT;
    const config = configuration();
    expect(config.database.port).toBe(5432);
  });

  it('DB_HOST 미설정 시 기본값 localhost를 사용한다', () => {
    delete process.env.DB_HOST;
    const config = configuration();
    expect(config.database.host).toBe('localhost');
  });
});
```

실행:
```bash
npm test -- --testPathPattern="configuration"
```
예상 결과: 파일을 작성하기 전이면 FAIL / 작성 후 실행하면 **3 tests passed**

- [ ] **Step 6: AppModule에 ConfigModule 등록**

`src/app.module.ts`를 아래 예시를 보고 수정한다.

```typescript
// app.module.ts 예시 코드 (직접 보고 수정할 것)
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './shared/config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      // isGlobal: true → 이 ConfigModule을 모든 모듈에서 별도 import 없이 사용 가능하게 한다.
      // false이면 DatabaseModule, TenantModule 각각에서 ConfigModule을 import해야 한다.
      isGlobal: true,
      // load: [configuration] → 우리가 만든 팩토리 함수를 사용해 구조화된 설정 객체를 만든다.
      // 이후 ConfigService.get<number>('database.port')처럼 타입 안전하게 꺼낼 수 있다.
      load: [configuration],
      // .env 파일을 자동으로 읽는다.
      // 이미 OS 환경변수가 설정되어 있으면 .env보다 OS 환경변수가 우선한다.
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 7: 타입 체크**

```bash
npx tsc --noEmit
```
오류 없으면:

- [ ] **Step 8: 커밋**

```bash
git add .gitignore .env.example src/shared/config/configuration.ts src/shared/config/configuration.spec.ts src/app.module.ts
git commit -m "feat: ConfigModule 설정 및 타입 안전한 configuration 함수 추가"
```
> `.env`는 커밋하지 않는다 (`.gitignore`에 포함됨을 확인)

---

### Task 2: Tenant 엔티티 + DDL 작성 (Step 5 선행)

**📚 배울 개념:**
- TypeORM 엔티티 데코레이터: `@Entity`, `@PrimaryGeneratedColumn('uuid')`, `@Column`, `@CreateDateColumn`, `@UpdateDateColumn`
- UUID vs 숫자 auto-increment PK: 분산 환경에서 충돌 없는 ID 생성
- `public` 스키마의 역할: 테넌트 공통 메타데이터 저장소 (테넌트 목록 등)
- `schema_name` 컬럼: slug와 DB 스키마 이름을 분리 저장하는 이유 (slug 변경 시 DB 스키마 이름 유지)

**Files:**
- Create: `src/shared/tenant/tenant.entity.ts`
- Create: `database/ddl/schema.sql`

**Interfaces:**
- Produces: `Tenant` 엔티티 클래스 — `id: string`, `slug: string`, `name: string`, `schemaName: string`, `createdAt: Date`, `updatedAt: Date` 필드

---

- [ ] **Step 1: Tenant 엔티티 예시 코드를 보고 직접 작성**

`src/shared/tenant/` 폴더를 만들고 `tenant.entity.ts`를 작성한다.

```typescript
// tenant.entity.ts 예시 코드 (직접 보고 작성할 것)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// @Entity('tenants') → 이 클래스가 'tenants' 테이블에 매핑된다.
// DatabaseModule에서 이 엔티티를 public 스키마 DataSource에 등록할 것이므로
// → public.tenants 테이블이 된다.
@Entity('tenants')
export class Tenant {
  // UUID PK: 여러 서버·인스턴스에서 동시에 생성해도 충돌이 없다.
  // PostgreSQL의 gen_random_uuid() 함수를 사용한다.
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // slug: URL에 안전한 식별자. "acme-corp", "my-company" 형태.
  // 테넌트별 스키마 이름("tenant_" + slug)을 만들 때 이 값을 사용한다.
  @Column({ unique: true, length: 100 })
  slug: string;

  // 사람이 읽을 수 있는 테넌트 이름 (화면 표시용)
  @Column({ length: 255 })
  name: string;

  // schemaName: 이 테넌트의 PostgreSQL 스키마 이름.
  // slug와 별도 컬럼으로 저장하는 이유: slug를 나중에 변경해도
  // DB 스키마 이름(데이터가 실제로 저장된 곳)은 그대로 유지된다.
  @Column({ name: 'schema_name', unique: true, length: 100 })
  schemaName: string;

  // TypeORM이 INSERT 시 자동으로 현재 시각을 채운다.
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // TypeORM이 UPDATE 시 자동으로 현재 시각을 채운다.
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: DDL 파일 작성**

`database/ddl/` 폴더를 만들고 `schema.sql`을 작성한다.

```sql
-- ============================================================
-- Cloud-Ledger Database Schema
-- ============================================================
-- [2026-06-21] 초기 스키마 생성: public.tenants 테이블

-- 설계 원칙:
-- public 스키마: 테넌트 공통 메타데이터 (테넌트 목록, 설정 등)
-- tenant_{slug} 스키마: 각 테넌트의 실제 데이터 (격리 저장)

-- ── public 스키마 (공통) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(100)  NOT NULL UNIQUE,  -- URL 안전한 식별자 (ex: acme-corp)
  name        VARCHAR(255)  NOT NULL,          -- 화면 표시용 이름
  schema_name VARCHAR(100)  NOT NULL UNIQUE,  -- PostgreSQL 스키마 이름 (ex: tenant_acme_corp)
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── 테넌트별 스키마 (동적 생성 — 예시) ──────────────────────────
-- 아래는 TenantDatasourceService.ensureTenantSchema()가 런타임에 실행하는 쿼리다.
-- 실제로는 코드에서 동적으로 생성한다. 참고용으로만 기록한다.

-- CREATE SCHEMA IF NOT EXISTS tenant_acme_corp;
--
-- 향후 각 테넌트 스키마에 추가될 테이블 (Step 6-9에서 구현):
-- aws_accounts, aws_resources, cost_records, alert_rules, alert_history, reports
```

- [ ] **Step 3: 커밋**

```bash
git add src/shared/tenant/tenant.entity.ts database/ddl/schema.sql
git commit -m "feat: Tenant 엔티티 및 DDL 초기 스키마 작성"
```

---

### Task 3: DatabaseModule — 공통 DataSource 등록 (Step 4 전반부)

**📚 배울 개념:**
- `TypeOrmModule.forRoot()` vs `forRootAsync()`: `ConfigService`를 주입받으려면 Async 버전이 필요하다. `useFactory`는 NestJS DI 컨테이너에서 `ConfigService` 인스턴스를 받아 설정 객체를 동적으로 만드는 팩토리 함수다.
- `entities` 배열: 이 DataSource가 관리할 엔티티 목록. public 스키마 엔티티만 여기에 등록한다.
- `synchronize: false`가 운영 환경에서 필수인 이유: `true`이면 서버 시작 시 TypeORM이 엔티티를 보고 자동으로 테이블을 ALTER/DROP할 수 있다.

**Files:**
- Create: `src/shared/database/database.module.ts`

**Interfaces:**
- Consumes: `ConfigModule` (Task 1), `Tenant` 엔티티 (Task 2)
- Produces: `DatabaseModule` — TypeORM public DataSource를 앱에 등록. `TypeOrmModule`을 exports해서 다른 모듈에서 `@InjectRepository(Tenant)` 사용 가능.

---

- [ ] **Step 1: DatabaseModule 예시 코드를 보고 직접 작성**

`src/shared/database/` 폴더를 만들고 `database.module.ts`를 작성한다.

```typescript
// database.module.ts 예시 코드 (직접 보고 작성할 것)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Tenant } from '../tenant/tenant.entity';

@Module({
  imports: [
    // forRootAsync + useFactory 조합:
    // NestJS DI 컨테이너가 ConfigService를 생성한 뒤 useFactory 함수에 주입한다.
    // 덕분에 .env 값을 안전하게 읽어서 TypeORM 옵션을 만들 수 있다.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // useFactory에서 ConfigService를 쓰기 위해 필요
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),

        // public 스키마 엔티티만 등록한다.
        // 각 테넌트 스키마의 엔티티는 TenantDatasourceService가 별도로 관리한다.
        entities: [Tenant],

        // synchronize: false — 절대 true로 바꾸지 말 것.
        // true이면 서버 시작 시 TypeORM이 엔티티를 보고 자동으로 테이블을 수정한다.
        // 운영 DB에서 컬럼 삭제, 타입 변경이 실수로 적용될 수 있다.
        synchronize: false,

        // 개발 중 실행되는 SQL을 콘솔에서 확인할 수 있다.
        // 운영 환경에서는 false로 변경한다.
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),
  ],
  // TypeOrmModule을 exports해서 DatabaseModule을 import하는 모듈들이
  // @InjectRepository(), getRepository() 등을 사용할 수 있게 한다.
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```
오류 없으면:

- [ ] **Step 3: 커밋**

```bash
git add src/shared/database/database.module.ts
git commit -m "feat: DatabaseModule - public 스키마 TypeORM 연결 설정"
```

---

### Task 4: TenantDatasourceService — 테넌트별 DataSource 캐시 (Step 4 후반부)

**📚 배울 개념:**
- TypeORM `DataSource`를 코드로 직접 생성하는 방법 (`new DataSource(options)`)
- `schema` 옵션: 이 DataSource로 실행하는 모든 쿼리가 해당 스키마를 바라본다 (PostgreSQL `search_path` 효과)
- `Map<string, DataSource>` 캐싱: 테넌트마다 매번 새 DataSource를 만들면 DB 연결 수 한도를 빠르게 소모한다. 한 번 만든 것을 재사용한다.
- `OnModuleDestroy` 훅: NestJS 앱 종료 시 열린 DataSource를 모두 닫아서 연결 누수를 방지한다.
- `private createDataSource()` 분리 이유: 테스트에서 DB 연결 부분만 mock하고, 캐싱 로직은 실제로 실행할 수 있다.

**Files:**
- Create: `src/shared/database/tenant-datasource.service.spec.ts`
- Create: `src/shared/database/tenant-datasource.service.ts`
- Modify: `src/shared/database/database.module.ts`

**Interfaces:**
- Consumes: `ConfigService`
- Produces: `TenantDatasourceService.getDataSource(tenantSlug: string): Promise<DataSource>`
- Produces: `TenantDatasourceService.initializeTenantSchema(tenantSlug: string): Promise<void>` (미래 테넌트 온보딩 API용)

---

- [ ] **Step 1: 단위 테스트 먼저 작성**

`src/shared/database/tenant-datasource.service.spec.ts`를 아래 예시를 보고 직접 작성한다.

```typescript
// tenant-datasource.service.spec.ts 예시 코드 (직접 보고 작성할 것)
//
// 무엇을 테스트하는가?
// 실제 DB 연결 없이 캐싱 로직만 검증한다.
// DataSource를 mock으로 대체해서 "같은 slug로 두 번 요청하면 캐시에서 반환하는지"를 확인.

import { TenantDatasourceService } from './tenant-datasource.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const mockConfigService = {
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      'database.host': 'localhost',
      'database.port': 5432,
      'database.username': 'postgres',
      'database.password': 'test',
      'database.database': 'cloud_ledger',
    };
    return map[key];
  }),
} as unknown as ConfigService;

const makeMockDataSource = () =>
  ({
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
    destroy: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
  }) as unknown as DataSource;

describe('TenantDatasourceService', () => {
  let service: TenantDatasourceService;
  let mockDs: DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantDatasourceService(mockConfigService);
    mockDs = makeMockDataSource();
    // private 메서드 mock: 실제 new DataSource()를 호출하면 DB 연결을 시도하기 때문에
    // 이 부분만 가짜로 교체한다. 캐싱 로직은 실제로 실행된다.
    jest.spyOn(service as any, 'createDataSource').mockReturnValue(mockDs);
  });

  it('같은 tenantSlug로 두 번 요청하면 DataSource를 한 번만 생성한다', async () => {
    const ds1 = await service.getDataSource('acme');
    const ds2 = await service.getDataSource('acme');
    // 참조가 동일한 객체여야 한다 (캐시 히트)
    expect(ds1).toBe(ds2);
    expect(mockDs.initialize).toHaveBeenCalledTimes(1);
  });

  it('다른 tenantSlug는 다른 DataSource를 반환한다', async () => {
    const mockDs2 = makeMockDataSource();
    let callCount = 0;
    jest
      .spyOn(service as any, 'createDataSource')
      .mockImplementation(() => (callCount++ === 0 ? mockDs : mockDs2));

    const ds1 = await service.getDataSource('acme');
    const ds2 = await service.getDataSource('xyz');
    expect(ds1).not.toBe(ds2);
  });

  it('onModuleDestroy 호출 시 모든 DataSource를 닫는다', async () => {
    await service.getDataSource('acme');
    await service.onModuleDestroy();
    expect(mockDs.destroy).toHaveBeenCalledTimes(1);
  });
});
```

실행:
```bash
npm test -- --testPathPattern="tenant-datasource"
```
예상 결과: **FAIL** — 아직 구현 파일이 없으므로 import 오류 발생. 이것이 TDD의 Red 단계.

- [ ] **Step 2: TenantDatasourceService 구현 예시를 보고 직접 작성**

`src/shared/database/tenant-datasource.service.ts`를 작성한다.

```typescript
// tenant-datasource.service.ts 예시 코드 (직접 보고 작성할 것)
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

@Injectable()
// OnModuleDestroy: NestJS 앱 종료 시 자동으로 onModuleDestroy()를 호출한다.
// 이 훅 없이 프로세스가 끝나면 DataSource들이 정리되지 않아 DB 연결이 누수된다.
export class TenantDatasourceService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatasourceService.name);

  // 핵심 캐시: tenantSlug → DataSource 매핑.
  // getDataSource()가 호출될 때마다 새 연결을 만들면 PostgreSQL의
  // max_connections 한도(기본 100)를 빠르게 소모한다.
  private readonly dataSources = new Map<string, DataSource>();

  constructor(private readonly config: ConfigService) {}

  async getDataSource(tenantSlug: string): Promise<DataSource> {
    // 캐시 히트: 이미 연결된 DataSource가 있으면 즉시 반환
    if (this.dataSources.has(tenantSlug)) {
      return this.dataSources.get(tenantSlug)!;
    }

    // 캐시 미스: 새 DataSource를 생성하고 초기화한다
    this.logger.log(`Creating DataSource for tenant: ${tenantSlug}`);
    const dataSource = this.createDataSource(tenantSlug);
    await dataSource.initialize(); // 실제 DB 연결 수립

    // 스키마가 없으면 생성한다 (테넌트 첫 접속 시)
    await this.ensureTenantSchema(dataSource, tenantSlug);

    this.dataSources.set(tenantSlug, dataSource);
    return dataSource;
  }

  // private으로 분리한 이유:
  // 테스트에서 jest.spyOn(service, 'createDataSource')으로 이 메서드만 mock할 수 있다.
  // 덕분에 실제 DB 연결 없이 캐싱 로직(getDataSource)을 독립적으로 테스트 가능하다.
  private createDataSource(tenantSlug: string): DataSource {
    const schemaName = `tenant_${tenantSlug}`;

    const options: DataSourceOptions = {
      type: 'postgres',
      host: this.config.get<string>('database.host'),
      port: this.config.get<number>('database.port'),
      username: this.config.get<string>('database.username'),
      password: this.config.get<string>('database.password'),
      database: this.config.get<string>('database.database'),

      // schema 옵션: 이 DataSource로 실행하는 모든 쿼리가 이 스키마를 바라본다.
      // PostgreSQL의 search_path 설정과 동일한 효과.
      // "SELECT * FROM aws_accounts"는 실제로 "tenant_acme.aws_accounts"를 읽는다.
      schema: schemaName,

      // 테넌트 스키마 엔티티는 Step 6-9에서 추가될 예정이다.
      entities: [],
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    };

    return new DataSource(options);
  }

  // 테넌트 스키마가 없으면 생성한다.
  // "IF NOT EXISTS"가 멱등성을 보장한다: 이미 있어도 에러가 나지 않는다.
  private async ensureTenantSchema(
    dataSource: DataSource,
    tenantSlug: string,
  ): Promise<void> {
    const schemaName = `tenant_${tenantSlug}`;
    // 스키마 생성은 TypeORM ORM 레이어가 아닌 DDL 영역이므로 raw SQL을 쓴다.
    // 따옴표("")로 감싸는 이유: 스키마 이름이 예약어와 충돌할 경우를 방지
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    this.logger.log(`Schema ready: ${schemaName}`);
  }

  async onModuleDestroy(): Promise<void> {
    const closePromises = Array.from(this.dataSources.values())
      .filter((ds) => ds.isInitialized)
      .map((ds) => ds.destroy());
    await Promise.all(closePromises);
    this.logger.log('All tenant DataSources closed');
  }
}
```

- [ ] **Step 3: 테스트 재실행 — Green 확인**

```bash
npm test -- --testPathPattern="tenant-datasource"
```
예상 결과: **3 tests passed**

- [ ] **Step 4: DatabaseModule에 TenantDatasourceService 추가**

`src/shared/database/database.module.ts`를 수정한다. 기존 TypeOrmModule.forRootAsync 설정은 그대로 두고 providers, exports만 추가한다.

```typescript
// 추가할 import
import { TenantDatasourceService } from './tenant-datasource.service';

// @Module() 데코레이터 수정 예시:
@Module({
  imports: [
    TypeOrmModule.forRootAsync({ /* 기존 내용 그대로 유지 */ }),
  ],
  // providers: NestJS DI 컨테이너에 이 클래스를 등록한다.
  // 등록되어야 다른 모듈에서 주입받을 수 있다.
  providers: [TenantDatasourceService],
  exports: [TypeOrmModule, TenantDatasourceService],
})
export class DatabaseModule {}
```

- [ ] **Step 5: 전체 테스트 실행**

```bash
npm test
```
예상 결과: 모든 기존 테스트 포함 **통과**

- [ ] **Step 6: 커밋**

```bash
git add src/shared/database/tenant-datasource.service.ts src/shared/database/tenant-datasource.service.spec.ts src/shared/database/database.module.ts
git commit -m "feat: TenantDatasourceService - 테넌트별 DataSource 캐싱 구현"
```

---

### Task 5: TenantContext + TenantMiddleware + TenantModule (Step 5)

**📚 배울 개념:**
- **NestJS 미들웨어 vs Guard vs Interceptor**: 미들웨어는 Express 레벨 — 가장 먼저 실행되며 인증·컨텍스트 추출에 적합하다. Guard는 인증/인가, Interceptor는 응답 변환/로깅에 쓴다.
- **`AsyncLocalStorage`**: Node.js 내장 기능. `async/await`를 거치는 비동기 콜체인 전체에서 값을 유지하는 "요청별 컨텍스트 저장소"다. request 객체에 직접 값을 붙이면 TypeScript 타입 확장이 필요하지만, AsyncLocalStorage는 그런 설정 없이 어디서든 접근 가능하다.
- **`TenantContext.run()`**: 미들웨어가 요청 처리를 `run()` 안에서 시작하면, 이후 모든 비동기 작업(핸들러, 서비스, 리포지토리)이 같은 저장소를 공유한다.

**Files:**
- Create: `src/shared/tenant/tenant.context.ts`
- Create: `src/shared/tenant/tenant.middleware.spec.ts`
- Create: `src/shared/tenant/tenant.middleware.ts`
- Create: `src/shared/tenant/tenant.module.ts`

**Interfaces:**
- Produces: `TenantContext.run(tenantSlug: string, callback: () => void): void`
- Produces: `TenantContext.getTenantSlug(): string | undefined`
- Produces: `TenantMiddleware` — NestJS 미들웨어, AppModule의 `configure()`에서 등록
- Produces: `TenantModule` — DatabaseModule을 포함하는 공유 모듈

---

- [ ] **Step 1: TenantContext 예시 코드를 보고 직접 작성**

`src/shared/tenant/tenant.context.ts`를 작성한다.

```typescript
// tenant.context.ts 예시 코드 (직접 보고 작성할 것)
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage 이해하기:
// 일반 변수: 함수 호출이 끝나면 사라진다.
// AsyncLocalStorage: 요청이 완전히 끝날 때까지 비동기 체인 전체에서 살아있다.
//
// 동작 원리: Node.js가 비동기 작업(Promise, setTimeout, I/O)을 추적해
// "어떤 AsyncLocalStorage.run() 안에서 시작된 작업인지"를 자동으로 연결한다.
// 덕분에 미들웨어에서 한 번 설정하면 핸들러, 서비스, 리포지토리 어디서든 꺼낼 수 있다.

interface TenantStore {
  tenantSlug: string;
}

// 앱 전체에서 하나의 AsyncLocalStorage 인스턴스를 공유한다.
// NestJS 모듈 밖에서도 접근할 수 있도록 모듈 레벨 상수로 선언한다.
const asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  // 미들웨어에서 호출: 이 콜백이 실행되는 동안 tenantSlug가 저장소에 살아있다.
  // callback 안에서 next()를 호출하면 요청 처리 전체가 이 컨텍스트 안에서 실행된다.
  run: (tenantSlug: string, callback: () => void): void => {
    asyncLocalStorage.run({ tenantSlug }, callback);
  },

  // 핸들러, 서비스, 리포지토리 어디서든 현재 요청의 tenantSlug를 꺼낼 수 있다.
  // run() 컨텍스트 밖(미들웨어가 설정하지 않은 경우)에서 호출하면 undefined를 반환한다.
  getTenantSlug: (): string | undefined => {
    return asyncLocalStorage.getStore()?.tenantSlug;
  },
};
```

- [ ] **Step 2: TenantMiddleware 테스트 먼저 작성**

`src/shared/tenant/tenant.middleware.spec.ts`를 작성한다.

```typescript
// tenant.middleware.spec.ts 예시 코드 (직접 보고 작성할 것)
import { TenantMiddleware } from './tenant.middleware';
import { TenantContext } from './tenant.context';
import { Request, Response, NextFunction } from 'express';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;

  beforeEach(() => {
    middleware = new TenantMiddleware();
  });

  it('x-tenant-id 헤더에서 tenantSlug를 추출해 TenantContext에 설정한다', (done) => {
    const req = {
      headers: { 'x-tenant-id': 'acme-corp' },
    } as unknown as Request;
    const res = {} as Response;

    // next()는 AsyncLocalStorage.run() 콜백 안에서 호출된다.
    // 그러므로 next() 내부에서 getTenantSlug()를 호출하면 값이 있어야 한다.
    const next: NextFunction = () => {
      expect(TenantContext.getTenantSlug()).toBe('acme-corp');
      done();
    };

    middleware.use(req, res, next);
  });

  it('x-tenant-id 헤더가 없으면 next()는 호출하되 tenantSlug는 undefined다', (done) => {
    const req = { headers: {} } as unknown as Request;
    const res = {} as Response;

    // 헤더 없으면 TenantContext.run()을 건너뛰고 next()를 직접 호출한다.
    // 그러므로 AsyncLocalStorage 컨텍스트가 없어 undefined가 반환된다.
    const next: NextFunction = () => {
      expect(TenantContext.getTenantSlug()).toBeUndefined();
      done();
    };

    middleware.use(req, res, next);
  });
});
```

실행:
```bash
npm test -- --testPathPattern="tenant.middleware"
```
예상 결과: **FAIL** — 구현 파일이 없으므로 import 오류 발생. Red 단계.

- [ ] **Step 3: TenantMiddleware 구현 예시를 보고 직접 작성**

`src/shared/tenant/tenant.middleware.ts`를 작성한다.

```typescript
// tenant.middleware.ts 예시 코드 (직접 보고 작성할 것)
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContext } from './tenant.context';

// NestMiddleware 인터페이스를 구현하면 NestJS가 이 클래스를 미들웨어로 인식한다.
// AppModule의 configure()에서 이 미들웨어를 경로에 등록해야 활성화된다.
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // x-tenant-id 헤더에서 테넌트 식별자를 읽는다.
    // "x-" 접두사는 비표준 커스텀 헤더 규약이다.
    // 클라이언트 요청 예시: curl -H "x-tenant-id: acme-corp" http://localhost:3000/...
    const tenantSlug = req.headers['x-tenant-id'] as string | undefined;

    if (tenantSlug) {
      // TenantContext.run() 안에서 next()를 호출한다.
      // 이 콜백이 시작되는 순간부터 요청 처리가 끝날 때까지
      // 어디서든 TenantContext.getTenantSlug()로 값을 꺼낼 수 있다.
      TenantContext.run(tenantSlug, () => next());
    } else {
      // 테넌트 헤더가 없어도 요청은 계속 처리한다.
      // 누가 이 엔드포인트에 접근 가능한지는 Guard의 역할이다.
      // 미들웨어는 컨텍스트 설정만 담당한다.
      next();
    }
  }
}
```

- [ ] **Step 4: 테스트 재실행 — Green 확인**

```bash
npm test -- --testPathPattern="tenant.middleware"
```
예상 결과: **2 tests passed**

- [ ] **Step 5: TenantModule 예시 코드를 보고 직접 작성**

`src/shared/tenant/tenant.module.ts`를 작성한다.

```typescript
// tenant.module.ts 예시 코드 (직접 보고 작성할 것)
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

// TenantModule: 테넌트 관련 공유 기능을 묶는 모듈.
// 미들웨어(TenantMiddleware)는 NestModule 인터페이스를 통해 AppModule에서 등록한다.
// 이 모듈은 향후 TenantService(테넌트 생성/조회 API)가 생길 때 여기에 추가한다.
@Module({
  imports: [
    // DatabaseModule을 포함해서 TenantDatasourceService가
    // 이 모듈을 import하는 곳에서 주입 가능하도록 한다.
    DatabaseModule,
  ],
  providers: [],
  exports: [DatabaseModule],
})
export class TenantModule {}
```

- [ ] **Step 6: 커밋**

```bash
git add src/shared/tenant/tenant.context.ts src/shared/tenant/tenant.middleware.ts src/shared/tenant/tenant.middleware.spec.ts src/shared/tenant/tenant.module.ts
git commit -m "feat: TenantContext(AsyncLocalStorage), TenantMiddleware, TenantModule 구현"
```

---

### Task 6: AppModule 전체 연결 + 통합 확인

**📚 배울 개념:**
- `NestModule` 인터페이스 + `configure(consumer)`: 모듈 레벨에서 미들웨어를 특정 경로에 적용하는 방법
- `MiddlewareConsumer.apply().forRoutes('*path')`: 모든 경로에 미들웨어를 적용한다 (NestJS 11 / Express 5 와일드카드 문법)

**Files:**
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `ConfigModule` (Task 1), `DatabaseModule` (Task 3-4), `TenantModule` (Task 5), `TenantMiddleware` (Task 5)
- Produces: 실행 가능한 서버 (DB 없이도 부팅 가능, DB 쿼리는 PostgreSQL 연결 필요)

---

- [ ] **Step 1: AppModule 수정 예시를 보고 직접 작성**

`src/app.module.ts`를 수정한다.

```typescript
// app.module.ts 최종 버전 예시 코드 (직접 보고 작성할 것)
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './shared/config/configuration';
import { DatabaseModule } from './shared/database/database.module';
import { TenantModule } from './shared/tenant/tenant.module';
import { TenantMiddleware } from './shared/tenant/tenant.middleware';

// NestModule 인터페이스를 implement하면 configure() 메서드를 정의할 수 있다.
// configure()는 NestJS 앱 초기화 시 자동으로 호출되어 미들웨어를 경로에 등록한다.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    DatabaseModule,
    TenantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      // '*path'는 NestJS 11(Express 5) 방식의 와일드카드: 모든 경로에 적용.
      // 특정 경로만 적용하려면 forRoutes('aws-accounts')처럼 지정한다.
      .forRoutes('*path');
  }
}
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
npm test
```
예상 결과: **모든 테스트 통과** (configuration.spec, tenant.middleware.spec, tenant-datasource.service.spec, app.controller.spec)

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```
오류 없어야 한다.

- [ ] **Step 4: 최종 커밋**

```bash
git add src/app.module.ts
git commit -m "feat: AppModule - DatabaseModule, TenantModule, TenantMiddleware 전체 연결"
```

---

## 완료 기준 체크리스트

Step 3-5 완료 시 다음이 모두 충족되어야 한다:

- [ ] `npm test` 전체 통과
- [ ] `npx tsc --noEmit` 오류 없음
- [ ] `.env`가 git에 포함되지 않음 (`.gitignore` 확인)
- [ ] `database/ddl/schema.sql` 날짜 주석 포함
- [ ] 4개의 git commit (Task 1-4 각각)

다음 단계: **Step 6 — InfrastructureContext domain 레이어** (AwsAccount Aggregate Root, VO, Domain Events, Repository 인터페이스)
