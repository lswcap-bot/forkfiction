import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ad-slot";
import { InitialAvatar, SectionHead } from "@/components/ff";
import { WorkCardGrid } from "@/components/work-card";
import { getWorksByOwner } from "@/lib/discover";
import { createClient } from "@/lib/supabase/server";

// 프로필 화면. 주소는 /@필명이고, next.config.ts의 rewrite로 이 페이지에 연결된다.
// (app/@handle은 Next가 병렬 라우트로 해석하므로 쓸 수 없다)
// 내 원작, 내 갈래, 받은 별. 본인이 보면 임시 저장·숨긴 작품도 함께 나온다. 광고는 목록 아래 1개(F10).
export default function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  return (
    <main className="ff-container flex flex-1 flex-col gap-10 pt-6 pb-20 sm:pt-10">
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
    .maybeSingle<{ id: string; handle: string; display_name: string; bio: string | null }>();

  if (!profile) notFound();

  const { originals, forks, stars } = await getWorksByOwner(profile.id);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6 sm:flex-row sm:items-center sm:gap-5 sm:rounded-panel sm:p-8">
        <InitialAvatar name={profile.display_name} className="size-16 bg-kind-original text-xl" />
        <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold tracking-[-0.04em] sm:text-4xl">{profile.display_name}</h1>
        <p className="text-sm text-ink-2">
          @{profile.handle} · 받은 별 <span className="tabular-nums">{stars.toLocaleString()}</span>
        </p>
        {profile.bio && <p className="mt-1 leading-relaxed whitespace-pre-line">{profile.bio}</p>}
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHead line="bg-original-line" title={`원작 ${originals.length.toLocaleString()}`} />
        <WorkCardGrid works={originals} empty="아직 원작이 없습니다." />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead line="bg-kind-fork" title={`갈래 ${forks.length.toLocaleString()}`} />
        <WorkCardGrid works={forks} empty="아직 갈래가 없습니다." />
      </section>

      <AdSlot id="profile-below-list" />
    </>
  );
}
