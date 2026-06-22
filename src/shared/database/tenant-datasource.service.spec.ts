import { TenantDatasourceService } from './tenant-datasource.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

// 실제 DB 연결 없이 ConfigService를 흉내내는 mock
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

// initialize/destroy/query를 가짜로 교체한 DataSource mock 팩토리
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
    // private createDataSource()만 mock으로 교체 — 캐싱 로직은 실제로 실행된다
    jest.spyOn(service as any, 'createDataSource').mockReturnValue(mockDs);
  });

  it('같은 tenantSlug로 두 번 요청하면 DataSource를 한 번만 생성한다', async () => {
    const ds1 = await service.getDataSource('acme');
    const ds2 = await service.getDataSource('acme');

    // 같은 참조여야 한다 (캐시 히트)
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
