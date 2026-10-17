/** from 자리의 항목을 to 자리로 옮긴 새 배열. 사이 항목은 한 칸씩 밀리거나 당겨진다. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
