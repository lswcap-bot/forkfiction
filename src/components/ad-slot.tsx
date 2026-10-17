import { cn } from "@/lib/utils";

// 광고 자리(PLAN.md F10). 광고는 이 컴포넌트로만 넣는다.
// 작업실·비교·올리기·로그인·관리자 화면에는 넣지 않는다.
//
// 자리 크기를 미리 잡아 두어 광고가 늦게 뜨거나 안 떠도 본문이 출렁이지 않게 한다.
// NEXT_PUBLIC_ADS_ENABLED가 "true"가 아니면(애드센스 승인 전) 회색 자리표시만 보인다.

const SIZES = {
  /** 본문 사이·목록 아래 가로 배너 */
  banner: "h-[100px] w-full max-w-[728px]",
  /** 넓은 화면 오른쪽 여백 세로 배너: 160×600, 1280px 이상에서는 300×600 */
  skyscraper: "h-[600px] w-[160px] xl:w-[300px]",
} as const;

export type AdSlotSize = keyof typeof SIZES;

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

export function AdSlot({ id, size = "banner", className }: { id: string; size?: AdSlotSize; className?: string }) {
  return (
    <aside
      aria-label="광고"
      data-ad-slot={id}
      className={cn("mx-auto flex shrink-0 items-center justify-center", SIZES[size], className)}
    >
      {ADS_ENABLED ? (
        // 애드센스 승인 뒤 이 자리에 광고 코드를 넣는다(7단계)
        null
      ) : (
        <div className="flex size-full items-center justify-center rounded-ad border border-dashed border-[#BEBBB3] bg-mute text-[11px] font-semibold tracking-[0.08em] text-ink-3">
          광고
        </div>
      )}
    </aside>
  );
}
