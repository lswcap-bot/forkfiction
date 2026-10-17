"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { SlugField, useSlugCheck } from "@/components/slug-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MD_EXAMPLE } from "@/lib/split-chapters";
import { randomSlug, titleToSlug } from "@/lib/slug";
import { splitChapters } from "@/lib/split-chapters";
import {
  AI_USAGES,
  CHAPTERS_MAX,
  CHAPTER_TITLE_MAX,
  LICENSES,
  SUMMARY_MAX,
  TITLE_MAX,
  chapterProblem,
  type AiUsage,
  type License,
} from "@/lib/work-meta";
import { createWork } from "./actions";

type Draft = { key: number; title: string; body: string };

const FILE_MAX_BYTES = 3 * 1024 * 1024;

const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function UploadForm() {
  const ids = useId();
  const [source, setSource] = useState("");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [split, setSplit] = useState<Draft[] | null>(null);
  const [chapters, setChapters] = useState<Draft[] | null>(null);
  const [openKey, setOpenKey] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fallbackSlug, setFallbackSlug] = useState("");
  const [license, setLicense] = useState<License>("CC-BY-SA-4.0");
  const [allowFork, setAllowFork] = useState(true);
  const [aiUsage, setAiUsage] = useState<AiUsage>("none");
  const [rights, setRights] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 주소를 직접 고치기 전까지는 제목에서 만든다
  const slugValue = slugTouched ? slugInput : (titleToSlug(title) ?? fallbackSlug);
  const slugStatus = useSlugCheck(slugValue);

  async function readFile(file: File) {
    if (file.size > FILE_MAX_BYTES) {
      setSourceError("파일이 너무 큽니다(3MB까지).");
      return;
    }
    setSource(await file.text());
    setSourceError(null);
  }

  function runSplit() {
    const result = splitChapters(source);
    if (result.chapters.length === 0) {
      setSourceError("원고가 비어 있습니다.");
      return;
    }
    const drafts = result.chapters.map((ch, i) => ({ key: i, ...ch }));
    setSplit(drafts);
    setChapters(drafts);
    setOpenKey(null);
    setSourceError(null);
    if (result.title && !title) setTitle(result.title.slice(0, TITLE_MAX));
    if (!fallbackSlug) setFallbackSlug(randomSlug());
  }

  function updateChapter(key: number, title: string) {
    setChapters((list) => list!.map((ch) => (ch.key === key ? { ...ch, title } : ch)));
  }

  function move(index: number, delta: -1 | 1) {
    setChapters((list) => {
      const next = [...list!];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  function remove(key: number) {
    setChapters((list) => list!.filter((ch) => ch.key !== key));
  }

  const problems = chapters?.map((ch) => chapterProblem(ch)) ?? [];
  const chaptersOk =
    !!chapters && chapters.length > 0 && chapters.length <= CHAPTERS_MAX && problems.every((p) => p === null);
  const titleOk = title.trim().length > 0 && title.trim().length <= TITLE_MAX;
  const canSave = chaptersOk && titleOk && summary.trim().length <= SUMMARY_MAX && rights && slugStatus.state === "ready";

  function save(visibility: "draft" | "public") {
    if (!canSave || slugStatus.state !== "ready" || !chapters) return;
    setError(null);
    startTransition(async () => {
      const result = await createWork({
        title,
        summary,
        slug: slugStatus.slug,
        slugInput: slugStatus.input,
        license,
        allowFork,
        aiUsage,
        rightsConfirmed: rights,
        visibility,
        chapters: chapters.map(({ title, body }) => ({ title, body })),
      });
      // 성공하면 작품 대문으로 이동하므로 돌아오는 것은 오류뿐이다
      if (result) {
        setError(result.error);
        if (result.slug) {
          setSlugTouched(true);
          setSlugInput(result.slug);
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {/* 1. 원고 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">1. 원고</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-file`}>MD 파일</Label>
          <Input
            id={`${ids}-file`}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-source`}>또는 본문 붙여넣기</Label>
          <textarea
            id={`${ids}-source`}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={8}
            placeholder={"# 작품 제목\n\n## 1장 제목\n\n본문…\n\n## 2장 제목\n\n본문…"}
            className={`${textareaClass} font-mono`}
          />
          <p className="text-sm text-muted-foreground">
            맨 위 <code>#</code>이 하나면 작품 제목, 그 아래 <code>##</code>를 장으로 봅니다.{" "}
            <code>#</code>이 여러 개면 각 <code>#</code>을 장으로 보되, 맨 위 <code>#</code> 아래에 본문이 없으면
            작품 제목으로 봅니다.
          </p>
          <details open className="rounded-lg border text-sm">
            <summary className="cursor-pointer px-3 py-2 font-medium">MD 형식 예시</summary>
            <div className="flex flex-col gap-2 border-t px-3 py-3">
              <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">{MD_EXAMPLE}</pre>
              <p className="text-muted-foreground">
                이렇게 쓰면 작품 제목은 『칼의 여행』, 장은 「떠나는 날」「강가에서」 두 개가 됩니다. 장 제목 앞의
                &lsquo;1장 —&rsquo;은 장 번호와 겹치므로 떼고, 첫 장 앞에 쓴 글은 &lsquo;머리말&rsquo; 장이 됩니다.
              </p>
              <div>
                <Button type="button" variant="outline" size="sm" disabled={!!source.trim()} onClick={() => setSource(MD_EXAMPLE)}>
                  예시를 붙여넣기 칸에 넣기
                </Button>
              </div>
            </div>
          </details>
        </div>
        {sourceError && <p className="text-sm text-destructive">{sourceError}</p>}
        <div>
          <Button type="button" onClick={runSplit} disabled={!source.trim()}>
            {split ? "다시 나누기" : "장 나누기"}
          </Button>
        </div>
      </section>

      {chapters && (
        <>
          {/* 2. 장 확인 */}
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold">2. 장 확인 ({chapters.length}개)</h2>
              {split && chapters !== split && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setChapters(split)}>
                  처음 나눈 대로
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              장 제목과 순서를 고칠 수 있습니다. 머리말이나 작가의 말처럼 장이 아닌 부분은 지워 주세요.
            </p>
            {chapters.length === 0 && (
              <p className="text-sm text-destructive">장이 하나도 없습니다. 다시 나누거나 처음 나눈 대로 되돌려 주세요.</p>
            )}
            {chapters.length > CHAPTERS_MAX && (
              <p className="text-sm text-destructive">장은 {CHAPTERS_MAX}개까지 올릴 수 있습니다.</p>
            )}
            <ol className="flex flex-col divide-y rounded-lg border">
              {chapters.map((ch, i) => (
                <li key={ch.key} className="flex flex-col gap-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}장</span>
                    <Input
                      value={ch.title}
                      onChange={(e) => updateChapter(ch.key, e.target.value)}
                      maxLength={CHAPTER_TITLE_MAX + 20}
                      aria-label={`${i + 1}장 제목`}
                      aria-invalid={!!problems[i] || undefined}
                    />
                    <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
                      {ch.body.length.toLocaleString()}자
                    </span>
                    <div className="flex shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={openKey === ch.key ? "본문 접기" : "본문 보기"}
                        onClick={() => setOpenKey(openKey === ch.key ? null : ch.key)}
                      >
                        {openKey === ch.key ? <EyeOff /> : <Eye />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="위로" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ChevronUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="아래로"
                        disabled={i === chapters.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${i + 1}장 지우기`} onClick={() => remove(ch.key)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {problems[i] && <p className="pl-12 text-sm text-destructive">{problems[i]}</p>}
                  {!ch.body.trim() && !problems[i] && (
                    <p className="pl-12 text-sm text-muted-foreground">본문이 비어 있습니다.</p>
                  )}
                  {openKey === ch.key && (
                    <div className="reading mx-auto max-h-96 w-full overflow-y-auto rounded-md bg-muted/40 p-4">
                      <Markdown>{ch.body}</Markdown>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* 3. 작품 정보 */}
          <section className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold">3. 작품 정보</h2>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-title`}>제목</Label>
              <Input
                id={`${ids}-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-slug`}>작품 주소</Label>
              <SlugField
                id={`${ids}-slug`}
                value={slugValue}
                onChange={(v) => {
                  setSlugTouched(true);
                  setSlugInput(v);
                }}
                status={slugStatus}
              />
              <p className="text-sm text-muted-foreground">
                제목을 로마자로 바꿔 채웠습니다. 임시 저장 동안에는 고칠 수 있지만, 공개한 뒤에는 바꿀 수 없습니다.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-summary`}>소개</Label>
              <textarea
                id={`${ids}-summary`}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                maxLength={SUMMARY_MAX}
                className={textareaClass}
              />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {summary.length}/{SUMMARY_MAX}
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">라이선스</legend>
              {LICENSES.map((l) => (
                <label key={l.value} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="license"
                    value={l.value}
                    checked={license === l.value}
                    onChange={() => setLicense(l.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">{l.label}</span>
                    {l.value === "CC-BY-SA-4.0" && <span className="text-muted-foreground"> (기본)</span>}
                    <br />
                    <span className="text-muted-foreground">{l.note}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={license !== "ARR" && allowFork}
                disabled={license === "ARR"}
                onCheckedChange={(v) => setAllowFork(v === true)}
              />
              <span>
                갈래 허용{" "}
                <span className="text-muted-foreground">
                  {license === "ARR" ? "— 갈래 금지 라이선스에서는 켤 수 없습니다." : "— 끄면 '여기서 갈라지기' 버튼이 숨겨집니다."}
                </span>
              </span>
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">AI 활용</legend>
              <div className="flex gap-4">
                {AI_USAGES.map((a) => (
                  <label key={a.value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="aiUsage"
                      value={a.value}
                      checked={aiUsage === a.value}
                      onChange={() => setAiUsage(a.value)}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">작품 대문에 표시됩니다. AI로 쓴 글도 올릴 수 있습니다.</p>
            </fieldset>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={rights} onCheckedChange={(v) => setRights(v === true)} className="mt-0.5" />
              <span>
                이 작품을 올릴 권리가 있습니다. 남의 작품을 내 원작처럼 올리면 숨김 처리됩니다.{" "}
                <Link href="/terms" target="_blank" className="underline underline-offset-4">
                  이용약관
                </Link>
              </span>
            </label>
          </section>

          {/* 4. 저장 */}
          <section className="flex flex-col gap-3 border-t pt-6">
            <p className="text-sm text-muted-foreground">
              공개하면 누구나 읽을 수 있고 작품 주소는 더 이상 바꿀 수 없습니다.
              {license !== "ARR" && allowFork && (
                <> 갈래를 허용하면, 나중에 갈래 금지로 바꿔도 이미 나온 갈래는 남습니다(CC 라이선스는 한 번 허락하면 되돌릴 수 없습니다).</>
              )}
            </p>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="lg" disabled={!canSave || pending} onClick={() => save("draft")}>
                임시 저장
              </Button>
              <Button type="button" size="lg" disabled={!canSave || pending} onClick={() => save("public")}>
                {pending ? "저장하는 중…" : "공개"}
              </Button>
            </div>
            {!canSave && !pending && (
              <p className="text-sm text-muted-foreground">
                {!titleOk
                  ? "제목을 적어 주세요."
                  : !chaptersOk
                    ? "장 목록의 문제를 고쳐 주세요."
                    : slugStatus.state !== "ready"
                      ? "작품 주소를 확인해 주세요."
                      : !rights
                        ? "올릴 권리 확인에 체크해 주세요."
                        : null}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
