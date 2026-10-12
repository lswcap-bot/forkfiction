import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

// 구글 로그인에서 돌아오는 곳. 인증 코드를 세션으로 바꾸고,
// 필명을 아직 정하지 않았으면 /onboarding으로 보낸다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    const onboarding = new URL("/onboarding", origin);
    if (next !== "/") onboarding.searchParams.set("next", next);
    return NextResponse.redirect(onboarding);
  }

  return NextResponse.redirect(new URL(next, origin));
}
