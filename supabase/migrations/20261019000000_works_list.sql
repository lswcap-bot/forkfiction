-- 전체 목록(/works)
--   1) work_parent_titles: 목록 카드의 '『부모』 N장에서 갈라짐'에 쓸 바로 위 부모 제목.
--      work_lineage 뷰는 모든 작품의 계보를 다 계산한 뒤 거르므로, 목록에서는 받은 id의 부모만 읽는 이 함수를 쓴다.
--      가림 규칙은 work_lineage와 같다: 숨겨진 부모는 그 작가·관리자가 아니면 제목이 null(화면에는 '숨겨진 작품').
--      부모가 임시 저장으로 돌아갔어도 계보처럼 제목은 보인다.
--   2) 정렬 인덱스: 최신순(처음 공개), 별 많은 순, 갈래 많은 순. 같으면 최신순, 그다음 id로 끊어 쪽이 겹치지 않게 한다.

create function public.work_parent_titles(p_work_ids uuid[])
returns table (work_id uuid, parent_title text, parent_hidden boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.id,
    case
      when p.visibility = 'hidden'
        and p.owner_id is distinct from (select auth.uid())
        and not public.is_admin()
      then null
      else p.title
    end,
    p.visibility = 'hidden'
  from public.works w
  join public.works p on p.id = w.parent_work_id
  where w.id = any (p_work_ids[1:100])
    and public.can_read_work(w.id)
$$;

comment on function public.work_parent_titles is
  '작품들의 바로 위 부모 제목(목록 카드용, 한 번에 100개까지). 숨겨진 부모는 그 작가·관리자가 아니면 제목이 null.';

revoke execute on function public.work_parent_titles(uuid[]) from public, anon, authenticated;
grant execute on function public.work_parent_titles(uuid[]) to anon, authenticated;

-- 정렬 인덱스(공개 작품만). 탭(원작·갈래)은 parent_work_id로 거른다.
create index works_public_published_idx on public.works (first_published_at desc, id)
  where visibility = 'public';
create index works_public_stars_sort_idx on public.works (star_count desc, first_published_at desc, id)
  where visibility = 'public';
create index works_public_forks_sort_idx on public.works (fork_count desc, first_published_at desc, id)
  where visibility = 'public';

-- 6단계의 별 인덱스는 위 정렬 인덱스가 대신한다
drop index if exists public.works_public_stars_idx;
