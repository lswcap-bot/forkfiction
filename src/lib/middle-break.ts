// 긴 장의 본문 중간 광고 자리(PLAN.md F10). 문장 한가운데를 피해 가운데에 가장 가까운
// 문단 경계(빈 줄)에서 본문을 둘로 나눈다. 코드 블록 안의 빈 줄은 경계로 보지 않는다.

export const MIDDLE_AD_MIN_LENGTH = 8000;

export function splitAtMiddle(body: string, minLength = MIDDLE_AD_MIN_LENGTH): [string, string] | null {
  if (body.length < minLength) return null;

  const paragraphs = body.split("\n\n");
  // 각 경계(i번째 문단 뒤)의 위치와, 그 경계가 코드 블록 밖인지
  let offset = 0;
  let inFence = false;
  let best = -1;
  let bestDistance = Infinity;
  const middle = body.length / 2;

  for (let i = 0; i < paragraphs.length - 1; i++) {
    const fences = paragraphs[i].match(/^ {0,3}(`{3,}|~{3,})/gm)?.length ?? 0;
    if (fences % 2 === 1) inFence = !inFence;
    offset += paragraphs[i].length + 2;
    if (inFence) continue;
    const distance = Math.abs(offset - middle);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }

  if (best < 0) return null;
  return [paragraphs.slice(0, best + 1).join("\n\n"), paragraphs.slice(best + 1).join("\n\n")];
}
