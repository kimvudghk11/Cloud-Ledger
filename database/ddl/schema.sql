-- ============================================================
-- Cloud-Ledger Database Schema
-- ============================================================
-- 변경 시 상단에 날짜 주석 추가, 항상 최신 상태 유지
-- [2026-06-21] 초기 스키마 설계: public.tenants 및 전체 테넌트 스키마 테이블 정의


-- ── PUBLIC SCHEMA (공통 메타 — 모든 테넌트 공유) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  -- schema_name: 이 테넌트의 PostgreSQL 스키마 이름 (예: tenant_acme-corp)
  -- slug와 별도 저장하는 이유: slug가 바뀌어도 실제 데이터가 저장된 스키마 이름은 유지된다.
  schema_name VARCHAR(100) NOT NULL UNIQUE,
  plan_type   VARCHAR(20)  NOT NULL DEFAULT 'FREE',
  status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);


-- ── TENANT SCHEMA (각 tenant_{slug} 스키마에 동일하게 생성) ──────────────────
-- 아래 테이블들은 TenantDatasourceService가 테넌트 스키마를 초기화할 때 생성한다.
-- (Step 6-12에서 각 Context 구현 시 순서대로 추가될 예정)


-- Infrastructure Context ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aws_accounts (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100)  NOT NULL,
  role_arn         VARCHAR(2048) NOT NULL,
  external_id      VARCHAR(256),
  regions          TEXT[]        NOT NULL DEFAULT '{}',
  enabled_services TEXT[]        NOT NULL DEFAULT '{}',
  status           VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS aws_resources (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID          NOT NULL REFERENCES aws_accounts(id),
  service       VARCHAR(50)   NOT NULL,
  region        VARCHAR(50)   NOT NULL,
  resource_id   VARCHAR(512)  NOT NULL,
  resource_name VARCHAR(256),
  tags          JSONB         NOT NULL DEFAULT '{}',
  metadata      JSONB         NOT NULL DEFAULT '{}',
  status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
  discovered_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aws_resources_account_service_region
  ON aws_resources(account_id, service, region);

CREATE INDEX IF NOT EXISTS idx_aws_resources_resource_id
  ON aws_resources(resource_id);

CREATE INDEX IF NOT EXISTS idx_aws_resources_status
  ON aws_resources(status) WHERE deleted_at IS NULL;


-- Billing Context ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cost_records (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID          NOT NULL REFERENCES aws_accounts(id),
  service      VARCHAR(50)   NOT NULL,
  region       VARCHAR(50),
  resource_id  VARCHAR(512),
  period_start DATE          NOT NULL,
  period_end   DATE          NOT NULL,
  amount       NUMERIC(12,4) NOT NULL,
  currency     VARCHAR(10)   NOT NULL DEFAULT 'USD',
  granularity  VARCHAR(10)   NOT NULL,
  raw_data     JSONB         NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_records_account_period_service
  ON cost_records(account_id, period_start, service);

CREATE TABLE IF NOT EXISTS budget_configs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID          NOT NULL REFERENCES aws_accounts(id),
  name            VARCHAR(100)  NOT NULL,
  scope_type      VARCHAR(20)   NOT NULL,
  scope_value     VARCHAR(50),
  limit_amount    NUMERIC(12,4) NOT NULL,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'USD',
  period          VARCHAR(10)   NOT NULL,
  alert_threshold NUMERIC(5,2)  NOT NULL DEFAULT 80.00,
  enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- Alert Context ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_rules (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  type       VARCHAR(30)  NOT NULL,
  conditions JSONB        NOT NULL DEFAULT '{}',
  channels   JSONB        NOT NULL DEFAULT '[]',
  enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id      UUID        NOT NULL REFERENCES alert_rules(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  message      TEXT        NOT NULL,
  status       VARCHAR(20) NOT NULL,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_rule_triggered
  ON alert_history(rule_id, triggered_at DESC);


-- Report Context ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type         VARCHAR(30) NOT NULL,
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'GENERATING',
  file_path    VARCHAR(1024),
  generated_at TIMESTAMPTZ,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
