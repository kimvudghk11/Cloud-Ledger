import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

@Injectable()
// OnModuleDestroy: NestJS 앱 종료 시 자동으로 onModuleDestroy()를 호출한다.
// 이 훅 없이 프로세스가 끝나면 열린 DataSource들이 정리되지 않아 DB 연결이 누수된다.
export class TenantDatasourceService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatasourceService.name);

  // tenantSlug → DataSource 캐시.
  // 매 요청마다 새 DataSource를 만들면 PostgreSQL max_connections(기본 100)를 빠르게 소모한다.
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
    await dataSource.initialize();

    await this.ensureTenantSchema(dataSource, tenantSlug);

    this.dataSources.set(tenantSlug, dataSource);
    return dataSource;
  }

  // private으로 분리한 이유:
  // 테스트에서 jest.spyOn(service, 'createDataSource')으로 이 메서드만 mock할 수 있다.
  // 덕분에 실제 DB 연결 없이 캐싱 로직만 독립적으로 테스트 가능하다.
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
      // "SELECT * FROM aws_accounts"는 실제로 "tenant_acme.aws_accounts"를 읽는다.
      schema: schemaName,

      // 테넌트 스키마 엔티티는 이후 Task에서 추가된다.
      entities: [],
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    };

    return new DataSource(options);
  }

  // 스키마가 없으면 생성한다.
  // IF NOT EXISTS가 멱등성을 보장한다: 이미 있어도 에러가 나지 않는다.
  private async ensureTenantSchema(
    dataSource: DataSource,
    tenantSlug: string,
  ): Promise<void> {
    const schemaName = `tenant_${tenantSlug}`;
    // 따옴표("")로 감싸는 이유: 스키마 이름이 SQL 예약어와 충돌할 경우를 방지한다.
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
