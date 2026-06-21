import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * @Entity('tenants) -> 이 클래스가 tenants 테이블에 매핑
 * DatabaseModule에서 public 스키마 DataSource에 이 엔티티를 등록할 것이므로
 * 실제 테이블 위치는 public.tenants가 된다.
 */
@Entity('tenants')
export class Tenant {
  /**
   * uuid PK: 여버 서버, 인스턴스에서 동시에 생성해도 충돌이 없음
   * PostgreSQL의 gen_random_uuid() 함수를 사용
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * URL에 안전한 식별자 "acme-corp", "my-company" 형태
   * 테넌트별 스키마 이름 "tenant_" + slug을 만들 때 이 값을 사용
   */
  @Column({ unique: true, length: 100 })
  slug: string;

  // 한표에 표시하는 이름
  @Column({ length: 255 })
  name: string;

  /**
   * 실제 PostgreSQL 스키마 이름
   * slg와 별도 저장하는 이유:
   * slug가 나중에 바뀌더라도 DB 스키마 이름은 유지
   */
  @Column({ name: 'schema_name', unique: true, length: 100 })
  schemaName: string;

  @Column({ name: 'plan_type', length: 20, default: 'FREE' })
  planType: string;

  @Column({ length: 20, default: 'ACTIVE' })
  status: string;

  // TypeORM이 INSERT 시 자동으로 현재 시각
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // TypeORM이 UPDATE 시 자동으로 현재 시각
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * DeleteDateColumn -> TypeORM soft delete 전용
   * repository.softDelete()를 호출하면 이 컬럼에 시각을 기록하고
   * 이후 find() 쿼리에서 자동으로 제외 (WHERE deleted_at IS NULL)
   */
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
