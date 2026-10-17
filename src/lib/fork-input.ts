import { TITLE_MAX } from "./work-meta";

// 갈래 만들기 입력. DB의 works_title_length, works_fork_shape 제약과 같은 값을 쓴다.
export const FORK_NOTE_MAX = 100;

export function forkInputProblem(input: { title: string; note: string }): string | null {
  const title = input.title.trim();
  if (!title || title.length > TITLE_MAX) return `갈래 제목은 1~${TITLE_MAX}자로 적어 주세요.`;
  const note = input.note.trim();
  if (!note) return "한 줄 소개를 적어 주세요. 갈래 지도에 이 문장이 보입니다.";
  if (/[\r\n]/.test(note)) return "한 줄 소개는 줄을 바꾸지 않고 적어 주세요.";
  if (note.length > FORK_NOTE_MAX) return `한 줄 소개는 ${FORK_NOTE_MAX}자까지입니다.`;
  return null;
}
