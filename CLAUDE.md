# ForkFiction (포크픽션)
포크할 수 있는 소설 플랫폼. 기획은 docs/PLAN.md가 기준이다. 기획과 다르게 해야 하면 먼저 물어볼 것.

@AGENTS.md

## 스택
- Next.js App Router + TypeScript(strict), Tailwind, shadcn/ui
- Supabase(Postgres, Auth Google, RLS). 클라이언트는 @supabase/ssr
- 테스트: Vitest(단위), Playwright(흐름)

## 명령어
- npm run dev / npm run build / npm test
- npx playwright test — 흐름·모바일 375px 테스트. 운영 빌드를 3100번에 띄우고 .env.local의 Supabase를 쓴다. 로그인은 @forkfiction.test 임시 사용자의 쿠키를 직접 넣는 방식이고(tests/e2e/support.ts) 끝나면 지운다. 앱에 테스트용 로그인 경로를 만들지 않는다
- npm run test:db — .env.local의 Supabase 프로젝트에 임시 사용자를 만들어 RLS·DB 함수를 검사하고 지운다(원격 DB를 쓴다)
- npm run seed:kalui -- --handle=<필명> [--dry-run] — 『칼의 여행』 개발용 시드. 운영 데이터에는 넣지 않는다
- npm run seed:forks [-- --reset] — 시드 사용자(seed-*@forkfiction.test)가 "[개발용] 시드 원작"(dev-seed-original)과 갈래 5개를 만든다. 실제 작품·사용자에는 손대지 않는다. --reset은 시드 사용자와 그 작품·수정본을 지운다
- npm run admin:set -- --handle=<필명> [--off] — 관리자(profiles.is_admin) 켜고 끄기. service role로 바꾼다
- DB 변경은 항상 supabase/migrations/의 새 마이그레이션 파일로. 대시보드에서 직접 고치지 않는다.

## 꼭 지킬 규칙
- revisions는 쌓기만 한다. 수정·삭제 코드를 만들지 않는다. 예외: tests/db 정리와 seed:forks --reset은 service role로 테스트·시드 사용자(@forkfiction.test) 범위의 수정본만 지운다.
- 갈래 생성은 fork_work() DB 함수로만 한다.
- 새 갈래 알림은 갈래를 만들 때가 아니라 처음 공개될 때 원작자에게 보낸다(works_notify_fork_published 트리거).
- 장과 수정본은 DB 함수(save_chapter, revert_chapter, add_chapter, delete_chapter, move_chapter)로만 바꾼다. 직접 insert/update/delete 권한은 없다.
- is_canon은 뿌리 원작자만 set_canon()으로 바꾼다.
- star_count·fork_count는 트리거가 유지한다. fork_count는 공개된 직접 갈래 수다.
- 숨김·복구는 admin_hide_work()·admin_restore_work()로만 한다. 복구는 숨기기 직전 상태(hidden_from)로 돌린다.
- 계보는 숨겨진 조상을 지우지 않고 제목·작가 없이 '숨겨진 작품'으로만 보여 준다(work_lineage).
- reports는 관리자만 읽는다. 신고자를 작가나 다른 사용자에게 보여 주지 않는다.
- 가입은 구글로만. 이메일·전화·익명 가입은 auth.users 트리거(forkfiction_signup_guard)가 @forkfiction.test 말고는 막는다.
- 없는 프로필·작품·장은 proxy(src/lib/supabase/proxy.ts, src/lib/route-check.ts)가 미리 걸러 HTTP 404를 낸다. 새 동적 주소를 만들면 여기도 맞춘다.
- 약관·처리방침은 전문가 검토 전 초안이다. '초안' 표시를 임의로 떼지 않는다.
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
