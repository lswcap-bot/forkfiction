// 필명 규칙. 클라이언트와 서버가 같은 함수를 쓴다.
// 이 목록을 바꾸면 supabase/migrations의 profiles 예약어 check도 함께 바꾼다.
export const RESERVED_HANDLES = [
  "admin", "new", "login", "onboarding", "auth", "api", "forkfiction", "w", "u",
  "logout", "signup", "settings", "edit", "tree", "compare", "about", "terms",
  "privacy", "help", "support", "official", "staff", "moderator", "system",
  "root", "me", "null", "undefined", "anonymous", "ads",
] as const;

const RESERVED = new Set<string>(RESERVED_HANDLES);
const HANDLE_PATTERN = /^[a-z0-9_]+$/;

export type HandleResult =
  | { ok: true; handle: string }
  | { ok: false; reason: "length" | "format" | "reserved"; message: string };

export function validateHandle(input: string): HandleResult {
  const handle = input.trim();

  if (RESERVED.has(handle)) {
    return { ok: false, reason: "reserved", message: "쓸 수 없는 필명입니다." };
  }
  if (handle.length < 3 || handle.length > 20) {
    return { ok: false, reason: "length", message: "필명은 3~20자로 정해 주세요." };
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      ok: false,
      reason: "format",
      message: "영문 소문자, 숫자, 밑줄(_)만 쓸 수 있습니다.",
    };
  }
  return { ok: true, handle };
}
