import type { Metadata } from "next";
import Link from "next/link";
import { PillLink } from "@/components/ff";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reportReasonLabel } from "@/lib/work-meta";
import { AdminButton } from "./admin-button";

export const metadata: Metadata = { title: "관리" };

// 관리자 화면(F9): 열린 신고 목록과 숨긴 작품. profiles.is_admin인 사람만 들어오고, 그 밖에는 404.
// 광고 없음(F10).
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto flex w-full max-w-[912px] flex-1 flex-col gap-6 px-4 pt-6 pb-20 sm:pt-10">
      <Suspense fallback={null}>
        <AdminView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const LIST_LIMIT = 200;
const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

async function AdminView({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const viewer = await getViewer();
  if (!viewer?.profile?.is_admin) notFound();

  const { tab } = await searchParams;
  const current = tab === "hidden" ? "hidden" : "reports";

  return (
    <>
      <h1 className="text-[28px] font-bold tracking-[-0.04em] sm:text-4xl">관리</h1>
      <nav className="flex gap-2" aria-label="관리 탭">
        {(
          [
            ["reports", "열린 신고"],
            ["hidden", "숨긴 작품"],
          ] as const
        ).map(([key, label]) => (
          <PillLink key={key} href={key === "reports" ? "/admin" : "/admin?tab=hidden"} current={current === key}>
            {label}
          </PillLink>
        ))}
      </nav>
      {current === "reports" ? <OpenReports /> : <HiddenWorks />}
    </>
  );
}

type ReportRow = {
  id: string;
  reason: string;
  detail: string | null;
  created_at: string;
  work: { id: string; slug: string; title: string; visibility: string; owner: { handle: string; display_name: string } };
  chapter: { position: number } | null;
  reporter: { handle: string; display_name: string };
};

async function OpenReports() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, reason, detail, created_at, " +
        "work:works(id, slug, title, visibility, owner:profiles!works_owner_id_fkey(handle, display_name)), " +
        "chapter:chapters(position), reporter:profiles!reports_reporter_id_fkey(handle, display_name)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT)
    .returns<ReportRow[]>();
  if (error) throw error;

  if (data.length === 0) return <Empty>열린 신고가 없습니다.</Empty>;

  return (
    <ol className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-card bg-surface">
      {data.map((r) => {
        const href = r.chapter ? `/w/${r.work.slug}/${r.chapter.position}` : `/w/${r.work.slug}`;
        return (
          <li key={r.id} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">{reportReasonLabel(r.reason)}</span>
              <Link href={href} className="font-serif font-medium hover:underline">
                『{r.work.title}』{r.chapter && ` ${r.chapter.position}장`}
              </Link>
              <span className="text-sm text-muted-foreground">
                작가 {r.work.owner.display_name} @{r.work.owner.handle}
              </span>
            </div>
            {r.detail && <p className="text-sm whitespace-pre-line">{r.detail}</p>}
            <p className="text-xs text-muted-foreground">
              신고 {r.reporter.display_name} @{r.reporter.handle} · {dateFormat.format(new Date(r.created_at))}
            </p>
            <div className="flex flex-wrap gap-2">
              <AdminButton action="hide" id={r.work.id} confirmText={`『${r.work.title}』을(를) 숨길까요? 이 작품의 열린 신고가 모두 처리됨으로 닫힙니다.`}>
                작품 숨기기
              </AdminButton>
              <AdminButton action="dismiss" id={r.id}>
                기각
              </AdminButton>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type HiddenRow = {
  id: string;
  slug: string;
  title: string;
  hidden_from: "draft" | "public";
  hidden_at: string | null;
  owner: { handle: string; display_name: string };
  reports: { reason: string; status: string }[];
};

async function HiddenWorks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .select("id, slug, title, hidden_from, hidden_at, owner:profiles!works_owner_id_fkey(handle, display_name), reports(reason, status)")
    .eq("visibility", "hidden")
    .order("hidden_at", { ascending: false, nullsFirst: false })
    .limit(LIST_LIMIT)
    .returns<HiddenRow[]>();
  if (error) throw error;

  if (data.length === 0) return <Empty>숨긴 작품이 없습니다.</Empty>;

  return (
    <ol className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-card bg-surface">
      {data.map((w) => {
        const reasons = [...new Set(w.reports.filter((r) => r.status === "resolved").map((r) => reportReasonLabel(r.reason)))];
        return (
          <li key={w.id} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link href={`/w/${w.slug}`} className="font-serif font-medium hover:underline">
                『{w.title}』
              </Link>
              <span className="text-sm text-muted-foreground">
                작가 {w.owner.display_name} @{w.owner.handle}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {w.hidden_at && `${dateFormat.format(new Date(w.hidden_at))}에 숨김 · `}
              복구하면 {w.hidden_from === "public" ? "공개" : "임시 저장"} 상태로 돌아갑니다
              {reasons.length > 0 && ` · 신고 사유: ${reasons.join(", ")}`}
            </p>
            <div>
              <AdminButton action="restore" id={w.id}>
                복구
              </AdminButton>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card border-[1.5px] border-dashed border-kind-draft-line px-4 py-10 text-center text-sm leading-relaxed text-ink-2">{children}</p>;
}
