import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Tenant } from '../tenant/tenant.entity';

@Module({
  imports: [
    // forRootAsync + useFactory 조합:
    // DI 컨테이너가 ConfigService를 준비한 뒤 useFactory에 주입한다.
    // 덕분에 .env 값을 안전하게 읽어서 TypeORM 옵션을 동적으로 만들 수 있다.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),

        // public 스키마 엔티티만 여기에 등록한다.
        // 테넌트 스키마 엔티티는 TenantDatasourceService가 별도로 관리한다.
        entities: [Tenant],

        // synchronize: false — 절대 true로 바꾸지 말 것.
        // true이면 서버 시작 시 TypeORM이 자동으로 테이블을 ALTER/DROP할 수 있다.
        synchronize: false,

        // 개발 중 실행 SQL을 콘솔에서 확인할 수 있다.
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),
  ],
  // TypeOrmModule을 exports해서 이 모듈을 import하는 곳에서
  // @InjectRepository(Tenant) 등을 사용할 수 있게 한다.
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
