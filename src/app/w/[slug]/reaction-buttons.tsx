"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Award, Star } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { setCanon, toggleStar } from "./actions";

// 작품 대문의 별 버튼(F7). 로그인 전이면 로그인으로 보낸다. 내 작품에는 보여 주지 않는다.
export function StarButton({
  workId,
  starred,
  viewer,
  returnTo,
}: {
  workId: string;
  starred: boolean;
  /** anon: 로그인 전, onboarding: 필명을 정하기 전, ready: 별을 줄 수 있음 */
  viewer: "anon" | "onboarding" | "ready";
  returnTo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (viewer !== "ready") {
    const href = `/${viewer === "anon" ? "login" : "onboarding"}?next=${encodeURIComponent(returnTo)}`;
    return (
      <Link href={href} className={buttonVariants({ variant: "outline", size: "lg" })}>
        <Star />
        별 주기
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-pressed={starred}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleStar(workId, !starred);
            if (result) setError(result.error);
          });
        }}
      >
        <Star className={starred ? "fill-current" : undefined} />
        {starred ? "별 줌" : "별 주기"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </span>
  );
}

// 정사 인정·해제. 뿌리 원작자에게만 보인다(DB의 set_canon이 다시 확인한다).
export function CanonButton({ workId, isCanon }: { workId: string; isCanon: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={pending}
        className={isCanon ? "border-transparent bg-kind-canon hover:bg-kind-canon hover:brightness-95" : undefined}
        onClick={() => {
          if (isCanon && !confirm("이 갈래의 정사 배지를 뗄까요?")) return;
          setError(null);
          startTransition(async () => {
            const result = await setCanon(workId, !isCanon);
            if (result) setError(result.error);
          });
        }}
      >
        <Award />
        {isCanon ? "정사 해제" : "정사로 인정"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </span>
  );
}
