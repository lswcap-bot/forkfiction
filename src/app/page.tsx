import { Suspense, type ReactNode } from "react";
import { AdSlot } from "@/components/ad-slot";
import { WorkCardGrid } from "@/components/work-card";
import { getNewOriginals, getTopForks, getTrendingOriginals, TRENDING_DAYS } from "@/lib/discover";

// 홈(F7): 새 원작, 요즘 갈래가 많이 나는 원작, 별 많은 갈래. 광고는 목록 사이(F10).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-12">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">ForkFiction</h1>
        <p className="text-muted-foreground">이 이야기, 여기서부터 당신 버전으로.</p>
      </section>

      <HomeSection title="새 원작">
        <NewOriginals />
      </HomeSection>

      <AdSlot id="home-list-1" />

      <HomeSection title="요즘 갈래가 많이 나는 원작" note={`최근 ${TRENDING_DAYS}일 동안 공개된 갈래 수`}>
        <TrendingOriginals />
      </HomeSection>

      <AdSlot id="home-list-2" />

      <HomeSection title="별 많은 갈래">
        <TopForks />
      </HomeSection>
    </main>
  );
}

function HomeSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      <Suspense fallback={<div className="h-40 rounded-lg bg-muted/40" />}>{children}</Suspense>
    </section>
  );
}

async function NewOriginals() {
  return <WorkCardGrid works={await getNewOriginals()} empty="아직 공개된 원작이 없습니다." />;
}

async function TrendingOriginals() {
  return <WorkCardGrid works={await getTrendingOriginals()} empty={`최근 ${TRENDING_DAYS}일 동안 공개된 갈래가 없습니다.`} />;
}

async function TopForks() {
  return <WorkCardGrid works={await getTopForks()} empty="아직 별을 받은 갈래가 없습니다." />;
}
