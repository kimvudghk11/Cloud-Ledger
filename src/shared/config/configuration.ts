/**
 * 왜 이 팔이 필요한가?
 * process.env의 모든 값은 string | undefined 타입
 * DB_PORT는 숫자인데 환경변수로 읽으면 문자열 "5432"가 온다
 * 이 함수가 파싱, 숫자 변환, 기본값 설정을 한 곳에서 담당
 * ConfigModule에 load하면 ConfigService.get<number>('database.port')로
 * 이미 변환된 값을 꺼낼 수 있다.
 */

export default () => ({
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'cloud_ledger',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    roleSessionName:
      process.env.AWS_ROLE_SESSION_NAME ?? 'cloud-ledger-session',
  },
});
