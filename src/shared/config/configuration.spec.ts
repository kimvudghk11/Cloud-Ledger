import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 테스트 간 격리: 각 테스트가 깨끗한 환경변수에서 시작하게 한다.
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('DB_PORT를 숫자로 파싱한다', () => {
    process.env.DB_PORT = '5433';
    const config = configuration();
    expect(config.database.port).toBe(5433);
    // 핵심: 문자열이 아닌 number 타입이어야 한다
    expect(typeof config.database.port).toBe('number');
  });

  it('DB_PORT 미설정 시 기본값 5432를 사용한다', () => {
    delete process.env.DB_PORT;
    const config = configuration();
    expect(config.database.port).toBe(5432);
  });

  it('DB_HOST 미설정 시 기본값 localhost를 사용한다', () => {
    delete process.env.DB_HOST;
    const config = configuration();
    expect(config.database.host).toBe('localhost');
  });
});
