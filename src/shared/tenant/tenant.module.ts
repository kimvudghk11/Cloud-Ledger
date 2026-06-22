import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

// TenantMiddleware는 NestModule 인터페이스를 통해 AppModule의 configure()에서 등록한다.
// 이 모듈은 향후 TenantService(테넌트 생성/조회 API)가 생길 때 providers에 추가한다.
@Module({
  imports: [DatabaseModule],
  providers: [],
  exports: [DatabaseModule],
})
export class TenantModule {}
