import Link from "next/link";

// 관리자가 숨긴 작품 안내. 숨긴 작품은 작가와 관리자만 읽을 수 있다(그 밖의 사람에게는 404).
export function HiddenNotice({ isOwner }: { isOwner: boolean }) {
  return (
    <section role="status" className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="font-medium text-destructive">관리자에 의해 숨겨진 작품입니다</h2>
      {isOwner ? (
        <p className="text-sm text-muted-foreground">
          지금은 나만 볼 수 있습니다. 다른 사람의 계보에는 제목 없이 &lsquo;숨겨진 작품&rsquo;으로 표시되고, 이 작품의 갈래는 그대로 남습니다.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          작가와 관리자만 볼 수 있습니다.{" "}
          <Link href="/admin?tab=hidden" className="underline underline-offset-4">
            관리 화면에서 복구
          </Link>
        </p>
      )}
    </section>
  );
}
