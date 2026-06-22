import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

@Injectable()
export class TenantDatasourceService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatasourceService.name);

  // DataSource 대신 Promise<DataSource>를 캐싱한다.
  // 이유: 동시에 같은 tenantSlug로 요청이 들어와도 Promise를 즉시 저장하므로
  // 두 번째 요청은 같은 Promise를 await한다 → initialize()가 딱 1번만 실행된다.
  private readonly datasourcePromises = new Map<string, Promise<DataSource>>();

  constructor(private readonly config: ConfigService) {}

  async getDataSource(tenantSlug: string): Promise<DataSource> {
    if (!this.datasourcePromises.has(tenantSlug)) {
      // Promise를 동기적으로 즉시 저장 → 이후 동시 요청은 캐시 히트
      this.datasourcePromises.set(tenantSlug, this.initDataSource(tenantSlug));
    }
    return this.datasourcePromises.get(tenantSlug)!;
  }

  private async initDataSource(tenantSlug: string): Promise<DataSource> {
    this.logger.log(`Creating DataSource for tenant: ${tenantSlug}`);
    const dataSource = this.createDataSource(tenantSlug);
    await dataSource.initialize();
    await this.ensureTenantSchema(dataSource, tenantSlug);
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

      entities: [],
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    };

    return new DataSource(options);
  }

  private async ensureTenantSchema(
    dataSource: DataSource,
    tenantSlug: string,
  ): Promise<void> {
    const schemaName = `tenant_${tenantSlug}`;
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    this.logger.log(`Schema ready: ${schemaName}`);
  }

  async onModuleDestroy(): Promise<void> {
    // allSettled: 초기화 중 실패한 Promise가 있어도 나머지를 계속 정리한다
    const results = await Promise.allSettled(this.datasourcePromises.values());
    const closePromises = results
      .filter(
        (r): r is PromiseFulfilledResult<DataSource> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value)
      .filter((ds) => ds.isInitialized)
      .map((ds) => ds.destroy());
    await Promise.all(closePromises);
    this.logger.log('All tenant DataSources closed');
  }
}
