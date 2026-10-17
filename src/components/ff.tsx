import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// 시안(design/)의 작은 공통 조각: 칩, 필터 알약, 정렬 분절 버튼, 빈 상태, 글자 아바타, 칸 머리.

const CHIP_TONES = {
  /** 정사: 검은 바탕 노란 글자 */
  canon: "bg-ink text-kind-canon",
  /** 임시 저장 등 상태: 흰 바탕 테두리 */
  line: "border border-kind-draft-line bg-surface text-ink-2",
  danger: "bg-destructive/10 text-destructive",
  original: "bg-kind-original text-ink",
  fork: "bg-kind-fork text-ink",
  ink: "bg-ink text-surface",
} as const;

export function Chip({ tone, children, className }: { tone: keyof typeof CHIP_TONES; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-[9px] text-[11px] font-semibold",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 필터 알약(높이 44): 흰 바탕 + 테두리, 오른쪽 개수 배지. 고른 것은 검은 바탕 + 노란 배지 */
export function PillLink({
  href,
  current,
  count,
  children,
}: {
  href: string;
  current: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-2.5 rounded-full border text-sm font-medium transition-colors",
        count === undefined ? "px-[18px]" : "pr-2 pl-[18px]",
        current ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:bg-paper",
      )}
    >
      {children}
      {/* 개수는 보이기만 한다. 링크의 접근성 이름은 탭 이름 그대로 둔다 */}
      {count !== undefined && (
        <span
          aria-hidden
          className={cn(
            "inline-grid h-[26px] min-w-[26px] place-items-center rounded-full px-2 text-xs font-semibold tabular-nums",
            current ? "bg-kind-canon text-ink" : "bg-line-soft",
          )}
        >
          {count.toLocaleString()}
        </span>
      )}
    </Link>
  );
}

/** 정렬: 회색 트랙 안의 분절 버튼, 고른 것만 흰 바탕 + 그림자 */
export function SegmentedNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; current: boolean }[];
}) {
  return (
    <nav aria-label={label} className="inline-flex gap-0.5 rounded-full bg-mute p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors",
            item.current ? "bg-surface text-ink shadow-ff-1" : "text-ink-2 hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** 빈 상태: 카드 자리와 같은 높이의 점선 상자 + 문구(+ 보조 버튼) */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[150px] flex-wrap items-center gap-5 rounded-card border-[1.5px] border-dashed border-kind-draft-line bg-paper p-6",
        className,
      )}
    >
      <div className="flex shrink-0 gap-1" aria-hidden>
        <span className="h-11 w-2.5 rounded-[5px] bg-kind-original" />
        <span className="h-11 w-2.5 rounded-[5px] bg-kind-fork" />
        <span className="h-11 w-2.5 rounded-[5px] bg-ink/12" />
      </div>
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
        <p className="text-[15px] font-bold">{title}</p>
        {hint && <p className="text-[13px] leading-relaxed text-ink-2">{hint}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex h-11 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-[13px] font-semibold hover:bg-paper"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** 프로필 사진이 없으므로 필명 첫 글자(로마자면 두 글자)로 아바타를 그린다 */
export function initials(name: string) {
  const chars = [...name.trim()];
  if (chars.length === 0) return "?";
  return /[a-z0-9]/i.test(chars[0]) ? chars.slice(0, 2).join("").toLowerCase() : chars[0];
}

export function InitialAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-[38px] shrink-0 place-items-center rounded-full bg-surface text-[13px] font-semibold", className)}
    >
      {initials(name)}
    </span>
  );
}

/** 칸 머리: 위 4px 색 선, 제목(+ 설명), 오른쪽 링크 */
export function SectionHead({
  title,
  note,
  line,
  action,
}: {
  title: ReactNode;
  note?: ReactNode;
  line?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {line && <div className={cn("h-1 rounded-sm", line)} aria-hidden />}
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-3">
          <h2 className="text-[17px] font-bold tracking-[-0.03em] sm:text-xl">{title}</h2>
          {note && <p className="text-xs font-medium text-ink-3 sm:text-[13px]">{note}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

/** 통계 한 칸: 작은 이름 + 가는 큰 숫자 */
export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-surface p-3.5 sm:gap-2 sm:rounded-none sm:bg-transparent sm:p-0">
      <dt className="text-[11px] font-medium text-ink-3 sm:text-xs">{label}</dt>
      <dd className="text-[28px] leading-none font-light tracking-[-0.04em] tabular-nums sm:text-[40px]">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

export function StatRow({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:flex sm:gap-12">
      {items.map((i) => (
        <Stat key={i.label} {...i} />
      ))}
    </dl>
  );
}
