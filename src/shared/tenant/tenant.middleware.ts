import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContext } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // "x-" 접두사는 비표준 커스텀 헤더 규약이다.
    // 예: curl -H "x-tenant-id: acme-corp" http://localhost:3000/...
    const tenantSlug = req.headers['x-tenant-id'] as string | undefined;

    if (tenantSlug) {
      // run() 안에서 next()를 호출 → 이후 모든 비동기 체인에서 tenantSlug 접근 가능
      TenantContext.run(tenantSlug, () => next());
    } else {
      // 헤더 없어도 요청은 계속 처리한다.
      // 접근 제어는 Guard의 역할이고, 미들웨어는 컨텍스트 설정만 담당한다.
      next();
    }
  }
}
