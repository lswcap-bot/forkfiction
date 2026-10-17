"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { MdEditor } from "@/components/md-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { draftKey, draftStatus, isDirty, parseDraft, type ChapterText } from "@/lib/editor-draft";
import { moveItem } from "@/lib/move";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";
import { CHAPTER_STATES, CHAPTER_TITLE_MAX, CHAPTERS_MAX } from "@/lib/work-meta";
import type { ChapterListItem, EditorChapter, HistoryItem } from "@/lib/works";
import { addChapter, deleteChapter, loadRevision, moveChapter, revertChapter, saveChapter } from "./actions";

export type WorkroomWork = {
  id: string;
  slug: string;
  title: string;
  isFork: boolean;
  forkPoint: number | null;
};

type Props = {
  work: WorkroomWork;
  header: ReactNode;
  chapters: ChapterListItem[];
  chapter: EditorChapter;
  history: HistoryItem[];
};

const LEAVE_MESSAGE = "저장하지 않은 변경이 있습니다. 이 페이지를 떠나면 이 브라우저의 임시 보관본만 남습니다. 떠날까요?";

export function Workroom({ work, header, chapters, chapter, history }: Props) {
  // 장 구조를 바꾸는 동안(저장하지 않은 글이 있으면) 막는다
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ChapterSidebar work={work} chapters={chapters} current={chapter} locked={dirty} />
        {/* 장이 바뀌면 편집기를 새로 만든다 */}
        <ChapterEditor key={chapter.id} work={work} chapter={chapter} history={history} onDirtyChange={setDirty} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 장 목록: 이동, 순서 바꾸기(끌기·↑↓), 추가, 삭제
// ────────────────────────────────────────────────────────────

function ChapterSidebar({
  work,
  chapters,
  current,
  locked,
}: {
  work: WorkroomWork;
  chapters: ChapterListItem[];
  current: EditorChapter;
  locked: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(chapters);
  const [dragging, setDragging] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 서버에서 새 목록이 오면 그대로 따른다
  const [lastChapters, setLastChapters] = useState(chapters);
  if (chapters !== lastChapters) {
    setLastChapters(chapters);
    setOrder(chapters);
  }

  const busy = pending || locked;
  const base = `/w/${work.slug}/edit`;

  // 넓은 화면에서는 늘 펼쳐 두고, 좁은 화면에서는 접어서 편집기가 먼저 보이게 한다
  const listRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (listRef.current && !window.matchMedia("(min-width: 1024px)").matches) listRef.current.open = false;
  }, []);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, then?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        setOrder(chapters);
        return;
      }
      then?.();
    });
  }

  function move(from: number, to: number) {
    if (busy || from === to || to < 0 || to >= order.length) return;
    const next = moveItem(order, from, to);
    setOrder(next);
    const ch = order[from];
    const currentIndex = next.findIndex((c) => c.id === current.id);
    run(
      () => moveChapter(ch.id, to + 1),
      () => {
        // 지금 고치는 장의 번호가 바뀌었으면 주소도 따라간다
        if (currentIndex + 1 !== current.position) router.replace(`${base}?ch=${currentIndex + 1}`);
      },
    );
  }

  function remove(ch: ChapterListItem) {
    if (busy) return;
    const warning =
      ch.state === "inherited"
        ? `${ch.position}장 「${ch.title}」을 지울까요? 물려받은 장을 지우면 이 장이 갈림점이 됩니다.`
        : `${ch.position}장 「${ch.title}」을 지울까요? 이 장은 목록에서 사라집니다.`;
    if (!window.confirm(warning)) return;
    run(
      () => deleteChapter(ch.id),
      () => {
        if (ch.id === current.id) router.replace(`${base}?ch=${Math.max(1, ch.position - 1)}`);
        else if (ch.position < current.position) router.replace(`${base}?ch=${current.position - 1}`);
      },
    );
  }

  function add() {
    if (busy) return;
    const position = order.length + 1;
    run(
      () => addChapter({ workId: work.id, position, title: "새 장", chapterCount: order.length }),
      () => router.push(`${base}?ch=${position}`),
    );
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-6 lg:w-64">
      <details ref={listRef} open className="group rounded-lg border lg:border-0" aria-label="장 목록">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium lg:px-1">
          장 목록 ({order.length}개) · 지금 {current.position}장
        </summary>
        <ol className="flex flex-col p-1 lg:p-0">
          {order.map((ch, i) => {
            const active = ch.id === current.id;
            return (
              <li
                key={ch.id}
                draggable={!busy}
                onDragStart={(e) => {
                  setDragging(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragging !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging !== null) move(dragging, i);
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
                className={`group/item flex items-center gap-1 rounded-md pr-1 ${active ? "bg-muted" : "hover:bg-muted/50"} ${dragging === i ? "opacity-50" : ""}`}
              >
                <GripVertical
                  aria-hidden
                  className={`size-4 shrink-0 text-muted-foreground ${busy ? "opacity-30" : "cursor-grab"}`}
                />
                <Link
                  href={`/w/${work.slug}/edit?ch=${i + 1}`}
                  aria-current={active ? "page" : undefined}
                  className="flex min-w-0 flex-1 items-baseline gap-2 py-2 text-sm"
                >
                  <span className="w-9 shrink-0 text-muted-foreground tabular-nums">{i + 1}장</span>
                  <span className={`truncate ${active ? "font-medium" : ""}`}>{ch.title}</span>
                </Link>
                {work.isFork && <StateBadge state={ch.state} />}
                <div className="flex shrink-0 opacity-60 group-hover/item:opacity-100 focus-within:opacity-100">
                  <IconButton label={`${i + 1}장을 위로`} disabled={busy || i === 0} onClick={() => move(i, i - 1)}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    label={`${i + 1}장을 아래로`}
                    disabled={busy || i === order.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                  <IconButton label={`${i + 1}장 지우기`} disabled={busy || order.length <= 1} onClick={() => remove(ch)}>
                    <Trash2 />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="p-1 lg:px-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={busy || order.length >= CHAPTERS_MAX}
            onClick={add}
          >
            <Plus />
            {order.length + 1}장 새로 쓰기
          </Button>
        </div>
      </details>
      {locked && <p className="text-xs text-muted-foreground">저장한 뒤에 장을 더하거나 옮기고 지울 수 있습니다.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </aside>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

function StateBadge({ state }: { state: ChapterListItem["state"] }) {
  const tone = state === "inherited" ? "bg-muted text-muted-foreground" : "border border-foreground/20";
  return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] ${tone}`}>{CHAPTER_STATES[state]}</span>;
}

// ────────────────────────────────────────────────────────────
// 편집기: 쓰기 · 미리보기 · 저장 · 수정 기록
// ────────────────────────────────────────────────────────────

type Saved = ChapterText & { id: string };

function ChapterEditor({
  work,
  chapter,
  history,
  onDirtyChange,
}: {
  work: WorkroomWork;
  chapter: EditorChapter;
  history: HistoryItem[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const ids = useId();
  const [saved, setSaved] = useState<Saved>({ id: chapter.headRevisionId, title: chapter.title, body: chapter.body });
  const [title, setTitle] = useState(chapter.title);
  const [body, setBody] = useState(chapter.body);
  // 바깥에서 글을 바꿀 때(임시 보관본·되돌리기) 편집기를 새로 만든다
  const [editorVersion, setEditorVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [unlocked, setUnlocked] = useState(chapter.state !== "inherited");
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string; conflict?: boolean } | null>(null);
  const [peek, setPeek] = useState<{ label: string; title: string; body: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const current = { title, body };
  const dirty = isDirty(saved, current);
  const readOnly = !unlocked;
  const previewBody = useDeferredValue(body);
  const key = draftKey(chapter.id);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const allowLeave = useUnsavedWarning(dirty, LEAVE_MESSAGE);

  // ── 브라우저 임시 보관(수정본은 만들지 않는다)
  const [draftNotice, setDraftNotice] = useState<"restorable" | "stale" | "none">("none");
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // 저장소를 못 쓰는 환경이면 임시 보관 없이 쓴다
    }
    // localStorage는 브라우저에만 있어 그린 뒤에 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftNotice(draftStatus(parseDraft(raw), { id: chapter.headRevisionId, title: chapter.title, body: chapter.body }));
  }, [key, chapter.headRevisionId, chapter.title, chapter.body]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (dirty) {
          window.localStorage.setItem(key, JSON.stringify({ base: saved.id, title, body, savedAt: Date.now() }));
        } else if (draftNotice === "none") {
          window.localStorage.removeItem(key);
        }
      } catch {
        // 임시 보관은 편의 기능이라 실패해도 넘어간다
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, key, saved.id, title, body, draftNotice]);

  function loadText(text: ChapterText) {
    setTitle(text.title);
    setBody(text.body);
    setEditorVersion((v) => v + 1);
  }

  function restoreDraft() {
    let draft = null;
    try {
      draft = parseDraft(window.localStorage.getItem(key));
    } catch {}
    if (draft) {
      loadText(draft);
      setUnlocked(true);
    }
    setDraftNotice("none");
  }

  function discardDraft() {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    setDraftNotice("none");
  }

  // ── 저장
  const save = useCallback(() => {
    if (!dirty || pending || readOnly) return;
    setStatus(null);
    const text = { title, body };
    startTransition(async () => {
      const result = await saveChapter({ chapterId: chapter.id, ...text, baseRevisionId: saved.id, message });
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error, conflict: result.conflict });
        return;
      }
      setSaved({ id: result.headRevisionId, ...text });
      setMessage("");
      try {
        window.localStorage.removeItem(key);
      } catch {}
      setStatus({ tone: "ok", text: "저장했습니다. 수정 기록에 새 수정본이 쌓였습니다." });
    });
  }, [dirty, pending, readOnly, title, body, chapter.id, saved.id, message, key]);

  // Ctrl+S / ⌘S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  function reloadFresh() {
    // 지금 글은 임시 보관본으로 남아 있어 새로 불러온 뒤 다시 꺼낼 수 있다
    try {
      window.localStorage.setItem(key, JSON.stringify({ base: saved.id, title, body, savedAt: Date.now() }));
    } catch {}
    allowLeave();
    window.location.reload();
  }

  // ── 수정 기록
  function peekRevision(item: HistoryItem) {
    startTransition(async () => {
      const rev = await loadRevision(item.id);
      if (!rev) {
        setStatus({ tone: "error", text: "수정본을 불러오지 못했습니다." });
        return;
      }
      setPeek({ label: historyLabel(item), ...rev });
      setTab("preview");
    });
  }

  function revert(item: HistoryItem) {
    if (pending) return;
    const ask = dirty
      ? "저장하지 않은 변경을 버리고 이 수정본으로 되돌릴까요? 되돌리기도 새 수정본으로 기록에 남습니다."
      : "이 수정본으로 되돌릴까요? 되돌리기도 새 수정본으로 기록에 남습니다.";
    if (!window.confirm(ask)) return;
    setStatus(null);
    startTransition(async () => {
      const rev = await loadRevision(item.id);
      const result = await revertChapter({ chapterId: chapter.id, revisionId: item.id, baseRevisionId: saved.id });
      if (!result.ok || !rev) {
        setStatus({ tone: "error", text: result.ok ? "되돌리지 못했습니다." : result.error, conflict: !result.ok && result.conflict });
        return;
      }
      setSaved({ id: result.headRevisionId, ...rev });
      loadText(rev);
      setUnlocked(true);
      setPeek(null);
      try {
        window.localStorage.removeItem(key);
      } catch {}
      setStatus({ tone: "ok", text: `${historyLabel(item)}으로 되돌렸습니다.` });
    });
  }

  const nextForkPoint = Math.min(work.forkPoint ?? chapter.position, chapter.position);

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4" aria-label={`${chapter.position}장 고쳐 쓰기`}>
      {/* 임시 보관본 */}
      {draftNotice !== "none" && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="flex-1">
            {draftNotice === "restorable"
              ? "저장하지 않은 글이 이 브라우저에 남아 있습니다."
              : "이 브라우저에 남은 글은 그 뒤 다른 곳에서 저장되기 전의 것입니다. 불러와서 저장하면 그 저장을 덮습니다."}
          </p>
          <Button type="button" size="sm" onClick={restoreDraft}>
            불러오기
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
            버리기
          </Button>
        </div>
      )}

      {/* 물려받은 장 */}
      {readOnly && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm">
          <p className="flex-1 text-muted-foreground">
            원작에서 물려받은 장입니다. 원작의 갈라진 시점 그대로이며, 원작이 나중에 고쳐도 바뀌지 않습니다.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirmUnlock(true)}>
            이 장 고치기
          </Button>
        </div>
      )}
      <Dialog open={confirmUnlock} onOpenChange={setConfirmUnlock}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 장부터 달라집니다</DialogTitle>
            <DialogDescription>
              {chapter.position}장을 고쳐 저장하면 이 장은 &lsquo;고침&rsquo;이 되고, 갈림점이{" "}
              {nextForkPoint === work.forkPoint ? `${nextForkPoint}장 그대로입니다` : `${work.forkPoint}장에서 ${nextForkPoint}장으로 바뀝니다`}.
              저장하기 전까지는 아무것도 바뀌지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>그만두기</DialogClose>
            <Button
              type="button"
              onClick={() => {
                setUnlocked(true);
                setConfirmUnlock(false);
              }}
            >
              고치기 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 장 제목 */}
      <div className="flex items-center gap-3">
        <label htmlFor={`${ids}-title`} className="shrink-0 font-serif text-xl font-bold text-muted-foreground">
          {chapter.position}장
        </label>
        <Input
          id={`${ids}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={CHAPTER_TITLE_MAX}
          readOnly={readOnly}
          aria-label="장 제목"
          className="h-10 font-serif text-lg"
        />
      </div>

      {/* 모바일: 쓰기/미리보기 탭 */}
      <div role="tablist" aria-label="편집 화면" className="flex gap-1 border-b lg:hidden">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? "border-foreground font-medium" : "border-transparent text-muted-foreground"}`}
          >
            {t === "write" ? "쓰기" : "미리보기"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={`h-[60dvh] overflow-hidden rounded-lg border lg:block lg:h-[calc(100dvh-16rem)] ${tab === "write" ? "" : "hidden"} ${readOnly ? "bg-muted/30" : ""}`}
        >
          <MdEditor
            key={editorVersion}
            initialValue={body}
            onChange={setBody}
            readOnly={readOnly}
            placeholder="여기에 본문을 씁니다. 마크다운을 쓸 수 있습니다."
            ariaLabel={`${chapter.position}장 본문`}
          />
        </div>
        <div
          className={`h-[60dvh] overflow-y-auto rounded-lg border px-5 py-4 lg:block lg:h-[calc(100dvh-16rem)] ${tab === "preview" ? "" : "hidden"}`}
          aria-label="미리보기"
        >
          {peek ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <span>{peek.label} 보는 중</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPeek(null)}>
                  닫기
                </Button>
              </div>
              <h2 className="font-serif text-xl font-bold">{peek.title}</h2>
              <div className="reading">
                <Markdown>{peek.body}</Markdown>
              </div>
            </div>
          ) : previewBody.trim() ? (
            <div className="reading">
              <Markdown>{previewBody}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">본문을 쓰면 여기에 읽기 화면처럼 보입니다.</p>
          )}
        </div>
      </div>

      {/* 저장 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={100}
          placeholder="한 줄 메모 (선택)"
          aria-label="수정 메모"
          disabled={readOnly}
          className="sm:flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) save();
          }}
        />
        <Button type="button" onClick={save} disabled={!dirty || pending || readOnly}>
          {pending ? "저장하는 중…" : dirty ? "저장" : "저장됨"}
        </Button>
      </div>
      <div aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <p className={status.tone === "error" ? "text-destructive" : "text-muted-foreground"}>
            {status.text}{" "}
            {status.conflict && (
              <button type="button" className="underline underline-offset-4" onClick={reloadFresh}>
                새로 불러오기
              </button>
            )}
          </p>
        )}
        {!status && dirty && <p className="text-muted-foreground">저장하지 않은 변경이 있습니다. 이 브라우저에 임시 보관 중입니다.</p>}
      </div>

      {/* 수정 기록 */}
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">수정 기록 ({history.length})</summary>
        <ol className="flex flex-col divide-y border-t">
          {history.map((item) => {
            const isHead = item.id === saved.id;
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                <time dateTime={item.created_at} className="text-muted-foreground tabular-nums">
                  {formatTime(item.created_at)}
                </time>
                <span className="min-w-0 flex-1 truncate">
                  {item.inherited ? "원작에서 물려받음" : item.message || <span className="text-muted-foreground">메모 없음</span>}
                </span>
                {isHead && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">지금</span>}
                <Button type="button" variant="ghost" size="sm" onClick={() => peekRevision(item)} disabled={pending}>
                  보기
                </Button>
                {!isHead && (
                  <Button type="button" variant="outline" size="sm" onClick={() => revert(item)} disabled={pending}>
                    이 수정본으로 되돌리기
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

function historyLabel(item: HistoryItem) {
  return item.inherited ? "물려받은 원작 수정본" : `${formatTime(item.created_at)} 수정본`;
}
