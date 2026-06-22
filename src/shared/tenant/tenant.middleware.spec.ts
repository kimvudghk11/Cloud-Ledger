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

    // next()는 TenantContext.run() 콜백 안에서 호출된다.
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

    // 헤더가 없으면 TenantContext.run()을 건너뛰고 next()를 직접 호출한다.
    // AsyncLocalStorage 컨텍스트가 없으므로 undefined가 반환된다.
    const next: NextFunction = () => {
      expect(TenantContext.getTenantSlug()).toBeUndefined();
      done();
    };

    middleware.use(req, res, next);
  });
});
