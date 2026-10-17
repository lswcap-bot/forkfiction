"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

// 화면을 그리다 난 오류. 머리글은 그대로 두고 이 자리만 바꾼다.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">문제가 생겼습니다</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        잠시 뒤 다시 시도해 주세요. 계속되면 lswcap@naver.com으로 알려 주세요.
        {error.digest && (
          <>
            <br />
            <span className="font-mono text-xs">오류 번호 {error.digest}</span>
          </>
        )}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>다시 시도</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          홈으로
        </Link>
      </div>
    </main>
  );
}
