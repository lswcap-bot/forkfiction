import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <p className="text-sm text-muted-foreground">
          로그인하면 작품을 올리고, 원하는 장에서 갈래를 낼 수 있습니다.
        </p>
      </div>
      <Suspense fallback={<div className="h-9" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const failed = params.error !== undefined;

  const viewer = await getViewer();
  if (viewer) redirect(viewer.profile ? next : `/onboarding?next=${encodeURIComponent(next)}`);

  return (
    <div className="flex flex-col gap-3">
      {failed && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          로그인을 마치지 못했습니다. 다시 시도해 주세요.
        </p>
      )}
      <GoogleButton next={next} />
    </div>
  );
}
