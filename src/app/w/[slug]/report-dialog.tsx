"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Flag } from "lucide-react";
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
import { REPORT_DETAIL_MAX, REPORT_REASONS, type ReportReason } from "@/lib/work-meta";
import { reportContent } from "./actions";

type Props = {
  workId: string;
  /** 장 신고면 그 장 id, 작품 신고면 null */
  chapterId: string | null;
  /** 창 제목에 쓰는 대상 이름: 『칼의 여행』 또는 『칼의 여행』 3장 */
  target: string;
  viewer: "anon" | "onboarding" | "ready";
  returnTo: string;
};

// 작품·장 신고(F9): 표절, 불법 콘텐츠, 음란·폭력, 기타. 누가 신고했는지는 관리자만 본다.
export function ReportDialog({ workId, chapterId, target, viewer, returnTo }: Props) {
  const trigger = (
    <>
      <Flag />
      신고
    </>
  );
  const triggerClass = buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground" });

  if (viewer !== "ready") {
    const href = `/${viewer === "anon" ? "login" : "onboarding"}?next=${encodeURIComponent(returnTo)}`;
    return (
      <Link href={href} className={triggerClass}>
        {trigger}
      </Link>
    );
  }

  return (
    <Dialog>
      <DialogTrigger className={triggerClass}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <ReportForm workId={workId} chapterId={chapterId} target={target} />
      </DialogContent>
    </Dialog>
  );
}

function ReportForm({ workId, chapterId, target }: Pick<Props, "workId" | "chapterId" | "target">) {
  const ids = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <DialogHeader>
        <DialogTitle>신고했습니다</DialogTitle>
        <DialogDescription>관리자가 확인한 뒤 필요하면 작품을 숨깁니다. 신고한 사람은 작가에게 알리지 않습니다.</DialogDescription>
      </DialogHeader>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const result = await reportContent({ workId, chapterId, reason, detail });
      if ("error" in result) setError(result.error);
      else setDone(true);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{target} 신고</DialogTitle>
        <DialogDescription>신고한 사람은 관리자만 볼 수 있습니다.</DialogDescription>
      </DialogHeader>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">사유</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${ids}-reason`}
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="size-4 accent-foreground"
            />
            {r.label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-detail`} className="text-sm font-medium">
          자세한 내용 <span className="font-normal text-muted-foreground">(선택)</span>
        </label>
        <textarea
          id={`${ids}-detail`}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={REPORT_DETAIL_MAX}
          rows={4}
          placeholder={reason === "plagiarism" ? "원본 작품의 제목이나 주소를 적어 주세요." : ""}
          className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {detail.length.toLocaleString()} / {REPORT_DETAIL_MAX.toLocaleString()}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={!reason || pending}>
          {pending ? "신고하는 중…" : "신고하기"}
        </Button>
      </DialogFooter>
    </form>
  );
}
