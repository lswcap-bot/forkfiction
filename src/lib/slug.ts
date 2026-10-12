// 작품 주소(slug). 제목을 로마자로 바꿔 기본값을 만들고, 작가가 고칠 수 있다.
// 형식은 DB의 works_slug_format 제약과 같다: 영문 소문자·숫자·하이픈 3~80자.

export const SLUG_MIN = 3;
export const SLUG_MAX = 80;
const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const INITIALS = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const MEDIALS = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae",
  "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
// 받침은 대표음으로 적는다
const FINALS = [
  "", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l",
  "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t",
];
const RIEUL_INITIAL = 5;
const RIEUL_FINAL = 8;

/**
 * 한글 음절을 로마자로 바꾼다. 국어의 로마자 표기법을 글자 단위로 단순하게 따른 것이라
 * 소리 나는 대로 바뀌는 규칙(연음, 비음화 등)은 반영하지 않는다. ㄹㄹ만 ll로 적는다.
 */
export function romanize(text: string): string {
  let out = "";
  let prevFinal = -1;
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) {
      out += ch;
      prevFinal = -1;
      continue;
    }
    const initial = Math.floor(code / 588);
    const medial = Math.floor((code % 588) / 28);
    const final = code % 28;
    out +=
      (initial === RIEUL_INITIAL && prevFinal === RIEUL_FINAL ? "l" : INITIALS[initial]) +
      MEDIALS[medial] +
      FINALS[final];
    prevFinal = final;
  }
  return out;
}

/** 제목으로 기본 주소를 만든다. 쓸 만한 글자가 3자 미만이면 null. */
export function titleToSlug(title: string): string | null {
  let slug = romanize(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > SLUG_MAX) {
    const cut = slug.slice(0, SLUG_MAX + 1);
    const lastDash = cut.lastIndexOf("-");
    slug = (lastDash >= SLUG_MIN ? cut.slice(0, lastDash) : slug.slice(0, SLUG_MAX)).replace(/-+$/, "");
  }
  return slug.length >= SLUG_MIN ? slug : null;
}

export type SlugResult = { ok: true; slug: string } | { ok: false; message: string };

export function validateSlug(input: string): SlugResult {
  const slug = input.trim().toLowerCase();
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return { ok: false, message: `주소는 ${SLUG_MIN}~${SLUG_MAX}자로 적어 주세요.` };
  }
  if (!SLUG_FORMAT.test(slug)) {
    return {
      ok: false,
      message: "주소는 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있고 하이픈으로 시작·끝나거나 겹칠 수 없습니다.",
    };
  }
  return { ok: true, slug };
}

/** 쓸 만한 주소를 만들 수 없을 때 쓰는 8자리 무작위 주소 */
export function randomSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}
