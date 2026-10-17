import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowRight, PenLine } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { SectionHead, StatRow } from "@/components/ff";
import { buttonVariants } from "@/components/ui/button";
import { WorkCardStrip } from "@/components/work-card";
import { getNewOriginals, getSiteStats, getTopForks, getTrendingOriginals, TRENDING_DAYS } from "@/lib/discover";
import { worksHref } from "@/lib/works-query";

// 홈(F7): 통계, 올리기 안내, 새 원작, 요즘 갈래가 많이 나는 원작, 별 많은 갈래. 광고는 목록 사이(F10).
// 칸은 넓은 화면에서 격자, 모바일에서 옆으로 넘기는 띠다.
export default function Home() {
  return (
    <main className="ff-container flex flex-1 flex-col pb-20">
      <section className="flex flex-col gap-5 pt-6 pb-7 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-8 sm:pt-10 sm:pb-9">
        <div className="flex flex-col gap-2 sm:gap-3">
          <h1 className="text-[32px] leading-[1.1] font-bold tracking-[-0.05em] sm:text-5xl">ForkFiction</h1>
          <p className="text-[15px] tracking-[-0.02em] text-ink-2 sm:text-lg">이 이야기, 여기서부터 당신 버전으로.</p>
        </div>
        <Suspense fallback={<div className="h-[78px] sm:h-[60px] sm:w-80" />}>
          <SiteStatsRow />
        </Suspense>
      </section>

      {/* 올리기 안내. /new가 로그인·필명 정하기를 거쳐 다시 돌아오게 하므로 링크는 하나로 둔다. */}
      <section
        aria-labelledby="home-upload"
        className="mb-10 flex flex-wrap items-center justify-between gap-5 rounded-[28px] bg-surface p-5 sm:mb-14 sm:gap-6 sm:rounded-panel sm:py-7 sm:pr-7 sm:pl-8"
      >
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex shrink-0 gap-1" aria-hidden>
            <span className="h-2.5 w-6 rounded-[5px] bg-kind-original sm:h-14 sm:w-3.5 sm:rounded-[7px]" />
            <span className="h-2.5 w-6 rounded-[5px] bg-kind-fork sm:h-14 sm:w-3.5 sm:rounded-[7px]" />
            <span className="h-2.5 w-6 rounded-[5px] bg-kind-canon sm:h-14 sm:w-3.5 sm:rounded-[7px]" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 id="home-upload" className="text-lg font-bold tracking-[-0.03em] sm:text-xl">
              내 소설 올리기
            </h2>
            <p className="text-sm leading-[1.7] text-ink-2">
              MD 원고를 올리거나 붙여 넣으면 제목(#, ##)을 기준으로 장이 나뉩니다. 공개하면 누구나 원하는 장에서 갈라져
              자기 버전을 이어 쓸 수 있고, 원작자라는 표시는 계보에 끝까지 남습니다.
            </p>
          </div>
        </div>
        <Link href="/new" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
          <PenLine />
          내 소설 올리기
        </Link>
      </section>

      <HomeSection title="새 원작" line="bg-original-line" more={worksHref({ tab: "original", sort: "new", page: 1 })}>
        <NewOriginals more={worksHref({ tab: "original", sort: "new", page: 1 })} />
      </HomeSection>

      <AdSlot id="home-list-1" className="my-9 sm:my-14" />

      <HomeSection
        title="요즘 갈래가 많이 나는 원작"
        note={`최근 ${TRENDING_DAYS}일 동안 공개된 갈래 수`}
        line="bg-original-line"
        more={worksHref({ tab: "original", sort: "forks", page: 1 })}
      >
        <TrendingOriginals more={worksHref({ tab: "original", sort: "forks", page: 1 })} />
      </HomeSection>

      <AdSlot id="home-list-2" className="my-9 sm:my-14" />

      <HomeSection title="별 많은 갈래" line="bg-kind-canon" more={worksHref({ tab: "fork", sort: "stars", page: 1 })}>
        <TopForks more={worksHref({ tab: "fork", sort: "stars", page: 1 })} />
      </HomeSection>
    </main>
  );
}

async function SiteStatsRow() {
  const stats = await getSiteStats();
  return (
    <StatRow
      items={[
        { label: "원작", value: stats.originals },
        { label: "갈래", value: stats.forks },
        { label: "이번 주 새 갈래", value: stats.newForksWeek },
      ]}
    />
  );
}

// 칸마다 개수를 제한해 보여 주고, '전체 보기'는 맞는 탭·정렬로 전체 목록을 연다
function HomeSection({
  title,
  note,
  line,
  more,
  children,
}: {
  title: string;
  note?: string;
  line: string;
  more: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 sm:gap-4" aria-label={title}>
      <SectionHead
        title={title}
        note={note}
        line={line}
        action={
          <Link
            href={more}
            aria-label={`${title} 전체 보기`}
            className={buttonVariants({ variant: "outline", className: "shrink-0 bg-transparent text-[13px] font-semibold" })}
          >
            전체 보기
            <ArrowRight />
          </Link>
        }
      />
      <Suspense fallback={<div className="h-[210px] rounded-card bg-mute/60" />}>{children}</Suspense>
    </section>
  );
}

async function NewOriginals({ more }: { more: string }) {
  return (
    <WorkCardStrip
      works={await getNewOriginals()}
      empty="아직 공개된 원작이 없습니다."
      emptyHint="MD 원고를 올리면 첫 원작이 됩니다."
      more={more}
      moreLabel="새 원작 모두 보기"
    />
  );
}

async function TrendingOriginals({ more }: { more: string }) {
  return (
    <WorkCardStrip
      works={await getTrendingOriginals()}
      empty={`최근 ${TRENDING_DAYS}일 동안 공개된 갈래가 없습니다.`}
      emptyHint="마음에 드는 원작을 골라 첫 갈래를 내 보세요."
      emptyAction={{ href: worksHref({ tab: "original", sort: "new", page: 1 }), label: "원작 둘러보기" }}
      more={more}
      moreLabel="요즘 갈래가 많이 나는 원작 모두 보기"
    />
  );
}

async function TopForks({ more }: { more: string }) {
  return (
    <WorkCardStrip
      works={await getTopForks()}
      empty="아직 별을 받은 갈래가 없습니다."
      emptyHint="갈래를 읽고 별을 주면 이 칸에 올라옵니다."
      emptyAction={{ href: worksHref({ tab: "fork", sort: "new", page: 1 }), label: "갈래 둘러보기" }}
      more={more}
      moreLabel="별 많은 갈래 모두 보기"
    />
  );
}
