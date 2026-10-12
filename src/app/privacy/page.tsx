import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보 처리방침 · ForkFiction" };

// 7단계(출시 준비)에서 실제 처리방침으로 채운다.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">개인정보 처리방침</h1>
      <p className="text-muted-foreground">준비 중입니다.</p>
    </main>
  );
}
