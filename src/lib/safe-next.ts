// 로그인 뒤 돌아갈 주소(next)를 사이트 안 경로로만 제한한다 (열린 리다이렉트 방지).
const BASE = "http://forkfiction.invalid";
const SKIP_PATHS = ["/login", "/onboarding"];

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";

  // 브라우저처럼 해석해서(\ → / 포함) 다른 호스트로 빠지면 막는다.
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";

  const { pathname } = url;
  if (SKIP_PATHS.includes(pathname) || pathname.startsWith("/auth/")) return "/";

  return pathname + url.search + url.hash;
}
