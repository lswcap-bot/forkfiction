import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { LineageLine } from "@/components/lineage-line";
import { compareChapters, compareSummary, type CompareRow, type Segment } from "@/lib/compare";
import { getCompareChapter, getLineage, getWorkBySlug } from "@/lib/works";

export const metadata: Metadata = { title: "원작과 비교" };

// 원작과 비교(F5): 갈래의 장을, 그 장이 갈라질 때 가져온 원작 수정본(origin_revision_id)과
// 문단 단위로 나란히 놓고 바뀐 문장을 색으로 표시한다. 광고를 넣지 않는다(F10).
// 본문은 마크다운으로 그리지 않고 원문 텍스트 그대로 보여 준다(React가 이스케이프한다).
export default function ComparePage({ params }: PageProps<"/w/[slug]/[position]/compare">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={null}>
        <CompareView params={params} />
      </Suspense>
    </main>
  );
}

// 같은 문단이 이보다 길게 이어지면 가운데를 접는다
const SAME_RUN_FOLD = 4;

async function CompareView({ params }: Pick<PageProps<"/w/[slug]/[position]/compare">, "params">) {
  const { slug, position: positionParam } = await params;
  if (!/^[1-9]\d{0,3}$/.test(positionParam)) notFound();
  const position = Number(positionParam);

  const work = await getWorkBySlug(decodeURIComponent(slug));
  if (!work || work.parent_work_id === null) notFound();

  const [chapter, lineage] = await Promise.all([getCompareChapter(work.id, position), getLineage(work.id)]);
  if (!chapter) notFound();

  // 계보에서 바로 위 부모(depth 1)가 비교 대상 작품이다
  const parent = lineage.find((l) => l.depth === 1);
  const parentLabel = parent ? `『${parent.ancestor_title}』` : "원작";
  const back = `/w/${work.slug}/${position}`;

  const header = (
    <header className="flex flex-col gap-2">
      <LineageLine lineage={lineage} />
      <p className="text-sm text-muted-foreground">
        <Link href={`/w/${work.slug}`} className="hover:underline">
          『{work.title}』
        </Link>{" "}
        · {work.owner.display_name}
      </p>
      <h1 className="font-serif text-2xl font-bold tracking-tight">
        <span className="mr-2 text-muted-foreground">{position}장</span>
        {chapter.title}
        <span className="ml-3 align-middle text-base font-normal text-muted-foreground">원작과 비교</span>
      </h1>
      <Link href={back} className="text-sm underline-offset-4 hover:underline">
        ← {position}장 읽기로
      </Link>
    </header>
  );

  if (!chapter.origin) {
    return (
      <>
        {header}
        <Notice>
          원작에 없는 장입니다. 이 갈래에서 새로 쓴 장이라 비교할 원작 본문이 없습니다.
        </Notice>
      </>
    );
  }

  const rows = compareChapters(chapter.origin.body, chapter.body);
  const summary = compareSummary(rows);
  const unchanged = summary.changed + summary.added + summary.removed === 0;

  return (
    <>
      {header}

      <div className="flex flex-col gap-1 text-sm">
        <p>
          비교 대상: {parentLabel} {position}장 「{chapter.origin.title}」(갈라진 시점의 수정본)
          {chapter.origin.title !== chapter.title && <> → 이 갈래의 「{chapter.title}」</>}
        </p>
        {unchanged ? (
          <p className="text-muted-foreground">원작과 같습니다.</p>
        ) : (
          <p className="flex flex-wrap gap-x-4 text-muted-foreground">
            <span>바뀐 문단 {summary.changed}개</span>
            <span>더한 문단 {summary.added}개</span>
            <span>뺀 문단 {summary.removed}개</span>
            <span>같은 문단 {summary.same}개</span>
          </p>
        )}
        <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
          <span>
            <mark className={REMOVED}>빠지거나 바뀌기 전 문장</mark>
          </span>
          <span>
            <mark className={ADDED}>더하거나 바뀐 문장</mark>
          </span>
        </p>
      </div>

      <div className="hidden grid-cols-2 gap-6 border-b pb-2 text-sm font-medium md:grid">
        <p>원작 · {parentLabel}</p>
        <p>갈래 · 『{work.title}』</p>
      </div>

      <ol className="flex flex-col gap-4">{renderRows(rows)}</ol>
    </>
  );
}

function renderRows(rows: CompareRow[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < rows.length; ) {
    // 같은 문단이 길게 이어지면 처음과 끝만 보이고 가운데는 접는다
    let j = i;
    while (j < rows.length && rows[j].kind === "same") j++;
    const run = j - i;
    if (run > SAME_RUN_FOLD) {
      out.push(<Row key={i} row={rows[i]} />);
      out.push(
        <li key={`fold-${i}`}>
          <details className="rounded-md border border-dashed">
            <summary className="cursor-pointer px-3 py-2 text-center text-sm text-muted-foreground">
              같은 문단 {run - 2}개 펼치기
            </summary>
            <ol className="flex flex-col gap-4 p-3">
              {rows.slice(i + 1, j - 1).map((row, k) => (
                <Row key={k} row={row} />
              ))}
            </ol>
          </details>
        </li>,
      );
      out.push(<Row key={j - 1} row={rows[j - 1]} />);
      i = j;
      continue;
    }
    if (run > 0) {
      for (let k = i; k < j; k++) out.push(<Row key={k} row={rows[k]} />);
      i = j;
      continue;
    }
    out.push(<Row key={i} row={rows[i]} />);
    i++;
  }
  return out;
}

const REMOVED = "rounded-sm bg-rose-100 px-0.5 text-rose-950 line-through decoration-rose-400/70 dark:bg-rose-950/60 dark:text-rose-100";
const ADDED = "rounded-sm bg-emerald-100 px-0.5 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-100";

function Row({ row }: { row: CompareRow }) {
  switch (row.kind) {
    case "same":
      // 좁은 화면에서는 같은 문단을 한 번만 보여 준다
      return (
        <li className="grid gap-2 md:grid-cols-2 md:gap-6" aria-label="같음">
          <Para muted>{row.text}</Para>
          <div className="hidden md:block" aria-hidden>
            <Para muted>{row.text}</Para>
          </div>
        </li>
      );
    case "changed":
      return <Pair origin={<Para>{segments(row.origin, REMOVED)}</Para>} fork={<Para>{segments(row.fork, ADDED)}</Para>} label="바뀜" />;
    case "removed":
      return (
        <Pair
          origin={
            <Para>
              <mark className={REMOVED}>{row.text}</mark>
            </Para>
          }
          fork={<Empty>갈래에서 뺀 문단</Empty>}
          label="뺌"
        />
      );
    case "added":
      return (
        <Pair
          origin={<Empty>원작에 없는 문단</Empty>}
          fork={
            <Para>
              <mark className={ADDED}>{row.text}</mark>
            </Para>
          }
          label="더함"
        />
      );
  }
}

function segments(parts: Segment[], changedClass: string) {
  return parts.map((s, i) =>
    s.changed ? (
      <mark key={i} className={changedClass}>
        {s.text}
      </mark>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );
}

// 넓은 화면은 좌우, 좁은 화면은 원작 위·갈래 아래
function Pair({ origin, fork, label }: { origin: ReactNode; fork: ReactNode; label: string }) {
  return (
    <li className="grid gap-2 md:grid-cols-2 md:gap-6" aria-label={label}>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground md:hidden">원작</span>
        {origin}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground md:hidden">갈래</span>
        {fork}
      </div>
    </li>
  );
}

function Para({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <p
      className={`font-serif leading-[1.9] break-keep whitespace-pre-wrap [overflow-wrap:anywhere] ${muted ? "text-muted-foreground" : ""}`}
    >
      {children}
    </p>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">{children}</p>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
