-- save_chapter의 '그 사이 다른 곳에서 저장됨' 오류 코드를 40001에서 PT409로 바꾼다.
-- 40001(serialization_failure)은 PostgREST가 재시도하는 코드라 요청이 끝나지 않았다.
-- PT409는 PostgREST가 HTTP 409로 돌려준다.

create or replace function public.save_chapter(
  p_chapter_id uuid,
  p_title text,
  p_body_md text,
  p_base_revision_id uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid;
  v_ch public.chapters;
  v_head public.revisions;
  v_rev_id uuid;
begin
  select work_id into v_work_id from public.chapters where id = p_chapter_id;
  if not found then
    raise exception '장을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  perform public.lock_own_work(v_work_id);

  select * into v_ch from public.chapters where id = p_chapter_id;
  if v_ch.head_revision_id is distinct from p_base_revision_id then
    raise exception '그 사이 이 장이 다른 곳에서 저장되었습니다. 새로 불러온 뒤 다시 저장해 주세요.'
      using errcode = 'PT409';
  end if;

  select * into v_head from public.revisions where id = v_ch.head_revision_id;
  if v_head.title = btrim(p_title) and v_head.body_md = p_body_md then
    return v_head.id;
  end if;

  -- 제목·본문·메모 길이는 revisions의 제약이 검사한다
  insert into public.revisions (chapter_id, author_id, title, body_md, parent_revision_id, message)
    values (v_ch.id, (select auth.uid()), btrim(p_title), p_body_md, v_ch.head_revision_id,
            nullif(btrim(p_message), ''))
    returning id into v_rev_id;

  -- 물려받은 장이면 chapters_guard가 modified로 바꾸고, 갈림점 트리거가 갈림점을 당긴다
  update public.chapters set head_revision_id = v_rev_id where id = v_ch.id;

  return v_rev_id;
end;
$$;

