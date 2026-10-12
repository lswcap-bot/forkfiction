import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth";

// 프로필 화면. 주소는 /@필명이고, next.config.ts의 rewrite로 이 페이지에 연결된다.
// (app/@handle은 Next가 병렬 라우트로 해석하므로 쓸 수 없다)
// 내 원작·내 갈래·받은 별은 6단계에서 채운다.
export default function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Suspense fallback={null}>
        <ProfileDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ProfileDetail({ params }: Pick<PageProps<"/u/[handle]">, "params">) {
  const { handle } = await params;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio")
    .eq("handle", decodeURIComponent(handle))
    .maybeSingle<Profile>();

  if (!profile) notFound();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{profile.display_name}</h1>
      <p className="text-sm text-muted-foreground">@{profile.handle}</p>
      {profile.bio && <p className="mt-2 whitespace-pre-line">{profile.bio}</p>}
    </div>
  );
}
