import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "새 작품 올리기 · ForkFiction" };

// 새 작품 올리기. 로그인하고 필명·약관 동의를 마친 사용자만 쓸 수 있다.
// 광고를 넣지 않는 화면이다(PLAN.md F10).
export default function NewWorkPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">새 작품 올리기</h1>
        <p className="text-sm text-muted-foreground">
          MD 원고를 올리면 제목(#, ##)을 기준으로 장을 나눕니다. 나눈 결과를 확인하고 고친 뒤 저장하세요.
        </p>
      </div>
      <Suspense fallback={null}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/new");
  if (!viewer.profile) redirect("/onboarding?next=/new");
  return <UploadForm />;
}
