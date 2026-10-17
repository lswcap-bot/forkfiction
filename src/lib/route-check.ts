// proxy가 화면을 그리기 전에 '있는 주소인지' 확인할 경로 규칙.
// Cache Components는 <Suspense> 안의 notFound() 전에 200을 보내기 시작하므로, 없는 프로필·작품·장은
// proxy에서 미리 걸러야 HTTP 404가 나간다. 실제 조회는 src/lib/supabase/proxy.ts가 한다.

export type CheckedRoute =
  | { kind: "profile"; handle: string }
  | { kind: "work"; slug: string; position?: number; page?: "tree" | "edit" | "compare" }
  | { kind: "invalid" };

const HANDLE = /^[a-z0-9_]{3,20}$/;
const SLUG = /^(?=.{3,80}$)[a-z0-9]+(-[a-z0-9]+)*$/;
const POSITION = /^[1-9]\d{0,3}$/;

/** 검사할 주소면 그 내용을, 형식부터 틀렸으면 invalid를, 검사하지 않는 주소면 null을 돌려준다. */
export function parseCheckedRoute(pathname: string): CheckedRoute | null {
  let path: string;
  try {
    path = decodeURIComponent(pathname).replace(/\/+$/, "");
  } catch {
    return null;
  }
  const parts = path.split("/").slice(1);

  // /@필명, /u/필명
  const handle = parts[0]?.startsWith("@") && parts.length === 1 ? parts[0].slice(1) : parts[0] === "u" && parts.length === 2 ? parts[1] : null;
  if (handle !== null) return HANDLE.test(handle) ? { kind: "profile", handle } : { kind: "invalid" };

  if (parts[0] !== "w" || parts.length < 2) return null;
  // 메타데이터 이미지 경로는 이미지 쪽에서 처리한다
  if (parts.some((p) => p.startsWith("opengraph-image") || p.startsWith("twitter-image"))) return null;

  const [, slug, second, third] = parts;
  if (!SLUG.test(slug) || parts.length > 4) return { kind: "invalid" };
  if (second === undefined) return { kind: "work", slug };
  if (second === "tree" || second === "edit") {
    return third === undefined ? { kind: "work", slug, page: second } : { kind: "invalid" };
  }
  if (!POSITION.test(second)) return { kind: "invalid" };
  const position = Number(second);
  if (third === undefined) return { kind: "work", slug, position };
  return third === "compare" ? { kind: "work", slug, position, page: "compare" } : { kind: "invalid" };
}
