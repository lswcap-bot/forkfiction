import { diffArrays, diffSentences } from "diff";

// 원작과 비교(F5): 문단 단위로 짝을 맞추고, 바뀐 문단 안에서는 바뀐 문장만 표시한다.
// 글자 단위보다 소설 읽기에 맞는 비교다.

export type Segment = { text: string; changed: boolean };

export type CompareRow =
  | { kind: "same"; text: string }
  | { kind: "changed"; origin: Segment[]; fork: Segment[] }
  /** 원작에만 있는 문단 */
  | { kind: "removed"; text: string }
  /** 갈래에만 있는 문단 */
  | { kind: "added"; text: string };

/** 빈 줄로 문단을 나눈다. 문단 안의 줄바꿈은 둔다. */
export function splitParagraphs(md: string): string[] {
  return md
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function compareChapters(originMd: string, forkMd: string): CompareRow[] {
  const parts = diffArrays(splitParagraphs(originMd), splitParagraphs(forkMd));
  const rows: CompareRow[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.added && !part.removed) {
      for (const text of part.value) rows.push({ kind: "same", text });
      continue;
    }

    // 붙어 있는 '빠짐'과 '들어옴'은 앞에서부터 한 문단씩 짝지어 '바뀜'으로 본다
    const next = parts[i + 1];
    const pairedWith = next && (next.added || next.removed) && next.added !== part.added ? next : null;
    const removed = part.removed ? part.value : (pairedWith?.value ?? []);
    const added = part.added ? part.value : (pairedWith?.value ?? []);
    if (pairedWith) i++;

    const pairs = Math.min(removed.length, added.length);
    for (let k = 0; k < pairs; k++) rows.push(changedRow(removed[k], added[k]));
    for (const text of removed.slice(pairs)) rows.push({ kind: "removed", text });
    for (const text of added.slice(pairs)) rows.push({ kind: "added", text });
  }

  return rows;
}

function changedRow(origin: string, fork: string): CompareRow {
  const row = { kind: "changed" as const, origin: [] as Segment[], fork: [] as Segment[] };
  for (const part of diffSentences(origin, fork)) {
    if (!part.added) push(row.origin, part.value, part.removed);
    if (!part.removed) push(row.fork, part.value, part.added);
  }
  return row;
}

// 같은 종류가 이어지면 한 조각으로 합친다
function push(segments: Segment[], text: string, changed: boolean) {
  const last = segments.at(-1);
  if (last && last.changed === changed) last.text += text;
  else segments.push({ text, changed });
}

export function compareSummary(rows: CompareRow[]) {
  const count = { same: 0, changed: 0, added: 0, removed: 0 };
  for (const row of rows) count[row.kind]++;
  return count;
}
