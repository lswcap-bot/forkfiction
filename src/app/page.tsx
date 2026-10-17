import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PenLine } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { buttonVariants } from "@/components/ui/button";
import { WorkCardGrid } from "@/components/work-card";
import { getNewOriginals, getTopForks, getTrendingOriginals, TRENDING_DAYS } from "@/lib/discover";

// 홈(F7): 올리기 안내, 새 원작, 요즘 갈래가 많이 나는 원작, 별 많은 갈래. 광고는 목록 사이(F10).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-12">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">ForkFiction</h1>
        <p className="text-muted-foreground">이 이야기, 여기서부터 당신 버전으로.</p>
      </section>

      {/* 올리기 안내. /new가 로그인·필명 정하기를 거쳐 다시 돌아오게 하므로 링크는 하나로 둔다. */}
      <section className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold">내 소설 올리기</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            MD 원고를 올리거나 붙여 넣으면 제목(#, ##)을 기준으로 장이 나뉩니다. 공개하면 누구나 원하는 장에서 갈라져
            자기 버전을 이어 쓸 수 있고, 원작자라는 표시는 계보에 끝까지 남습니다.
          </p>
        </div>
        <Link href="/new" className={buttonVariants({ size: "lg", className: "shrink-0" })}>
          <PenLine />
          내 소설 올리기
        </Link>
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
