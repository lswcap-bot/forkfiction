import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "필명 정하기" };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-[-0.04em] sm:text-4xl">필명 정하기</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          필명은 작품 주소와 계보에 남습니다. 한 번 정하면 바꿀 수 없으니 신중히 골라 주세요.
        </p>
      </div>
      <Suspense fallback={null}>
        <Onboarding searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/onboarding");
  if (viewer.profile) redirect(next);

  return <OnboardingForm next={next} defaultDisplayName={viewer.googleName?.slice(0, 30) ?? ""} />;
}
