import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
};

export type Viewer = {
  userId: string;
  email: string | undefined;
  /** 구글 계정 이름. 온보딩의 표시 이름 기본값으로 쓴다. */
  googleName: string | undefined;
  /** 온보딩(필명·약관 동의)을 마치지 않았으면 null */
  profile: Profile | null;
};

// 지금 로그인한 사용자와 프로필. 한 요청 안에서는 한 번만 조회한다.
// 쿠키를 읽으므로 <Suspense> 안에서 부른다.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const meta = user.user_metadata as { full_name?: string; name?: string };
  return {
    userId: user.id,
    email: user.email,
    googleName: meta.full_name ?? meta.name,
    profile: profile ?? null,
  };
});
