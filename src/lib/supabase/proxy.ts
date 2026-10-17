import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { parseCheckedRoute, type CheckedRoute } from "@/lib/route-check";

// 요청마다 Supabase 세션(인증 쿠키)을 갱신한다.
// 프로필·작품·장 주소는 화면을 그리기 전에 있는지 확인해, 없으면 HTTP 404로 돌려준다(route-check.ts).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // createServerClient와 getUser 사이에 다른 코드를 넣지 않는다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 서버 액션(POST)은 화면이 이미 확인한 주소에서 오므로 다시 보지 않는다
  if (request.method === "GET" || request.method === "HEAD") {
    const route = parseCheckedRoute(request.nextUrl.pathname);
    if (route && !(await routeExists(supabase, route, user?.id ?? null))) {
      const notFound = NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
      // 갱신한 세션 쿠키는 404 응답에도 실어 보낸다
      response.cookies.getAll().forEach((cookie) => notFound.cookies.set(cookie));
      return notFound;
    }
  }

  return response;
}

// 지금 사용자 권한(RLS)으로 읽을 수 있는지 본다. 남의 임시 저장·숨긴 작품은 없는 주소와 같다.
async function routeExists(supabase: SupabaseClient, route: CheckedRoute, userId: string | null) {
  if (route.kind === "invalid") return false;

  if (route.kind === "profile") {
    const { data } = await supabase.from("profiles").select("id").eq("handle", route.handle).maybeSingle();
    return data !== null;
  }

  const { data: work } = await supabase
    .from("works")
    .select("id, owner_id, parent_work_id")
    .eq("slug", route.slug)
    .maybeSingle();
  if (!work) return false;
  // 작업실: 로그인 전이면 화면이 로그인으로 보낸다. 로그인했는데 남의 작품이면 없는 주소다.
  if (route.page === "edit") return userId === null || work.owner_id === userId;
  // 원작에는 비교 화면이 없다
  if (route.page === "compare" && work.parent_work_id === null) return false;
  if (route.position === undefined) return true;

  const { count } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("work_id", work.id)
    .eq("position", route.position);
  return (count ?? 0) > 0;
}
