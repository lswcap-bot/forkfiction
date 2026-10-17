-- 7단계: 출시 전 보안 정리
--   1) 이메일·전화 가입 막기: ForkFiction은 구글 계정으로만 가입한다. 테스트 사용자(@forkfiction.test)만 예외.
--      Auth 설정의 '가입 허용'을 끄면 구글 가입까지 막히고, 이메일 로그인을 끄면 테스트 로그인이 안 되므로
--      auth.users에 들어가기 전에 트리거로 거른다(대시보드 설정 없이 마이그레이션만으로 적용된다).
--      허용 목록이 아니라 막을 방식(email·phone·익명)만 적어, 구글 가입 경로에는 손대지 않는다.
--   2) work_lineage 뷰 권한을 읽기만으로 좁힌다(Supabase 기본 권한이 뷰에 쓰기 권한까지 주고 있었다).

-- ────────────────────────────────────────────────────────────
-- 가입 막기
-- ────────────────────────────────────────────────────────────

create function public.signup_allowed(p_provider text, p_email text, p_is_anonymous boolean default false)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(p_email), '') like '%@forkfiction.test'
    or not (coalesce(p_is_anonymous, false) or coalesce(p_provider, '') in ('email', 'phone'))
$$;

comment on function public.signup_allowed is
  '가입 허용 여부. 이메일·전화·익명 가입은 @forkfiction.test(테스트·시드 사용자)만 허용한다. 구글 등 외부 계정은 허용.';

create function public.auth_users_signup_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.signup_allowed(new.raw_app_meta_data ->> 'provider', new.email, new.is_anonymous) then
    raise exception 'ForkFiction은 구글 계정으로만 가입할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger forkfiction_signup_guard
  before insert on auth.users
  for each row execute function public.auth_users_signup_guard();

-- 트리거는 Auth 서버의 역할(supabase_auth_admin)로 돈다
revoke execute on function
  public.signup_allowed(text, text, boolean),
  public.auth_users_signup_guard()
  from public, anon, authenticated;

grant execute on function
  public.signup_allowed(text, text, boolean),
  public.auth_users_signup_guard()
  to supabase_auth_admin, service_role;

-- ────────────────────────────────────────────────────────────
-- work_lineage: 읽기만
-- ────────────────────────────────────────────────────────────

revoke all on public.work_lineage from anon, authenticated;
grant select on public.work_lineage to anon, authenticated;
