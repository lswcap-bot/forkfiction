import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

// 서버 컴포넌트·서버 액션·라우트 핸들러용 Supabase 클라이언트.
// 요청마다 새로 만든다(전역 변수에 두지 않는다).
export async function createClient() {
  // Supabase 클라이언트는 세션 만료를 확인하며 Date.now()를 부른다.
  // Cache Components의 미리 렌더링(쿠키가 채워진 단계 포함)이 여기서 멈추도록,
  // 실제 요청이 들어온 뒤에만 이어서 실행한다.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy가 맡는다.
          }
        },
      },
    },
  );
}
