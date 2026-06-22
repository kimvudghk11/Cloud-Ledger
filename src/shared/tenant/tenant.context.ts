import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage 이해하기:
// 일반 변수는 함수 호출이 끝나면 사라진다.
// AsyncLocalStorage는 run() 안에서 시작된 비동기 체인 전체(핸들러, 서비스, 리포지토리)에서
// Node.js가 자동으로 컨텍스트를 연결해 주기 때문에 어디서든 꺼낼 수 있다.

interface TenantStore {
  tenantSlug: string;
}

// 앱 전체에서 하나의 인스턴스를 공유한다.
// NestJS 모듈 DI 밖에서도 접근할 수 있도록 모듈 레벨 상수로 선언한다.
const asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  // 미들웨어에서 호출: 이 콜백이 실행되는 동안 tenantSlug가 저장소에 살아있다.
  // callback 안에서 next()를 호출하면 요청 처리 전체가 이 컨텍스트 안에서 실행된다.
  run: (tenantSlug: string, callback: () => void): void => {
    asyncLocalStorage.run({ tenantSlug }, callback);
  },

  // run() 컨텍스트 밖에서 호출하면 undefined를 반환한다.
  getTenantSlug: (): string | undefined => {
    return asyncLocalStorage.getStore()?.tenantSlug;
  },
};
