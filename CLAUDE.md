# ForkFiction (포크픽션)
포크할 수 있는 소설 플랫폼. 기획은 docs/PLAN.md가 기준이다. 기획과 다르게 해야 하면 먼저 물어볼 것.

@AGENTS.md

## 스택
- Next.js App Router + TypeScript(strict), Tailwind, shadcn/ui
- Supabase(Postgres, Auth Google, RLS). 클라이언트는 @supabase/ssr
- 테스트: Vitest(단위), Playwright(흐름)

## 명령어
- npm run dev / npm run build / npm test / npx playwright test
- npm run test:db — .env.local의 Supabase 프로젝트에 임시 사용자를 만들어 RLS·DB 함수를 검사하고 지운다(원격 DB를 쓴다)
- npm run seed:kalui -- --handle=<필명> [--dry-run] — 『칼의 여행』 개발용 시드. 운영 데이터에는 넣지 않는다
- DB 변경은 항상 supabase/migrations/의 새 마이그레이션 파일로. 대시보드에서 직접 고치지 않는다.

## 꼭 지킬 규칙
- revisions는 쌓기만 한다. 수정·삭제 코드를 만들지 않는다.
- 갈래 생성은 fork_work() DB 함수로만 한다.
- 새 갈래 알림은 갈래를 만들 때가 아니라 처음 공개될 때 원작자에게 보낸다. (현재 fork_work 안의 알림은 4단계 공개 기능에서 옮긴다. PLAN.md '2단계에서 다음 단계로 넘긴 일' 참고)
- is_canon은 뿌리 원작자만 set_canon()으로 바꾼다.
- 계보 표기는 어떤 화면에서도 숨기거나 지울 수 없다.
- 사용자 MD는 반드시 rehype-sanitize를 거쳐 렌더링한다.
- service role 키는 서버 코드에서만 쓴다.
- 광고는 AdSlot 컴포넌트로만 넣는다. 작업실·비교·올리기·로그인·관리자 화면에는 넣지 않는다.
- 장르 구분은 만들지 않는다.
- 화면 문구는 한국어. 용어: 원작, 갈래, 갈림점, 계보, 갈래 지도, 정사, 별

## 일하는 방식
- 큰 작업은 계획부터 보여주고 승인받는다.
- 규칙이 있는 로직(장 분할, 포크, 갈래 지도 배치)은 테스트를 먼저 쓴다.
- 끝나면 npm run build와 npm test를 돌리고 결과를 알려준다. DB를 바꿨으면 npm run test:db도 돌린다.
