"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { GitFork } from "lucide-react";
import { SlugField, useSlugCheck } from "@/components/slug-field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORK_NOTE_MAX, forkInputProblem } from "@/lib/fork-input";
import { randomSlug, titleToSlug } from "@/lib/slug";
import { TITLE_MAX } from "@/lib/work-meta";
import { forkWork } from "../actions";

type Props = {
  workId: string;
  workTitle: string;
  position: number;
  licenseLabel: string;
  /** anon: 로그인 전, onboarding: 필명을 정하기 전, ready: 갈래를 낼 수 있음 */
  viewer: "anon" | "onboarding" | "ready";
  /** 로그인·온보딩 뒤 돌아올 주소 */
  returnTo: string;
};

// 여기서 갈라지기: 갈래 제목, 한 줄 소개(필수), 주소. 라이선스는 원작 조건을 그대로 따른다.
export function ForkDialog({ workId, workTitle, position, licenseLabel, viewer, returnTo }: Props) {
  if (viewer !== "ready") {
    const href = viewer === "anon" ? `/login?next=${encodeURIComponent(returnTo)}` : `/onboarding?next=${encodeURIComponent(returnTo)}`;
    return (
      <Link href={href} className={buttonVariants({ size: "lg" })}>
        <GitFork />
        여기서 갈라지기
      </Link>
    );
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="lg" />}>
        <GitFork />
        여기서 갈라지기
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <ForkForm workId={workId} workTitle={workTitle} position={position} licenseLabel={licenseLabel} />
      </DialogContent>
    </Dialog>
  );
}

function ForkForm({ workId, workTitle, position, licenseLabel }: Omit<Props, "viewer" | "returnTo">) {
  const ids = useId();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fallbackSlug] = useState(randomSlug);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const slugValue = slugTouched ? slugInput : (titleToSlug(title) ?? fallbackSlug);
  const slugStatus = useSlugCheck(slugValue);
  const problem = forkInputProblem({ title, note });
  const canSubmit = !problem && slugStatus.state === "ready" && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || slugStatus.state !== "ready") return;
    setError(null);
    startTransition(async () => {
      const result = await forkWork({
        sourceWorkId: workId,
        position,
        title,
        note,
        slug: slugStatus.slug,
        slugInput: slugStatus.input,
      });
      // 성공하면 작업실로 이동하므로 돌아오는 것은 오류뿐이다
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{position}장에서 갈라지기</DialogTitle>
        <DialogDescription>
          {position > 1 ? `『${workTitle}』의 ${position === 2 ? "1" : `1~${position - 1}`}장은 그대로 물려받고, ` : `『${workTitle}』을 `}
          {position}장부터 내 버전으로 고쳐 씁니다. {position + 1}장 이후는 가져오지 않습니다.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-title`}>갈래 제목</Label>
        <Input
          id={`${ids}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="울라의 길"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-note`}>한 줄 소개</Label>
        <Input
          id={`${ids}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={FORK_NOTE_MAX}
          placeholder="울라가 떠나지 않았다면"
          aria-describedby={`${ids}-note-help`}
        />
        <p id={`${ids}-note-help`} className="text-sm text-muted-foreground">
          갈래 지도에 이 문장이 보입니다. ({note.trim().length}/{FORK_NOTE_MAX})
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-slug`}>갈래 주소</Label>
        <SlugField
          id={`${ids}-slug`}
          value={slugValue}
          onChange={(v) => {
            setSlugTouched(true);
            setSlugInput(v);
          }}
          status={slugStatus}
        />
        <p className="text-sm text-muted-foreground">임시 저장 동안에는 바꿀 수 있고, 공개한 뒤에는 바꿀 수 없습니다.</p>
      </div>

      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        라이선스: 원작과 같은 <strong className="font-medium text-foreground">{licenseLabel}</strong>이 자동으로
        적용되고 바꿀 수 없습니다. 갈래 대문에는 계보(『{workTitle}』 → {position}장에서 → 내 갈래)가 항상 표시됩니다.
      </p>

      {(error || (problem && (title || note))) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? problem}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {pending ? "만드는 중…" : "갈래 만들기"}
        </Button>
      </DialogFooter>
    </form>
  );
}
